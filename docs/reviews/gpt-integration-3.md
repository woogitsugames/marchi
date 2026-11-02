# Integracja GPT-6 — runda 3 (paczka 07, gałęzie `gpt/48…54`)

Baza `claude/eager-cori-08wt8e` @ 1277542. Każda gałąź scalona lokalnie `--no-ff` (bez konfliktów); na końcu
`npm run typecheck`, `npm test` (282/282), `npm run build`, `tools/codex-check.ts`, `process_audio.py --check`.
Na GitHubie nic nie scalano ani nie zamykano.

## 48 — tłumaczenia, paczka 06 (15 języków)
- **Przyjęto:** misje VII–IX i pory roku (24 klucze) we wszystkich 15 słownikach.
- **Poprawiono:** `season.when` przetłumaczono ze starej wersji (`{season} · dzień {day}`); baza ma
  `{season} · rok {year}` — poprawione ręcznie we wszystkich 15 językach. Kolejność kluczy ustawiona jak w `pl.ts`
  (nowe narzędzie `tools/i18n-reorder.ts`; komentarze sekcji w słownikach usunięte). `PENDING_KEYS` 33 → 9
  (zostają klucze z rundy 2026-11-02: rozbiórka, NO_STONE, CONTESTED „idzie do”, kamień drogowy).

## 49 — misje X–XII
- **Przyjęto:** `src/sim/proposals/missions-10-12.ts`, boty, `docs/missions/m10–m12.md`, listy PL/EN
  `docs/content/letters-10-12.md`, `tests/missions-10-12.test.ts`. Tylko `import type`, brak `mission.id ===`,
  brak zakazanej matematyki. Rejestracja w `missions.ts` (zrobiona przez GPT) zostaje — misje **nie są w menu**
  (`MENU_MISSIONS` kończy się na m9); do menu po integracji UI (teksty, listy, podpowiedzi) — pozycja w backlogu.

## 50 — pliki dźwięków (13 nowych)
- **Nie dostarczono plików** — w gałęzi tylko narzędzia (`tools/finalize_audio_50.py`, testy `process_audio`)
  i kroki CI tylko do odczytu (unittest, `ffprobe`, `process_audio.py --check`). Workflow nie pushuje.
- **Przyjęto** narzędzia i kroki CI (sprawdzają dzisiejszy katalog 46 plików: PASS 1,40 MB / 4 MB).
  Zlecenie 50 **pozostaje otwarte** (pliki CC0 + wpisy w `ASSETS.md`).

## 51 — Kronika doliny
- **Przyjęto:** czyste warunki danych `src/sim/proposals/chronicle.ts`, 30 wpisów PL/EN, test. Jeszcze niepodpięte
  do UI/zapisu — pozycja w backlogu.

## 52 — balans sandboxa z porami roku
- **Przyjęto:** `tools/balance-sandbox.ts` (180 min, 6 strategii), raport `docs/balance/sandbox-seasons.md`.
  Łatka strojeniowa z raportu **nie jest stosowana** (sam autor zaleca playtest przed zmianą sim).

## 53 — testy odporności
- **Przyjęto:** `tests/seasons-fuzz.test.ts`, `tests/save-v6.test.ts`, `tests/missions-7-9-edge.test.ts`.
- **Poprawiono:** test „NO_STONE exact payload” oczekiwał `{k,need,have}`; baza dodała podpowiedzi
  (`incoming`, `atQuarry`, `quarries`). Test porównuje teraz błąd komendy z błędem walidacji i dokładne need/have.

## 54 — Księga towarów
- **Przyjęto:** `docs/content/codex.{json,md}`, `tools/codex-check.ts` (OK: 10 towarów, 13 budynków).

## Odrzucono
- Nic w całości. Częściowo: brak plików audio (50) — zlecenie otwarte.
