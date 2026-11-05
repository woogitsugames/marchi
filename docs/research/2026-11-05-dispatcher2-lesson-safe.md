# Dyspozytor 2 „bezpieczny dla lekcji” — runda badań (decyzja właściciela 2026-11-05)

Data: 2026-11-05 · gałąź `claude/research-dispatch2b` (od `claude/w-dispatch2`, C + A + `WAGON_DUE`).
Narzędzia (nowe): `tools/dispatch2-ab.ts` (A/B jednym poleceniem: testy drabin lekcji + bot I + ankieta
„jeden wóz więcej” dla każdego wariantu, 4 procesy naraz, tabela markdown; `FAST=1` pomija ankietę,
gdy drabina już pęka), `tools/dispatch2-bal.ts` (`balance-night6 --no-search` pod wariantem).
Przełączniki w czasie badania: `RULES` w `src/sim/logistics.ts`. Po decyzji właściciela (D-156, wdrożone L1) zostało
`DISPATCH2 = { ruleA, fleetGate, minFreeRunS, ruleC }`. Pozostałe warianty z tabel odtworzysz z historii gałęzi
(commit 47c29cc).

## TL;DR

- **Żaden wariant nie spełnia w pełni wszystkich trzech warunków.** Przejrzałem około 220 wariantów (193 w
  `2026-11-05-dispatcher2-grid*.txt`). Warianty, które trzymają wszystkie drabiny, ograniczają szkodę
  dodatkowego wozu o około jedną trzecią. C + A ogranicza ją o 86 %.
- **Najlepszy wariant bezpieczny dla lekcji to L1.** Reguła A działa dopiero przy flocie ≥ startowa + 2 i tylko
  wtedy, gdy najbliższy wolny wóz ma ≥ 50 s pustego dojazdu. Reguła C jest wyłączona.
  - Wszystkie testy drabin przechodzą.
  - `npm test`: 476 / 480. Padają tylko 4 testy złotych haszy i zrzutów, które i tak muszą się zmienić.
  - Ankieta: wolniej 56 → 40, utracone pieczęci 28 → 19.
  - Pieczęci gracza eye bez dodatkowego wozu: 61 → 63.
  - Balans night6: 9 pieczęci w górę, 1 w dół (m12 „same wozy”, czyli zła poprawka XII), 0 przegranych, −18,8 min.
- L1 zostaje na tej gałęzi jako domyślny. Warunek 2 („szkoda wyraźnie poniżej bazy”) jest spełniony **tylko
  częściowo**: −32 % strat, a nie −86 % jak w C + A.
- **Przyczyna jest strukturalna, a nie parametryczna.** W VIII „częściowa” poprawka to jeden dodatkowy wóz
  (ma dać 2★). W X i XII „zła” poprawka to dwa wozy o 0:20 (ma dać ≤ 1★). Każda reguła, która sprawia, że
  dodatkowy wóz przestaje szkodzić, czyni go też lepszą poprawką. Wtedy te szczeble wchodzą na wyższy próg.
  Do tego „nic” w V i XII przy starcie ze startową flotą przyspiesza pod A lub C i przekracza próg 2★ / 3★.

## Tabela wariantów (`npx tsx tools/dispatch2-ab.ts`)

Ankieta: 13 misji × eye-30/60 × jeden wóz kupiony o 1:00 … 9:00. „Wolniej” to próby dłuższe o > 3 s.
„Eye Σ” to te same 26 przebiegów bez dodatkowego wozu.

