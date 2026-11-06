# 66 — Przegląd tłumaczeń pisanych przez agenty — gałąź `gpt/66-i18n-review`

Od 4 XI agenci Claude dopisali i przetłumaczyli na 15 języków (de, es, fr, it, nl, pt_BR, sv, tr, ru, uk, ja, ko,
zh_Hans, ar, hi) ok. 130 kluczy i kilka listów. To tłumaczenia maszynowe bez przeglądu native speakera.

**Zakres:** wszystkie klucze dodane lub zmienione w `src/i18n/*.ts` od 2026-11-04 (lista: `git log --since=2026-11-04
-p -- src/i18n/pl.ts`), plus listy w `src/content/letters.ts` zmienione od tej daty (misja I — list porażki, misja VIII
— nowy list, list otwierający Wolnej doliny `letter.valleyOpening`). Źródło znaczenia: `pl.ts` (oryginał) + `en.ts`.

**Zwróć szczególną uwagę** (zgłoszenia agentów, `docs/BACKLOG.md` „native review” i D-155 w `docs/DECISIONS.md`):
- tytuł misji XIII `menu.m13` („Pierwsze piętro łańcucha”) — „piętro/stopień/ogniwo” spójnie z listami XIII;
- słowo „marchia” w `menu.m13Sub` (tr, ar, hi, ja, ko, zh, sv/nl/de, ru/uk);
- telegraficzne linie `seal.tempo.*` (Flip) — mają być krótkie, ale gramatyczne;
- ar: rodzajniki przy `{goodGen}`, zgodność rodzaju przy `{wagon}`; tr: sufiksy po placeholderach;
- ru/uk: dopełniacz liczby mnogiej (`why.topUp`), de: `alle # Wagen fahren`, `fix.rankWhy`;
- nowe: `hud.calmStall`, `place.cutsRoad`, `status.STORAGE_FULL.saturated`, `status.OUTPUT_FULL.surplus`,
  `cause/fix.marketFull`, `fix.wagonLately`, `cause.paceGrow`, `fix.growWhy`, `seal.tempo.grow`, klucze posterunku
  i karty „Wąskie gardło” (D-170/D-171), `status.WAGON_DUE`, `cause.WAGON_DUE`, ekran moderatora `playtest.*`.

**Zasady:** zachowaj placeholdery (`{n}`, `{good}`, `{goodAcc}`, `{goodGen}`, `{wagon}`, `{time}` …) i bloki
`{n, plural, …}` z kategoriami CLDR; długość ≤ angielskiej (linie HUD mieszczą się w 2 wierszach przy 412 px);
ton listów — średniowieczny kasztelan, bez archaizmów niezrozumiałych dla współczesnego gracza.
**Oddaj:** poprawione pliki + `docs/reviews/i18n-review-66.md` (tabela: język, klucz, było → jest, powód).
Sprawdź: `npm run i18n:coverage` (0 błędów placeholderów), `npm test`, `npm run typecheck`.
