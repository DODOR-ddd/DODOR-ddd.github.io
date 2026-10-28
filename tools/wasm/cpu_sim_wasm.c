/* cpu_sim_wasm.c — browser port of ~/project/cpu_sim.c
 *
 * Same simulated CPU (4 regs, 256B memory, context-stack interrupts),
 * but the POSIX bits move to the browser:
 *   - SIGINT/SIGUSR1 delivery  -> sim_raise(2 | 10), called from a button
 *   - usleep main loop         -> sim_tick(), called from a JS clock
 *   - printf                   -> Emscripten Module.print (serial panel)
 * Build: see tools/wasm/build.sh (emcc, --no-entry).
 */
#include <emscripten.h>
#include <stdio.h>
#include <string.h>
#include <stdatomic.h>

#define NREGS 4
#define MEMSZ 256

enum {
    OP_LDI = 0x10, OP_ADD = 0x11, OP_MOV = 0x12,
    OP_STA = 0x20, OP_LDA = 0x21, OP_RETI = 0x2F,
    OP_JMP = 0x30, OP_JNZ = 0x31,
    OP_OUT = 0x40,
    OP_HLT = 0xF0,
};

#define VECTOR_MAIN    0x00
#define VECTOR_SIGINT  0x20
#define VECTOR_SIGUSR1 0x30
#define DATA_BASE      0x80

#define SIGINT_C  2
#define SIGUSR1_C 10

typedef struct {
    int pc;
    int reg[NREGS];
    unsigned char mem[MEMSZ];
    int halted;
} cpu_t;

#define CTX_MAX 4
typedef struct { int pc, reg[NREGS]; } ctx_frame_t;
static ctx_frame_t ctx_stack[CTX_MAX];
static int ctx_sp = 0;

static cpu_t cpu;
static volatile atomic_int pending_sig = 0;

static const char *sig_name(int s)
{
    return s == SIGINT_C ? "SIGINT" : s == SIGUSR1_C ? "SIGUSR1" : "?";
}

static void dump_ctx(const char *when)
{
    printf("   [ctx %s] PC=%02Xh", when, cpu.pc);
    for (int i = 0; i < NREGS; i++)
        printf(" R%d=%d", i, cpu.reg[i]);
    printf(" depth=%d\n", ctx_sp);
}

static void push_context(void)
{
    if (ctx_sp >= CTX_MAX) {
        printf("context stack overflow\n");
        cpu.halted = 1;
        return;
    }
    ctx_stack[ctx_sp].pc = cpu.pc;
    memcpy(ctx_stack[ctx_sp].reg, cpu.reg, sizeof(cpu.reg));
    ctx_sp++;
}

static void pop_context(void)
{
    ctx_sp--;
    cpu.pc = ctx_stack[ctx_sp].pc;
    memcpy(cpu.reg, ctx_stack[ctx_sp].reg, sizeof(cpu.reg));
}

static void dispatch_pending(void)
{
    int sig = atomic_exchange(&pending_sig, 0);
    if (!sig)
        return;

    int vector = (sig == SIGINT_C) ? VECTOR_SIGINT : VECTOR_SIGUSR1;
    printf(">> interrupt: %s -> vector %02Xh\n", sig_name(sig), vector);
    dump_ctx("before");
    push_context();
    cpu.pc = vector;
    dump_ctx("enter ");
}

static int imm7(unsigned char arg)
{
    int v = arg & 0x7F;
    return (v & 0x40) ? v - 128 : v;
}

