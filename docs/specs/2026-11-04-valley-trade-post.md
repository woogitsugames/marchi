# Specyfikacja: późna wolna dolina — karta „Wąskie gardło” i punkt handlowy za rzeką

Data: 4 listopada 2026 (dzień 8c, research). Gałąź bazowa: `claude/eager-cori-08wt8e` (stan z `cc3bf16`:
renoma zamówień 0,5× i lek „Kup wóz” na zatkany spichlerz już są w kodzie).
Decyzja właściciela (~13:30, `docs/HANDOVER.md`): późna gra doliny = **(a) karta „Wąskie gardło” + punkt handlowy
za rzeką od rangi 4** (125 %, drewniany most zamarza zimą, ranga 5 → 17 000, zapis v9 z migracją).
Podstawa liczb: `docs/research/2026-11-04-valley-late-game.md` (dalej „raport”), prototyp
`docs/research/2026-11-04-valley-late-proto.patch` (projekt D) i nowe pomiary z tego dnia (§6, narzędzie
`tools/valley-bottleneck.ts`).

Ten dokument jest instrukcją wykonawczą. Wszystko, co nie jest tu nazwane, zostaje bez zmian. Kod, komentarze
i commity po angielsku; teksty dla gracza tylko przez i18n (§5).

---

## 0. Streszczenie decyzji projektowych (to, czego prototyp nie rozstrzygał)

| Kwestia | Prototyp | Ta specyfikacja | Dlaczego |
|---|---|---|---|
| Typ budynku | drugi `castle` | nowy typ **`tradePost`** (4×4, jak prototyp) | własna etykieta karty i arkusza (raport §3: `castle:IDLE!` to zła etykieta), brak kolizji z kodem kontraktu |
| Gdzie żyje nasycenie | `market.post` (pole w `MarketState`) | nowy wycinek **`state.tradePost`**, tylko w stanie `sandbox` | `MarketState` jest w każdym stanie: nowe pole zmieniłoby hasze misji |
| Kiedy punkt istnieje | budynek mapy od startu | budynek mapy od startu (nowa gra) / wstawiony migracją v8 → v9 | gracz widzi cel za rzeką od początku; teren pod punktem jest zajęty od startu |
| Wypłata | wspólne `market.cents` | wspólne `market.cents` (bez zmian) | jedna ścieżka zaokrągleń; dokładna suma punktu w `tradePost.earnedCents` |
| Jarmark | działa też w punkcie | działa też w punkcie | zgodność z pomiarem 125 % → R5 119,3 |
| Zamówienia królewskie | `owed` tylko dla pierwszego targu | tylko zamek; punkt **nigdy** nie przyjmuje towaru na zamówienie | zamówienie to zamek; prototyp tak mierzył |
| Brak drogi do punktu | `NO_ROAD` (prawdziwy postój) | `NO_ROAD`, ale **spokojna** pinezka w UI | gracz, który nie chce punktu, nie może mieć wiecznej czerwonej karty |
| Karta „Wąskie gardło” | — (tylko metryka) | tylko UI, próbki poza stanem, progi z pomiaru (§3.1) | zmierzone: rozróżnia „gardło jest” od „wyleczone” |

Nowych komend gracza **nie ma**: punkt otwiera się sam od rangi 4, gracz buduje zwykłą drogą (`road`, powierzchnia 1)
z drewnianym mostem albo brukuje przęsło (`road`, powierzchnia 2). Rozbiórka punktu jest zabroniona.

---

## 1. Symulacja (`src/sim/`)

### 1.1 Dane statyczne (`src/sim/defs.ts`)

1. `STATE_VERSION = 9` (było 8).
2. `BuildingType` (`src/sim/types.ts`): dopisać `| 'tradePost'` **na końcu** unii (po `'brewery'`).
3. `BUILDINGS`: dopisać **na końcu rekordu** (po `brewery`; kolejność kluczy wpływa na `Object.keys(BUILDINGS)` w
   `replay.ts` i w bramce zapisu):
   ```ts
   // free valley late game (D-111): the trading post across the river, a map building, never placed by the player
   tradePost: { type: 'tradePost', w: 4, h: 4, recipe: null, inCap: 0, outCap: 0, storeCap: 0, price: 0 },
   ```
4. Nowa stała (obok `MARKET`):
   ```ts
   /** Free valley trading post across the river (D-111, research 2026-11-04 valley late game, design D). */
   export const TRADE_POST = {
     /** Candidate top-left cells, first free one wins (map build and the v8 -> v9 migration); gate faces north. */
     sites: [{ x: 37, y: 58 }, { x: 43, y: 58 }, { x: 33, y: 58 }, { x: 37, y: 62 }] as readonly { x: number; y: number }[],
     facing: 2,
     /** Rank from which the post buys (4 = Gród). */
     rank: 4,
     /** Price at the post in percent of the castle formula at the post's own saturation. */
     pricePct: 125,
     /** One saturation unit per good recovers every this many ticks (same pace as the castle). */
     recoverTicks: 10 * TICK_HZ,
     /** Sales kept for the sheet ("Ostatnie sprzedaże"). */
     recentMax: 5,
   } as const;
   ```
5. `RANKS[5].renown`: **14 500 → 17 000** (reszta wiersza bez zmian).

### 1.2 Stan (`src/sim/types.ts`)

```ts
/** One sale at the trading post (one wagon unloading), for the sheet. */
export interface TradeSale {
  /** Tick of the sale. */
  tick: number;
  good: Good;
  /** Units sold (1..WAGON_CAPACITY). */
  qty: number;
  /** What the units paid, in hundredths of silver (exact, before the market.cents carry). */
  cents: number;
}

/** Free valley trading post (state v9, D-111). Present only in 'sandbox' states, the last key of the state. */
export interface TradePostState {
  /** Id of the 'tradePost' building; -1 when an old save had no free site for it (migration v8 -> v9). */
  building: number;
  /** The post's own saturation per good, 0..MARKET.cap (castle saturation is untouched by post sales). */
  saturation: GoodMap;
  /** Units sold at the post per good (a subset of ledger.sold). */
  sold: GoodMap;
  /** Hundredths of silver earned at the post in total (exact; silver shown = floor(earnedCents / 100)). */
  earnedCents: number;
  /** The last TRADE_POST.recentMax sales, oldest first. */
  recent: TradeSale[];
}
```
W `SimState` po `valleyEvents?`:
```ts
  /**
   * Free valley trading post (state v9, D-111). Only in 'sandbox' states (absent everywhere else, so contract
   * missions serialize exactly as before); always the last key.
   */
  tradePost?: TradePostState;
```
Wartości domyślne (`freshTradePost(building: number)` w nowym module `src/sim/tradePost.ts`):
`{ building, saturation: emptyGoods(), sold: emptyGoods(), earnedCents: 0, recent: [] }`.
Kolejność kluczy dokładnie taka (hash = `JSON.stringify`).

### 1.3 Nowy moduł `src/sim/tradePost.ts` (czysty, tylko `+ - * /`, `Math.floor/min/max`)

Eksporty:

```ts
export function freshTradePost(building: number): TradePostState;

/**
 * Places the trading post on the first free site of TRADE_POST.sites (place(..., free = true): no silver, no rank gate,
 * placedTick -1, the gate cell gets a dirt road as for every map building). Returns the building id or -1.
 * Used by buildMission (new free valley) and by the v8 -> v9 migration (on a clone of the old state).
 */
export function placeTradePost(world: World): number;

/** The post building of this world, or null (not the free valley, or no site). */
export function tradePostOf(world: World): Building | null;

/** Does the post buy right now? Free valley, market open, rank >= TRADE_POST.rank, the slice and building exist. */
export function postOpen(world: World): boolean;

/** Price of the next unit of g at the post, in hundredths of silver (own saturation, fair, 125 %). */
export function postCents(world: World, g: Good): number;
```
Wzór ceny (identyczny z prototypem, zmierzony):
`postCents = Math.floor(centsAt(g, tp.saturation[g], fairPercent(world, g)) * TRADE_POST.pricePct / 100)`.
`centsAt` z `town.ts` trzeba wyeksportować (dziś prywatna). Liczby całkowite; `floor` na każdej sztuce.

### 1.4 Zmiany w istniejących plikach sim

