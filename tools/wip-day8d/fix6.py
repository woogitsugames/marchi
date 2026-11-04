p='/workspace/marchi-saves/src/styles/main.css'; s=open(p).read()
old=""".bubble.is-critical .bb { background-image: image-set(url("/assets/ui/kit/pin-red@2x.png") 2x, url("/assets/ui/kit/pin-red@3x.png") 3x); }"""
new="""/* critical / worst: the scalloped wax-seal pin (D-121), a shape of its own, not only a colour */
.bubble.is-critical .bb { background-image: image-set(url("/assets/ui/kit/pin-alarm@2x.png") 2x, url("/assets/ui/kit/pin-alarm@3x.png") 3x); }"""
assert old in s; s=s.replace(old,new)
old2=""".bubble .bb { width: 40px; height: 48px; filter: drop-shadow(0 2px 1px rgb(20 14 8 / .45)); }"""
new2="""/* a 1 px parchment halo first (a11y F7: the pins sank into the grass by day), then the kit's soft shadow */
.bubble .bb { width: 40px; height: 48px; filter: drop-shadow(0 0 1px rgb(234 214 173 / .95)) drop-shadow(0 2px 1px rgb(20 14 8 / .45)); }"""
assert old2 in s; s=s.replace(old2,new2)
old3=""".bubble.is-critical .bb-in { color: var(--wine); box-shadow: inset 0 0 0 2.5px var(--wine), 0 0 0 1px rgb(111 29 34 / .35); }"""
new3=""".bubble.is-critical .bb-in { color: var(--wine); box-shadow: inset 0 0 0 2.5px var(--wine), 0 0 0 1px rgb(111 29 34 / .35); }
/* the alarm pin's disc is 86 % of the round one, set lower inside the wax rim (tools/make-pin-alarm.py) */
.bubble.is-critical .bb-in { width: 28px; height: 28px; margin-top: 9px; }
.bubble.is-critical.is-first .bb::after { inset-block-start: 9px; inset-inline-start: 6px; width: 28px; height: 28px; }"""
assert old3 in s; s=s.replace(old3,new3)
open(p,'w').write(s)
