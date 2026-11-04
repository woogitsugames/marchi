p='/workspace/marchi-saves/src/styles/main.css'; s=open(p).read()
reps=[
(""".good-chip .inc { font-size: 13px; color: #7d5d23;""",""".good-chip .inc { font-size: 13px; color: #6b4f1d;"""),
(""".kv dd.eta { color: #7d5d23; font-size: 17px; }""",""".kv dd.eta { color: #6b4f1d; font-size: 17px; }"""),
("""font-size: 17px; font-weight: 700; color: #7d5d23; }""","""font-size: 17px; font-weight: 700; color: #6b4f1d; }"""),
("""  --slate: #3d4852;""","""  --slate: #36404a;"""),
("""  font-weight: 600;
  color: var(--ink-soft);
}
.menu-continue""","""  font-weight: 600;
  /* ink, not ink-soft: the dim menu paper over the live scene left 3.4:1 (a11y F11, D-122) */
  color: var(--ink);
}
.menu-continue"""),
("""  font-size: 13px;
  line-height: 1.25;
  color: var(--ink-soft);
  margin-top: 2px;""","""  font-size: 14px;
  line-height: 1.25;
  color: var(--ink);
  margin-top: 2px;"""),
("""letter-spacing: .1em; color: var(--wine); margin-bottom: 1px;""","""letter-spacing: .1em; color: #561418; margin-bottom: 1px;"""),
(""".tool.is-disabled[data-tool='wagon'] .tl { opacity: 1; color: #6e1a1e; }""",""".tool.is-disabled[data-tool='wagon'] .tl { opacity: 1; color: #6e1a1e; }
/* "brak 4" is the only visible reason on the hatched card: a parchment plaque under it so the hatching never runs
   through the letters (a11y F12: 1.3:1 at worst; D-122) */
.tool.is-disabled[data-tool='wagon'] .tl { background: var(--kparch); box-shadow: 0 0 0 2px var(--kparch); border-radius: 2px; padding-inline: 3px; color: #5c1418; }"""),
]
for a,b in reps:
    assert a in s, a
    s=s.replace(a,b)
open(p,'w').write(s)