**`src/sim/missions.ts` – `buildMission`:** po pętli `def.buildings` i **przed** pętlą dróg mapy:
```ts
if (def.id === 'sandbox') state.tradePost = freshTradePost(placeTradePost(world));
```
(`valleyEvents` jest ustawiane wcześniej, więc `tradePost` jest ostatnim kluczem.) W nowej dolinie punkt dostaje
**id 6** (po zamku 5), `nextId` = 7 — tak jak w prototypie, w którym mierzono liczby z raportu. Mapa doliny jest
zawsze `valley1` z seedem 1301 w grze; seedy 1302/1303 (testy, narzędzia) mają ten sam wolny teren pod
(37,58) (sprawdzone `validatePlace`, wszystkie 4 kandydaty wolne na 1301–1303).

**`src/sim/town.ts`:**
- `isMarket(world, b)`: `(b.type === 'castle' && marketOpen(world)) || (b.type === 'tradePost' && postOpen(world))`.
- nowy eksport `marketCents(world, m, g)`: zamek → `unitCents(st, g, fairPercent(world, g))`, punkt → `postCents(world, g)`.
- `sellAt(world, b, g)`: gałąź dla `b.type === 'tradePost'` (kopiuj z prototypu): pętla po sztukach, każda
  `postCents` przy bieżącym `tp.saturation[g]`, potem `tp.saturation[g] = min(MARKET.cap, +1)`; suma sztuk do
  `m.cents` (wspólne przeniesienie groszy jak dziś) i do `tp.earnedCents`; `tp.sold[g] += qty`;
  `tp.recent.push({ tick: st.tick, good: g, qty, cents })`, a gdy dłuższe niż `TRADE_POST.recentMax` —
  `tp.recent.shift()` (mutacja w miejscu jest w porządku: stan jest własnością sim). Reszta jak dla zamku:
  `ledger.consumed/sold`, wypłata `floor(m.cents / 100)`, `coins`, `silverEarned`, **`renown` i `flow` też**
  (sprzedaż w punkcie liczy się do rang, tak mierzono). **Nasycenie zamku nietknięte.**
- `stepTown`: po odnowie nasycenia zamku:
  ```ts
  const tp = st.tradePost;
  if (tp && next % TRADE_POST.recoverTicks === 0) for (const g of GOODS) if (tp.saturation[g] > 0) tp.saturation[g]--;
  ```
- `sandboxStatus().unlocked`/`locked`: bez zmian (dla `tradePost` `unlockRank` = −1 → `NOT_PLACEABLE`, nie
  trafia do żadnej listy w dolinie). W misjach `unlocked` zawiera wszystkie typy — `marketSheet` filtruje `castle`;
  dopisać tam też `tradePost` (§3.4).
- Nowy pomocnik odczytu dla UI (czysty): `tradePostStatus(world): TradePostStatus | null` →
  `{ building, open, linked, prices: { good, cents, castleCents, pct, saturation, sold }[], recent, earned, units }`,
  gdzie `pct = floor(cents * 100 / (MARKET.base[g] * 100))` (procent ceny bazowej), `linked` = brama punktu w tej
  samej składowej sieci co brama dowolnej stajni (`reachable`), `earned = floor(earnedCents / 100)`,
  `units = suma tp.sold`.

**`src/sim/logistics.ts`:**
- `dispatch`, blok targu (z prototypu, z jedną poprawką): lista `markets = st.buildings.filter((b) => isMarket(world, b))`;
  zamiast pętli „targ × towary” — lista par posortowana:
  ```ts
  // goods owed to accepted royal orders go first, and only to the castle (orders are the crown's, D-54)
  const owed = (m: Building, g: Good): number => (m.type === 'castle' && orderOutstanding(st, g) > 0 ? 1 : 0);
  const pairs: { m: Building; g: Good; c: number; o: number }[] = [];
  for (const m of markets) for (const g of GOODS) if (MARKET.base[g] > 0) pairs.push({ m, g, c: marketCents(world, m, g), o: owed(m, g) });
  pairs.sort((a, c) => c.o - a.o || c.c - a.c || GOODS.indexOf(a.g) - GOODS.indexOf(c.g) || a.m.id - c.m.id);
  ```
  Wnętrze pętli (sloty, `inflightPerGood` liczone **per budynek targu**, wybór najbliższego źródła do `m.gate`,
  kamień z granarów wyłączony) bez zmian. Przy jednym targu kolejność par = dzisiejsza kolejność towarów, więc
  dolina przed R4 zachowuje się tak samo (inne są tylko id budynków gracza, +1). Udział floty
  `MARKET.wagonSharePct` jest wspólny dla zamku i punktu (jak w prototypie).
- `statusFor`: nowa gałąź przed `if (b.progress >= 0)` (typ bez receptury nie może dojść do `def.recipe!`):
  ```ts
  if (b.type === 'tradePost') {
    // closed until rank 4; open: a market that only needs a road from a stable (not just a road stub at its gate)
    if (!postOpen(world)) return { k: 'IDLE' };
    return linkedToStable(world, b) ? { k: 'IDLE' } : { k: 'NO_ROAD' };
  }
  ```
  `linkedToStable` = `st.buildings.some((s) => s.type === 'stable' && reachable(world, s.gate, b.gate))`
  (składowe sieci są w cache `network.ts`, koszt pomijalny). Zamek zostaje przy `gateConnected`.
- `topUpHold`, popyt producentów, pchanie do spichlerzy: nic (punkt nie ma receptury, wejść ani wyjść).

**`src/sim/wagons.ts`** (rozładunek, ~l. 388):
```ts
if (isMarket(world, to)) { if (to.type === 'castle') handInOrders(world, to, j.good); sellAt(world, to, j.good); }
```
`acceptsUpTo` / `accepts`: bez zmian (`isMarket` obejmuje punkt; zamknięty punkt nie ma wejść → 0 / false).

**`src/sim/diagnose.ts` – `outputCustomer`:** odbiorca to także otwarty punkt:
`if (!takes && c.type === 'tradePost') takes = postOpen(world);` (po gałęzi zamku).

**`src/sim/commands.ts` – `demolishBuilding`:** `if (b.type === 'castle' || b.type === 'stable' || b.type === 'tradePost') → CANNOT_DEMOLISH`.
`demolishIsFinal` (`missions.ts`) bez zmian (dotyczy kontraktów).

**`src/sim/index.ts`:** eksportować `TRADE_POST`, `freshTradePost`, `postOpen`, `postCents`, `tradePostOf`,
`tradePostStatus`, `marketCents`, typy `TradePostState`, `TradeSale`.

**Czego nie ruszać:** `events.ts` (zamówienia, kupiec, jarmark — kupiec dalej sprawdza dojazd do *zamku*),
`seasons.ts` (zimowy lód już zamyka drewniane przęsła w dolinie: `ICE_OFFSETS` 3–5 i 9–11 min zimy,
`bridgeIceUntil`), `MarketState`.

### 1.5 Zapis: STATE_VERSION 9 i migracja v8 → v9 (`src/platform/save.ts`)

Wpis w `MIGRATIONS` (styl jak 7 → 8; **czysty**: pracuje na klonie, nie zmienia wczytanego obiektu):
```ts
// v8 -> v9: the free valley's trading post (D-111). A sandbox save gets the post building on the first free site of
// TRADE_POST.sites (placed with the sim's own place(), on a clone: id = nextId, gate road, netVersion + 1) and the
// tradePost slice appended last (key order of a fresh state). No free site: the slice with building -1 (the valley
// plays on without a post). Every other mission is unchanged apart from the version.
8: (s) => {
  const mission = s.mission as Record<string, unknown>;
  const out = JSON.parse(JSON.stringify({ ...s, version: 9 })) as Record<string, unknown>;
  if (mission.id !== 'sandbox') return out;
  const st = out as unknown as SimState;
  st.tradePost = freshTradePost(placeTradePost(worldFromState(st))); // terrain from mapId + seed, as on load
  return out;
},
```
(`worldFromState` z `src/sim/sim.ts`; import do `save.ts` razem z `freshTradePost`, `placeTradePost`.)
Uwaga: `place()` dopisuje budynek z polami w kolejności świeżego stanu i `status` = `{k:'IDLE'}` (bez receptury),
`stalledTicks` 0, `placedTick` −1, ustawia drogę na bramie, jeśli jej nie było, i zwiększa `netVersion`.

