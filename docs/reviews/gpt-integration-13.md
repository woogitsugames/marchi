# Integracja GPT-6 — paczka 13 (gałęzie `gpt/73…99`, 21 zleceń)

Baza `claude/eager-cori-08wt8e` @ b6b86d9, gałąź integracyjna `claude/gpt-review-13`. Każda gałąź scalona lokalnie
`--no-ff`, poprawki w osobnych commitach. Na GitHubie nic nie scalano, nie zamykano i nie komentowano.
Żadna gałąź nie dotknęła zakazanych ścieżek (`src/ui`, `src/render`, `src/styles`, `src/sim`, `src/main.ts`,
`src/platform`, `src/audio/sounds.ts`, workflows, `package.json`); zmiany w `src/` tylko w `src/i18n/{pl,en}.ts`
i `src/content/letters.ts` (dozwolone w 85/86/99). Brak sekretów, brak cudzych zasobów.

Na końcu: `npm run typecheck` OK, `npm test` **549/549** (failed=0), `npm run build` OK, `i18n:coverage`
683 klucze / 0 brakujących / 0 rozbieżnych placeholderów, `tools/smoke.cjs` SMOKE bad=0 (m1–m13 + sandbox),
layout `--quick` — wynik w sekcji „Weryfikacja”.

## 73 — zdarzenia doliny rang 4–5 (tekst)
- **Przyjęto:** 6 propozycji zamówień (posterunek, most po zimie, jarmark) PL/EN; towary istnieją w `GOODS`.
- **Poprawiono:** tabela dopisana do `docs/content/events.md` psuła test `valley-events` (test traktuje każdy wiersz
  „| \`id\`” jako wdrożony szablon: „known ID: post_shelter”). Propozycje przeniesiono do
  `docs/content/events-late.md`, w `events.md` został odsyłacz. GPT deklarował zielone testy — nie były.
- **Do wdrożenia przez koordynatora:** szablony w generatorze zamówień (ilości/nagrody), decyzja, czy `post_*`
  wymaga otwartego posterunku.

## 74 — kronika rang 4–5 i posterunku (tekst)
- **Przyjęto:** 8 wpisów PL/EN, długości w limicie (≤32 / ≤90).
- **Poprawiono:** jak w 73 — test `chronicle` („expected 30, got 38”); przeniesione do `docs/content/chronicle-late.md`.
- **Do wdrożenia:** warunki danych (sprzedaż w posterunku osobno od `sold` zamku, zamarznięty most z historii
  zdarzeń, rekord przepływu z oknem), klucze `chron.*`.

## 75 — testy zapisu v9
- **Przyjęto:** `tests/save-v9-continuation.test.ts` — dolina z posterunkiem, zapis w trakcie `WAGON_DUE` (m4),
  trzy scenariusze fuzz; zapis → bramka → migracja → 3000 ticków, ten sam hasz. 3/3 zielone.

## 76 — długości tłumaczeń
- **Przyjęto:** `tools/i18n-length.ts` (stosunek do EN i PL, próg 130 %).
- **Poprawiono:** pełny CSV (11 611 wierszy, 1,4 MB) łamał test `repo-size` (plik > 1 MiB poza katalogami zasobów).
  Domyślnie narzędzie zapisuje tylko wiersze > 130 % (2063 wiersze, 224 KB); pełna tabela przez `--all`
  (nie commitować). Uwaga: 1,4 MB blob zostaje w historii commitu scalającego.

## 77 — zbiorcze wyniki playtestu
- **Przyjęto:** `tools/playtest-aggregate.ts` (parser CSV z cudzysłowami, pierwsza ważna próba na uczestnika,
  ścisłe < 30 s, mediany, TOP kodów problemów), fikstura z nagłówkiem identycznym z `results-template.csv`,
  test zielony. Kod gęsto sformatowany — do ewentualnego przeformatowania, działa poprawnie.

## 78 — pomoc w grze (tekst)
- **Przyjęto:** `docs/content/help.md`, 6 kart PL/EN.
- **Poprawiono:** „Wybierz trakt / Select Track” → narzędzie „Droga” / „Road” (`tool.road`), „Free Valley” → „Free valley”.
- **Do wdrożenia:** ekran pomocy + klucze i18n (koordynator).

## 85 — korekta `pl.ts`
- **Przyjęto:** `fix.surplus` (szyk, jednoznaczny podmiot), list VI „magazyn” → „spichlerz” (spójność terminu).
- **Odrzucono:** `end.act.bridge` „…rozładuje kolejkę” — powtarza „kolejki” z tego samego zdania; oryginał
  „ją rozładuje” był poprawny. Raport GPT zaktualizowany. Uwaga: korekta bardzo skromna (3 zmiany).

## 86 — korekta `en.ts`
- **Przyjęto wszystkie 6 zmian:** `status.WAGON_DUE` („collects”), samouczek „Select Road” (zgodnie z `tool.road`),
  `end.act.wagon` bez powtórzenia, listy IV/VII/XI (wagons, „worked together”, „more wagons”). Każda nie dłuższa.

## 87 — spójność `docs/missions/*.md`
- **Przyjęto:** nowe `m1.md`, `m14.md`, `m15.md`, korekty m3 (deszcz 20–700 s, termin 660 s), m4 (historyczne progi),
  m6. Sprawdzone wyrywkowo z kodem (m1: 180 srebra, 2 wozy, 9:15/10:45/12:00; m14: 90 srebra, 4 wozy, 8:36;
  m15: zboże 30 + drewno 36, transze 5:30/7:30).
- **Do decyzji:** M15 — komentarz w `missions-14-15.ts` opisuje chleb i deski, dane mają zboże i drewno.

## 88 — indeks decyzji
- **Przyjęto:** `tools/decisions-index.ts` + `docs/DECISIONS-index.md`.
- **Poprawiono:** narzędzie pomijało nagłówki `## D-NN` (brakowało D-152); indeks odświeżony do D-203 (190 wpisów).
  Status/data heurystyczne („nieokreślony” gdzie brak jawnego oznaczenia).

## 89 — słownik dla tłumaczy
- **Przyjęto:** `docs/i18n/glossary.md`, 61 pojęć × 17 języków z rzeczywistych ciągów. Zgłoszone niespójności
  (posterunek vs „Punkt handlowy” w `building.tradePost`; sława vs renoma) — do decyzji redakcyjnej.

## 90 — scenariusz samouczka budowania (tekst)
- **Przyjęto:** 6 kroków dla Wolnej doliny, warunki przejścia ze stanu świata, „Pomiń”, bez wymuszania.
- **Poprawiono:** „Track” → narzędzie „Droga”/„Road”; „drwalnia” → „chata drwala” (`building.woodcutter`) + uwaga.
- **Do wdrożenia:** całość w `src/ui/` (koordynator).

## 91 — menu na zimno (tekst)
- **Przyjęto:** krótsze podtytuły I–XV + Wolna dolina, PL/EN.
- **Poprawiono:** XII EN „Ale” → „Beer” (towar `beer`); dopisano uwagę, że IX i X brzmią podobnie.
- **Do wdrożenia/decyzji:** zamiana `menu.m*Sub` (+ 15 języków) po akceptacji właściciela.

## 92 — dolina 3 h z botem
- **Przyjęto:** `docs/research/gpt-valley-3h.md` (wszystkie strategie × 4 seedy, sprzedaż posterunku dla `decent`,
  karta 10/30/60 przez 90 min).
- **Potwierdzono na bieżącej bazie:** `valley-3h grow --seeds 1301` → `step "road to the trading post" failed:
  {"k":"BLOCKED","cell":2439}` — plan bota `grow` wymaga naprawy (koordynator). Także `card-10` kończy ze 142 wozami.

## 93 — długi fuzz
- **Przyjęto:** raport + 2 testy w `tests/known-failing/`. Runner potwierdza oba otwarte błędy:
  - seed 255 (m2, rozbiórka komórki 2937 w ticku 2065): wóz 12 w `BRIDGE_JAM` 3007 ticków;
  - seed 91 (valley-75, 5 komend): wóz 15 w `BRIDGE_JAM` 3040 ticków.
  Obie to zakleszczenie na moście po rozbiórce drogi — **błąd symulacji do naprawy przez koordynatora**.
  Zgłoszony też błąd `shrink` w `tools/fuzz-lib.ts` (ticki bezwzględne snapshotu vs długość względna).

## 94 — krzywa trudności
- **Przyjęto:** tabela zapasów 3★/2★ dla m1–m13 (bot 10/30/60 s) + SVG. Wnioski: M1/M2 trudny start, M7 i M11
  bez 3★ we wszystkich wariantach. Liczb nie powtarzano. M14/M15 bez danych (poza `MISSIONS`; `balance-night6`
  rzuca `TypeError` przy jawnym `m14`).

## 95 — polityka prywatności
- **Przyjęto częściowo:** poprawki PL/EN i `data-safety.md` (localStorage obok IndexedDB, schowek w trybie playtestu
  i panelu diagnostycznym, kopie systemowe). **Pozostałe 15 języków nie zaktualizowano** — zlecenie otwarte.
- **Do uwagi:** `ASSET_PACK_PROD_BASE` (pakiet 4K) to adres sieciowy — przy włączeniu pakietu polityki i
  formularze sklepów muszą wspomnieć pobieranie zasobów.

## 96 — audyt licencji zasobów
- **Przyjęto:** `tools/assets-audit.ts` (202 pliki, 0 brakujących wpisów) i tabela per-plik w `ASSETS.md`.
- **Poprawiono:** konflikt w `ASSETS.md` z sekcją „Graphics polish 10” bazy — zachowane obie.
- **Do decyzji właściciela:** 61 plików `ui/kit` ma tylko „licencja jak gra” — potwierdzić warunki i pochodzenie.

## 97 — README
- **Przyjęto:** `README.md` po angielsku + `docs/README.pl.md`.
- **Poprawiono:** przywrócono odznakę CI, sekcję GitHub Actions i komendy `bot`/`perf:sim`, które GPT usunął.

## 98 — arkusz muzyki
- **Przyjęto:** 7 cue’ów z promptami PL/EN, bez plików.
- **Poprawiono:** ujednolicono „bęben ramowy”; dopisano, że menu/misja/deszcz/wygrana/przegrana już mają utwory —
  nowe zamówienia to zima, ranga 4–5, posterunek.

## 99 — teksty czytnika ekranu
- **Przyjęto częściowo:** `pin.stood` PL/EN (czas przestoju / „stalled for”), PL `hud.stallsNext`.
- **Poprawiono:** PL `hud.stallsNext` „Liczba przestojów: {n}. Pokaż kolejny” → „Zastoje: {n} — pokaż kolejny”
  (termin „zastój” jak na pieczęci alarmu, odpowiednik EN „Stalls: {n}”). Pozostałe 15 języków mają dawną,
  nadal poprawną treść. Brak odsłuchu TalkBack/VoiceOver; pasek pojemności w `panels.ts` bez nazwy/jednostki —
  wymaga zmiany UI (koordynator).

## Odrzucono
- W całości nic. Częściowo: `end.act.bridge` z 85. Niepełne: 95 (15 języków), 99 (odsłuch, UI).

## Weryfikacja
LAYOUT_PLACEHOLDER
