# MARCHIA — Szlaki Królestwa

Mobilna, średniowieczna strategia logistyczna na Androida i iOS. Buduj drogi, przewoź towary wozami i ustalaj przyczyny przestojów produkcji lub transportu. Gra oferuje krótkie misje i rozbudowę Wolnej doliny.

[English](../README.md) · [Projekt gry](DESIGN.md) · [Zasady projektu](../CLAUDE.md)

## Uruchomienie

Potrzebny jest Node.js 20 lub nowszy. W katalogu repozytorium:

```bash
npm install
npm run dev         # serwer deweloperski Vite
npm test            # testy headless; wynik w linii SUMMARY
npm run typecheck   # aplikacja i symulacja
npm run build       # produkcyjna wersja webowa
```

Do zbudowania testowego APK potrzebne są JDK 21 i Android SDK. Jeśli SDK nie jest zainstalowane, uruchom `npm run setup:android`, a następnie `npm run apk`. Plik APK powstanie w `dist-apk/`. Wymagania i dodatkowe polecenia opisuje [CLAUDE.md](../CLAUDE.md).

## Katalogi

- `src/sim/` — deterministyczna symulacja i zasady gry.
- `src/ui/`, `src/render/`, `src/i18n/` — interfejs, renderowanie i tłumaczenia.
- `src/platform/`, `android/`, `ios/` — zapis i platformy mobilne.
- `public/assets/` — zasoby gry; źródła i licencje w [ASSETS.md](ASSETS.md).
- `tests/`, `tools/` — testy automatyczne i narzędzia.
- `docs/` — projekt, decyzje i dokumentacja produkcyjna.

Przed zmianami przeczytaj [CLAUDE.md](../CLAUDE.md): opisuje architekturę, zasady dotyczące zasobów i tryb pracy. Decyzje projektowe są w [DECISIONS.md](DECISIONS.md), a wytyczne wizualne w [UI_STYLE.md](UI_STYLE.md).
