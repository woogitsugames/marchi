#!/bin/bash
# frame9 matrix: priority order first; two runs each. Usage: bash docs/research/frame9-data/run.sh
cd "$(dirname "$0")/../../.."
D=docs/research/frame9-data
for r in 1 2; do
  for c in "sandbox100 high" "m12 high" "sandbox200 high" "sandbox100 low" "sandbox50 low" "sandbox50 high" "sandbox200 low" "m13 high" "m12 low"; do
    set -- $c; f=$D/$1-$2-r$r.json
    [ -s $f ] && continue
    echo "$(date +%T) $(cut -d' ' -f1-3 /proc/loadavg) $c r$r" >> $D/runs.log
    timeout 600 node tools/frame9-cost.mjs http://127.0.0.1:5199 $1 $2 near,mid 3 > $f 2>>$D/stderr.log || echo "FAIL $c r$r" >> $D/runs.log
  done
done
echo "$(date +%T) ALLDONE" >> $D/runs.log
