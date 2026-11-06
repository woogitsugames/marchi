#!/bin/bash
# frame10 matrix: day-9 base (5f1542e, port 5198) vs current (port 5199), interleaved, two runs each.
# Usage: bash docs/research/frame10-data/run.sh [runs="1 2"]
cd "$(dirname "$0")/../../.."
D=docs/research/frame10-data
for r in ${1:-1 2}; do
  for c in "sandbox100 high" "sandbox200 high" "m12 high" "sandbox200 low" "m15 high"; do
    set -- $c
    for v in base:5198 cur:5199; do
      tag=${v%%:*}; port=${v##*:}
      [ "$tag" = base ] && [ "$1" = m15 ] && continue
      f=$D/$tag-$1-$2-r$r.json
      [ -s $f ] && continue
      echo "$(date +%T) $(cut -d' ' -f1-3 /proc/loadavg) $tag $c r$r" >> $D/runs.log
      timeout 600 node tools/frame9-cost.mjs http://127.0.0.1:$port $1 $2 near,mid 3 > $f 2>>$D/stderr.log || echo "FAIL $tag $c r$r" >> $D/runs.log
    done
  done
done
echo "$(date +%T) ALLDONE" >> $D/runs.log
