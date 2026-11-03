# Audyt jakości diagnozy postojów (m1–m12 + wolna dolina)

Data: 2026-11-03, gałąź `claude/research-day4b`. Zmiany tylko w `tools/` i `docs/research/`; `src/` nietknięte.
Narzędzie: `tools/diagnosis-audit.ts` (logika) + `tools/diagnosis-audit-run.mjs` (bundler esbuild: `src/i18n/index.ts`
używa `import.meta.glob` z Vite, więc pod `tsx` się nie ładuje; bundler podmienia tylko tę jedną linię na `{}` i
uruchamia **prawdziwe** `panels.ts`, `stalls.ts`, `codex.ts`, `format.ts` po polsku w Node).

```bash
node tools/diagnosis-audit-run.mjs                     # wszystkie misje + dolina, ~15 s, tabele na stdout
node tools/diagnosis-audit-run.mjs m4 m6               # wybrane misje
node tools/diagnosis-audit-run.mjs m4 --case=nic@390   # jedna próbka w całości (łańcuch, sondy, tekst PL karty i arkusza)
AUDIT_OUT_DIR=/jakiś/katalog node tools/...            # gdzie zapisać JSON z próbkami (domyślnie /tmp)
```

## TL;DR

1. **Diagnoza „brak drogi” działa świetnie.** `NO_ROAD` i `NO_WAGON.NONE_CAN_REACH` mają przycisk „Zbuduj drogę/most”
   w 100% próbek, a przycisk usuwa postój w 98% / 82% (m1, m5, m6, m12 — lekcje drogowe są czytelne i naprawialne jednym tapnięciem).
2. **Największy problem: `OUTPUT_FULL.NO_WAGON` („Pełno — brak wozu”, przycisk „Kup wóz”).** To najczęstszy korzeń
   najgorszego postoju w całej grze (140 z 511 próbek z postojem, 27%), w 74% oznaczony jako krytyczny (wosk),
   a **dokupienie wozu usuwa go w 60 s tylko w 11% przypadków** (3 wozy: 36%). Odbiorcy towaru byli głodni tylko w 6/140
   próbkach — w pozostałych to nieszkodliwa nadwyżka (odbiorca ma zapas, kontrakt tego towaru nie potrzebuje). Dominuje
   kartę w m4 (87% czasu), m8 (75–82%), m5 po lekcji (69%), m1 po lekcji (53%) i w dolinie (56%).
3. **Po poprawnym zagraniu karta nadal krzyczy.** W m4, m5, m6, m8, m12 po wykonaniu lekcji najgorszy postój jest
   krytyczny przez 47–100% czasu (fałszywe alarmy z p. 2 i `STORAGE_FULL` małego spichlerza, gdy duży ma miejsce).
4. **`STORAGE_FULL` nie ma żadnej podpowiedzi** (0% przycisku), choć w m6/m12 przed lekcją obok stoi niepodłączony duży
   spichlerz, który za 2 srebra rozwiązuje misję.
5. **Lód w m4 jest niewidoczny w łańcuchu:** gdy 3–5 z 6 wozów stoi `BRIDGE_CLOSED`, karta mówi „Gospodarstwo: pełno,
   brak wozu → Kup wóz” (nie działa: 0/6), bez wskazówki o lodzie.
6. **Kodeks objaśnia nie ten status w 33% próbek:** łańcuch kończy się na budynku `WORKING` albo wozie w ruchu
   (`TO_PICKUP`, `TO_DROPOFF`, `LOADING`) i fałda „Co to znaczy?” tłumaczy „Produkuje” / „Jedzie po ładunek” zamiast samego postoju.

Wszystkie proponowane naprawy (rozdz. 5) są w warstwie UI albo w czytających funkcjach `diagnose.ts`, których `step()`
nie woła — **nie zmieniają złotych hashy**.

## 1. Metoda

**Scenariusze** (strategie wzięte z istniejących botów, bez nowych pomysłów na grę):