**Bramka zapisu (`src/platform/saveGate.ts`):** nowa funkcja `gateTradePost(c, s, version)` wołana po
`gateValleyEvents`:
- brak `tradePost` w stanie `sandbox` przy `version >= 9` → `BAD_TYPE missing`; obecny poza `sandbox` → `INCONSISTENT`;
- `building`: int −1..maxInt; ≥ 0 musi wskazywać budynek typu `tradePost` (`DANGLING_REF`); budynek typu
  `tradePost` w stanie bez wycinka albo poza doliną → `INCONSISTENT`; więcej niż jeden budynek `tradePost` → `INCONSISTENT`;
- `saturation`: pełna mapa towarów, int 0..`MARKET.cap`; `sold`: pełna mapa, int ≥ 0; `earnedCents`: int ≥ 0;
- `recent`: tablica ≤ `TRADE_POST.recentMax`, każdy wpis `{tick 0..state.tick, good, qty 1..WAGON_CAPACITY, cents ≥ 0}`.
Typ `tradePost` przechodzi `BUILDING_TYPES` automatycznie (klucz `BUILDINGS`).

**Replay (`src/sim/replay.ts`):** nic poza tym, że raporty v8 są odrzucane („state version 8 differs”), jak przy
każdym podbiciu wersji. `place` z typem `tradePost` jest odrzucany przez sim (`NOT_PLACEABLE` w dolinie).

### 1.6 Determinizm — uwagi dla dewelopera

- Tylko liczby całkowite i `floor`; zero nowych losowań RNG; brak `Date`/`Math.random`/trygonometrii.
- Remisy w liście par: zamówienie → cena malejąco → indeks w `GOODS` → id targu rosnąco (zamek 5 przed punktem 6).
- `recent` to zwykła tablica obiektów JSON; `shift()`/`push()` w sim po kolei, deterministycznie.
- Kolejność kluczy: `freshTradePost` jak w §1.2; budynek przez `place()`; wycinek ostatni.
- Misje kontraktowe: `marketOpen` = false → blok targu w `dispatch` nie działa; brak wycinka; nowy klucz w
  `BUILDINGS` jest na końcu i nie ma wyjść (`producerOf`, `inputGoods`, `outputGoods` bez zmian).
- `tools/check-*`/`purity.test.ts` pilnują zakazanych API — nowy moduł ich nie używa.

### 1.7 Testy i złote hasze

**Muszą przejść bez zmiany wartości (dowód, że misje są nietknięte):**
- `tests/valley-events-live.test.ts` → `CONTRACT_GOLDEN` (13 misji + lab × {0, 2 wozy}, wersja zerowana);
- `tests/chains.test.ts` → `V4_GOLDEN` (misje I–VI + lab, widok v4);
- `tests/dispatch-reachability.test.ts` → hasze ławki 50/100 (liczone z `version: 7`);
- `tests/terrain-golden.test.ts`.

**Zmieniają się (dolina) — poprawić świadomie, z komentarzem „state v9 (D-111)”:**
- `valley-events-live`: test „free valley starts with an empty v8 event slice, last in key order” → ostatni klucz
  `tradePost`, przedostatni `valleyEvents`; test „save v7 → v8” → „save v7 → v9”: po migracji jest budynek
  `tradePost` id 6 w (37,58), klucze jak w świeżym stanie, kontrakt v6/v7 bez wycinka.
- `tests/save-chain.test.ts`: `downgrade()` dla stanu doliny usuwa `tradePost`, budynek typu `tradePost`, zeruje
  drogę na jego bramie (komórka 57·96+39), `nextId -= 1`, `netVersion -= 1`; `expectedAfterMigration` dla doliny
  (`from` 1–5) daje świeży wycinek z `building = 6`. Ciąg 1…5 → 9 ma dalej dawać stan bajt w bajt równy świeżemu.
- wszystkie testy doliny porównujące *dwa przebiegi* (`stateHash(a) === stateHash(b)`) przechodzą bez zmian
  wartości (nie mają stałych).
- `tests/i18n-hygiene.test.ts`, `tests/i18n-*.test.ts`: nowe klucze w `PENDING_KEYS` (§5).
- `tests/workers.test.ts`, `tests/yard-piles.test.ts`: iterują `BUILDING_KINDS` — nowy model musi je przejść (§4).

**Nowe testy:**
1. `tests/trade-post.test.ts`
   - świeża dolina: budynek `tradePost` id 6 w (37,58), 4×4, brama (39,57) z drogą, status `IDLE`, wycinek ostatni,
     `postOpen` = false; misje (`m1`, `lab`) nie mają ani budynku, ani wycinka;
   - zamknięty (ranga < 4) z drogą: dyspozytor nie wysyła tam żadnego wozu (12 min, zero zleceń `to === 6`);
   - ranga 4 bez drogi: status `NO_ROAD`; z drogą od stajni: `IDLE` (sam odcinek przy bramie nie wystarcza);
   - sprzedaż: po dowozie 6 desek `cents` = Σ `floor(centsAt(planks, s, 100) × 125 / 100)` dla s = 0..5,
     `tp.saturation.planks` = 6, nasycenie zamku bez zmian, `ledger.sold`, `renown`, `flow` rosną, zachowanie towarów
     (`checkInvariants`) co tick; `recent` ≤ 5 i najstarszy wypada;
   - odnowa: po 10 s nasycenie −1 dla każdego towaru > 0;
   - para targ–towar: przy tym samym nasyceniu punkt jest pierwszy (125 % > 100 %); przy przyjętym zamówieniu na
     deski deski jadą do zamku; `handInOrders` nigdy nie bierze towaru w punkcie;
   - rozbiórka punktu → `CANNOT_DEMOLISH`;
   - zima: drewniany most na trasie, wóz z ładunkiem do punktu stoi `BRIDGE_CLOSED` ≥ 20 s → `heldSpanFor(world, post)`
     niepuste i `cureFor` = `'pave'`; po brukowaniu przęsła w tej samej zimie wóz jedzie;
   - determinizm: te same komendy ⇒ ten sam hash; zapis/odczyt w trakcie (przed i po R4) daje identyczną kontynuację.
2. `tests/save-v9.test.ts`
   - fixture **`tests/fixtures/save-v8-sandbox.json`** — wygenerować *na bazie przed zmianami* (pierwszy krok
     commitu 1): `createWorld('sandbox')`, plan `DECENT` przez 40 min, `makeEnvelope('valley1', state, 0)`, zapis
     JSON (≈ 35–60 kB, jak `save-v7-sandbox.json`); skrypt jednorazowy w commicie jako `tools/make-fixture-v8.ts`;
   - migracja: budynek na (37,58), `id === nextId` sprzed migracji, klucze jak w świeżym stanie, gra działa 2 min
     z `checkInvariants`, po R4 (podnieść `town.rank` w teście) i drodze sprzedaje;
   - zajęte miejsce: wstawić do fixture'a drogę na (38,59) → punkt na (43,58); wszystkie 4 zajęte → `building: -1`,
     gra działa, UI nic nie pokazuje (`tradePostStatus` = null);
   - bramka: odrzuca wycinek poza doliną, `saturation` > 24, `building` wskazujący nie-punkt, dwa punkty,
     `recent` dłuższe niż 5, brak wycinka w v9 doliny;
   - zapis kontraktu v8 → v9 bez wycinka i bez budynku.

---

## 2. Odblokowanie i miejsce na mapie

### 2.1 Gdzie stoi punkt

Mapa `valley1` (96 × 72 pól po 4 m), seed 1301. Zamek: (60,19), brama (62,23); droga zamkowa wzdłuż y = 24.
Rzeka przecina dolinę w y ≈ 27–41; na odcinku x = 37–41 ma **3 pola** wody (wiersze 34, 35, 36).

