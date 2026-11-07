#!/bin/bash
cd /workspace/marchi-kitperf
D=$1; mkdir -p $D
for r in 1 2 3; do for v in before:5233 after:5232; do tag=${v%%:*}; port=${v##*:}
  echo "$(date +%T) $(cut -d' ' -f1-3 /proc/loadavg) $tag r$r" >> $D/runs.log
  WINDOW_MS=${WINDOW_MS:-6000} timeout 900 node tools/startup-probe.mjs http://127.0.0.1:$port ${Q:-high} 3 > $D/start-$tag-r$r.json 2>>$D/err.log
done; done
echo ALLDONE >> $D/runs.log