| misja | „nic” | „lekcja” (właściwa naprawa z bota) | dodatkowo |
|---|---|---|---|
| m1–m3 | brak akcji | `tools/balance.ts`: most+2 wozy / kamienny most @45 s / bruk @25 s | – |
| m4–m6 | brak akcji | `balance.ts` plan z `expect: 3` | m5, m6: „1 wóz @0:30” (częściowa) |
| m7–m9 | brak akcji | `bot-missions-7-9.ts` „wlasciwa” | – |
| m10–m12 | brak akcji | `bot-missions-10-12.ts` „wlasciwa” | m10, m12: `WRONG_FIXES` „2 wozy” |
| dolina | – | `bot-sandbox.ts` DECENT, 60 min | – |

**Próbkowanie co 30 s gry.** W każdej próbce bierzemy to, co widzi gracz: `rankStalls(world)[0]` (karta najgorszego
postoju w HUD) i zapisujemy:

- łańcuch `explainBuilding(world, id, 5, true)` (tak jak arkusz „Dlaczego stoi?”), klucz statusu korzenia
  (`codexKey`), czy korzeń jest prawdziwym postojem (`isStall`/`NO_INPUT` dla budynku, `isWagonWait` dla wozu),
  czy istnieje wpis w `STALL_CODEX` (zawsze istnieje — kodeks jest wyczerpujący, więc liczymy „kodeks trafny” =
  wpis istnieje **i** korzeń jest postojem);
- **arkusz wyrenderowany naprawdę** (`buildingSheet(nav, id).update(fakeSheet)`), z HTML odczytujemy, co jest
  oferowane: przycisk drogi (`data-act="fix:"`), „Kup wóz” (`buy:`), „Spichlerz” (`granary:`) oraz wskazówki bez
  przycisku (`granary-hint`, `jam-hint`, `ice-hint`, `season-hint`, `shared-hint`, `thin-hint`); `cureFor()` (podświetlenie narzędzia w HUD);
- tekst PL karty HUD (kopia `stallReason` z `hud.ts`, nieeksportowana) i pełny tekst arkusza.

**Skuteczność.** Stan jest klonowany (`structuredClone`, ten sam teren), w klonie dokładamy +10 000 srebra (mierzymy
skuteczność, nie stać-czy-nie-stać), wykonujemy komendę przycisku (dokładnie tę: `gapSuggestion().cells` jako droga
gruntowa, `buyWagon` w stajni) i liczymy czas do „postój zniknął” = `stalledTicks === 0` przez ≥ 5 s z rzędu (jednoklatkowe
mignięcie się nie liczy), horyzont 60 s. To samo w klonie bez akcji (kontrola). **Naprawa działa** = postój znika w 60 s
i co najmniej 10 s wcześniej niż w kontroli. Kontrfaktycznie: +1 wóz, +3 wozy, +1 wóz/120 s i **komenda lekcji misji**.
Dodatkowe sondy per status: ilu odbiorców towaru jest głodnych, czy kontrakt jeszcze go potrzebuje, ile wozów stoi
`BRIDGE_CLOSED/BRIDGE_JAM/NO_ROUTE`, czy stajnia w ogóle dojeżdża do źródła przy `ALL_BUSY`, czy inny spichlerz ma miejsce.

Ograniczenia: boty grają skryptem (nie reagują na kartę), próbka co 30 s (≈ 635 próbek, 511 z postojem), horyzont 60 s.
Przycisk „Spichlerz” (`granary-btn`) nie wystąpił ani razu (w misjach, gdzie pojawia się `granary`, spichlerza nie wolno
stawiać — jest tylko wskazówka), więc jego skuteczność nie jest zmierzona (narzędzie ma do tego `granaryCmds`). Karta wozu
nie jest audytowana: najgorszy postój to zawsze budynek.

## 2. Wyniki per misja