```
x →  2 3         4         5         6
     890123456789012345678901234567890123
 19  TTT......T.TTTTT................CCCC     C zamek (60,19), H stajnia, G spichlerz
 21  ..................HHH...GGG.....CCCC
 23  ...................@.....@........@.     @ bramy (zamek: (62,23))
 24  ###################################.     droga zamkowa y = 24
 25  ...........|........................     | trasa gracza: kolumna x = 39, y = 25…56
 33  ~~~........|..........~~~~~~~~~~~~~~
 34  ~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~     = drewniany most, 3 pola (y = 34–36)
 35  ~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~
 36  .~~~~~~~~~~=~~~~~~..................
 41  ...........|........................     (y 42–54: pusta łąka)
 57  ...........@........................     brama punktu (39,57), droga gruntowa od startu
 58  .........PPPP.......................     P punkt 4×4: x 37–40, y 58–61
 61  .........PPPP.......................
```
(wycinek z `createWorld('sandbox')`, seed 1301; pominięte wiersze bez zmian)

**Miejsce: lewy górny róg (37,58), 4 × 4 pola, brama na północ (facing 2) w (39,57).** Dlaczego:
- południowy brzeg jest pusty przez całą grę (`DECENT` nie buduje niczego na południe od rzeki), płaski
  (różnica wysokości pod stopą ≤ 0,4 m na seedach 1301–1303, limit 2,5 m);
- najwęższe przejście przez rzekę (3 pola) leży dokładnie na północ od bramy, a most mieści się w limicie
  `WOOD_BRIDGE_MAX_WAGONS = 3` jednego pasa;
- odległość od zamku (brama (62,23)) to ~57 pól jazdy — to jest „nowa odległość” z raportu (×2–5 dla
  producentów ze wschodu), która przesuwa wąskie gardło;
- to samo miejsce, na którym mierzono 125 % → R5 119,3 min (raport §1).
Kolejne miejsca (tylko gdy (37,58) zajęte w starym zapisie): (43,58), (33,58), (37,62) — wszystkie wolne na
seedach 1301–1303 w świeżej dolinie.

### 2.2 Co musi zbudować gracz

Jedna droga gruntowa z drewnianym mostem od sieci stajni do bramy (39,57). Najkrótsza: kolumna x = 39 od
y = 25 (odgałęzienie od drogi zamkowej) do y = 56: 29 pól gruntu + 3 pola mostu = **47 srebra**
(`validateRoad` ok na 1301–1303). Przy randze 4 gracz ma ~23 000 monet, więc koszt to nie bariera — barierą jest
wiedza „tam jest rynek” i potem zimowa decyzja most drewniany / kamienny. Kamienne przęsło (bruk, od R2):
3 × 15 srebra + 3 × 3 kamienia.

Dwie ścieżki w UI (§3.3):
- arkusz punktu przy `NO_ROAD` pokazuje istniejący **lek „Zbuduj drogę i most: N srebra”** (`gapTarget` →
  `gapSuggestion` → `suggestLinkToStable`; ten sam przycisk co dla każdego odciętego budynku, zaznacza trasę
  na mapie i buduje jednym dotknięciem);
- albo ręcznie narzędziem „Droga”.

### 2.3 Komunikat odblokowania (ranga 4, „Gród”)

Istniejący list rangi (`Hud.showRankUp`):
- lista „Odblokowano: …” (`unlockList(4)`) dostaje na końcu **„punkt handlowy za rzeką”** (`town.unlockPost`).
  Implementacja: w `unlockList(rank)` (`src/ui/hud.ts:70`) po gałęzi `castleLevel` dopisać
  `if (rank === TRADE_POST.rank) parts.push(t('town.unlockPost'))` — warunek tylko na numer rangi (funkcja nie
  dostaje świata i służy też arkuszowi „Targ i ranga” oraz historii rang), więc wpis pojawia się w każdej dolinie;
- pod listą nowy akapit `town.postOpen` (tylko w liście R4 i tylko gdy w świecie jest punkt);
- po zamknięciu listu: bez ruchu kamery i bez tostu (list wystarcza). Od tej chwili nad punktem stoi **mosiężna
  (spokojna) pinezka** `NO_ROAD` — jedno dotknięcie otwiera arkusz z lekiem drogi.
Zapis wczytany po R4 nie pokazuje listu ponownie (dzisiejsze zachowanie `lastRank`).

---

## 3. Interfejs (`src/ui/`)

### 3.1 Karta „Wąskie gardło” — sygnał i progi

**Sygnał (zmierzony w raporcie §2, progi z `tools/valley-bottleneck.ts`, §6):** dla każdego towaru wejściowego g —
ilu odbiorców (warsztatów z g w recepturze) w tej sekundzie *czeka na g*: status `WAITING_DELIVERY`, `NO_WAGON`,
`WAITING_UPSTREAM` albo `NO_INPUT` z przyczyną inną niż `UNREACHABLE`, z `status.good === g` (to dokładnie
prywatna `waitsForInput` z `src/ui/stalls.ts`). Żaden z tych stanów poza `NO_INPUT`/`NO_WAGON` nie jest postojem,
dlatego dzisiejsza karta milczy.

**Próbkowanie (tylko UI, poza stanem, jak D-110):** raz na sekundę symulacji (`tick % TICK_HZ === 0`) w `onTick`
aplikacji, pierścień 180 próbek (3 min) na towar, `WeakMap<World, BottleneckLog>`; nowy świat lub wczytany zapis =
pusty dziennik (karta może się pojawić najwcześniej po 3 min).

**Reguła towarowa (cure `producer`):**
- okno pełne (180 próbek);
- średnia czekających ≥ **1,50** (suma ≥ 270) → karta się pojawia; już pokazana karta tego towaru znika dopiero
  przy średniej < **1,10** (histereza; suma < 198);
- odbiorców g na mapie ≥ 2;
- producent g (`producerOf(g)`) da się teraz postawić (`canPlace(world, type).ok` — ranga);
- **wyżej w łańcuchu:** pomija się g, gdy średnio co najmniej połowa budynków produkujących g sama czeka na swój
  wkład (np. piekarnie czekają na mąkę, bo młyny czekają na zboże → karta nazywa zboże, nie mąkę);
- wiele towarów spełnia warunki → najwyższa średnia, remis → kolejność `GOODS`;
- jeżeli ≥ 50 % próbek czekania na g to `NO_WAGON` → lek `wagon` zamiast `producer` (w pomiarach nie wystąpiło,
  reguła zostaje dla małych flot).

**Reguła floty (cure `wagon`):** brak towaru z reguły towarowej, ranga ≥ 2, i w każdej z 180 próbek **żaden wóz
nie stał** (`status.k !== 'IDLE'` dla wszystkich) → karta „Wozy: wszystkie w drodze od 3 minut”. Od rangi 2,
bo startowa para wozów jest zajęta zawsze (bez tego warunku: 89 % próbek pierwszych 30 min biernej gry).

**Kiedy karta jest widoczna (miejsce karty najgorszego postoju):**

| sytuacja | co pokazuje dolny pasek |
|---|---|
| `rankStalls()[0]` istnieje i **nie** jest `minor` (prawdziwy postój, w tym lód/przęsło, `sharedOne`) | karta najgorszego postoju jak dziś — prawdziwy postój zawsze wygrywa |
| brak prawdziwego postoju i reguła daje wynik | **karta „Wąskie gardło”** |
| brak prawdziwego postoju i brak wyniku, są spokojne pinezki | spokojna karta jak dziś |
| nic | pasek ukryty |

Tylko w wolnej dolinie (`rankGated(world) && marketOpen(world)`); w misjach nic się nie zmienia (D-110 dalej
działa tylko w misjach).

### 3.2 Maszyneria misji, która dziś jest wyłączona w dolinie — co dokładnie włączyć

Lek „postaw producenta” istnieje dla misji IX/X (D-105, D-107, D-110). W dolinie wyłącza go flaga
`missionBuildable(id) === 'ranked'`:

