#!/bin/bash
cd /workspace/marchi-perfworld
# startup day 14: before (5202: 28d3076, vite build --sourcemap) / after (5201: claude/w-perfworld) interleaved, high,
# 3 rounds x (startup-probe 3 reps + world-load-probe 3 reps); results land in $D
D=${D:-docs/research/startup14-data}; mkdir -p $D
for r in 1 2 3; do for v in before:5202 after:5201; do tag=${v%%:*}; port=${v##*:}
  echo "$(date +%T) $(cut -d' ' -f1-3 /proc/loadavg) $tag r$r" >> $D/runs.log
  timeout 900 node tools/startup-probe.mjs http://127.0.0.1:$port high 3 > $D/start-$tag-r$r.json 2>>$D/err.log
  timeout 900 node tools/world-load-probe.mjs http://127.0.0.1:$port 3 > $D/load-$tag-r$r.json 2>>$D/err.log
done; done
echo ALLDONE >> $D/runs.log