Kolumny: *krytyczny* — najgorszy postój ma wosk (`isCritical`); *korzenie* — klucz statusu korzenia łańcucha, udział
w próbkach z postojem; *kodeks trafny* — fałda „Co to znaczy?” objaśnia prawdziwy postój; *przycisk* — arkusz ma
przycisk naprawy; *wskazówka* — tylko tekst; *naprawa działa* — wśród próbek z przyciskiem; *lekcja* — gdy przycisku
brak, czy komenda lekcji misji usunęłaby ten postój.

| misja / scenariusz | próbek | z postojem | krytyczny | najczęstsze korzenie (udział czasu) | kodeks trafny | przycisk | wskazówka | naprawa działa | lekcja, gdy brak przycisku |
|---|---|---|---|---|---|---|---|---|---|
| m1 / nic | 24 | 24 | 100% | NO_WAGON.NONE_CAN_REACH 92%, NO_WAGON.ALL_BUSY 8% | 100% | 100% | 0% | 75% (18/24) | – |
| m1 / lekcja | 21 | 19 | 47% | OUTPUT_FULL.NO_WAGON 53%, wagon.TO_PICKUP 32%, NO_WAGON.ALL_BUSY 16% | 68% | 68% | 0% | 31% (4/13) | – |
| m2 / nic | 21 | 18 | 6% | wagon.TO_DROPOFF 39%, WORKING 39%, wagon.TO_PICKUP 17% | 6% | 6% | 0% | 100% (1/1) | 6% (1/17) |
| m2 / lekcja | 17 | 14 | 0% | WORKING 50%, wagon.TO_DROPOFF 29%, wagon.TO_PICKUP 21% | 0% | 0% | 0% | – | – |
| m3 / nic | 17 | 17 | 18% | wagon.TO_PICKUP 53%, NO_WAGON.ALL_BUSY 29%, WORKING 18% | 29% | 29% | 0% | 80% (4/5) | 33% (4/12) |
| m3 / lekcja | 11 | 8 | 0% | wagon.TO_PICKUP 75%, NO_WAGON.ALL_BUSY 13%, WORKING 13% | 13% | 13% | 0% | 100% (1/1) | – |
| m4 / nic | 23 | 23 | 91% | OUTPUT_FULL.NO_WAGON 87%, NO_WAGON.ALL_BUSY 13% | 100% | 100% | 0% | 9% (2/23) | – |
| m4 / lekcja | 12 | 12 | 75% | OUTPUT_FULL.NO_WAGON 75%, NO_WAGON.ALL_BUSY 25% | 100% | 100% | 0% | 17% (2/12) | – |
| m5 / nic | 19 | 19 | 100% | NO_ROAD 100% | 100% | 100% | 0% | 95% (18/19) | – |
| m5 / lekcja | 16 | 13 | 62% | OUTPUT_FULL.NO_WAGON 69%, wagon.TO_PICKUP 15%, NO_ROAD 8% | 85% | 85% | 0% | 9% (1/11) | – |
| m5 / 1 wóz | 18 | 18 | 100% | NO_ROAD 100% | 100% | 100% | 0% | 94% (17/18) | – |
| m6 / nic | 17 | 17 | 100% | NO_ROAD 76%, STORAGE_FULL 24% | 100% | 76% | 0% | 100% (13/13) | 50% (2/4) |
| m6 / lekcja | 16 | 16 | 100% | STORAGE_FULL 94%, NO_ROAD 6% | 100% | 6% | 0% | 100% (1/1) | – |
| m6 / 1 wóz | 17 | 17 | 100% | NO_ROAD 76%, STORAGE_FULL 24% | 100% | 76% | 0% | 100% (13/13) | 0% (0/4) |
| m7 / nic | 21 | 6 | 0% | wagon.LOADING 50%, wagon.TO_PICKUP 33%, wagon.TO_DROPOFF 17% | 0% | 0% | 0% | – | 0% (0/6) |
| m7 / lekcja | 12 | 5 | 0% | wagon.LOADING 40%, wagon.TO_DROPOFF 40%, wagon.TO_PICKUP 20% | 0% | 0% | 0% | – | – |
| m8 / nic | 21 | 20 | 75% | OUTPUT_FULL.NO_WAGON 75%, NO_WAGON.ALL_BUSY 15%, wagon.TO_PICKUP 5% | 90% | 90% | 0% | 17% (3/18) | 0% (0/2) |
| m8 / lekcja | 18 | 17 | 71% | OUTPUT_FULL.NO_WAGON 82%, wagon.TO_PICKUP 6%, wagon.LOADING 6% | 88% | 88% | 0% | 0% (0/15) | – |
| m9 / nic | 22 | 16 | 13% | NO_WAGON.ALL_BUSY 50%, wagon.TO_PICKUP 44%, WORKING 6% | 50% | 50% | 0% | 75% (6/8) | 0% (0/8) |
| m9 / lekcja | 17 | 13 | 15% | wagon.TO_PICKUP 62%, NO_WAGON.ALL_BUSY 15%, OUTPUT_FULL.NO_DESTINATION 15% | 31% | 15% | 15% | 50% (1/2) | – |
| m10 / nic | 24 | 7 | 86% | OUTPUT_FULL.NO_DESTINATION 86%, WORKING 14% | 86% | 0% | 100% | – | 0% (0/7) |
| m10 / lekcja | 16 | 11 | 0% | wagon.TO_PICKUP 82%, WORKING 18% | 0% | 0% | 0% | – | – |
| m10 / zły: 2 wozy | 20 | 1 | 0% | WORKING 100% | 0% | 0% | 100% | – | 0% (0/1) |
| m11 / nic | 21 | 12 | 0% | wagon.TO_PICKUP 75%, NO_WAGON.ALL_BUSY 17%, wagon.TO_DROPOFF 8% | 17% | 17% | 0% | 50% (1/2) | 10% (1/10) |
| m11 / lekcja | 17 | 8 | 0% | wagon.TO_PICKUP 63%, wagon.TO_DROPOFF 25%, wagon.UNLOADING 13% | 0% | 0% | 0% | – | – |
| m12 / nic | 20 | 20 | 100% | NO_ROAD 85%, STORAGE_FULL 15% | 100% | 85% | 0% | 100% (17/17) | 33% (1/3) |
| m12 / lekcja | 17 | 15 | 53% | STORAGE_FULL 60%, OUTPUT_FULL.NO_WAGON 27%, wagon.TO_PICKUP 7% | 87% | 27% | 0% | 50% (2/4) | – |
| m12 / zły: 2 wozy | 20 | 20 | 100% | NO_ROAD 85%, STORAGE_FULL 15% | 100% | 85% | 0% | 100% (17/17) | 100% (3/3) |
| dolina / DECENT 60 min | 120 | 105 | 33% | OUTPUT_FULL.NO_WAGON 56%, wagon.TO_PICKUP 42%, wagon.LOADING 2% | 56% | 56% | 0% | 19% (11/59) | – |

