# Zlecenie 03 — Ikona aplikacji i ekran startowy

Styl: jak ikony w `src/ui/icons.ts` (drzeworyt/rycina, jednolity kolor, kreskowanie). Zobacz `docs/shots/icons.png`
i paletę w `docs/ART_DIRECTION.md` (Torf `#2b2620`, pergamin `#e4dccb`, Glina `#8c4a2f`, Ochra `#b8893a`).

Motyw: **wóz z ładunkiem na drewnianym moście** (sylwetka), albo pieczęć woskowa z kołem wozu. Bez tekstu w ikonie.
Ma być czytelny w 48 px na launcherze. Narysuj jako SVG ręcznie (ścieżki), bez generatorów obrazów AI
i bez gotowych paczek ikon. Źródło: `art/app-icon.svg` (+ wariant monochromatyczny dla Android 13 themed icons).

Do zrobienia:
- Android: adaptive icon (foreground SVG→PNG/vector drawable, background Torf), `mipmap-*` wszystkie gęstości,
  themed (monochrome) layer; splash (Android 12+ SplashScreen API: ikona na tle Torf). Pliki w `android/app/src/main/res/`.
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset` (1024 px + wymagane rozmiary), splash/LaunchScreen tło Torf + ikona.
- Skrypt `tools/make-icons.mjs` generujący wszystkie rozmiary z SVG (użyj `sharp` jako devDependency albo Playwright,
  który jest w środowisku) — żeby dało się odtworzyć.
- Zrzut porównawczy `docs/shots/app-icon.png` (ikona na jasnym i ciemnym tle, 48/96/192/512 px).

Kryteria: rozpoznawalna w 48 px, zgodna ze stylem ikon gry, bez gradientów, neonów, glassmorphism, emoji.