| element | plik:linia (stan `cc3bf16`) | dziś w dolinie | zmiana |
|---|---|---|---|
| `sampleInputWaits(world)` | `src/ui/stalls.ts:126`, warunek `if (can === 'ranked' \|\| can.length === 0) return;` (l. 129) | nie próbkuje | warunek → `if (can !== 'ranked' && can.length === 0) return;` + na końcu `if (can === 'ranked') sampleBottleneck(world);` |
| `inputWaitTicks(world, b)` | `stalls.ts` | zawsze 0 | bez zmian kodu — zaczyna działać (oko karty wybiera najdłużej czekający warsztat) |
| `sharedOneProducer` | `stalls.ts:94`, `if (can === 'ranked' \|\| …) return null` (l. 100) | null | **bez zmian** (dolina ma ≥ 2 producentów; karta „jeden dostawca” w dolinie nie była mierzona) |
| `cureFor(world, id)` | `stalls.ts` | — | po `sharedOneCard`: `if (bottleneckFor(world, b)) return 'producer'` (albo `'wagon'` dla leku floty); do klucza cache dopisać `bottleneckKey(world)` |
| `Hud.updateWagon` podświetlenie | `src/ui/hud.ts:477` | — | bez zmian kodu: `this.cure` = lek karty gardła → `build` (producer) albo `wagon` dostaje `is-cure` |
| `cureHtml` gałąź `'producer'` | `src/ui/panels.ts:106–121` | — | zamiast `sharedOneProducer(world, b)` wołać `producerCure(world, b)` (patrz niżej); tekst pomocy zależny od źródła |
| `carded` | `panels.ts:507` | — | bez zmian: czekający (nie zablokowany) warsztat z lekiem `producer` dostaje sekcję „Naprawa” |
| klik `producer:<id>` | `panels.ts:296` → `nav.pickBuild(p.type, p.id)` | — | bez zmian |
| `App.pickBuild(type, near)` | `src/ui/app.ts:896` | — | bez zmian (ghost przez `buildSite`, `src/ui/site.ts`; w dolinie bez `siteHints` → szukanie pierścieniami przy `near`) |

Nowy moduł **`src/ui/bottleneck.ts`** (czysty odczyt stanu, zero zapisów):
```ts
export const NECK_WINDOW = 180;            // samples, one per sim second
export const NECK_SHOW_X100 = 150;         // mean waiting consumers x100 to show
export const NECK_HIDE_X100 = 110;         // a shown good stays until the mean drops below this
export const NECK_MIN_CONSUMERS = 2;
export const NECK_FLEET_RANK = 2;
export interface BottleneckCard {
  kind: 'good' | 'fleet';
  good: Good | null;           // null for 'fleet'
  /** Mean waiting consumers x100 over the window, and consumers of the good on the map. */
  meanX100: number; consumers: number;
  cure: 'producer' | 'wagon';
  /** Building type to build (producerOf(good)), and the producer to build next to (id) — the one nearest by road to `focus`. */
  build: BuildingType | null; near: number;
  /** The consumer that has waited longest (inputWaitTicks) — the eye button's target; for 'fleet': the stable. */
  focus: number;
}
export function sampleBottleneck(world: World): void;            // once per sim second (from sampleInputWaits)
export function bottleneckCard(world: World): BottleneckCard | null; // cached per tick
/** The card's cure for this building's own sheet: b waits for the card's good. */
export function bottleneckFor(world: World, b: Building): BottleneckCard | null;
```
Kod reguły jest w `tools/valley-bottleneck.ts` (`sample`, `card`) — przenieść 1:1, dodać `focus`/`near`/`build`.

W `stalls.ts` nowy wspólny kształt leku producenta:
```ts
export interface ProducerCure { producer: number; type: BuildingType; consumers: number; source: 'shared' | 'neck'; good: Good }
export function producerCure(world: World, b: Building): ProducerCure | null; // sharedOneProducer ?? bottleneckFor
```

### 3.3 Karta „Wąskie gardło” — wygląd, teksty, zachowanie

- Ten sam element `.stall-card` (bez nowego DOM), klasa `is-neck`: tło `panel` zamiast `panel-alert` (bez winnej
  belki — to nie postój), kicker **„WĄSKIE GARDŁO”** (`hud.bottleneck`) zamiast „NAJGORSZY ZASTÓJ”.
- Treść (format jak dziś `<b>kto:</b> powód`):
  - towar: **„Zboże: czeka średnio 2 z 4 warsztatów”** — `<b>{goodName}</b>` + `neck.reason {n, m}`,
    n = `max(1, round(meanX100 / 100))`, m = `consumers`;
  - flota: **„Wozy: wszystkie w drodze od 3 minut”** — `neck.fleetWho` + `neck.fleet`.
- Oko (52 px): kamera do `focus` i arkusz tego warsztatu („Dlaczego stoi?”). Arkusz pokazuje łańcuch jak dziś
  (np. „Zboże w drodze — wóz 7”) i sekcję **„Naprawa”**: przycisk „Postaw jeszcze: Gospodarstwo −30”
  (`fix.producer`, istniejący klucz) + pomoc `neck.why`; dla floty arkusz stajni (ma „Kup wóz”).
  `aria-label` oka: `neck.show`.
- Pieczęć alarmu: ikona `bottleneck` (nowa, §4.3) zamiast ikony statusu; plakietka = liczba pinezek
  (`stalls.length`); gdy pinezek brak, pieczęć ukryta, karta zostaje sama.
- Narzędzia: lek `producer` → podświetlona karta „Buduj” (`card-highlight`), lek `wagon` → „Kup wóz”.
- Pinezki: karta **nie dodaje** pinezek (czekające warsztaty nie stoją). Spokojne pinezki zostają jak są.
- Animacja: wejście/wyjście karty 150 ms (fade jak dziś), bez pulsowania; brak `flashFirstStall` dla gardła.
- Czytnik ekranu: przy pierwszym pojawieniu się karty dla danego towaru `announce("Wąskie gardło: zboże")`
  (raz na towar i sesję).
- `stallSig` w `Hud.updateStalls` dostaje człon `neck:<kind>:<good>:<n>:<m>` — DOM zmienia się tylko przy zmianie.
- Krajobraz / Flip: karta w miejscu karty postoju; w trybie zegarka (Flip) brak karty jak dziś.

Zmierzone (§6): DECENT 41 / 13 / 40 % próbek w pasmach 90–120 / 120–150 / 150–180 min (zawsze zboże, lek
„Gospodarstwo”); +1 farma 36 / 11 / 34 % (jedna nie wystarcza, karta słusznie zostaje); **+2 farmy 0 / 0 / 4 %**;
bierny i mała flota: 0 % (tam rządzą prawdziwe karty i lek „Kup wóz”). Z punktem handlowym (125 %): 35 / 28 / 40 %,
a w zimowych pasmach prawdziwa karta „przęsło” wygrywa miejsce w 13–15 % próbek.

### 3.4 Arkusz punktu handlowego

Dotknięcie budynku → `buildingSheet` jak dla każdego budynku (tytuł `building.tradePost`, ikona `tradePost`).
Nowa gałąź w `stockHtml` (`panels.ts`, obok `castle`): `postHtml(world, b)` z `tradePostStatus(world)`:

1. **Linia stanu** (zamiast „Stoi” dla `IDLE`):
   - zamknięty: ikona `seal` + `post.closed {rank}` („Otworzy się w randze „Gród”.”);
   - otwarty, bez drogi: dzisiejsza czerwona/mosiężna linia `NO_ROAD` + lek drogi (gap finder, §2.2) + `post.noRoad`;
   - otwarty i połączony: ikona `coin` + `post.open` („Kupuje”).
2. **Warunki:** `post.terms {pct}` („Kupuje każdy towar po 125% ceny zamku, z własnym nasyceniem.”).
3. **Ceny w punkcie** (`post.prices`): wiersz na towar jak w „Targ i ranga” (`.ms-good`): ikona, nazwa, cena teraz
   (`cents/100`, `fmtDec`), mała linia `post.vsCastle {pct}` = cena punktu względem ceny zamku *teraz*
   (np. „125% ceny zamku”, „98% ceny zamku” gdy punkt jest bardziej nasycony), pasek nasycenia punktu.
   Wiersze, gdzie punkt płaci więcej niż zamek, bez wyróżnienia kolorem — tylko liczba (zasada „ciepłe = problem”).
4. **Ostatnie sprzedaże** (`post.recent`): do 5 wierszy od najnowszej: ikona towaru, `post.sale {qty, good, n}`,
   `post.ago {time}`; pusto → `post.none`. Suma: `post.total {units, n}`.