**Per status korzenia (wszystkie misje):**

| status korzenia | próbek | krytyczny | przycisk | przycisk działa | +1 wóz działa | lekcja działa |
|---|---|---|---|---|---|---|
| OUTPUT_FULL.NO_WAGON | 140 | 74% | 100% („Kup wóz”) | 11% | 11% | 0% (n=35) |
| wagon.TO_PICKUP | 117 | 0% | 0% | – | 2% | 16% (n=31) |
| NO_ROAD | 99 | 100% | 100% (droga) | **98%** | 0% | 98% (n=97) |
| STORAGE_FULL | 38 | 89% | **0%** | – | 5% | 43% (n=14) |
| NO_WAGON.ALL_BUSY | 35 | 43% | 100% („Kup wóz”) | 63% | 63% | 71% (n=24) |
| WORKING | 24 | 0% | 0% | – | 13% | 8% (n=13) |
| NO_WAGON.NONE_CAN_REACH | 22 | 100% | 100% (droga+most) | **82%** | 0% | 95% (n=22) |
| wagon.TO_DROPOFF | 17 | 0% | 0% | – | 0% | 0% (n=9) |
| wagon.LOADING | 10 | 0% | 0% | – | 0% | 0% (n=4) |
| OUTPUT_FULL.NO_DESTINATION | 8 | 100% | 0% (tylko wskazówka) | – | 0% | 0% (n=6) |

