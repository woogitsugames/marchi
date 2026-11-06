#!/bin/bash
# startup before (5197: start of the day + marks) / after ($AFTER, default 5194: D-221/D-222/D-223) interleaved;
# low + high; 3 reps per process, $1 rounds, into $2 (default docs/research/startup10-data/final)
cd "$(dirname "$0")/../../.."
D=${2:-docs/research/startup10-data/final}
mkdir -p $D
for r in $(seq 1 ${1:-2}); do
  for q in high low; do
    for v in before:5197 after:${AFTER:-5194}; do
      tag=${v%%:*}; port=${v##*:}; f=$D/$tag-$q-r$r.json
      [ -s $f ] && continue
      echo "$(date +%T) $(cut -d' ' -f1-3 /proc/loadavg) $tag $q r$r" >> $D/runs.log
      LOADAVG="$(cut -d' ' -f1-3 /proc/loadavg)" timeout 900 node tools/startup-probe.mjs http://127.0.0.1:$port $q 3 > $f 2>>$D/stderr.log || echo "FAIL $tag $q r$r" >> $D/runs.log
    done
  done
done
echo "$(date +%T) ALLDONE" >> $D/runs.log
