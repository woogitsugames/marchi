Repozytorium: woogitsugames/marchi, gałąź bazowa: claude/eager-cori-08wt8e (zrób `git fetch` — baza poszła do przodu,
stan v5, 10 towarów). Pracuj na gałęziach claude/s4-chains-ui i claude/s4-wagon-spacing, na końcu PR-y do bazy.
Komunikacja po polsku, kod po angielsku. Zasady: CLAUDE.md. Przeczytaj docs/DECISIONS.md (D-27, D-29, D-30),
docs/design/sandbox.md, docs/BACKLOG.md. NIE edytuj src/ui/app.ts, src/ui/menu.ts, src/platform/save.ts (tam trwa
praca nad slotami zapisu). Nowe teksty: pl.ts + en.ts + PENDING_KEYS w pl.ts.

ZADANIE A — Interfejs i render nowych łańcuchów (claude/s4-chains-ui)
Symulacja ma już: towary fish/stone/charcoal/malt/beer, budynki fisher/quarry/charcoalBurner/malthouse/brewery,
błędy NOT_NEAR_WATER / NOT_ON_ROCK / NO_STONE{need,have}, przyczynę NO_INPUT cause CONTESTED{blockedBy},
koszt kamienia dróg (`roadStoneCost`, `stoneAvailable`), `isRockCell`, `nearWater`, rangi 4–5, `castleLevel`.
Modele, ładunki i ikony są gotowe (src/render/models/chains.ts, cargo.ts, src/ui/icons.ts).
1. src/ui/buildTool.ts + roadTool.ts: komunikaty dla nowych błędów przy duchu budynku; koszt kamienia obok srebra
   (np. „30 srebra · 4 kamienie (masz 2)”), też przy rysowaniu bruku/mostu kamiennego; przy stawianiu kamieniołomu
   podświetl skaliste pola (isRockCell) jako nakładkę na ziemi, przy rybaku — pola przy wodzie.
2. src/ui/panels.ts / format.ts: tekst i ikona dla CONTESTED („Drewno idzie do: Tartak”) z linkiem do rywala;
   karta spichlerza pokazuje rezerwę kamienia.
3. src/ui/marketSheet.ts + hud.ts: 10 towarów w tabeli cen, rangi 4–5 i „rozbudowa zamku” w historii/odblokowaniach.
4. src/render/view.ts / fx.ts: dym z węglarza (gdy WORKING), z browaru i słodowni (punkty dymu są w modelach);
   castleLevel 1 → wariant zamku (np. dodatkowa wieża/chorągiew) w buildingsView.
5. docs/UI_STYLE.md: tabela kształtów towarów o 5 nowych.
Zrzuty Playwright (412×915, 915×412, fold-inner-land; ?quality=low&dynres=0; preinstalowany, nie instaluj) →
docs/shots/ui5-*.png, obejrzyj, 2 rundy poprawek wg zakazów z CLAUDE.md. typecheck/test/build zielone.

ZADANIE B — Odstępy między wozami (claude/s4-wagon-spacing), src/sim + render
Wozy jadące tą samą krawędzią w tym samym kierunku nakładają się (BACKLOG). Dodaj w sim minimalny odstęp
(np. wóz nie wjeżdża na krawędź/nie zbliża się bliżej niż ~5 m do poprzedzającego wozu w tym samym kierunku;
deterministycznie, bez zakleszczeń — uważaj na skrzyżowania i bramy) albo — jeśli w sim zbyt ryzykowne —
rozwiąż czysto wizualnie w src/render/wagonsView.ts (przesunięcie wzdłuż krzywej), opisz decyzję jako D-NN.
Jeśli w sim: misje m1–m6 mogą się zmienić tylko nieznacznie — zmierz tools/balance.ts przed/po (progi pieczęci
nadal spełnione), fuzz `npm run fuzz -- --runs 60`, test na brak zakleszczeń z 120 wozami (tests/stress).
Raport po polsku z linkami do PR-ów i liczbami.