Co widać: tam, gdzie lekcja jest „brakującym odcinkiem drogi” (m1, m5, m6, m12), diagnoza prowadzi wprost do naprawy
jednym tapnięciem. Tam, gdzie lekcja dotyczy przepustowości (m2 most jednopasmowy, m3 deszcz, m7 długa trasa,
m11 za mało wozów), karta pokazuje głównie łagodne postoje (`WAITING_PICKUP` → wóz w drodze) — to uczciwe, ale lekcji
nie niesie; tę rolę ma karta tempa kontraktu, a nie łańcuch. Najgorzej jest tam, gdzie karta jest **głośna i myląca**:
m4, m8, dolina (nadwyżka „brak wozu”) i m6/m12 po lekcji (pełny mały spichlerz).

## 3. Konkretne przypadki

### A. „Pełno — brak wozu” to zwykle nadwyżka, a „Kup wóz” jej nie usuwa (m4, m8, m5, m1, dolina)

- Przykład: **m4 / nic, tick 3900** — `node tools/diagnosis-audit-run.mjs m4 --case=nic@390`
  HUD: „Gospodarstwo: pełny magazyn, brak wozu”. Arkusz: „Pełno zboża — brak wozu do odbioru · Przestój: 4:44 ·
  Naprawa: Kup wóz −30 · Wszystkie wozy są zajęte: nowy wóz ruszy ze stajni do najpilniejszej dostawy.”
  Młyn (jedyny odbiorca zboża) sam stoi z pełnym wyjściem. +1 wóz: brak efektu w 60 s i w 120 s, +3 wozy: brak efektu.
- **m8 / lekcja, tick 3000** (`m8 --case=lekcja@300`): „Kamieniołom: pełny magazyn, brak wozu”, krytyczny przez całą
  misję. W spichlerzu leży 12 kamienia (dokładnie tyle, ile trzeba na bruk z lekcji), rezerwa (`STONE_RESERVE` 18) chce
  6 < pełny ładunek, więc dyspozytor wiezie kamień tylko w ostatnim kroku „nadwyżki”. Kup wóz: 0/15 skuteczności.
- **Dolina, tick 10800** (`sandbox --case=DECENT@1080`): „Tartak: pełny magazyn, brak wozu”, 56% czasu karty.
  Tu wóz pomaga częściej (rynek bierze 75% floty), ale +1 wóz w 60 s: 11/59, +3 wozy: 30/59.

Dlaczego: w `logistics.ts` odbiór nadwyżki do spichlerza jest ostatnim krokiem dyspozytora (po zapotrzebowaniu
odbiorców, kontrakcie, rynku i rezerwie kamienia), więc nowy wóz bierze najpierw pilniejsze zlecenie. Sonda „głodny
odbiorca” (odbiorca tego towaru w `NO_INPUT`/`NO_WAGON`/`WAITING_UPSTREAM` na ten towar) była prawdziwa w **6 ze 140**
próbek, a kontrakt potrzebował towaru w 10/140. Zatem 74% wosku na tym statusie to w większości fałszywy alarm z
nieskuteczną radą, i to on sprawia, że po poprawnej lekcji m4/m5/m8 karta dalej świeci na czerwono.

### B. Lód w m4: wozy stoją przy moście, a karta każe kupić wóz

