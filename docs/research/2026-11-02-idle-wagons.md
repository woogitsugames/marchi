# Bezczynne wozy: powrót do stajni (backlog P3) — pomiar i rekomendacja

Data: 2026-11-02, gałąź `claude/w-research4`. Zmiany tylko w `tools/` i `docs/research/`; `src/` nietknięte.
Skrypty: `tools/idle-wagons.ts` (sterownik i metryki), `tools/idle-wagons-patch.mjs` (buduje kopię repo
poza worktree z załatanym `wagons.ts`; polityka wybierana zmienną `IDLE_POLICY`).

## 1. Co jest prawdą dzisiaj

- `targetNode()` (`src/sim/wagons.ts`): wóz bez zlecenia ma cel = `home.gate` (brama stajni). Czyli **puste wozy WRACAJĄ
  do stajni** (status `RETURNING`, po dojściu `IDLE`). Wpis w `HANDOVER.md` („puste wozy nie wracają do stajni”)
  jest nieaktualny albo opisuje inny objaw — pomiar: 1,6–5,9% czasu floty to jazda bezczynna do stajni, a 3–50% to postój
  przy bramie stajni (zależnie od wielkości floty). Do sprawdzenia przez właściciela, o jaki objaw chodziło.
- Dyspozytor (`logistics.ts`) wybiera najbliższy wolny wóz po czasie dojazdu z jego **aktualnego** węzła (`wagonNode`),
  więc wóz w drodze do stajni jest normalnie przydzielany po drodze. Powrót nie „marnuje” zlecenia — kosztuje tylko to,
  że następny dojazd po ładunek zaczyna się bliżej stajni niż bliżej ostatniej dostawy.
- **Wozy nie blokują się fizycznie.** Jedyna kolizja w symulacji to jednopasmowy most (`bridgeBlocker`, `BRIDGE_JAM`).
  Odstępy rysowane są wyłącznie w renderze (D-35, `wagonSpacing.ts`). „Kolejka przy bramie stajni” to więc stos
  rysowanych wozów w jednym węźle, nie opóźnienie w symulacji. Sam most nie jest związany z polityką bezczynności
  (BRIDGE_JAM 0–4% czasu wozów w benchu, 0% w misjach/sandboxie).

## 2. Metoda

Bez zmian w `src/`. Kopia repo w katalogu tymczasowym, `wagons.ts` załatany (polityka `home` daje identyczny hash
stanu jak prawdziwy `src/` — sprawdzone na sandboxie 20 wozów). Scenariusze: m1 (most + 4 wozy), m5 (łącznik spichlerza + 1),
m9 (druga drwalnia + 2), sandbox (plan DECENT, 30 min), bench (stres 10 min). Liczba wozów: naturalna, 10, 20, 30
(dokupione monetami +1e6, to zmienia ekonomię — porównania dotyczą polityk przy tej samej flocie). W sandboxie bot sam dokupuje
wozy, więc przy „10/20/30” flota to 19–20 / 29–31 / 41; polityki mają tam różne liczby wozów (±2) — zaszumia to wyniki.
Wszystkie biegi: 0 naruszeń inwariantów i niewyjaśnionych postojów.

Metryki (próbkowane co tick, per wóz): praca (jest zlecenie), jazda bezczynna, postój bezczynny, „podejście” = droga
(odometr) od przydziału zlecenia do załadunku, odległość (komórki) pozycji wozu od stajni w chwili przydziału,
liczba wozów w węźle bramy stajni, wozy z `BRIDGE_JAM`, jednostki dostarczone.

Polityki:
- **a. home** — dziś.
- **b. wait** — po rozładunku stoi w węźle dostawy; max 1 bezczynny wóz na węzeł, inaczej najbliższy wolny węzeł
  bramy budynku; nowo kupiony wóz stoi w stajni.
- **c. grace30 / grace90** — stoi w węźle dostawy N s (30 / 90), potem wraca do stajni, jeśli nadal brak zlecenia
  (przybliżenie „wraca tylko gdy brak popytu w N s”; dyspozytor i tak przydziela popyt natychmiast, więc
  „brak popytu” = brak zlecenia przez N s).

## 3. Wyniki

Jazda bezczynna do stajni i podejście, polityka `home` (dziś), średnia z m1/m5/m9/sandbox:

| flota | % czasu: jazda bezczynna | % czasu: postój bezczynny (głównie przy stajni) |
|---|---|---|
| naturalna (6–15) | 1,6 | 2,8–9,5 |
| 10 | 2,8 | 10–15 |
| 20 | 5,9 | 25–33 |
| 30 | 5,7 | 44–53 |

Różnica polityk względem `home`, średnia z m1/m5/m9/sandbox (bench pominięty — wozy zawsze pracują, brak różnicy):

| flota | polityka | jednostki/min | podejście do ładunku | jazda bezczynna | wozy w bramie stajni |
|---|---|---|---|---|---|
| naturalna | wait | +1,5% | −5% | −1,5 pp | 0 |
| naturalna | grace30 | +1,0% | −3% | −1,1 pp | 0 |
| 10 | wait | −0,5% | −2% | −2,1 pp | −0,2 |
| 10 | grace30 | +3,5% | 0% | −2,0 pp | −0,1 |
| 20–30 | wait | +4,6% | −18% | −0,5 pp | −1,2 |
| 20–30 | grace30 | +2,1% | −13% | −0,9 pp | −0,5 |
| 20–30 | grace90 | +4,9% | −17% | −0,5 pp | −1,0 |

