# 55 — Zestaw grafik UI malowany ręcznie (gałąź `gpt/55-ui-art-kit`)

## Dlaczego
Właściciel odrzucił kolejne wersje HUD rysowane w CSS jako „AI slop”: płaskie prostokąty z ramką i ikoną w kwadraciku
wyglądają generycznie, bez względu na kolory. **Układ** z makiety D mu odpowiada (`ref/D-412x915.jpg`,
`ref/D-915x412.jpg`): góra — menu, czas, srebro, prędkość, kontrakt pod wstęgą; dół — karta „Najgorszy zastój”
z czerwoną pieczęcią alarmu i rząd kart narzędzi. Brakuje **rzemiosła**: elementy mają wyglądać jak namalowane
i wykonane ręcznie dla tej gry, klasycznie (poważna gra historyczna), **nie bajkowo** i nie jak kreskówka.

Gust właściciela: czytelność i „żetony” jak w casualowych grach mobilnych (grube, wyraźne kształty, jeden duży
przycisk główny, liczniki-plakietki), ale w klimacie średniowiecza: pergamin, wosk, mosiądz, płótno, rzemień,
grawerunek. Paleta: przygaszona — wino/wiśnia (`#7a2630` ± ), łupkowy granat (`#34475a` ±), antyczny mosiądz/złoto
(`#b08a3e` ±), ciepły pergamin (`#e6d9bd` ±), atrament (`#2b2620`). Bez pasteli, neonu, połysku „plastiku”.

## Co dostarczyć (PNG z kanałem alfa, w `public/assets/ui/kit/`, plus arkusz podglądu)
Każdy element w 2 rozmiarach: `@2x` i `@3x` (wymiary bazowe w nawiasach, dp). Elementy rozciągane (9-slice) z
równymi marginesami nierozciąganych narożników — podaj je w `docs/ui-kit.md` (`left/top/right/bottom` w px).
1. **Panel pergaminowy** (9-slice, min 120×80): pergamin z delikatnym włóknem, cienka grawerowana ramka, ciemniejsza
   krawędź; wariant `panel-dim` (ciemniejszy) i `panel-alert` (lewa krawędź w kolorze wina, na kartę zastoju).
2. **Wstęga tytułowa** (9-slice poziomo, wys. 34): płaska heraldyczna wstęga w kolorze wina z zawiniętymi końcami
   i cienką złotą linią, miejsce na tekst.
3. **Żeton statystyki** (9-slice, wys. 40): mały pergaminowy plakietkowy kształt z miejscem na ikonę po lewej
   (czas, srebro).
4. **Przycisk okrągły** (56): pergamin w mosiężnej obręczy; stany `normal`, `pressed`, `active` (mosiężna/złota
   obwódka), `disabled` (przygaszony, kreskowanie).
5. **Karta narzędzia** (9-slice, 64×72): pergaminowa kartka/tabliczka; stany jak wyżej + `highlight` (mosiężna rama).
6. **Plakietka kosztu/licznika** (24): mała mosiężna moneta/medalion na liczbę; wariant czerwony (licznik zastojów).
7. **Pieczęć alarmu** (72): duża woskowa pieczęć w kolorze wina, nieregularny brzeg, wytłoczenie — pod ikonę.
8. **Pieczęcie kontraktu** (28): pusta (odcisk w pergaminie) i pełna (woskowa).
9. **Pasek postępu** (9-slice, wys. 8): grawerowany rowek + wypełnienie mosiężne/złote.
10. **Przełącznik segmentowy** (9-slice, wys. 44) dla prędkości: tło + segment aktywny.
11. **Pinezki na mapie** (40×48): czerwona (zastój), mosiężna (lżejszy zastój), łupkowa plakietka ETA (9-slice).
12. **Przycisk menu** (48).
Ikony (towary, narzędzia) **zostają z gry** (`src/ui/icons.ts`, jednokolorowe SVG) — kit ma na nie miejsce,
nie rysuj własnych ikon.

## Jak sprawdzić
- `docs/ui-kit.md`: tabela elementów (plik, wymiary, marginesy 9-slice, stany) + arkusz `docs/ui-kit-sheet.png`
  ze wszystkimi elementami na tle mapy (`ref/D-412x915.jpg` jako tło).
- **Makieta złożona z kitu**: odtwórz `ref/D-412x915.jpg` i `ref/D-915x412.jpg` z Twoich grafik (możesz złożyć
  obraz w dowolnym narzędziu) → `docs/ui-kit-D-412x915.png`, `docs/ui-kit-D-915x412.png`. To po nich właściciel
  oceni kit.
- Łącznie ≤ 1,5 MB (PNG zoptymalizowane). Wpis w `docs/ASSETS.md`: „wygenerowane dla Marchii, licencja jak gra”.
- **Nie** podpinaj kitu do kodu — integrację zrobi Claude po akceptacji właściciela.
