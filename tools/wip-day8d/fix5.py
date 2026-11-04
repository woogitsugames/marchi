p='/workspace/marchi-saves/src/styles/main.css'; s=open(p).read()
old="""button:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--ochre); outline-offset: 2px; }"""
new="""/* two-tone focus ring (D-123, a11y audit F8): an ink line between two pale bands. Ink on parchment reads 11:1, the
   pale bands stand off the map, the oak and the wine wax; the pair keeps 3:1 against anything behind it */
:root { --focus-ink: #1d1813; --focus-pale: #f6e9c8; }
button:focus-visible, [tabindex]:focus-visible, a[href]:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--focus-ink);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--focus-pale), 0 0 0 6px var(--focus-pale);
}"""
assert old in s; s=s.replace(old,new)
old2=""".vol:focus-visible { outline: 2px solid var(--ochre); outline-offset: 2px; }"""
new2=""".vol:focus-visible { outline: 2px solid var(--focus-ink); outline-offset: 2px; box-shadow: 0 0 0 2px var(--focus-pale), 0 0 0 6px var(--focus-pale); }"""
assert old2 in s; s=s.replace(old2,new2)
old3="""section.sheet:focus { outline: none; }"""
new3="""section.sheet:focus { outline: none; box-shadow: none; }"""
assert old3 in s; s=s.replace(old3,new3)
open(p,'w').write(s)
