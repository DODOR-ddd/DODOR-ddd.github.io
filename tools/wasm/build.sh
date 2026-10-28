#!/usr/bin/env bash
# Build cpu_sim WASM module into the blog's demo page assets.
# Usage: source ~/emsdk/emsdk_env.sh && ./tools/wasm/build.sh
set -euo pipefail
cd "$(dirname "$0")"

OUT="../../source/demo/cpu-sim"
mkdir -p "$OUT"

emcc cpu_sim_wasm.c -O3 --no-entry \
    -sEXPORTED_FUNCTIONS=_sim_reset,_sim_raise,_sim_tick,_sim_halted,_sim_pc,_sim_reg,_sim_ctx_sp,_sim_mem \
    -sEXPORTED_RUNTIME_METHODS=HEAPU8,cwrap \
    -sMODULARIZE=1 -sEXPORT_NAME=CreateCpuSim \
    -sALLOW_MEMORY_GROWTH=0 \
    -o "$OUT/cpu_sim.js"

echo "built: $OUT/cpu_sim.js + $OUT/cpu_sim.wasm"