**m4 / nic, ticki 3300–4800** (`m4 --case=nic@330` … `@480`): 3, 4, 5, 5, 5, 5 z 6 wozów w `BRIDGE_CLOSED`. Najgorszy
postój to gospodarstwo `OUTPUT_FULL.NO_WAGON` (łańcuch o długości 1), więc `iceHtml` (szuka `BRIDGE_CLOSED` w łańcuchu)
nie pokazuje wskazówki o lodzie, a przycisk „Kup wóz” nie działa (0/6; nowy wóz też utknie po złej stronie). To jest
dokładnie moment lekcji m4 („kamienny most nie zamarza”) i karta go nie nazywa.

### C. `STORAGE_FULL` bez żadnej podpowiedzi, a potem fałszywy wosk po lekcji (m6, m12)

- **m6 / nic, tick 900** (`m6 --case=nic@90`): „Spichlerz: spichlerz pełny”, arkusz tylko z kodeksem („Zbuduj kolejny
  spichlerz…”), bez przycisku. Sonda: drugi, duży spichlerz `#5` stoi `NO_ROAD` 0/60 — lekcja misji (2 pola drogi,
  2 srebra) usuwa postój. W tym samym czasie, gdy karta pokazuje `warehouse#5:NO_ROAD`, przycisk drogi działa w 100%
  — czyli gracz dostaje naprawę albo nie, zależnie od tego, który z dwóch spichlerzy akurat wygrał ranking.
  To samo w **m12 / nic, ticki 600–1200**.
- **m6 / lekcja, cała misja** (`m6 --case=lekcja@240`): po podłączeniu dużego spichlerza mały (12/12 zboża) jest
  krytycznym najgorszym postojem w 94% próbek, choć duży ma 6–18/60 wolnego miejsca (`roomElsewhere: true`). Gracz,
  który zrobił dokładnie to, czego uczy misja, widzi wosk bez rady. **m12 / lekcja**: 60% czasu.

### D. m1 bez mostu: `ALL_BUSY` → „Kup wóz”, choć żaden wóz nie dojedzie

**m1 / nic, ticki 900 i 1200** (`m1 --case=nic@90`): „Młyn wodny: wszystkie wozy zajęte”, przycisk „Kup wóz”. Sonda:
źródło zboża (gospodarstwo za rzeką) jest nieosiągalne ze stajni (`stableReachesSource: false`); +1 wóz: brak efektu,
most z lekcji: postój znika od razu. Przyczyna w dyspozytorze: gdy nie ma wolnego wozu, osiągalność liczy się od
źródła do odbiorcy (`reachable(s.gate, d.b.gate)`), a nie od stajni, więc `NONE_CAN_REACH` zamienia się w `ALL_BUSY`,
gdy tylko oba wozy jeżdżą. Rzadkie (8% m1/nic), ale to pierwsza misja i rada jest wprost błędna.

### E. Węgiel „nie ma dokąd wieźć” po wypełnieniu zamówienia (m9, m10)

**m10 / nic, ticki 5700–7200** (`m10 --case=nic@600`) i **m9 / lekcja, 4800–5100**: „Węglarnia: pełny magazyn, nie ma
dokąd wieźć”, wosk, wskazówka „Połącz drogą spichlerz albo odbiorcę, który go przyjmie”. Sonda: zamek ma już cały
węgiel z kontraktu (`contractDone: true`). Postój jest nieszkodliwy (towar po prostu nie jest już potrzebny), a w m10
jest to 86% czasu karty — i odciąga uwagę od prawdziwej lekcji (drugi drwal na deski).

### F. Kodeks objaśnia status, który nie jest postojem (33% próbek z postojem)

**m2 / nic, tick 1500** (`m2 --case=nic@150`): łańcuch „Gospodarstwo — pełno zboża, czeka, aż odbiorca weźmie więcej →
Młyn wodny — Produkuje”, a fałda „Co to znaczy?” mówi: „Produkuje — Budynek właśnie wytwarza towar… Pozwól dokończyć
bieżący cykl.” Podobnie **m11 / nic, tick 4500**: „Jedzie po ładunek — Poczekaj, jeśli wóz jedzie prawidłowo.”
`panels.ts` bierze kodeks dla ostatniego ogniwa łańcucha bez sprawdzenia, czy jest ono postojem (`chainHtml` sam to
sprawdza, bo nie daje mu znacznika „przyczyna”). Dotyczy 169 z 511 próbek (WORKING, TO_PICKUP, TO_DROPOFF, LOADING,
UNLOADING). Treść nie jest fałszywa, ale nie odpowiada na „dlaczego stoi?” — w 30-sekundowym budżecie to strata.

