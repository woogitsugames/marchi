#!/bin/bash
D=$1; mkdir -p $D; cd /tmp/claude-0/kit15
for r in 1 2 3 4; do for v in before:5233 after:5232; do tag=${v%%:*}; port=${v##*:}
  echo "$(date +%T) $(cut -d' ' -f1-3 /proc/loadavg) $tag r$r" >> $D/runs.log
  timeout 900 node incl-probe3.mjs http://127.0.0.1:$port/ 3 >> $D/$tag.jsonl 2>>$D/err.log
done; done
echo ALLDONE >> $D/runs.log
