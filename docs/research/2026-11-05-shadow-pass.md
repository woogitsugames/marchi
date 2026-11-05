# Przebieg cienia — co można uciąć (badanie 2026-11-05, dzień 9e)

Kontynuacja pozycji #4 z `2026-11-05-frame-cost-day9.md`: CPU przebiegu cienia to 13–28 % klatki. Każda zmiana
cienia zmienia obraz, więc decyzja należy do właściciela. Tu są pomiary, zrzuty i rekomendacja.

## Jak dziś działa cień (lighting.ts, view.ts)

- Jedno słońce (`DirectionalLight`), **jedna mapa cienia, bez kaskad**. Opcja (d) „mniej kaskad” nie ma zastosowania.
- Mapa 2048 (high/ultra) albo 1024 (low), PCF soft. Rozmiar mapy kosztuje GPU (wypełnianie), **nie CPU**: CPU zależy
  od liczby rysowań w przebiegu cienia (high 61, low 34 na klatkę przy piaskownicy 100 / 60 m).
- Kamera cienia dopasowana do zoomu: kwadrat o promieniu `0,8 · odległość` (28–320 m), przyciągany do tekseli.
- Przebieg idzie co klatkę, czyli cała scena drugi raz, także drzewa i budynki, które się nie ruszają.

## Sprawdzone opcje

Wszystkie trzy prototypy działają w czasie wykonania, wstrzykiwane do strony z niezmienionej wersji
(`tools/shadow9-modes.js`, włącza je `SHADOW_MODE` w `tools/frame9-cost.mjs`):

- **A — mapa cienia co 2. klatkę.** Odświeżenie jest wymuszane przy przesunięciu lub zoomie kamery albo gdy słońce
  obróciło się o > 0,002 rad od ostatniego odświeżenia. To dużo mniej niż teksel; słońce przy ×4 obraca się o ~0,0003 rad
  na klatkę. Mapa odświeżała się w 52 % klatek (468/902). Wariant „a0”, czyli odświeżanie przy każdym ruchu słońca,
  wypada podobnie, bo słońce zmienia się tylko na ticku. Gotowy szkic w `src` jest w
  `docs/research/2026-11-05-shadow-pass-a.patch`: `Lighting.shadowEvery`, 2 na low/high, 1 na ultra. Typecheck przechodzi.
- **B — węższy zasięg cienia:** promień × 0,6 (przy 60 m: 48 → 29 m).
- **C — statyczne cienie w pamięci podręcznej, w każdej klatce tylko wozy.** Prototyp mierzy górną granicę zysku:
  w przebiegu cienia rzucają tylko siatki wozów (23 obiekty, 7 rysowań). Sama pamięć podręczna nie jest zbudowana,
  wykonalność opisuję niżej.

## Pomiar CPU przebiegu cienia (piaskownica 100, 60 m, ms na sekundę gry przy ×4)

SwiftShader na CPU desktopu, pomiar bardzo zaszumiony (wspólna maszyna; przy tej samej konfiguracji czas całej klatki
wahał się 155–408 ms/s). Dlatego podaję zakres z 1–2 przebiegów po 4 sekundy, minimum oraz liczbę rysowań, która jest
deterministyczna. Surowe dane: `docs/research/shadow9-data/*.json`, tabela: `shadow9-data/table.py`.

| opcja | jakość | rysowania cienia / kl. | trójkąty cienia / kl. | cień ms/s (mediana, przebiegi) | min | zmiana CPU cienia |
|---|---|---:|---:|---:|---:|---:|
| dziś | high | 61 | 397k | 32 / 145* | 25 | — |
| A co 2. kl. | high | 30 (średnio) | 199k | 16 / 20 | 9 | **≈ −50 %** |
| B zasięg ×0,6 | high | 61 | 397k | 39 / 66 | 33 | **≈ 0** |
| C tylko wozy | high | 7 | 22k | 25 | 8 | **≈ −60–70 %** (przy stojącej kamerze) |
| dziś | low | 34 | 237k | 39 / 43 | 20 | — |
| A co 2. kl. | low | 17 (średnio) | 119k | 10 / 8 | 5 | **≈ −50–75 %** |
| B zasięg ×0,6 | low | 34 | 237k | 32 / 28 | 17 | ≈ 0–15 % (szum) |
| C tylko wozy | low | 7 | 22k | 14 | 10 | ≈ −50–60 % |

\* pierwszy przebieg „dziś/high” szedł równolegle z kompilacją `tsc`, więc jest zawyżony. Wiarygodny jest drugi.

Przy udziale cienia 13–28 % klatki A oszczędza **~7–14 % CPU klatki**, a C przy stojącej kamerze ~9–18 %.

- **B nie zmniejsza liczby rysowań.** Wszystkie rzucające to duże `InstancedMesh` (drzewa, kępy, części wozów,
  budynki), których bryły brzegowe i tak przecinają mniejszy frustum. Zysk dotyczy wyłącznie GPU (mniej tekseli do
  zapełnienia na metr; ostrzejszy cień), na CPU — zero. Odpada jako sposób na CPU.