| wariant | reguły | drabiny pękają | bot I | próby | wolniej | pieczęć w dół | w górę | śr. Δ s | najgorzej | eye Σ pieczęci | eye Σ min |
|---|---|---|---|---|---|---|---|---|---|---|---|
| baza (dziś w `main`) | bez A, bez C | 0 | 3★ 8,85 | 195 | 56 | 28 | 15 | +5,3 | +284 | 61 | 223,3 |
| C + A (`w-dispatch2`) | A, C | **7** | 3★ 9,02 | 191 | 26 | 4 | 35 | −4,8 | +268 | 61 | 214,6 |
| A | A | 8 | 3★ 9,17 | 190 | 26 | 5 | 27 | −7,4 | +265 | 60 | 217,4 |
| C | C | 5 | 3★ 8,12 | 197 | 33 | 17 | 23 | +0,4 | +308 | 60 | 223,2 |
| **L1** | A przy flocie ≥ start+2 i wolnym dojeździe ≥ 50 s, bez C | **0** | 3★ 7,94 | 193 | **40** | **19** | 17 | +0,1 | +213 | **63** | 220,5 |
| L1′ (`g2mf60-c0`) | jak L1, dojazd ≥ 60 s | 0 | 3★ 7,94 | 194 | 42 | 19 | 14 | +1,7 | +266 | 62 | 220,3 |
| L1-cs (`g2mf60-cs`) | L1′ + C łagodne (głodny warsztat dalej dostaje wkład) | 0 | 3★ 7,94 | 194 | 41 | 19 | 20 | 0,0 | +247 | 61 | 221,4 |
| g3CA | C + A przy flocie ≥ start+3 | 0 | 3★ 9,02 | 194 | 46 | 22 | 25 | −1,5 | +212 | **60** ✗ | 222,3 |

Utracone pieczęci w L1: m4 ×5 (ekonomia: srebro na kamienny most przed lodem, jak w raporcie 9g; to samo w C + A),
m6 ×5, m12 ×3, m10 ×3, m11 ×2, m5 ×1. W m6 bramka floty się nie otwiera (start + 1 wóz to za mało), więc
szkoda zostaje jak w bazie.

### Co pękało w pomysłach z briefu (pełne listy w plikach `grid*.txt`)

| pomysł | najlepszy wynik | co pękło |
|---|---|---|
| ratio (wolny dojazd ≥ k × ETA zajętego), k = 1,5 / 2 / 3 | 4 drabiny | m4 (późny most daje 3★ zamiast 2), m6 (wóz @0:30 1★), m8 / m9 / m10 |
| margines 5 / 10 / 20 / 30 s | 5 | m5 „nic” 2★, m8 częściowa 3★, m12 |
| bez wstrzymania dla zamku / wypchnięć / tylko top-up / nigdy dla wąskiego gardła kontraktu | 6–8 | m5 / m6 „nic” 2★, m12 „nic” 2–3★, m13 jeden wóz 1★ |
| A tylko gdy zajęty wóz zaraz będzie (≤ 5 / 10 / 20 / 40 s) | 4 | m5 / m6 „wóz @0:30”, m9, m10 |
| A tylko przy ≥ 2 / 3 wolnych wozach | 2 | m6 „połącz duży spichlerz”, m12 |
| A tylko z wozem, który rozładowuje się przy samym źródle (powrót z ładunkiem) | 1 | m12 zła poprawka 2★ |
| C łagodne / C przy ≥ 2–3 wolnych | 2 | m6 „wóz @0:30” 1★, m10 zła poprawka 2★ |
| bramka floty +1 (A lub C dopiero po pierwszym kupionym wozie) | 1 | **m8 częściowa (jeden wóz) 2★ → 3★** — wóz staje się poprawką lekcji |
| bramka floty +2 bez progu dojazdu | 1 | m12 / m10 zła poprawka (dwa wozy @0:20) 2★ |
| **bramka +2 i wolny dojazd ≥ 40–70 s** | **0** | — (L1, L1′, L1-cs) |

Wąskie gardło: pomysły bez bramki floty zmieniają przebieg „nic” misji ze startową flotą (V, VI, XII).
Te przebiegi stoją kilka sekund od progu, więc lepszy dyspozytor przesuwa je o całą pieczęć. Bramka floty
chroni „nic” z definicji. Bramka +1 łamie jednak VIII, bo tam jeden wóz to szczebel „częściowa”.
Dopiero bramka +2 z progiem dojazdu zostawia wszystkie szczeble.

## Pełny balans (`tools/dispatch2-bal.ts`, 128 wierszy night6)

