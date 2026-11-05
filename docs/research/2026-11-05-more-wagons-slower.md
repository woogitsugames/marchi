# „Więcej wozów = wolniej” — przyczyna w dyspozytorze i trzy reguły (BACKLOG P2, D-127)

Data: 2026-11-05 · gałąź `claude/research-day9g` · `src/` przywrócony, prototypy jako patche obok.
Narzędzia (nowe): `tools/wagon-probe.ts` (jeden przebieg „rozsądnego gracza” eye-N z dodatkowym wozem i bez,
czas wozów według czynności, lista kursów), `tools/wagon-monotone.ts` (każda misja m1..m13, eye-30 i eye-60,
+1 wóz kupiony o 1:00, 2:00 … 9:00 — „czy jeden wóz więcej kiedykolwiek szkodzi?”). `tools/balance-night6.ts`
dostał haczyk `probe`, eksport `run`/`eyePlayer` i przełączniki `RULE_ARRIVE`/`RULE_TOPUP` (działają tylko z
nałożonym `…-variants.patch`).

## TL;DR

- **Odtworzone:** X, eye-60, wóz o 4:00 → 9,11 → 9,44 min (3★ → 2★); o 3:00 → 9,65, o 6:00 → 9,45.
  I, eye-60, wóz o 7:00 → **przegrana** (11,38 → 12,00), o 2:00/3:00/8:00 +23/+35/+17 s.
- **To nie jest wyjątek X i I.** Na 195 próbach (13 misji × eye-30/60 × zakup 1:00..9:00) jeden dodatkowy wóz
  **spowalnia w 56 (> 3 s) i odbiera pieczęć w 28**; średnio +5,3 s.
- **Przyczyna to nie kradzież zleceń ani most.** Dyspozytor nigdy nie odbiera zlecenia wozowi w trasie. Most
  jednopasowy w tych przebiegach blokuje 0–6 s na całą grę (hipoteza z D-127 się nie potwierdza). Są trzy
  mechanizmy: (1) **zachłanny przydział do najbliższego WOLNEGO wozu.** Daleki wolny wóz dostaje kurs i
  rezerwuje towar, choć zajęty wóz kończący rozładunek obok byłby na miejscu wcześniej. (2) **Drobnica do
  warsztatów w misjach.** Warsztat, który ma wkład, prosi o 1–2 szt. (`minQty = min(want, cap)`; D-94 wyłączył to
  tylko w dolinie). Wolny wóz od razu jedzie po 1 drewno. (3) **Wkład dla warsztatu, którego wyrobu nikt już nie
  chce.** W I po komplecie desek tartak dalej dostaje drewno po 1 szt., a chleb czeka.
- **Prototyp A („przyjazd przed wysłaniem”, `2026-11-05-more-wagons-slower.patch`, ~25 linii w
  `logistics.ts`)** zmniejsza liczbę prób, w których dodatkowy wóz szkodzi, z 56 do 28, a straconych pieczęci
  z 28 do 5 (z tego 2 to m4, gdzie wóz zjada srebro na kamienny most przed lodem — to nie dyspozytor).
  **A + C** (C = brak wkładu dla niepotrzebnego warsztatu): 28 / 4, gracz bez dodatkowego wozu: suma pieczęci
  61 = 61, łączny czas −38,7 min na 122 wierszach balansu, zero przegranych.
- **Cena:** zmienia hasze (złote v4: 11 z 26, v7: 21 z 30, ławka dyspozytora 5 z 6) i przestawia balans. W A+C
  pieczęć tracą m6 (8,31 → 8,49, próg 3★ 8,45), m10 (9,11 → 9,36, próg 9,30) i m13 eye-30 (5,49 → 5,52, próg 5,50).
  Zyskują m1, m2, m3, m4 i m5. 23 testy do przestrojenia. **Decyzja należy do właściciela (§6).**

## 1. Co robi ten jeden wóz — X (eye-60, zakup o 4:00)

`npx tsx tools/wagon-probe.ts m10 60 240` (z `JOBS=1` lista kursów):

| | wynik | kursy po 4:00 | niepełne | jedn. | jedn./kurs | puste dojazdy | z ładunkiem | bez zlecenia |
|---|---|---|---|---|---|---|---|---|
| bez wozu | 9,11 min ★3 | 15 | 7 | 69 | 4,60 | 842 s | 925 s | 265 s |
| +1 wóz o 4:00 | 9,44 min ★2 | 20 | 13 | 70 | 3,50 | 980 s | 1101 s | 320 s |

