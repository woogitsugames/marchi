# MARCHIA — audyt dostępności UI (zlecenie 24)

**Data:** 2026-11-01 · **Baza:** `claude/eager-cori-08wt8e` · **Zakres:** analiza statyczna `index.html`, `src/styles/main.css`, `src/ui/*.ts`, `src/render/overlay.ts`, `docs/UI_STYLE.md` oraz zrzutów `docs/shots/*.png`.

**Ocena:** dostępność **częściowa, WCAG 2.2 AA nie można potwierdzić**. Największe blokery: wyłączona możliwość powiększania, brak nazw dostępnych w przyciskach statusu, klikalne wiersze listu przewozowego bez semantyki/obsługi klawiatury, brak zarządzania fokusem w panelach oraz sterowanie mapą zależne od dotyku. To jest **audyt kodu i statycznych zrzutów**, nie certyfikacja WCAG ani wynik testu z TalkBack/VoiceOver.

## Materiał i metoda

Przejrzano zrzuty HUD, „Dlaczego stoi?”, karty wozu, ekranu składanego i nakładki ruchu. Materiał porównawczy w tym katalogu:

- [hud-cvd.svg](hud-cvd.svg)
- [why-bakery-cvd.svg](why-bakery-cvd.svg)
- [wagon-cvd.svg](wagon-cvd.svg)
- [traffic-cvd.svg](traffic-cvd.svg)
- [fold-cover-cvd.svg](fold-cover-cvd.svg)

Każdy autonomiczny SVG zawiera oryginalny PNG oraz wersje z **aproksymacjami** protanopii, deuteranopii i tritanopii na bazie macierzy przekształceń RGB (filtr `feColorMatrix` z przestrzenią sRGB). Symulacja ilustracyjna; rzeczywiste doświadczenie wzrokowe jest indywidualne. Otworzyć pliki w przeglądarce obsługującej SVG (nie każdy podgląd repo wyświetla obrazy osadzone jako `data:`). Brak modyfikacji `src/`.

### Daltonizm i rozpoznawalność bez koloru

- **Ikony towarów:** drewno (pozioma kłoda z pierścieniem), deski (trzy sztaplowane belki), zboże (snop), mąka (kwadratowy worek), chleb (bochenek z nacięciami) — osobne obrysy w `src/ui/icons.ts:479–600`. W kartach widać je nawet po utracie różnic barwy. **Ocena: spełniona zasada nieopierania się wyłącznie na kolorze** na zbadanych ekranach.
- **Statusy:** `src/ui/format.ts:104–121` używa odmiennych sylwetek (brak drogi, przekreślony towar, brak wozu, zapchany most); `src/ui/markers.ts:69–79` zmienia także kolor krytyczności. Kształt pozostaje ważniejszy od czerwieni/ochry. Ocena **pozytywna, choć brak nazw dostępnych przycisków statusu**.
- **Nakładka ruchu:** `src/render/overlay.ts:5–6,34–51` zapisuje obciążenie w kanale R tekstury, a droga pozostaje wyróżniana kolorem/intensywnością w shaderze. Zrzut `view-traffic-portrait.png` nie ma legendy liczbowej ani wzoru tekstury różnicującego poziomy natężenia. Kolory bruku/traktu i natężenia częściowo zlewają się z naturalną ziemią/jesienną roślinnością; po transformacji barw odczyt stopnia ruchu jest niepewny. **Nie uznawać nakładki za dostępną wyłącznie na podstawie koloru** — dodać desenie / etykiety wartości / alternatywną listę obciążonych odcinków i przetestować na urządzeniu.
- **Składany ekran:** test `fold-fold-cover-hud.png` pokazuje czytelny list i dolny pasek, lecz dostępność układu po zmianie orientacji, podziału ekranu i skali 200% wymaga ręcznej walidacji.

## Kontrast WCAG 2.2 AA — obliczenia palety

Kontrast policzono według względnej luminancji WCAG (sRGB), przy **pełnym kryciu**, bez nakładanych tekstur / antyaliasingu. Wymóg AA: **≥4.5:1 dla zwykłego tekstu, ≥3:1 dla dużego tekstu i istotnych elementów graficznych UI**. Duży tekst = ≥24 CSS px zwykły lub ≥18.66 CSS px pogrubiony; `17px` nie jest dużym tekstem.