| wariant | Σ pieczęci (baza 290) | w górę | w dół | wygrana → porażka | porażka → wygrana | Σ Δ min (wygrane w obu) |
|---|---|---|---|---|---|---|
| C + A | 299 | 24 | 18 | 0 | 1 | −44,1 |
| **L1** | 299 | 9 | **1** | 0 | 0 | −18,8 |

W C + A w dół idą m6 (9 wierszy), m10 (6) i m13 (3), wszystkie tuż przy progu 3★ (jak w raporcie 9g).
W L1 w dół idzie tylko m12 „same wozy” (2 → 1★), a to jest zła poprawka XII. W górę idą m1 eye/scan/letter,
m2, m4, m5 eye, m8 eye i „same wozy”.

## Testy

L1 jako domyślny: `npm test` → **476 passed, 4 failed** (z 480). Padają:
- `chains` › złote hasze v4 (m2 i m3 „kup 2 + …” — przebiegi z 2+ kupionymi wozami);
- `valley-events-live` › złote hasze v7;
- `dispatch-reachability` › hasze ławki dyspozytora (5 z 6 zrzutów bench50);
- `chains` › bramka zapisu v5: test wybiera z próbki stanu wóz z kamieniem, a w nowym przebiegu go nie ma.
  To zależność fikstury od trajektorii, nie błąd. Pada też w C + A.

Wszystkie testy drabin (`missions*`, `m1-eye-fix`), `sandbox`, `bridge`, `seasons-live`, `s2-mechanics`,
`thin-delivery`, `next-letter-surplus`, `m8-stone-stored` i `fleet-card` przechodzą. W C + A padały 23 testy.
Hasze **nie są** przenagrane. `npm run typecheck` przechodzi.

**Aktualizacja (D-156, wdrożenie):** hasze przenagrane, fikstura v5 naprawiona (próbka z wozem kamienia),
dodany `tests/wagon-due.test.ts`. `npm test` → 482 passed, 0 failed.

## Rekomendacja

1. **Jeśli najważniejsze są drabiny lekcji, wdrożyć L1** (D-nowe). Zmiana w dyspozytorze to dwie linie
   warunku nad istniejącą regułą A i `WAGON_DUE`. Wymaga tylko przenagrania 3 zestawów złotych haszy i jednej
   fikstury. Balans prawie się nie rusza (1 wiersz w dół, i to zła poprawka). Szkoda dodatkowego wozu spada
   o około jedną trzecią, nie znika. Bramka D-127/D-128 karty „Kup wóz” musi zostać.
2. **Pełnej monotoniczności (C + A) nie da się mieć bez zmiany samych lekcji.** VIII ma jeden wóz jako
   szczebel „częściowa”, a X i XII mają „dwa wozy” jako złą poprawkę. Gdy wóz przestaje szkodzić, staje się
   lepszą poprawką. Możliwe drogi, każda to decyzja projektowa, nie strojenie:
   (a) przeprojektować szczeble VIII / X / XII tak, by „wóz” nie był szczeblem drabiny, tylko np. drugą
   przeszkodą;
   (b) przyjąć C + A i przestroić progi oraz scenariusze tych trzech misji (raport 9g, §6).
3. Nie łączyć bramki floty z żadnymi innymi zmianami. To heurystyka „dyspozytor rozsądniej rozdziela kursy,
   gdy wozów jest wyraźnie więcej niż autorska flota”. Graczowi trudno ją wyjaśnić, ale jest niewidoczna:
   status `WAGON_DUE` mówi prawdę zawsze, gdy kurs jest wstrzymany.

## Pliki

- `src/sim/logistics.ts` — `DISPATCH2` (L1: bramka floty, próg wolnego dojazdu; C tylko dla narzędzi).
- `tools/dispatch2-ab.ts`, `tools/dispatch2-bal.ts` — runner A/B i balans pod wariantem.
- `docs/research/2026-11-05-dispatcher2-grid.txt`, `…-grid2.txt`, `…-grid3.txt` — surowe tabele 193 wariantów
  (`FAST=1`: wiersze z pękniętą drabiną nie mają ankiety).
