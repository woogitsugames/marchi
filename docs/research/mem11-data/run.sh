#!/bin/bash
# day 11 memory: before (e22bbd5, port 5197) / after (port 5194): high, 6 restarts menu -> XII -> menu, no valley
cd "$(dirname "$0")/../../.."
D=docs/research/mem11-data
for v in before:5197 after:5194; do
  tag=${v%%:*}; port=${v##*:}
  [ -s $D/$tag-high.json ] || timeout 3000 node tools/memory-probe.mjs http://127.0.0.1:$port high 6 m12 0 > $D/$tag-high.json 2>$D/$tag-high.log
done
echo ALLDONE >> $D/done.log