| Para foreground/background | Kontrast | Zwykły tekst AA | Komentarz |
|---|---:|:---:|---|
| `--ink #2b2620` / `--parchment #e4dccb` | **10.99:1** | OK | Podstawowy tekst |
| `--ink-soft #4d453a` / `--parchment` | **6.91:1** | OK | Opisy pomocnicze |
| `--meadow #56603f` / `--parchment` | **4.90:1** | OK | Status sprawny |
| `--clay #8c4a2f` / `--parchment` | **4.91:1** | OK | Status krytyczny |
| `--parchment` / `--oak #3b3127` | **9.31:1** | OK | Pasek narzędzi |
| `--mist #c9c6bb` / `--oak` | **7.42:1** | OK | Deszcz na pasku |
| `#f0e6d2` / `--clay` | **5.41:1** | OK | Główny przycisk |
| `--ochre #b8893a` / `--parchment` | **2.31:1** | **NIE** | Nie używać na papierze jako jedynego źródła informacji |
| `--ochre` / `--oak` | **4.04:1** | **NIE** | Dobre jako duża grafika, nie drobny tekst |
| `#7d5d23` / `--parchment` | **4.45:1** | **NIE** | `main.css:674,728` tuż poniżej 4.5 |
| `--iron #4a4843` / `--parchment` | **6.70:1** | OK | Linie i tekst |
| `--ink-soft` / `--parchment-dim #cfc5b0` | **5.51:1** | OK | Przyciski papierowe |

**Uwaga:** 4.45 i 4.04 nie zaokrąglać w górę do 4.5. Widoczny na zrzutach żółtawy wskaźnik ETA jest na innym tle (wypełnienie ochra, atrament), więc trzeba badać **konkretne pary**, nie przenosić automatycznie wyniku ochry na każdy element UI.

## Rejestr problemów

| ID | Waga | Lokalizacja | Ustalenie / ryzyko | Zalecenie |
|---|---|---|---|---|
| A01 | **P0** | `index.html:5` | `maximum-scale=1, minimum-scale=1, user-scalable=no` blokuje typowe powiększanie strony (WCAG 1.4.4, 1.4.10). | Usunąć blokadę zoomu; przetestować mapę przy powiększeniu/200% tekstu i Android font size. |
| A02 | **P1** | `src/ui/markers.ts:40–46,108–114` + `src/ui/icons.ts:1698` | `button.bubble` nie dostaje `aria-label`; w SVG statusu brak nazwy (`aria-hidden` dla ikony bez tytułu). W TalkBack możliwy anonimowy przycisk. | Przy aktualizacji markera ustawiać nazwę obiektu + przetłumaczony status; odświeżać nazwę po zmianie i18n. |
| A03 | **P1** | `src/ui/hud.ts:84–89,227–232`, `src/styles/main.css:264` | Wiersze `div.wb-line[data-wb]` reagują na `click`, ale nie mają `role=button`, `tabindex=0` ani aktywacji Enter/Space. Cel ma **30 px**, poniżej wewnętrznego progu 48 dp. | Użyć pełnoprawnego `<button>` z opisem liczby sztuk, min-height 48 px, zachowując wygląd papieru. |
| A04 | **P1** | `src/ui/sheets.ts:54–94,123–138` | `section.sheet role=dialog` bez `aria-labelledby`, `aria-modal` ani ustawienia/powrotu fokusu po otwarciu/zamknięciu. Dialog może być pominięty lub czytnik pozostanie w tle. | `h3` z unikalnym id, `aria-labelledby`; ustawić fokus na nagłówku/przycisku; przy zamykaniu przywrócić fokus; ustalić czy to modal, ukryć tło od a11y jeśli modalne. |
| A05 | **P1** | `src/ui/app.ts:480–495`, `src/ui/roadTool.ts` (interakcja gestem) | Klawiatura obsługuje skróty wyboru narzędzi, ale nie oferuje równoważnego sposobu wytyczenia odcinków drogi bez wskazywania na płótnie. Trudno przejść obowiązkowy most w M1 bez dotyku/wskazywania. | Dostępne pola współrzędnych/skok po siatce i potwierdzenie odcinka; zapewnić pełną obsługę klawiaturą i alternatywę dla sterowania gestami. |
| A06 | **P1** | `src/render/overlay.ts:5–6,34–51`, `src/render/terrain.ts` i zrzut `view-traffic-portrait` | Nakładka ruchu jest kolorystyczna bez podpisanej skali lub alternatywy tekstowej; nie da się pewnie ocenić natężenia z samego zrzutu w CVD. | Dodać liczby/przedziały i desenie lub alternatywną listę najbardziej obciążonych dróg; zweryfikować w CVD. |
| A07 | **P2** | `src/styles/main.css:674,728` | Brąz `#7d5d23` na pergaminie ma **4.45:1** (13px etykiety w drodze); minimalnie nie spełnia 4.5:1. | Przyciemnić odcień (po przeliczeniu ≥4.5:1, najlepiej ≥5:1); osobno sprawdzić światło/teksturę tła. |
| A08 | **P2** | `src/styles/main.css:78`, `src/styles/main.css:14` | Żółty obrys `--ochre` na jasnym pergaminie ma 2.31:1, może nie osiągać 3:1 dla zauważalnego fokusu. `focus-visible` istnieje — plus. | Użyć ciemniejszego kontrastującego obrysu na papierze i jasnego na dębie lub podwójnego obrysu. Sprawdzić 2.4.11 focus not obscured. |
| A09 | **P2** | `src/styles/main.css:57,263,270,604,929` | 13px opisy i **12px** etykiety narzędzi `is-narrow`; na Fold/Flip przy systemowych czcionkach mogą być za małe. 48dp jest wymogiem docelowym dla dotyku, ale nie minimalnym rozmiarem samego fontu w WCAG. | Minimum 14–16px dla tekstu funkcjonalnego, obsługa skalowania 200% i test reflow bez obcięć. |
| A10 | **P2** | `src/styles/main.css:729` | Klikalne `.kv .linkish` ma `min-height:40px`, poniżej przyjętego celu 48dp (WCAG 2.2 2.5.8 jest mniej restrykcyjne i dopuszcza wyjątki). | Podnieść do 48px i zachować przerwę między celami. |
| A11 | **P2** | `src/ui/menu.ts:76–89` | Segmenty jakości/języka są `role=group` bez programu powiązanego z widoczną etykietą `span.s-label`. | `aria-labelledby` powiązane ze `span` z id, ewentualnie `fieldset/legend`; sprawdzić odczyt stanu przycisków. |
| A12 | **P2** | `src/styles/main.css:1027–1029`; `src/ui/markers.ts:112–120`; `src/render/view.ts` | `prefers-reduced-motion` redukuje CSS animation/transition do 1ms (**na plus**), ale nie dowodzi wygaszenia kamerowych/3D animacji i ciągłych efektów ruchu. | W testach natywnych włączyć Android „Usuń animacje” / iOS Reduce Motion, zweryfikować kamerę i 3D; opcjonalny przełącznik ograniczający ruch w menu. |
| A13 | **P2** | `src/ui/hud.ts:224–232` | Poziom realizacji kontraktu jest głównie rysowany kreskami `tallySvg aria-hidden`; liczby `have/need` występują wizualnie, lecz wiersz nie ma semantycznej nazwy, a zmiany nie są zapowiadane. | Dodać czytelny `aria-label` towaru i postępu do przycisku wiersza; ogłaszać zmiany rozsądnie (nie co tick), np. po przekroczeniu progów. |
| A14 | **P2** | `src/ui/markers.ts:40–49` | Dynamiczna pula przycisków jest dołączana/usuwana położeniem, także przy częstych zmianach; fokus może przeskakiwać po ukryciu markera. | Jeśli fokus jest na znikającym markerze, przywrócić go do trwałego elementu; nie przełączać czytnikowi losowo kolejności tabulacji. |

