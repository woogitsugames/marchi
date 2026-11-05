# Odporność symulacji po zmianach dnia 9 (2026-11-06)

Gałąź `claude/research-day9j`, baza `5415373` (merge `claude/w-trade-post`: punkt handlowy, karta wąskiego gardła,
zapis v9). Zakres: dyspozytor 2 L1 (D-156, `WAGON_DUE`), dane misji VIII (D-165..D-167), ranga 1 doliny przy 120
(D-168), punkt handlowy + zapis v9 (D-170/D-171). Wszystko headless, deterministycznie, bez zmian w `src/`.

## Werdykt w skrócie

- **Nie znaleziono żadnego błędu symulacji.** Zero naruszeń niezmienników (zachowanie towarów, rezerwacje,
  `StallReason` na każdym bezczynnym budynku/wozie) w ~19 mln symulowanych ticków fuzzu plus przebiegach botów, zero rozjazdów hashy po
  save → load, zero rozjazdów między dwoma procesami.
- **Jedna luka w testach (naprawiona):** `tests/purity.test.ts` nie skanował podkatalogów `src/sim/` (np.
  `src/sim/proposals/`, gdzie leżą dane misji VII–XIII) i przepuszczał `Math.atan`, `Math.log2`, `Math.asin`, `**` itd.
- Pamięć: dolina 3 h przy ×4 przez prawdziwy `GameLoop` — sterta po GC stabilna (~13,3 → 13,6 MB od 30. do 180. minuty),
  stan rośnie tylko z liczbą budynków/wozów, wszystkie listy w stanie są ograniczone.

## 1. Zapisy: każda wersja → v9, potem 10+ minut gry z niezmiennikami co tick

Narzędzie: `tools/robustness.ts fixtures` + test `tests/robustness.test.ts`.

| Źródło | Wersje | Wynik |
|---|---|---|
| `tests/fixtures/save-v6-m2-sold-wagon.json` (prawdziwy zapis v6, m2) | v6 → v9 | czysto do końca misji (7,5 min gry, misja się kończy) |
| `tests/fixtures/save-v7-sandbox.json` | v7 → v9 | czysto, 12 min |
| `tests/fixtures/save-v8-sandbox.json` (prawdziwy v8, ranga 2) | v8 → v9 (punkt handlowy wstawiony migracją) | czysto, 12 min |
| dolina po 8 min gry DECENT, przepisana na schemat v1…v8 | v1, v2, …, v8 → v9 | czysto, 10 min (dalej z graczem DECENT) |
| m1 po 3 min, przepisana na v1…v8 | v1 … v8 → v9 | czysto, 10 min |
| m4 (lód), m13 po 3 min, przepisane na v3…v8 | v3 … v8 → v9 | czysto, 10 min |

Uwaga: w repo są fixtury tylko v6, v7, v8 (plików v1–v5 nigdy nie było). Wersje v1–v5 powstają tak jak w
`tests/save-chain.test.ts` — z rozegranego stanu usuwa się pola późniejszych schematów (helper przeniesiony do
`tests/save-downgrade.ts`), a v6–v8 analogicznie (bez `tradePost`, bez `valleyEvents`, bez numerów wozów).
Każdy zapis przechodzi pełną ścieżkę gry: tekst JSON → `parseSave` (bramka) → `migrate` → `deserialize`.
Sprawdzane co tick: `checkInvariants` (zachowanie towarów, rezerwacje = zlecenia, numery wozów, rynek) i
`unexplainedStalls` (każdy bezczynny budynek / stojący wóz ma przyczynę).

## 1b. Save → load w trakcie gry = bit w bit ten sam przebieg

`verifyRun` (w `tools/robustness.ts`): przebieg referencyjny gracza-bota z dziennikiem komend, hash co minutę gry;
potem powtórka dziennika z pełnym save → load (koperta, tekst JSON, bramka, migracje) w wybranych tickach i porównanie
hashu co minutę oraz na końcu.

- **Misje I–XIII, wszystkie 46 strategii autorskich** (42 kończą się wygraną, 4 przegraną — zgodnie z planem) (nic / częściowa / właściwa; `tools/balance.ts`,
  `bot-missions-7-9.ts`, `bot-missions-10-12.ts`, `bot-m13.ts`), save → load w 1/4, 1/2, 3/4 przebiegu, w m4
  dodatkowo w środku okna lodu: **wszystkie bit-identyczne**, niezmienniki czyste co tick. Wyniki (wygrana/przegrana)
  zgodne z drabinką pieczęci.
- **Dolina 180 min**, DECENT + każde zamówienie królewskie + każdy kupiec: save → load tuż po osiągnięciu rang 0…5
  (min 0/9/22/42/74/117), w każdym oknie lodu zimą (48, 54, 108, 114, 168, 174 min) i w każdej odwilży wiosennej — 15 punktów:
  **bit-identycznie**. Punkt handlowy aktywny (od rangi 4): 4092 jednostki sprzedane, 16 538 srebra.
- Uwaga poboczna (nie błąd): kupiec, któremu nie ma czego sprzedać, odpowiada `NO_SURPLUS` — bot pyta co sekundę,
  narzędzie to filtruje.

## 2. Determinizm

- Pełny przegląd (`npx tsx tools/robustness.ts all --valley-min 180`) uruchomiony **dwa razy w osobnych procesach**:
  wyjście (hash końcowy każdej z 46 strategii misji + doliny 180 min) identyczne po odcięciu czasów.