5. **Zima:** gdy dolina ma pory roku i jest zima albo ≤ 2 min do lodu: `s-hint` z ikoną `bridge_ice` +
   `post.iceHint`.
6. Kodeks („Co to znaczy?”) — istniejący wpis `NO_ROAD`, wariant spokojny (patrz niżej).

**Spokojna pinezka `NO_ROAD` punktu:** w `calmStall` (`stalls.ts`) dopisać warunek
`b.type === 'tradePost'` → calm (`minor`, nigdy krytyczna, mosiężna pinezka). `calmWhy` → nowy `'postRoad'`
→ tekst karty `cause.postNoRoad` („czeka na drogę z mostem”). Lek w arkuszu zostaje (droga). Dzięki temu gracz,
który punktu nie chce, nie dostaje wiecznej karty, a karta gardła ma pierwszeństwo przed tą pinezką.

**Zimowy lód na trasie do punktu** — bez nowego kodu: wóz z ładunkiem do punktu stoi `BRIDGE_CLOSED` ≥ 20 s →
`heldSpanFor(world, post)` → karta „Punkt handlowy: Wóz 7 stoi przed mostem zamkniętym przez krę”
(`cause.heldIce`), lek „Wyłóż most kamieniem” (`fix.pave`), krytyczna — wygrywa z kartą gardła.

**Arkusz „Targ i ranga”** (`marketSheet.ts`): filtr `b !== 'castle' && b !== 'tradePost'` na liście budynków; gdy
punkt istnieje i jest otwarty: pod cenami jedna linia `s-hint` z ikoną `tradePost` + `post.marketLine {pct}` i
przycisk `data-go="building:<id>"` („Pokaż punkt handlowy”, `post.show`), 48 px.

---

## 4. Grafika (`src/render/`, `src/ui/icons.ts`)

### 4.1 Model punktu handlowego (`src/render/models/buildings.ts`)

Styl jak reszta budynków (nagłówek pliku i `docs/ART_DIRECTION.md`): późnośredniowieczna zabudowa
środkowoeuropejska, obserwowana, nie zabawkowa; kolory z `C` i palety (Torf, Błoto, Strzecha, Kamień polny);
**jedyny ciepły akcent** — mała chorągiewka Glina tylko po otwarciu (punkt to miejsce, na które gracz ma patrzeć
od rangi 4). Nic pastelowego, brak low-poly płaskich ścian (jitter/noise jak w innych budynkach).

- `BuildingKind`: dopisać `'tradePost'`; `BUILDING_KINDS` — na końcu; `BUILDING_CELLS.tradePost = [4, 4]`;
  `BUILDERS.tradePost = tradePost`. Ramka: początek w środku stopy 16 × 16 m, front (+Z) do bramy;
  `gate: v3(2, 0, 8)` (brama pola x+2).
- **Bryła (16 × 16 m):**
  1. **Dom kupiecki** (`house()`): `cx 0, cz -3.6, len 10.4, dep 6.4, wallH 3.6, plinth 0.6, pitch 50,
     roof 'shingle', walls 'daub'`, szachulec (`timberFrame`) na froncie; drzwi z boku frontu (`u: 3.2`).
     Na froncie **szeroki otwór kramu** 4,2 × 1,2 m z dwiema okiennicami: zamknięty — obie pionowo w otworze
     (deski `C.boards`, okucia `metal`); otwarty — dolna opuszczona poziomo jako lada na dwóch zastrzałach, górna
     podniesiona jako daszek na tyczkach.
  2. **Waga miejska** (wiata) przy prawym froncie: 4 słupy `bark` 3,2 m, daszek z gontu 3,6 × 3,2 m pochylony
     w tył, pod nim **bezmian** — belka 2,6 m na łańcuchu (3 ogniwa `metal`), hak z jednej strony, kamienny
     odważnik (`stone`) z drugiej. To charakterystyczna sylwetka punktu z daleka (i motyw ikony, §4.3).
  3. **Plac:** ubita ziemia (bez nowej tekstury — zostaje teren), płot `fenceRun` po bokach i z tyłu
     (plecionka `wattleRun` przy domu), wjazd 4 m na środku frontu; słup przy wjeździe z deską-szyldem (wycięty
     krążek z kreską — moneta/waga, bez napisów).
  4. **Rekwizyty zawsze:** koryto, belka do uwiązania koni (`beam`), 2 beczki (`barrelGeom`).
- **Nakładka „otwarty”** `tradePostOpenParts(): ModelPart[]` (jak `castleUpgradeParts`, ta sama ramka):
  opuszczona lada + podniesiony daszek okiennic (zamiast zamkniętych okiennic — w modelu bazowym zamknięte
  okiennice są osobną częścią, którą `buildingsView` pomija, gdy punkt otwarty), 3 skrzynie (`crateGeom`),
  2 worki (`sack`), stos desek (`plankStack`), chorągiewka 1,2 × 0,45 m `cloth` `C.clay` na tyczce 5 m przy wadze.
- **`src/render/buildingsView.ts` – `sync`:** sygnatura `${lvl}|${postOpen ? 1 : 0}|…`; przy `b.type ===
  'tradePost'`: `add(model.parts.filter(nie-okiennice))` + `add(tradePostOpenParts())`, gdy `postOpen(world)`;
  inaczej pełny model z zamkniętymi okiennicami. (Najprościej: dwie listy części budowane raz — `closedParts`,
  `openParts` — zamiast filtrowania.)
- `src/render/terrain.ts:139` (spłaszczenie terenu pod budynkiem): `r = b.type === 'castle' || b.type === 'tradePost' ? 2 : 1`;
  `src/render/vegetation.ts:309` (karczowanie drzew): bez zmian (2 dla nie-zamku wystarczy).
- **Budżet:** model bazowy ≤ **8 000 trójkątów**, nakładka ≤ **1 500**. Dla porównania (zmierzone dziś
  `buildingModel(k).parts`): zamek 15 242 (7 części), gospodarstwo 8 592, browar 6 732, rybak 6 094,
  spichlerz 4 544, tartak 2 096, wieża R5 568. Tylko istniejące materiały (`wood`, `stone`, `plaster`, `metal`,
  `cloth`, `bark`) → budynki są scalane per materiał w `buildingsView`, więc **0 nowych wywołań rysowania**
  (zamek już używa wszystkich tych materiałów) i 0 nowych tekstur. Bez robotników (`workers` puste) — `tests/workers.test.ts`
  i `tests/yard-piles.test.ts` muszą przejść (brak `piles`: skrzynie są geometrią, nie stosem zapasu).
- Do czasu commitu 5 punkt rysuje się modelem zastępczym (`FALLBACK_KIND = 'warehouse'`), co jest akceptowalne
  w commitach 1–4.
- Podgląd: `tools/model-preview.html?view=buildings` (dopisać `tradePost` do widoku) + zrzut
  `docs/shots/day9-post-model-{closed,open}.jpg`.

### 4.2 Zimowy lód na drewnianym moście — **sprawdzone: w grafice go nie ma**

Sim zamyka drewniane przęsła zimą (`seasons.ts` `ICE_OFFSETS`, `bridgeIceUntil(world)`), UI ma ikonę
`bridge_ice` i teksty (`cause.heldIce`, `season.notice.ice-start`), teren ma szron (`uWinter`), ale
`src/render/bridgesView.ts` i `models/bridges.ts` **nie rysują lodu** (jedyna wzmianka to komentarz o izbicy
w `bridges.ts:65`). Ponieważ zimowy lód to główna prawdziwa karta punktu, dodać:
- w `bridgesView.ts` drugą siatkę **„kra”**: przy każdym podporze drewnianego przęsła (`bridgeFootings` dla
  `kind === 'wood'`) 3–4 płaskie, nieregularne kry (sześciokątny pryzmat 0,9–1,6 m, 0,12 m grubości, lekko
  przechylone, kolor Mgła `#c9c6bb` przyciemniony do `#b5b3a9` na krawędziach), plus pas szronu na pomoście
  (kolor wierzchołków pomostu → `lerp` do Mgły 35 %, w osobnej geometrii nakładki 2 cm nad deskami);
- materiał istniejący `stone` (wariant koloru wierzchołków), jedna scalona siatka budowana razem z mostami
  (`rebuild` przy zmianie sieci), `visible = bridgeIceUntil(world) >= 0` sprawdzane w `afterTick`
  (bez alokacji na klatkę);
