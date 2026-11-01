# MARCHIA — Szlaki Królestwa

![CI](https://github.com/woogitsugames/marchi/actions/workflows/ci.yml/badge.svg)

Średniowieczna strategia ekonomiczno-logistyczna na telefony (Android + iOS). Osada rośnie dzięki drogom
i fizycznemu przewożeniu towarów: każdy wóz wiezie widoczny ładunek, ma cel i czas dojazdu, a każdy przestój
ma przyczynę, którą gracz sprawdza jednym dotknięciem. Krótkie kontrakty po 5–12 minut i tryb swobodny.

## Komendy

```bash
npm ci
npm run dev          # serwer deweloperski Vite
npm test             # testy headless symulacji (linia SUMMARY na końcu)
npm run typecheck
npm run build
npm run bot          # bot przechodzi misję 1
npm run perf:sim     # koszt symulacji przy 50/100/200 wozach
npm run setup:android && npm run apk   # debug APK do dist-apk/
```

Szczegóły: `CLAUDE.md`, projekt: `docs/DESIGN.md`, styl: `docs/ART_DIRECTION.md`, `docs/UI_STYLE.md`.

## GitHub Actions

- **CI** (`.github/workflows/ci.yml`): push na `claude/**` i `gpt/**` oraz PR-y z/do tych gałęzi —
  testy, typecheck, build, bot misji 1, perf symulacji w podsumowaniu joba.
- **Debug APK** (`.github/workflows/apk.yml`): Actions → *Debug APK* → *Run workflow* (lub tag `v*`);
  APK w *Artifacts* przez 14 dni. Wersja testowa, niepodpisana do wydania.