### G. Obserwacje bez osobnej naprawy

- **m2, m7, m11 — lekcja przepustowości niewidoczna w karcie.** W m2/nic najgorszy postój jest łagodny w 17/18 próbkach,
  wozy w `BRIDGE_JAM` widać tylko w 6/21 próbkach, lekcja (kamienny most) usuwa kartowy postój w 1/17. Łańcuch nie jest
  tu narzędziem lekcji — warto sprawdzić osobno, czy karta tempa kontraktu ją niesie (poza zakresem tego audytu).
- **`ALL_BUSY` przy zdrowej sieci jest dobrze zdiagnozowany:** „Kup wóz” działa w 63% (wszystkie wyjątki poza m1 to m3
  w deszczu, gdzie lekcją jest bruk).
- **m8 — czy kamień „stoi”**: patrz A; uczciwszą radą byłoby „W spichlerzu jest 12 kamienia — wystarczy na bruk”,
  z przejściem do narzędzia drogi.

## 4. Szacunek efektu napraw 1, 3 i 5

Narzędzie liczy też ranking z proponowanymi regułami „spokojnego” postoju (`harmless()` w `tools/diagnosis-audit.ts`:
nadwyżka bez głodnego odbiorcy w misji kontraktowej i bez niedoboru kamienia na drogi, pełny spichlerz przy wolnym
osiągalnym, towar kontraktu już dostarczony w całości). Udział próbek z krytycznym najgorszym postojem:

| misja / scenariusz | dziś | po regułach 1+3+5 |
|---|---|---|
| m4 / nic | 91% | 17% |
| m4 / lekcja | 75% | 17% |
| m5 / lekcja | 50% | 13% |
| m6 / lekcja | 100% | 38% |
| m10 / nic | 25% | 0% |
| m12 / lekcja | 47% | 12% |
| m1 / lekcja | 43% | 29% |
| m9 / lekcja | 12% | 0% |
| m1, m5, m6, m12 / nic | 100% | 100% (prawdziwe braki drogi — bez zmian, dobrze) |
| m8 / nic, lekcja | 71% / 67% | 67% / 67% (reguła kamienia jest ostrożna, patrz 3G) |
| dolina | 29% | 29% (rynek: nadwyżka ma tam wartość, reguła jej nie wycisza) |

Razem: krytyczny najgorszy postój w 282 → 224 z 635 próbek, przy czym prawie cały spadek dotyczy sytuacji **po**
poprawnym zagraniu, a „nic” w misjach drogowych zostaje czerwone.

## 5. Naprawy — priorytety

Żadna z poniższych nie dotyka `step()` ani stanu — **złote hashe bez zmian** (`diagnose.ts` to funkcje tylko-do-odczytu,
jak `outputCustomer`; `tests/determinism-reads.test.ts` pilnuje dziś tylko `wagonEta` — warto dopisać nowe odczyty).
Sprawdzone: m1, m4, m6, m12 z wywołaniami `rankStalls`/`explainBuilding`/`cureFor`/`suggestLinkToStable` co 30 s między
tickami kończą się tym samym hashem co bez nich. Testy do aktualizacji: `stall-readability`, `stall-ranking-cache`,
ewentualnie `stall-codex`.