- koszt: **+1 wywołanie rysowania (+1 cień) tylko gdy lód trwa**, ≤ 150 trójkątów na pole drewnianego mostu;
- dotyczy też misji z lodem z mapy (IV) — tylko obraz, hasze bez zmian; zrzuty M4 zmienią się wizualnie.

### 4.3 Nowe ikony (drzeworyt, `src/ui/icons.ts`, siatka 24 × 24, `npm run icons` + `npm run icons:check`)

1. **`tradePost`** (budynek): **bezmian na słupie** — pionowy słup z ramieniem (szubienica-dźwig) po lewej,
   z ramienia na krótkim łańcuchu zwisa pozioma belka wagi; z jednej strony hak z workiem (trapez z zawiązaniem),
   z drugiej kulisty odważnik; pod spodem niska lada (pozioma deska na dwóch nogach). Kreskowanie cienia po prawej
   stronie słupa i pod ladą. Kształtem nie przypomina żadnej innej ikony budynku (zamek = wieża z blankami,
   spichlerz = szopa z dwuspadem, stajnia = długi dach): **jedyna ikona z asymetrycznym ramieniem i zwisającą belką**.
2. **`bottleneck`** (pieczęć karty): **kosz zsypowy (lej młyński) na kozłach** — szeroki u góry trapez z desek
   (2 rzazy poziome), nad nim kopczyk ziarna wychodzący ponad krawędź (kreskowany), u dołu wąska szyjka i
   **2–3 pojedyncze ziarna** pod nią, pod koszem rozstawione nogi kozła. Odróżnienie od `waiting`
   (symetryczna klepsydra z płytkami i słupkami): brak płytek, asymetria (pełno u góry, prawie nic u dołu),
   nogi kozła. Od `no_input` (towar przekreślony) i `contested` (rozwidlony trakt): inna klasa kształtu.
- Obie: wypełnienia bez konturu, ink/cut/hatch jak reszta; dopisać do `IconId`, do arkusza ikon
  (`tools/render-icon-sheet.ts`) i do `docs/ASSETS.md` (rysowane w kodzie, brak zewnętrznych plików).
- `format.ts:158` (`buildingStatusIcon` z `type`) działa automatycznie dla `tradePost`.

---

## 5. i18n — nowe klucze

Wszystkie do `src/i18n/pl.ts` i `src/i18n/en.ts` **oraz do `PENDING_KEYS`** (pozostałe 15 języków dostaje
fallback angielski, D-18; tłumaczenia w osobnej rundzie). Istniejące klucze używane ponownie: `fix.producer`,
`fix.wagon`, `fix.pave`, `fix.paveWhy`, `fix.bridge`, `fix.road`, `cause.heldIce`, `cause.NO_ROAD`,
`market.sat`, `market.colPrice`, `rank.4`, `town.unlocks`.

| klucz | PL | EN |
|---|---|---|
| `building.tradePost` | Punkt handlowy | Trading post |
| `town.unlockPost` | punkt handlowy za rzeką | the trading post across the river |
| `town.postOpen` | Za rzeką otwarto punkt handlowy: płaci {pct} ceny zamku. Doprowadź do niego drogę z mostem. | A trading post has opened across the river: it pays {pct} of the castle price. Build a road and a bridge to it. |
| `post.closed` | Otworzy się w randze „{rank}”. | Opens at the rank “{rank}”. |
| `post.open` | Kupuje | Buying |
| `post.terms` | Kupuje każdy towar po {pct} ceny zamku, z własnym nasyceniem. | Buys every good at {pct} of the castle price, with its own saturation. |
| `post.noRoad` | Kupcy czekają po drugiej stronie rzeki: doprowadź drogę z mostem do bramy. | The merchants wait across the river: build a road and a bridge to the gate. |
| `post.prices` | Ceny w punkcie | Prices at the post |
| `post.vsCastle` | {pct} ceny zamku | {pct} of the castle price |
| `post.recent` | Ostatnie sprzedaże | Recent sales |
| `post.sale` | {qty} × {good}: {n} srebra | {qty} × {good}: {n} silver |
| `post.ago` | {time} temu | {time} ago |
| `post.none` | Jeszcze nic tu nie sprzedano. | Nothing sold here yet. |
| `post.total` | Sprzedano tu: {units} szt. za {n} srebra | Sold here: {units} units for {n} silver |
| `post.iceHint` | Zimą kra zamyka drewniany most na kilka minut. Kamienny most jest przejezdny cały rok. | In winter, ice closes a wooden bridge for a few minutes. A stone bridge stays open all year. |
| `post.marketLine` | Punkt handlowy za rzeką płaci {pct} ceny, z własnym nasyceniem. | The trading post across the river pays {pct}, with its own saturation. |
| `post.show` | Pokaż punkt handlowy | Show the trading post |
| `cause.postNoRoad` | czeka na drogę z mostem | waits for a road and a bridge |
| `hud.bottleneck` | Wąskie gardło | Bottleneck |
| `neck.reason` | czeka średnio {n} z {m} warsztatów | on average {n} of {m} workshops wait |
| `neck.why` | Na {goodAcc} czeka średnio {n} z {m} warsztatów od 3 minut. Jeszcze jeden producent skróci kolejkę; nowy wóz tu nie pomoże. | On average {n} of {m} workshops have waited for {good} for 3 minutes. One more producer shortens the queue; a new wagon will not help here. |
| `neck.fleetWho` | Wozy | Wagons |
| `neck.fleet` | wszystkie w drodze od 3 minut | all on the road for 3 minutes |
| `neck.show` | Pokaż warsztat, który czeka najdłużej | Show the workshop that has waited longest |

24 klucze × 2 języki. `{pct}` przekazywać sformatowane (`fmtPercent`), `{time}` przez `ticksClock`, `{good}` —
mianownik małą literą (`goodName`), `{goodAcc}` — biernik (`goodAcc.*`). „{n} z {m} warsztatów czeka” jest
poprawne dla każdego n (konstrukcja partytywna z „z”), więc bez reguł liczby mnogiej.
`tests/i18n-hygiene.test.ts` wymaga użycia każdego klucza w kodzie.

---

## 6. Balans: liczby docelowe i jak je sprawdzić

**Cele (średnia seedów 1301–1303, 180 min; okna rang z PROTOCOL: R1 8–12, R2 20–30, R3 40–50, R4 70–90, R5 105–135):**

| gracz | R1 | R2 | R3 | R4 | R5 | srebro 180 min | źródło |
|---|---:|---:|---:|---:|---:|---:|---|
| DECENT + droga do punktu po planie (125 %, R5 17 000) | 10,5 | 22,5 | 42,0 | 75,6 | **119,3** (akcept. 112–126) | **30 673** (+25 %) | raport §1 (`trade125-r5x17k`) |
| DECENT bez punktu, R5 17 000 | 10,5 | 22,5 | 42,0 | 75,6 | **134,1** (≤ 135) | 24 578 | pomiar dziś (`decent`, `RANKS[5].renown = 17000` w pamięci: 134,9 / 133,2 / 134,0) |
| DECENT + droga + 2 farmy | — | — | — | — | — | ≈ +1 % wobec samego punktu | raport §2 |

Dodatkowo (pasma 90–180 min, gracz z punktem):
- jałowe wozy **1–4 %** (bez punktu 30–36 %);
- prawdziwa karta „przęsło skute lodem → wyłóż most kamieniem” w **13–15 %** próbek pasm zimowych (90–120, 150–180);
  gracz „+eye”, który ją wykona raz (~109 min), ma potem 0–1 %;
- karta „Wąskie gardło” (§3.1): DECENT 41 / 13 / 40 %, +2 farmy 0 / 0 / 4 %, z punktem 35 / 28 / 40 %, bierny 0 %.

**Uwaga do R5 bez punktu:** 134,1 min to górna krawędź okna. To świadoma konsekwencja decyzji (17 000): gracz bez
punktu kończy w oknie, ale ledwo. Jeśli po wdrożeniu średnia przekroczy 135, nie zmieniać progu samodzielnie —
zapytać właściciela (alternatywa: 16 500 → zmierzyć oba warianty).

