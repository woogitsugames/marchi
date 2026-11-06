#!/bin/bash
# frame10 after the fixes: before = start of the day (9c5078e, port 5199) vs after (port 5195), interleaved, two runs.
cd "$(dirname "$0")/../../.."
D=docs/research/frame10-data/after
mkdir -p $D
for r in 1 2; do
  for c in "m12 high" "sandbox200 high" "m15 high"; do
    set -- $c
    for v in before:5199 after:5195; do
      tag=${v%%:*}; port=${v##*:}; f=$D/$tag-$1-$2-r$r.json
      [ -s $f ] && continue
      echo "$(date +%T) $(cut -d' ' -f1-3 /proc/loadavg) $tag $c r$r" >> $D/runs.log
      timeout 900 node tools/frame9-cost.mjs http://127.0.0.1:$port $1 $2 near,mid 3 > $f 2>>$D/stderr.log || echo "FAIL $tag $c r$r" >> $D/runs.log
    done
  done
done
echo "$(date +%T) ALLDONE" >> $D/runs.log