- **C ma stały koszt, który nie znika.** Nawet 7 rysowań kosztuje ~8–25 ms/s: przejście całej sceny w
  `WebGLShadowMap.renderObject`, przełączenie celu, `clear`. Do tego przy każdym przesunięciu albo zoomie kamery mapa
  statyczna liczy się od nowa, czyli pełny koszt dzisiejszy plus kopia. Przy przewijaniu C kosztuje tyle co dziś albo
  więcej.

## Co widać (zrzuty 412×915, DPR 2, piaskownica 100, 60 m, czas renderu zamrożony)

Pliki są w `docs/research/shots-shadow9/`: `<jakość>-60-<opcja>-pair.jpg` to cały ekran przed/po, `-crop.jpg` to
wycinek z największą różnicą, powiększony 2×.

- **A.** Zrzut „po” ma mapę cienia o **1 tick** starszą od obrazu. Przy ×4 i 60 kl./s rzeczywiste opóźnienie wynosi
  0,67 ticka, przy 30 kl./s na telefonie 1,33, więc zrzut pokazuje typowy najgorszy przypadek. Na 63 jadących wozach:
  - high: zmienione 0,25 % pikseli (maks. 74 poziomy);
  - low: zmienione 0,22 % pikseli (maks. 41 poziomów).

  W skali telefonu różnicy nie widać. W wycinku 2× cień wozu jest przesunięty o ułamek długości wozu względem koła.
  W ruchu cień wozu porusza się 30 razy na sekundę zamiast 60. Na zatrzymanym zrzucie tego nie widać, dopiero w ruchu
  jako lekkie „ciągnięcie” cienia przy szybkim wozie. Statyczne cienie (budynki, drzewa) są identyczne.
- **B.**
  - high: zmienione 1,7 % pikseli. Cienie liści i gałęzi w koronach są nieco ostrzejsze, bo gęstość tekseli jest
    1,7× większa. Przy 60 m na pionowym ekranie cień nie urywa się w kadrze.
  - low: 0,4 % pikseli.

  Przy 160 m i więcej obcięcie (promień 96 m) zaczęłoby być widoczne u góry kadru; tego nie fotografowałem.
- **C.** Zrobiony poprawnie daje obraz identyczny bit w bit przy stojącej kamerze, więc zrzut nie ma sensu. Ryzyko
  wizualne to „szew”: przy błędzie w kopii głębi albo w odświeżaniu po ruchu słońca cienie budynków skakałyby co
  odświeżenie.

## Wykonalność C (three r181)

`WebGLShadowMap` czyści mapę przed każdym światłem i nie ma trybu „dorysuj”. Warstwy (`layers`) sprawdza względem
kamery głównej, nie kamery cienia. Droga przez API three wygląda tak:

1. Druga mapa `WebGLRenderTarget` dla statycznych rzucających: podmiana `light.shadow.map`, `needsUpdate`, rzucają
   tylko statyczne.
2. W każdej klatce do właściwej mapy idzie pełnoekranowy czworokąt z `customDepthMaterial`, który przepisuje
   spakowaną głębię RGBA oraz `gl_FragDepth` z mapy statycznej. Na to rysowane są wozy.

To ~150 linii, nowy shader, interakcja z pre-warmem programów (D-65/D-136) i z dopasowaniem kamery cienia (snap,
zoom) oraz wymagany test „bit w bit”. Ryzyko średnio-wysokie. Zysk ponad A to tylko ~10–20 punktów procentowych
przebiegu cienia i wyłącznie przy stojącej kamerze.

## Rekomendacja

**A na low i high, ultra bez zmian.** Daje ~−50 % CPU przebiegu cienia (~7–14 % klatki), zmienia dwie funkcje
(`Lighting.fitShadow` + jedna linia w `applyQuality`), na zrzutach jest niewidoczne w skali telefonu, a w ruchu daje
najwyżej lekko „ciągnący się” cień szybkiego wozu. Statyczne cienie się nie zmieniają, bo pan i zoom wymuszają
odświeżenie. B odrzucam, bo nie daje nic na CPU. C odłożyć: duży koszt wdrożenia, zysk tylko przy stojącej kamerze
i ryzyko szwu.

### Pytanie do właściciela

Obejrzyj `high-60-a-pair.jpg` i `high-60-a-crop.jpg`, najlepiej też w grze przy ×4 z łatką A. Którą opcję wybierasz?

- **A)** Cień co 2. klatkę na low i high, ultra bez zmian (rekomendacja; ~−7–14 % CPU klatki).
- **B)** Cień co 2. klatkę tylko na low (high zostaje co klatkę, zysk tylko na słabszych telefonach).
- **C)** Bez zmian w cieniu; szukamy oszczędności gdzie indziej (pozycje 1–3 z dnia 9 nie zmieniają obrazu).

## Pliki

- `tools/shadow9-modes.js`: prototypy w czasie wykonania (base, a, a0, b, c).
- `tools/frame9-cost.mjs` + `SHADOW_MODE`/`SHADOW_K`: pomiar.
- `tools/shadow9-shots.mjs`: zrzuty.
- `tools/render4-compose.py`: pary i wycinki.
- `docs/research/2026-11-05-shadow-pass-a.patch`: szkic wdrożenia A.
- `docs/research/shadow9-data/`: dane, `run.sh`, `table.py`.
- `docs/research/shots-shadow9/`: zrzuty JPEG.

Nie mierzone (limit czasu): 160 m, ultra, pozioma orientacja, mapa cienia na telefonie (GPU).