**Komendy:**
```bash
# 1. plan bota: tools/bot-sandbox.ts DECENT dostaje na końcu krok (commit 2)
#    { name: 'road to the trading post', rank: 4, cmds: (w) => [{ t: 'road', surface: 1, cells: col(w, 39, 25, 57) }] }
#    (komórka (39,57) to już droga przy bramie — validateRoad liczy tylko nowe pola)
npx tsx tools/bot-sandbox.ts 180                                  # rangi i srebro jednego seeda, zero naruszeń
npx tsx tools/valley-3h.ts decent --seeds 1301,1302,1303           # tabela pasm: jałowe wozy, karta, rangi
npx tsx tools/valley-bottleneck.ts decent decent+farm decent+2farms passive small   # karta gardła (§3.1)
npm run bot                                                        # misja I bez zmian: wygrana 8,85 min, 3★, 26 srebra
npm test                                                           # SUMMARY passed=N failed=0
```
Do `tools/valley-3h.ts` dopisać graczy: `decent-nopost` (DECENT bez ostatniego kroku — drugi wiersz tabeli),
`decent+eye` z `eyeAlways` (brukuje przęsło przy karcie `pave`). Gracze D z `tools/valley-late.ts`
(`trade*`) po commicie 2 dublowaliby punkt (wkładają drugi „zamek” do mapy) — oznaczyć w nagłówku jako przestarzałe
i usunąć ich z `LATE_LIST`.

---

## 7. Podział pracy: 6 commitów (każdy zielony: `npm run typecheck`, `npm test`, `npm run build`)

1. **`sim: trading post building and state v9 (closed post, migration v8 -> v9, save gate)`**
   Najpierw na czystej bazie: `tools/make-fixture-v8.ts` → `tests/fixtures/save-v8-sandbox.json`. Potem: typ
   `tradePost`, `TRADE_POST`, `src/sim/tradePost.ts` (bez `postCents`/`sellAt`), wycinek w `buildMission`,
   `statusFor` (zawsze `IDLE`, bo `postOpen` zwraca jeszcze `false` — stała `TRADE_POST.rank` sprawdzana dopiero
   w commicie 2 albo tymczasowo `return false`), `CANNOT_DEMOLISH`, `STATE_VERSION 9`, migracja, `gateTradePost`.
   Testy: `save-v9.test.ts`, poprawki `valley-events-live` (klucze), `save-chain` (downgrade). **Sprawdzić:**
   `CONTRACT_GOLDEN`, `V4_GOLDEN`, ławka 50/100 bez zmian. Dolina przed R4 zachowuje się jak dziś: bot DECENT na
   3 seedach ma średnie R1–R4 = 10,5 / 22,5 / 42,0 / 75,6 (prototyp z punktem jako id 6 dał dokładnie te średnie;
   dopuszczalne ±0,2 min na pojedynczym seedzie, bo id budynków gracza są o 1 większe).
2. **`sim: the trading post buys from rank 4 (125 %, own saturation, market-good pairs); rank 5 at 17 000`**
   `postOpen`, `postCents`, `marketCents`, `sellAt` (gałąź), `stepTown` (odnowa), `dispatch` (pary),
   `wagons.ts` (zamówienia tylko zamek), `outputCustomer`, `NO_ROAD` od R4, `RANKS[5] = 17 000`, krok DECENT
   „road to the trading post”, gracze `decent-nopost`/`decent+eye` w `valley-3h.ts`, `valley-late.ts` D → przestarzałe.
   Testy: `trade-post.test.ts`. W opisie commitu tabela §6 (R5 z punktem / bez, srebro, jałowe wozy).
   `docs/playtest/PROTOCOL.md`: rank 5 = 17 000.
3. **`ui: trading post sheet, rank-4 letter line, calm no-road pin`**
   `postHtml` w arkuszu budynku, `tradePostStatus`, `unlockList`/`showRankUp` (R4), `calmStall`/`calmWhy`
   `'postRoad'`, linia w „Targ i ranga”, klucze `post.*`, `town.unlockPost`, `town.postOpen`, `cause.postNoRoad`,
   `building.tradePost` (+ `PENDING_KEYS`). Zrzuty §8.
4. **`ui: valley bottleneck card (Wąskie gardło) with the producer / wagon cure`**
   `src/ui/bottleneck.ts`, `sampleInputWaits` w dolinie, `producerCure`, `cureFor`, `cureHtml`, `Hud.updateStalls`
   (pierwszeństwo, `is-neck`, pieczęć), ikona `bottleneck`, klucze `hud.bottleneck`, `neck.*`.
   Testy: `tests/bottleneck.test.ts` — syntetyczne statusy: okno niepełne → null; średnia 1,49 → null, 1,50 → karta;
   histereza 1,10; < 2 odbiorców → null; producent zablokowany rangą → null; pominięcie towaru z głodnymi
   producentami (piekarnie/młyny → zboże); reguła floty od rangi 2; prawdziwy postój wygrywa; misje (`m9`) →
   null zawsze, a karta D-110 działa jak przed zmianą (`shared-card.test.ts` bez zmian); hash stanu przed i po
   `sampleBottleneck` + `bottleneckCard` identyczny. Zrzuty §8.
5. **`render: trading post model (closed / open), ice floes on wooden bridges, trade post icon`**
   Model, nakładka, `buildingsView` (sygnatura), `terrain.ts` (r = 2), kra na mostach, ikona `tradePost`,
   `docs/ASSETS.md`. Testy: `workers`, `yard-piles` (automatycznie), nowy test budżetu w `tests/workers.test.ts`
   lub osobny: `tradePost` ≤ 8 000 trójkątów, nakładka ≤ 1 500, wyłącznie istniejące materiały. `npm run perf:sim`
   bez zmian; pomiar wywołań rysowania na `?perf=1` w zimie z lodem (+1).
6. **`docs: D-111 trading post, D-112 bottleneck card; handover`**
   `docs/DECISIONS.md` (D-111: punkt, v9, migracja, R5 17 000, liczby §6; D-112: karta gardła, progi, pomiary),
   `docs/design/sandbox.md` (sekcja późnej gry), `docs/BACKLOG.md` (tłumaczenia 24 kluczy na 15 języków; opcjonalny
   wpis kroniki „pierwsza sprzedaż za rzeką”), `docs/HANDOVER.md`.

Kolejność 3 ↔ 4 jest wymienna; 5 można robić równolegle po 1 (zależy tylko od typu `tradePost` i `postOpen`).

---

## 8. Zrzuty i kontrola (CLAUDE.md: po każdym głównym ekranie)

Narzędzie `tools/day9-post-shots.mjs` (wzór: `tools/night6b-shots.mjs`, `window.__marchia.app`, `?play=sandbox`):
przypadki `post-closed` (arkusz przed R4), `post-open-noroad` (R4, list rangi i arkusz z lekiem „Zbuduj drogę i most”),
`post-sales` (po 5 min handlu: ceny, ostatnie sprzedaże), `post-ice` (zima, karta „przęsło”, kra na moście),
`neck-grain` (karta „Wąskie gardło: Zboże”, podświetlone „Buduj”, arkusz młyna z „Postaw jeszcze: Gospodarstwo”),
`neck-fleet`. Rozmiary 412×915, 915×412, 904×1000 → `docs/shots/day9-*.jpg`. Stan przygotować komendami
(`loop.enqueue`) i podniesieniem `town.rank` tylko w skrypcie zrzutów. Obejrzeć pod listą „Forbidden” z CLAUDE.md
(brak szablonowych kart, cele dotyku ≥ 48 px, RTL `ar` dla arkusza punktu), potem `npm run layout -- --quick`.

---

## 9. Pliki tego badania

- `docs/specs/2026-11-04-valley-trade-post.md` — ta specyfikacja.
- `tools/valley-bottleneck.ts` — reguła karty gardła zaimplementowana poza `src/` (czysty odczyt) i pomiar pasm;
  `--late` ładuje graczy prototypu (wymaga `git apply --exclude=src/sim/events.ts docs/research/2026-11-04-valley-late-proto.patch`,
  bo `events.ts` zmienił się po prototypie).
- `tools/valley-3h.ts` — hak `afterStep` (sonda po każdym `step()`, tylko odczyt).