Dodatkowy wóz kosztuje flotę **+405 wozo-sekund (6,75 wozo-min)**, a przewozi **+1 jednostkę**. To 0,15 jedn. na
wozo-minutę, przy około 3,4 jedn./wozo-min reszty floty po 4:00. Prawie cały ten czas idzie na drobnicę.
Wóz 5 dostaje o 4:00 kurs „2 drewna → tartak”. Między 6:59 a 8:26 sześć kursów wiezie do tartaku po
**1 drewno** (W1, W3, W4, W3, W2, W4). Każdy trwa około 60 s, bo tartak (wkład 8) prosi o każdą wolną sztukę,
a wolny wóz zawsze się znajdzie. Odbiory desek częściej łapią wozy wracające z zamku (109 s zamiast 61 s, gdy
wóz rozładowujący drewno w tartaku brał deski od ręki). Ostatnie deski docierają o 9:27 zamiast 9:07.

## 2. Misja I (eye-60, zakup o 7:00 → przegrana)

`JOBS=1 npx tsx tools/wagon-probe.ts m1 60 420`: nowy W6 o 7:00 bierze deski, które o 7:01 wziąłby W1. W1 jedzie
więc po drewno. **Kontrakt na deski jest już pokryty**, a tartak dalej prosi o wkład. O 9:18, 9:28 i 9:39 trzy
wozy wiozą do tartaku po 1 drewno, a deski z tego idą do spichlerza. Łańcuch chleba traci wozy: ostatnie
2 chleby (W1, wyjazd 10:23) nie docierają przed 12:00. Mostowy korek przez całą grę: 0 s (wóz o 7:00) i 0–6 s
w pozostałych próbach eye-60. Teza z D-127 „jednopasowy most się korkuje” w tych danych nie występuje. Wozy
kupione po 5:00 szkodzą, bo **zabierają kursy bliższym wozom** i **rozdrabniają dowóz do warsztatu, który już nie
jest potrzebny**.

## 3. Skala — „jeden wóz więcej” we wszystkich misjach

`npx tsx tools/wagon-monotone.ts`. Pole „wolniej” = próby dłuższe o > 3 s. „Bez wozu” = te same 26 przebiegów
eye-30/60 bez dodatkowego zakupu (czy reguła nie psuje gry temu, kto wozu nie kupuje).

| reguła | próby | wolniej | pieczęć w dół | w górę | śr. Δ | najgorzej | bez wozu: Σ pieczęci / Σ min |
|---|---|---|---|---|---|---|---|
| dziś | 195 | **56** | **28** | 15 | +5,3 s | +284 s | 61 / 223,3 |
| A1 (tylko wóz jadący do samego źródła) | 193 | 36 | 7 | 29 | −3,4 s | +281 s | 58 / 223,2 |
| **A (przyjazd przed wysłaniem)** | 190 | **28** | **5** | 23 | −6,6 s | +265 s¹ | **61 / 216,9** |
| A3 (A, jeden wstrzymany popyt na wóz) | 191 | 24 | 4 | 38 | −13,3 s | +267 s¹ | 59 / 220,0 |
| A5 (A z marginesem 40 % + 10 s) | 196 | 26 | 9 | 46 | −10,9 s | +264 s¹ | 55 / 225,6 |
| B4 (drobnica ≥ 4 także w misjach = D-94) | 193 | 33 | 12 | 11 | −8,6 s | +175 s | 60 / 227,3 |
| B2 | 194 | 42 | 20 | 22 | +0,1 s | +336 s | 58 / 222,7 |
| **B4 + A** | 193 | **6** | **0** | 12 | −17,0 s | **+18 s** | 59 / 223,8 |
| C (bez wkładu dla niepotrzebnego warsztatu) | 197 | 33 | 17 | 23 | +0,4 s | +308 s¹ | 60 / 223,3 |
| **C + A** | 191 | **28** | **4** | 35 | −4,4 s | +268 s¹ | **61 / 214,6** |
| łańcuch (zlecenie w kolejce wozu, A4) | 225 | 20 | 6 | 50 | — | +73 s | **25** / 270,2 ✗ |

¹ Najgorszy przypadek to m4: wóz kupiony o 2:00–3:00 zjada srebro na kamienny most przed lodem. Gracz eye nie
stawia mostu (`stoneBridge` znika z akcji) i wozy stoją przy lodzie. To ekonomia, nie dyspozytor (bramka D-117
`iceBeforeWagon` pilnuje tego już w karcie floty).

