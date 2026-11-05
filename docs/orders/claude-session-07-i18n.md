Repozytorium: woogitsugames/marchi, gałąź bazowa: **claude/eager-cori-08wt8e** (zrób `git fetch`). Pracuj na gałęzi
**claude/x-i18n-day9**; małe commity; na końcu JEDEN PR do bazy (bez scalania i zamykania). Komunikacja po polsku,
kod/komentarze/commity po angielsku. Zasady: `CLAUDE.md` (najpierw!), `docs/DECISIONS.md` (D-37 RTL, D-18 liczby
mnogie), `docs/content/*` dla kontekstu tekstów.

NIE edytuj: `src/sim/**`, `src/render/**`, `src/ui/**` (poza `src/i18n/*` i `src/content/letters.ts`), workflowów CI.

ZADANIE: przetłumacz wszystkie klucze z `PENDING_KEYS` (`src/i18n/pl.ts`, ok. 66 kluczy z dni 5–9: karta tempa,
błoto, kra, flota, list porażki `end.act.*`, Księga przestojów, `why.more`, `pin.*`, misja XIII `menu.m13*` itd.) na
wszystkie języki gry: de, es, fr, it, nl, pt_BR, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi (plik na język w `src/i18n/`).
Źródło znaczenia: `pl.ts` (oryginał) + `en.ts`. Zachowaj placeholdery `{n}`, `{pct}`, `{name}` itd. i bloki
`{n, plural, …}` z kategoriami CLDR danego języka. Ton: krótko, rzeczowo, średniowieczny list kasztelana, bez emoji.
Długość: tekst mieści się tam, gdzie angielski (karta HUD ~2 linie przy 412 px) — skracaj raczej niż wydłużaj.
Dodatkowo: nowy tekst listu porażki misji I w `src/content/letters.ts` (pl/en zmienione w D-130 — inne języki wciąż
radzą „sprawdź przeprawę”) — przetłumacz na te same języki.

Po tłumaczeniu: `npx tsx tools/i18n-reorder.ts --write` (porządek kluczy + raport), usuń z `PENDING_KEYS` klucze
przetłumaczone we wszystkich językach, `npm run i18n:coverage`, `npm run typecheck`, `npm test` (musi kończyć się
`failed=0`), `npm run build`, `npm run layout -- --quick` (szuka ucięć i nachodzenia w de/pseudo; popraw zbyt długie
teksty). W PR: lista języków, liczba kluczy, teksty, których nie jesteś pewien (do przeglądu native speakera).

Commity kończ: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + `Claude-Session: <link Twojej sesji>`.