- `tsconfig.sim.json`: sonda — dopisanie `document.title` do `src/sim/town.ts` daje `TS2584` (brak DOM) — działa.
- `tests/purity.test.ts`: sonda — dopisanie `Math.atan(1)` do `src/sim/proposals/missions-7-9.ts` **przechodziło**.
  Dwie przyczyny: `readdirSync` bez rekursji (podkatalog `proposals/` pomijany) i lista zakazana zamiast dozwolonej
  (`atan`, `asin`, `acos`, `tanh`, `log2`, `log10`, `expm1`, `**` niewyłapane). **Naprawione**: skan rekursywny
  (z asercją, że `proposals/` jest skanowany), biała lista `Math.{sqrt, abs, min, max, floor, round, ceil, trunc,
  sign, imul}` + stałe (`Math.SQRT2`), zakaz `**`, komentarze blokowe usuwane przed skanem. Obecny kod przechodzi
  (używa tylko floor/ceil/round/min/max/abs/sqrt/imul i `SQRT2`).

## 3. Fuzz

| Kampania | Przebiegi × ticki | Mapy | Wynik |
|---|---|---|---|
| `tools/fuzz.ts --runs 600 --ticks 8000 --seed 7001` | 600 × 8000 | m1–m13, sandbox, sandbox@5 | 0 błędów, 11,93 mln ticków, 8439 komend przyjętych / 5701 odrzuconych, do 25 wozów, 754 s |
| `tools/fuzz.ts --runs 60 --ticks 33000 --seed 9001` | 60 × 33 000 (przez zimę: lód 48–50 i 54–56 min) | sandbox, sandbox@5 | 0 błędów, 5,04 mln ticków, 214 s |
| `tools/fuzz-late.ts --runs 90 --seed 501` (nowe) | 90 × 9000 | dolina DECENT od 75 / 100 / 120 min | 0 błędów, 810 tys. ticków × (przebieg + klon save/load + powtórka), 35 086 jednostek sprzedanych w punkcie handlowym, 33 618 wozo-ticków `BRIDGE_CLOSED` (lód), 416 s |

Domyślna lista `tools/fuzz.ts` (`ALL_FUZZ_MISSIONS`) to wciąż tylko m1–m6 + sandbox — misje VII–XIII trzeba podać
`--missions`. Nowe `tools/fuzz-late.ts` startuje z prawdziwie rozegranej doliny (ranga 4–5, punkt handlowy otwarty i
podłączony, 25–30 wozów), więc losowe komendy (drogi, ukośne mosty wieloprzęsłowe, rozbiórki przęseł, wozy, budynki)
trafiają w punkt handlowy, lód na mostach i odwilż, czego fuzz od zera praktycznie nie osiąga (punkt jest za rzeką).
`fuzz-lib`: `SNAPSHOTS` (nazwane stany startowe) i bezwzględne ticki komend w scenariuszu (dla świata od zera
identyczne jak dotąd — seedy testu `fuzz` dają te same scenariusze, test zielony).

## 4. Pamięć / alokacje: dolina 3 h przy ×4

`node --expose-gc --import tsx tools/valley-mem.ts --min 180` — prawdziwy `GameLoop` (speed 4, klatki po 16,7 ms),
DECENT + zdarzenia, HUD czyta `rankStalls` 4× na sekundę, niezmienniki co minutę.

| min | sterta po GC (MB) | stan JSON (KB) | wozy | ranga | GC (liczba / ms / max ms) | klatka p50/p99 ms |
|---|---|---|---|---|---|---|
| 0 | 9,8 | 32 | 2 | 0 | 0 | — |
| 30 | 13,3 | 43 | 16 | 2 | 34 / 50 / 8,2 | 0,00 / 0,12 |
| 60 | 13,3 | 48 | 25 | 3 | 75 / 94 / 8,4 | 0,00 / 0,15 |
| 120 | 13,5 | 52 | 30 | 5 | 128 / 153 / 8,4 | 0,01 / 0,29 |
| 180 | 13,6 | 53 | 30 | 5 | 170 / 215 / 9,9 | 0,01 / 0,26 |

Sterta płaska po wyjściu na plateau gospodarki (+0,3 MB w 150 min — szum JIT/IC), średnio ~1 GC na minutę gry
(scavenge, ~1,3 ms), najdłuższa pauza 9,9 ms. Jedyne, co w stanie rośnie między minutą 0 a 180, to liczba budynków
(6 → 24); `tradePost.recent` ≤ 5, `valleyEvents.orders` ≤ 1, `ledger.stallSeconds` ≤ 26 kluczy (rodzaje przyczyn),
ścieżki wozów ≤ 41 komórek. Dziennik `GameLoop.journal` rośnie bez limitu, ale to 128 komend na 3 h (limit raportu
50 000).

## Nowe testy i narzędzia

- `tests/robustness.test.ts` (7 testów, ~12 s): fixtury v6–v8 i przepisane v1–v8 (dolina, m1, m4, m13) → v9 + 10 min
  z niezmiennikami co tick; save → load bit-identyczny w 1/4, 1/2, 3/4 każdej misji I–XIII; dolina 25 min z save → load
  po każdej nowej randze.
- `tests/purity.test.ts`: rekursywny skan, biała lista `Math.*`, zakaz `**`.
- `tests/save-downgrade.ts`: wspólny helper (wyjęty z `save-chain.test.ts`).
- `tools/robustness.ts`, `tools/fuzz-late.ts`, `tools/valley-mem.ts`.

## Repro (dla kolejnych sesji)

```bash
npx tsx tools/robustness.ts all --valley-min 180       # ~30 s, "ALL CLEAN"
npx tsx tools/fuzz.ts --runs 600 --ticks 8000 --missions m1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11,m12,m13,sandbox,sandbox@5
npx tsx tools/fuzz-late.ts --runs 90
node --expose-gc --import tsx tools/valley-mem.ts --min 180
npm test -- robustness
```
