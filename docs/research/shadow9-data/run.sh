#!/bin/sh
# sandbox100, camera 60 m, 4 synthetic seconds per run; server: vite preview --port 5199 --outDir dist-perf9 (unpatched build)
cd "$(dirname "$0")/../../.."
for q in ${QS:-high low}; do
  for m in ${MODES:-base a b c}; do
    SHADOW_MODE=$([ $m = base ] && echo "" || echo $m) node tools/frame9-cost.mjs http://localhost:5199/ sandbox100 $q near 4 > docs/research/shadow9-data/$m-$q${SUF:-}.json 2>/dev/null
    echo "$m $q done"
  done
done
