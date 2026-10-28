---
title: 把 CPU 模拟器编译成 WASM：在浏览器里玩中断
date: 2026-10-28 21:30:00
categories:
  - 技术
tags:
  - WebAssembly
  - C
  - cpu_sim
---

之前写过一个小的 CPU 模拟器（[cpu_sim.c](https://github.com/DODOR-ddd)）：4 个寄存器、256 字节内存，重点是把 POSIX 信号（SIGINT / SIGUSR1）当作中断线——信号 handler 只置一个 pending 标志（async-signal-safe），真正的派发发生在**指令边界**：保存 PC + 寄存器到上下文栈，跳到 ISR，RETI 恢复现场。

最近把它编译成了 WebAssembly，现在可以直接在浏览器里玩：

**→ [demo/cpu-sim/](/demo/cpu-sim/)**

<!-- more -->

## 移植时的三个映射

浏览器没有 POSIX，对应关系其实很自然：

| 原版 | WASM 版 |
| ---- | ---- |
| `kill -INT` / Ctrl-C | 页面按钮 → 导出函数 `sim_raise(2)` |
| `while(!halted) { ...; usleep(300ms); }` | JS 时钟 `setInterval(() => sim_tick(), 1000/hz)` |
| `printf` 到终端 | Emscripten 把 stdout 重定向到 `Module.print`，画到串口面板 |

核心语义一行没改：中断依旧只在指令边界派发，`pending_sig` 依旧是原子的"只置不查"。所以你在浏览器里看到的行为和本地跑 `./cpu_sim` 完全一致——包括中断打在 `STA` 之前时，数据格还没被写入这种时序细节。

## 怎么玩

1. **Run** 开始倒计时（3 Hz 慢时钟，方便观察）
2. 运行中点 **⚡ SIGINT**：ISR 会读 `mem[0x80]`、打印、覆写成 42、RETI
3. 点 **⚡ SIGUSR1**：ISR 置 `R2 = 1` 当标志
4. 留意 REGISTERS 面板的 **ctx stack depth**：进 ISR +1，RETI -1，嵌套中断最深 4 层
5. MEMORY 面板绿色高亮是 PC，黄色是数据格

构建方式在仓库 `tools/wasm/`（emcc，`--no-entry`，产物 7.5 KB）。
