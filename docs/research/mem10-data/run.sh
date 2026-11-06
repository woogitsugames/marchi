#!/bin/bash
# memory before (start of the day, port 5199) / after (port 5195): high, 10 restarts of XII, 3 h valley; low: 3 restarts
cd "$(dirname "$0")/../../.."
D=docs/research/mem10-data
for v in before:5199 after:5195; do
  tag=${v%%:*}; port=${v##*:}
  [ -s $D/$tag-high.json ] || timeout 3000 node tools/memory-probe.mjs http://127.0.0.1:$port high 10 m12 3 > $D/$tag-high.json 2>$D/$tag-high.log
  [ -s $D/$tag-low.json ] || timeout 1500 node tools/memory-probe.mjs http://127.0.0.1:$port low 3 m15 0 > $D/$tag-low.json 2>$D/$tag-low.log
done
echo ALLDONE >> $D/done.log
