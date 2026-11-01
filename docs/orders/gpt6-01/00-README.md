# Zlecenia GPT-6 — paczka 01 (MARCHIA — Szlaki Królestwa)

Repozytorium: `woogitsugames/marchi`. Gałąź bazowa: `claude/eager-cori-08wt8e`.
Każde zlecenie = osobna gałąź `gpt/<nr>-<skrót>` i osobny PR **do gałęzi bazowej** (nie do `main`).

Zanim zaczniesz, przeczytaj: `CLAUDE.md`, `docs/DESIGN.md`, `docs/ART_DIRECTION.md`, `docs/UI_STYLE.md`,
`docs/DECISIONS.md`. Są wiążące (zakazy stylu, czysta symulacja, i18n PL+EN, brak kopiowania z innych gier).

Zasady wspólne:
- Kod i komentarze po angielsku, teksty gracza tylko przez `src/i18n/pl.ts` + `src/i18n/en.ts`.
- Nie edytuj `src/sim/**`, `src/render/**`, `src/ui/**`, `src/main.ts`, chyba że zlecenie mówi inaczej
  (trwają tam prace równoległe — konflikty).
- Przed PR: `npm ci && npm test && npm run typecheck` (jeśli typecheck nie przechodzi z powodu plików,
  których nie dotykasz, opisz to w PR).
- Każdy zasób z zewnątrz: tylko CC0 lub OFL, wpis w `docs/ASSETS.md` (źródło, autor, licencja, link, zmiany).
- Nowe decyzje: dopisz w PR propozycję wpisu D-NN do `docs/DECISIONS.md` (kolejny wolny numer).
- Małe commity, opis PR: co, dlaczego, jak sprawdzić, zrzuty jeśli dotyczy.

Zlecenia:
1. `01-ci.md` — GitHub Actions: testy, typecheck, build, APK jako artefakt.
2. `02-audio.md` — dźwięk: ambient doliny, SFX wozów/budynków/UI, moduł audio.
3. `03-app-icon.md` — ikona aplikacji i ekran startowy (Android + iOS) w stylu drzeworytu.
4. `04-missions-2-3.md` — projekt misji 2 i 3 (dokument + dane jako propozycja).
5. `05-store-listing.md` — opisy do Google Play / App Store PL+EN, polityka prywatności.