static void step(void)
{
    unsigned char op = cpu.mem[cpu.pc];
    unsigned char arg = cpu.mem[cpu.pc + 1];
    int *A = &cpu.reg[0];

    switch (op) {
    case OP_LDI: cpu.reg[arg] = (signed char)cpu.mem[cpu.pc + 2]; cpu.pc += 3; break;
    case OP_ADD: *A += imm7(arg);                    cpu.pc += 2; break;
    case OP_MOV: cpu.reg[arg >> 2] = cpu.reg[arg & 3]; cpu.pc += 2; break;
    case OP_STA: cpu.mem[arg] = (unsigned char)*A;   cpu.pc += 2; break;
    case OP_LDA: *A = cpu.mem[arg];                  cpu.pc += 2; break;
    case OP_JMP: cpu.pc = arg;                       break;
    case OP_JNZ: cpu.pc = (*A != 0) ? arg : cpu.pc + 2; break;
    case OP_OUT: printf("   [out] R%d = %d\n", arg & 3, cpu.reg[arg & 3]); cpu.pc += 2; break;
    case OP_RETI:
        printf(">> RETI\n");
        dump_ctx("saved ");
        pop_context();
        dump_ctx("after ");
        break;
    case OP_HLT: cpu.halted = 1;                     break;
    default:
        printf("illegal opcode %02Xh at %02Xh\n", op, cpu.pc);
        cpu.halted = 1;
    }
}

static void emit(int *p, unsigned char op, unsigned char arg)
{
    cpu.mem[(*p)++] = op;
    cpu.mem[(*p)++] = arg;
}

static void emit_ldi(int *p, int reg, int imm)
{
    cpu.mem[(*p)++] = OP_LDI;
    cpu.mem[(*p)++] = (unsigned char)reg;
    cpu.mem[(*p)++] = (unsigned char)imm;
}

EMSCRIPTEN_KEEPALIVE
void sim_reset(void)
{
    int p;
    memset(&cpu, 0, sizeof(cpu));
    ctx_sp = 0;
    atomic_store(&pending_sig, 0);

    p = VECTOR_MAIN;                        /* countdown 5..1 then idle loop */
    emit_ldi(&p, 1, 5);
    emit(&p, OP_MOV, (0u << 2) | 1);
    emit(&p, OP_STA, DATA_BASE);
    emit(&p, OP_OUT, 1);
    emit(&p, OP_ADD, (unsigned char)(-1) & 0x7F);
    emit(&p, OP_MOV, (1u << 2) | 0);
    emit(&p, OP_JNZ, 0x03);
    emit(&p, OP_JMP, 0x03);

    p = VECTOR_SIGINT;                      /* print cell, overwrite with 42 */
    emit(&p, OP_LDA, DATA_BASE);
    emit(&p, OP_OUT, 0);
    emit_ldi(&p, 0, 42);
    emit(&p, OP_STA, DATA_BASE);
    emit(&p, OP_RETI, 0);

    p = VECTOR_SIGUSR1;                     /* R2 = 1 flag */
    emit_ldi(&p, 2, 1);
    emit(&p, OP_RETI, 0);

    cpu.pc = VECTOR_MAIN;
    printf("simulated CPU reset. program loaded at 0x00, ISRs at 0x20/0x30\n");
}

EMSCRIPTEN_KEEPALIVE
void sim_raise(int signo) { atomic_store(&pending_sig, signo); }

EMSCRIPTEN_KEEPALIVE
void sim_tick(void)
{
    if (cpu.halted)
        return;
    dispatch_pending();
    if (!cpu.halted)
        step();
    if (cpu.halted)
        printf("CPU halted. mem[0x%02X] = %d\n", DATA_BASE, cpu.mem[DATA_BASE]);
}

EMSCRIPTEN_KEEPALIVE
int  sim_halted(void) { return cpu.halted; }
EMSCRIPTEN_KEEPALIVE
int  sim_pc(void)     { return cpu.pc; }
EMSCRIPTEN_KEEPALIVE
int  sim_reg(int i)   { return (i >= 0 && i < NREGS) ? cpu.reg[i] : 0; }
EMSCRIPTEN_KEEPALIVE
int  sim_ctx_sp(void) { return ctx_sp; }
EMSCRIPTEN_KEEPALIVE
unsigned char *sim_mem(void) { return cpu.mem; }
