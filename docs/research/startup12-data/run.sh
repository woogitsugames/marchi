#!/bin/bash
# startup day 12: before (5228: 66691cc) / after (5227: claude/w-terrain) interleaved, low + high, 3 reps per process, $1 rounds
cd "$(dirname "$0")/../../.."
D=${2:-docs/research/startup12-data/final}; mkdir -p $D
for r in $(seq 1 $1); do for q in high low; do for v in before:5228 after:${AFTER:-5227}; do
  tag=${v%%:*}; port=${v##*:}; f=$D/$tag-$q-r$r.json; [ -s $f ] && continue
  echo "$(date +%T) $(cut -d' ' -f1-3 /proc/loadavg) $tag $q r$r" >> $D/runs.log
  LOADAVG="$(cut -d' ' -f1-3 /proc/loadavg)" timeout 900 node tools/startup-probe.mjs http://127.0.0.1:$port $q 3 > $f 2>>$D/stderr.log || echo "FAIL $tag $q r$r" >> $D/runs.log
done; done; done
echo ALLDONE >> $D/runs.log
