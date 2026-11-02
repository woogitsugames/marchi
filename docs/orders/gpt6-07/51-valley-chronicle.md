# 51 — Kronika doliny (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)
Gałąź `gpt/51-valley-chronicle`. Wolna dolina to spokojny city builder (D-21/D-29) — bez wygranej/przegranej.
Chcemy „Kronikę”: kamienie milowe, które gracz odkrywa grając (np. „Pierwsza beczka piwa sprzedana na zamku”,
„Pierwszy kamienny most”, „Zima bez zamkniętego mostu”, „100 desek w jeden rok”, „Ranga Gród”).
Dostarcz:
- `src/sim/proposals/chronicle.ts` — czyste funkcje: `CHRONICLE: ChronicleDef[]` (id, warunek jako dane, np.
  `{kind:'sold', good:'beer', atLeast:1}`, `{kind:'rank', atLeast:4}`, `{kind:'built', type:'quarry'}`,
  `{kind:'season', season:'winter', noStall:'BRIDGE_CLOSED'}`), `checkChronicle(state, prevDone): string[]` zwracająca
  nowo zdobyte id — tylko odczyt stanu (ledger, town, buildings), deterministycznie; opisz w PR, jakich pól stanu
  brakuje (jeśli jakichś) i jak je dodać.
- 20–30 wpisów; żaden nie wymaga grania > 3 h; żaden nie nagradza „grindu” bez myślenia — każdy uczy czegoś o logistyce.
- `docs/content/chronicle.md` — teksty PL+EN: tytuł (≤ 32 zn.) i jedno zdanie kronikarskie (≤ 90 zn.), styl
  średniowiecznej kroniki, bez emoji, bez „Gratulacje!”.
- `tests/chronicle.test.ts` — na stanach z `buildMission('sandbox')` + krótkiego przebiegu bota (tools/bot-sandbox.ts).
Bez nagród w srebrze (na razie tylko wpis do kroniki).