1. **Nadwyżka zamiast „brak wozu” (P1; m4, m5, m8, m1, dolina).** W `calmStall()` (`src/ui/stalls.ts`) uznać
   `OUTPUT_FULL.NO_WAGON` za spokojny, gdy żaden odbiorca nie czeka na ten towar, kontrakt go nie potrzebuje i nie
   brakuje kamienia na drogi (warunek z `harmless()`); w `cureFor()` nie podświetlać wtedy „Kup wóz”, a w arkuszu
   zamiast przycisku jedna linia i18n („Nadwyżka: odbiorcy mają zapas, zboże poczeka w gospodarstwie”). W dolinie
   (rynek) zostawić wóz, ale jako minor — +3 wozy pomagają tam w 51% przypadków. Zysk: 27% wszystkich próbek z postojem
   przestaje wysyłać gracza po wóz, który w 89% nic nie zmienia.
2. **Wozy uwięzione przy moście/lodzie jako przyczyna `NO_WAGON`/`OUTPUT_FULL.NO_WAGON` (P1; m4).** W łańcuchu dla
   gracza (`explainBuilding(..., customers = true)` albo w `panels.ts`): gdy ≥ 1/3 floty stoi `BRIDGE_CLOSED`,
   `BRIDGE_JAM` lub `NO_ROUTE`, dołożyć ogniwo do takiego wozu (najbliższego), wtedy `iceHtml`/`jam-hint`/naprawa drogi
   zadziałają same, a `cureFor` nie powie „wóz”. Lekcja m4 staje się widoczna w dokładnie tym oknie (330–480 s), w którym dziś jej nie ma.
3. **`STORAGE_FULL` wskazuje spichlerz do podłączenia albo milknie (P2; m6, m12).** Gdy istnieje spichlerz `NO_ROAD`,
   łańcuch przechodzi do niego (→ istniejący `gapTarget`/przycisk drogi, 2 srebra w m6/m12); gdy inny osiągalny
   spichlerz ma miejsce — postój spokojny (minor, bez wosku); gdy żadnego — `cureFor` = `granary`. Usuwa fałszywy wosk
   po lekcji (m6: 100% → 38%) i daje przycisk przed lekcją w 24% próbek m6/nic, które go dziś nie mają.
4. **Kodeks dla ostatniego ogniwa, które jest postojem (P2; 33% próbek).** W `panels.ts` (arkusz budynku i wozu)
   zamiast `chain[chain.length - 1]` brać ostatnie ogniwo spełniające `rootIsStall` (ta sama funkcja co w `chainHtml`),
   a gdy żadnego — status samego budynku. Jedna linijka, zero nowych tekstów.
5. **`ALL_BUSY` bez dojazdu ze stajni = brak drogi (P3; m1).** W `cureFor()` i `gapTarget()`: dla `NO_WAGON.ALL_BUSY`
   sprawdzić, czy stajnia dojeżdża do jakiegokolwiek źródła towaru; jeśli nie — traktować jak `NONE_CAN_REACH`
   (przycisk mostu z `suggestLinkToStable`). Naprawa w dyspozytorze (`logistics.ts`, liczyć osiągalność od stajni)
   byłaby czystsza, ale **zmienia statusy w stanie, więc i złote hashe** — nie polecam przed playtestem.
6. **Towar kontraktu dostarczony = koniec, nie postój (P3; m9, m10).** `OUTPUT_FULL.NO_DESTINATION`, gdy zamek ma już
   całe zamówienie tego towaru i nikt inny go nie bierze: spokojny, bez wskazówki o spichlerzu, tekst „Zamówienie na
   węgiel wypełnione”. Analogicznie do `outputCustomer` (czytająca funkcja w `diagnose.ts` albo w `stalls.ts`).

Kolejność wdrożenia: 1 i 2 razem (dotyczą tego samego statusu i tej samej rady „Kup wóz”), potem 4 (najtańsza),
3, 5, 6. Po wdrożeniu: ponowić `node tools/diagnosis-audit-run.mjs` — tabela z rozdz. 4 powinna się zgodzić z kolumną
„po regułach”, a kolumna „naprawa działa” dla `OUTPUT_FULL.NO_WAGON` przestaje mieć sens (przycisku tam nie będzie).