Najwyraźniejszy przypadek — sandbox 30 min (jednostki/min, podejście m, wozy w bramie średnio):

| flota | home | wait | grace30 | grace90 |
|---|---|---|---|---|
| naturalna (15) | 29,7 / 73,7 / 0,28 | 30,7 / 65,7 / 0,21 | 28,0 / 69,4 / 0,20 | 30,1 / 67,1 / 0,22 |
| ~20 | 37,6 / 69,5 / 1,5 | 37,6 / 68,2 / 0,93 | 39,4 / 69,7 / 1,2 | 38,6 / 74,9 / 0,94 |
| ~30 | 56,8 / 49,6 / 6,2 | 63,7 / 26,4 / 4,8 | 61,5 / 33,6 / 5,5 | 64,2 / 30,9 / 5,0 |
| ~41 | 63,9 / 39,6 / 15,3 | 66,0 / 20,4 / 13,7 | 65,9 / 26,3 / 14,7 | 71,1 / 20,3 / 13,8 |

Misje (czas do wygranej, min; `home` / wait / grace30), flota 20 → m1 7,44/7,44/7,44; m5 5,93/6,54/6,23;
m9 7,07/6,64/6,71; flota 30 → m1 6,78/6,83/6,71; m5 6,23/5,63/5,68; m9 6,97/6,62/6,94. Różnice ±10% w obie strony,
bez trendu — szum układu zleceń, nie efekt polityki. Wszystkie misje nadal wygrane.

Wnioski liczbowe:
1. Jazda bezczynna to przy 20+ wozach ~6% czasu floty, a zysk z jej likwidacji to ułamek tego. Dziś wozy i tak są
   przydzielane z bieżącej pozycji, więc nie „tracą” zleceń.
2. Polityka b/c wyraźnie skraca podejście (−13…−18% przy 20+ wozach; w sandboxie do −50%), ale przepustowość rośnie
   tylko o ok. +2…+5% (w szumie ±5–10% pojedynczych biegów). Przy flocie naturalnej efekt ≈ 0.
3. Stos wozów w bramie stajni (do 13–15 średnio przy 30–41 wozach) niemal się nie zmienia: nadwyżkowe wozy
   rodzą się w stajni i nigdy nie dostają zleceń. To problem nadmiaru floty, nie polityki powrotu.
4. Zatory na mostach: bez związku z polityką (m1/m5/m9/sandbox 0–0,15%; bench 0,7–4%, bez trendu).

## 4. Wpływ na hashe / testy (polityka b i c)

Zmiana zmienia ścieżki wozów, więc zmienia hash i wyniki misji. W kopii z polityką `grace30` `npm test` daje 14 błędów
z 290 (z `wait`: 15+). Dotknięte: golden hashe misji I–VI i lab (`chains.test.ts`), drabinki pieczęci/czasu m5–m6, m8, m9,
m10–m12 (okna 5–12 min i różnice ≥0,8 min), `save-chain` (golden m1), `wagon-spacing`. Dodatkowo w mojej
kopii błąd `savediverge` w `fuzz.test.ts` — to artefakt eksperymentu (miejsce parkowania trzymane poza stanem;
prawdziwa implementacja potrzebuje pola w `Wagon` + migracji zapisu v→v+1 i bumpu `chains.test.ts` golden).
Czyli to **zmiana wymagająca D-NN, zgody właściciela, regeneracji golden hashy i ponownego strojenia balansu misji**.

## 5. Rekomendacja

1. **Nie zmieniać polityki w symulacji teraz.** Przepustowość +2…+5% w szumie, koszt: zmiana hashy, migracja zapisu,
   przestrojenie misji m5–m12 i okien sandboxa. Zysk praktycznie tylko kosmetyczny. P3 → odłożyć lub oznaczyć „obserwacja”.
2. Jeśli problemem jest tylko wygląd („kolejka” przy bramie): rozwiązać w renderze (jak D-35) — rozfalować rysowane
   bezczynne wozy w stajni (siatka/łuk przed bramą), bez dotykania stanu symulacji. Zerowe ryzyko dla hashy.
3. Jeśli właściciel mimo to chce zmiany sym: wariant **b (wait, ≤1 na węzeł)** jest najprostszy i daje największy skrót
   podejścia (−18%), ale wymaga pola `park` w stanie. Wariant c (grace 90 s) ma podobny efekt i łagodniejszą zmianę
   wizualną (wozy wracają po dłuższej bezczynności). Obydwa mają osobną decyzję D-NN. Warto też rozważyć powiązany
   problem: nadwyżka floty przy 30+ wozach (44–54% postoju) — sygnał w UI „wozów więcej niż zleceń” zamiast zmiany tras.
4. Poprawić wpis backlogu/HANDOVER: wozy wracają do stajni (to P3 o nadmiarze ruchu, nie o błędzie P0).

## 6. Jak powtórzyć

```bash
node tools/idle-wagons-patch.mjs /tmp/idle-copy
cp tools/idle-wagons.ts /tmp/idle-copy/tools/
cd /tmp/idle-copy && IDLE_POLICY=wait npx tsx tools/idle-wagons.ts sandbox 20   # m1|m5|m9|sandbox|bench, wagons|nat
```