Wnioski z tabeli:
- **B4 + A** prawie spełnia założenie „wóz nigdy nie szkodzi” (6 z 193, najgorzej +18 s, zero strat). Drobnica ≥ 4
  w misjach łamie jednak drabinę balansu tak samo jak w badaniu z 2026-11-03 (d4). Przy eye-30/60 m8 spada
  z 3★ (9,40) do **1★ (12,41)**, m11 z 2★ do 1★, m3 z 3★ do 2★. Na długich trasach zapas 4 cykli nie starcza.
  Odrzucona dla misji.
- **Łańcuch** (zarezerwuj kurs od razu dla wozu, który zaraz się zwolni, prototyp A4) zrobiony naiwnie wiąże
  wozy za wcześnie. Gracz bez dodatkowego wozu traci 36 pieczęci. To wymaga nowego pola stanu i migracji.
  Nie warto tego teraz robić.
- Warianty A1, A3 i A5 nie są lepsze od A. Wynik zależy od losowego przetasowania, a nie od reguły.

## 4. Pełny balans, boty, hasze (A oraz C + A)

`tools/balance-night6.ts m1..m13 --no-search` (123 wiersze: passive, wagons-only, eye/eye+ 10/30/60 s, scan+,
letter+eye+):

| | pieczęć w górę | w dół | wygrana → porażka | porażka → wygrana | Σ Δ min (wygrane w obu) |
|---|---|---|---|---|---|
| A | 19 | 18 | 1 (m9 passive) | 1 (m10 passive) | −30,0 |
| **C + A** | 21 | 17 | **0** | 1 (m10 passive) | **−38,7** |

C + A, pieczęć w dół (wszystkie tuż przy progu):
- m6, wszyscy gracze eye/scan/letter: 8,31 → 8,49 (próg 3★ 8,45) → 2★;
- m10, eye-30/60 i scan/letter: 9,11–9,13 → 9,36 (próg 9,30) → 2★;
- m13 eye-30/scan: 5,49 → 5,52 (próg 5,50) → 2★.

W górę: m1 scan+ i letter (1 → 2★), m2 eye-10/30 (→ 2–3★), m3 eye-10/60 (2 → 3★), m4 eye-30 (2 → 3★),
m5 eye-30/60 i passive (→ 3★/2★), m12 passive (1 → 3★).

Boty: `npm run bot` (m1) 8,85 ★3 → A: 9,17 ★3, C + A: 9,02 ★3. `tools/bot-m10.ts` dziś: nic 0★ (porażka) /
częściowa 2★ / właściwa 3★ / zła 1★. Po A: 1 / 2 / **2** / 1 (lekcja X przestaje dawać 3★). Po C + A:
**2** / 2 / 3 / 2 (lekcja działa, ale „nic” daje 2★, a test wymaga ≤ 1).

Hasze (A; C + A ma tę samą liczbę padających testów): `npm test` → **23 z 480 testów pada**. Złote v4 misji I–VI
i laboratorium: **11 z 26** zmienionych. Złote v7 kontraktów: **21 z 30**. Ławka dyspozytora
(`dispatch-reachability`): 5 z 6 zrzutów. Do tego testy drabiny misji (m4, m5, m6, m8, m9, m10, m12, m13),
`sandbox` (ranga 0 → 1 po bezczynności), `bridge`/`s2-mechanics`/`seasons-live` (scenariusze z korkiem i lodem
przestały go wywoływać — trzeba je przestawić, nie naprawiać).

## 5. Opcje i ryzyko