## Mocne strony

- `src/styles/main.css:137–138,327,337–339,427–428,606,705`: wiele prawdziwych przycisków ma 48–60 px, a karta przyczyn 56 px.
- `src/styles/main.css:78`: `focus-visible` jest jawne.
- `src/ui/hud.ts:97–107,121,129–131`: opisane przyciski narzędzi, przyciski tempa z `aria-pressed`, semantyczny `nav`, powiadomienia w `aria-live=polite`.
- `src/ui/sheets.ts:127,134–138`: zamykanie przez nazwany przycisk oprócz gestu; `src/ui/app.ts:480–487`: Escape i skróty.
- `src/styles/main.css:1027–1029`: CSS szanuje systemowy `prefers-reduced-motion`.
- Sylwetki pięciu towarów i statusów są rozdzielone kształtem, a nie tylko kolorem.

## Plan weryfikacji i kryteria odbioru po poprawkach

1. **P0:** Chrome Android przy powiększeniu 200%, tekst systemowy 200%, TalkBack — zakładamy wybrany rozmiar i możliwość odczytania progresu. Skalowania nie wolno blokować.
2. **P1:** TalkBack (Android), VoiceOver (iOS): przejść kolejno „lista przewozowa → zamek → łańcuch przyczyn → wóz → zamknij” bez zgubienia fokusu. Każdy element interaktywny ma własną nazwę, rolę i stan.
3. **P1:** zewnętrzna klawiatura: wejście w M1, połączenie dwóch brzegów rzeki, naprawa braku drogi, przejście przez status bez pointera.
4. **P1:** nakładka ruchu: w oryginale oraz CVD rozpoznać ≥3 poziomy obciążenia bez czytania koloru (wzór/liczby/legenda).
5. **P2:** screeny 412×915, 915×412, 904×1000 i Fold/Flip przy font-size 200%, systemowym high-contrast i reduce-motion. Ponownie przeliczyć kontrast po zmianie CSS. Sprawdzić disabled/control status.
6. Zgłosić zadania per ID w backlogu w **osobnym PR** — ten audyt nie modyfikuje produktu.

**Definicja „przetestowano”:** bez uruchomienia APK na urządzeniach i czytnikach wyniki pozostają „do sprawdzenia”. Screenshot nie potwierdza dostępności w drzewie semantycznym ani focus trap.

## Metodologia / normy

- WCAG 2.2: [1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum), [1.4.4 Resize text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text), [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast), [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [2.4.11 Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum), [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value).
- Kryterium produktu MARCHIA `docs/UI_STYLE.md`: **obszar dotyku ≥48 CSS px**, co jest ostrzejsze od ogólnego minimum 24 CSS px WCAG 2.2 AA dla niektórych celów.
