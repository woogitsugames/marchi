#!/bin/bash
# startup before (5197: marks only) / after (5196: D-221) interleaved; low + high; 3 reps per process, $1 rounds
cd "$(dirname "$0")/../../.."
D=docs/research/startup10-data
for r in $(seq 1 ${1:-2}); do
  for q in high low; do
    for v in before:5197 after:5196; do
      tag=${v%%:*}; port=${v##*:}; f=$D/$tag-$q-r$r.json
      [ -s $f ] && continue
      echo "$(date +%T) $(cut -d' ' -f1-3 /proc/loadavg) $tag $q r$r" >> $D/runs.log
      LOADAVG="$(cut -d' ' -f1-3 /proc/loadavg)" timeout 900 node tools/startup-probe.mjs http://127.0.0.1:$port $q 3 > $f 2>>$D/stderr.log || echo "FAIL $tag $q r$r" >> $D/runs.log
    done
  done
done
echo "$(date +%T) ALLDONE" >> $D/runs.log