| opcja | co zmienia | zysk | ryzyko |
|---|---|---|---|
| **0. Bez zmian** (obecna bramka D-127/D-128) | nic | hasze i balans bez zmian | 28 z 195 zakupów „lekarstwa” odbiera pieczęć. Karta pokazuje „Kup wóz” tylko tam, gdzie zmierzono, że nie szkodzi. Gracz, który kupi wóz z własnej woli, nadal może przegrać I. |
| **A. Przyjazd przed wysłaniem** | `pickWagon`: gdy zajęty wóz (rozładunek lub reszta trasy + 3 s + pusty dojazd) stanie przy źródle wcześniej niż najbliższy wolny, kurs czeka do następnego dispatchu | wolniej 56 → 28, straty 28 → 5, gra bez wozu −30 min | hasze. Balans m6/m10/m13 przy progu. Lekcja X (bot „właściwa”) 3 → 2★. Wstrzymany popyt nie ma jeszcze własnego `StallReason` (wypchnięcie nadwyżki spada na `OUTPUT_FULL.NO_WAGON` — karta „Kup wóz” byłaby kłamstwem: trzeba dodać „wóz N przyjedzie po to za 0:12”) |
| **C. Bez wkładu dla niepotrzebnego warsztatu** | warsztat w misji, którego żadnego wyrobu nie chce już zamek (cały list) ani inny warsztat na mapie, nie zamawia wkładu | drobnica do tartaku po desce w I znika. Mało zmienia sam (wolniej 33, straty 17) | to samo rozdrobnienie co A: m6 spada przez transze (wyrób potrzebny w późniejszym liście się liczy — warto sprawdzić osobno) |
| **C + A** (zalecane do decyzji) | obie | wolniej 28, straty 4, 0 przegranych, −38,7 min, Σ pieczęci bez zmian | 3 progi 3★ do przesunięcia o 3–14 s (m6 8,45 → ~8,55, m10 9,30 → ~9,40, m13 5,50 → ~5,55) i próg 2★ m10 (test „nic ≤ 1★”) plus 23 testy i złote hasze do nagrania od nowa |
| B. Drobnica ≥ 4 w misjach | D-94 dla kontraktów | z A prawie idealna monotoniczność | m8 3 → 1★, m11, m3 — odrzucona (jak d4 2026-11-03) |

## 6. Rekomendacja i pytanie do właściciela

**Rekomendacja:** wdrożyć **C + A** jako jedną zmianę „dyspozytor 2” (D-nowe, bez zmiany wersji stanu: reguły czytają
tylko istniejące pola) razem z:
(a) nowym, spokojnym powodem dla wstrzymanego kursu („Wóz 3 przyjedzie po to za 0:12”) zamiast spadania na
`NO_WAGON`;
(b) przesunięciem progów 3★ m6/m10/m13 o 3–14 s i progu 2★ m10, tak by drabiny lekcji (bot nic ≤ 1 / właściwa 3)
wróciły;
(c) ponownym nagraniem złotych haszy v4/v7 i ławki dyspozytora;
(d) potem poluzowaniem bramki D-127/D-128 — karta „Kup wóz” może pojawiać się częściej, bo zakup przestaje szkodzić.
Do zrobienia w osobnym dniu, z pełnym pomiarem jak tutaj. Nie łączyć z innymi zmianami balansu.

**Pytanie do właściciela:** czy zgadzasz się na zmianę dyspozytora, która zmienia hasze wszystkich misji
(11/26 złotych v4, 21/30 v7) i wymaga przestrojenia trzech progów 3★ (m6, m10, m13 o kilka–kilkanaście sekund)?
W zamian kupienie wozu prawie przestaje szkodzić (straty pieczęci po zakupie 28 → 4 na 195 prób). Gra bez
dodatkowych wozów ma ten sam łączny wynik pieczęci i jest średnio o ~19 s szybsza na przebieg. Jeśli nie, zostaje
obecna bramka karty (D-127/D-128), a gracz kupujący wóz „na własną rękę” nadal może sobie zaszkodzić (I: przegrana
po wozie o 7:00).

## 7. Pliki

- `docs/research/2026-11-05-more-wagons-slower.patch` — reguła A, czysta (bez przełączników), na `src/sim/logistics.ts`.
- `docs/research/2026-11-05-more-wagons-slower-optionC.patch` — reguła C (nakładać razem z A: `git apply` obu).
- `docs/research/2026-11-05-more-wagons-slower-variants.patch` — wszystkie warianty z przełącznikiem `RULES`
  (A1–A5, B-N, łańcuch `queued`) do powtórzenia pomiarów: `RULE_ARRIVE=2 RULE_TOPUP=4 npx tsx tools/wagon-monotone.ts`.
- `tools/wagon-probe.ts`, `tools/wagon-monotone.ts`, haczyk `probe` w `tools/balance-night6.ts`.

Zastrzeżenie: gracz eye reaguje na to, co widzi, więc dodatkowy wóz zmienia też jego późniejsze kliknięcia
(np. I o 5:30: eye kupuje jeszcze jeden wóz). Opisane wyżej przypadki X o 4:00 i I o 7:00 są czyste: gracz
wykonuje te same akcje co bez wozu, a różnicę robi wyłącznie dyspozytor.
