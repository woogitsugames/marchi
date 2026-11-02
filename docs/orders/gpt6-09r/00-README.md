# Zlecenia GPT-6 — paczka 09R (ponowne wysłanie nieoddanych: 60, 44, 47)

**Repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`** — zrób `git fetch` (baza z 2 XI wieczór: HUD v3 D-43
na Twoim zestawie UI, stan symulacji **v7** D-44 z numerami wozów, listy kasztelana w grze D-46, misje I–XII w menu,
pory roku w Wolnej dolinie, sloty zapisu na misję D-36, RTL D-37). Każde zlecenie = osobna gałąź `gpt/<nr>-<skrót>`
i PR do bazy. Zasady wspólne jak w paczce 08 (`docs/orders/gpt6-08/00-README.md`): bez edycji `src/ui/**`,
`src/render/**`, `src/styles/**`, istniejących plików `src/sim/**`, `.github/workflows/**`, `package.json`;
symulacja tylko `+ - * /` i `Math.sqrt/abs/min/max/floor/round`, bez `Math.random`/`Date`; numerów D-NN nie dopisuj
(zaproponuj w PR); `npm test` i `npm run typecheck` zielone. **Zlecenie bez plików jest nieoddane.**
Jeśli czegoś nie da się zrobić — napisz to wprost w PR zamiast oddawać pustą gałąź.

| Nr | Plik | Temat |
|---|---|---|
| 60 | 60-polish-copy-review.md | Korekta polskich tekstów gry |
| 44 | 44-valley-events.md | Zdarzenia w Wolnej dolinie (dane + czyste funkcje + teksty) |
| 47 | 47-playtest-v2.md | Protokół playtestu v2 (z misjami VII–XII, nowym HUD i składakami) |
