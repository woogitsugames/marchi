# Marchia — audyt dostępności (zlecenie 24)

**Data:** 2026-11-01  
**Repozytorium:** woogitsugames/marchi  
**Baza audytu:** claude/eager-cori-08wt8e, commit 11a8a8ed54f976d7416cc52be7d3e6bf5ef9a15f  
**Zakres:** docs/UI_STYLE.md, src/styles/main.css, src/ui/*.ts (15 plików, tylko odczyt), index.html, src/main.ts oraz istotne ścieżki renderera (src/render/overlay.ts, terrain.ts, view.ts i src/ui/flatView.ts); 61 plików docs/shots/ui-*.png i fold-*.png.  
**Rodzaj:** statyczny audyt kodu, obliczenia kontrastu i symulacja zaburzeń widzenia barw. **Nie wykonano** testu urządzeń z TalkBack/VoiceOver ani pomiaru hitboxów z działającej aplikacji. Zapisane zrzuty są punktami kontrolnymi, nie dowodem zgodności na wszystkich urządzeniach.

## Podsumowanie

**Werdykt: dostępność nie jest gotowa do zatwierdzenia.** Najpoważniejsze bariery dotyczą wejścia na mapie (canvas/gesty bez równoważnika klawiaturowego), semantyki znaczników, okien dialogowych i powiększania. Paleta podstawowych tekstów jest zasadniczo czytelna, ale są **dwa potwierdzone przypadki kontrastu poniżej 4,5:1**. Przyciski główne mają poprawną bazę 48–60 px, lecz istnieją odstępstwa. Media query prefers-reduced-motion **istnieje**, lecz nie obejmuje animacji WebGL/Canvas.

Ważne rozróżnienie: 48 dp to **wymóg projektu UI_STYLE**, nie literalne minimum WCAG 2.2 AA. Kryterium WCAG 2.2 2.5.8 określa zwykle co najmniej 24×24 CSS px z wyjątkami; audyt stosuje bardziej rygorystyczny próg projektu ≥48 dp. WCAG nie narzuca też uniwersalnego minimum rozmiaru czcionki w px.

## Symulacje widzenia barw — 61 zrzutów

W katalogu simulations/ zapisano po **trzy obrazy SVG dla każdego z 61 oryginałów** (łącznie 183 pliki): protanopia, deuteranopia, tritanopia. SVG **odwołują się do oryginalnego PNG** w docs/shots/ i przetwarzają go podczas renderowania standardową macierzą barwną. W odróżnieniu od niezależnego, zrasteryzowanego PNG wymagają obecności katalogu docs/shots/. Nie zawierają modyfikacji obrazów źródłowych. Narzędzie VIEWER.html pokazuje oryginał i trzy symulacje obok siebie, zachowując proporcje źródeł.

Stosowane są macierze Machado (pełna symulacja, liniowa przestrzeń RGB, feColorMatrix), jako przybliżenie percepcji — nie kliniczny model widzenia każdego użytkownika. Wyniki należy dodatkowo obejrzeć na urządzeniu.

**Ocena znaczenia kształtów:**
- **Towary: pozytywnie na poziomie definicji ikon.** src/ui/icons.ts:480–616 deklaruje pięć wyraźnie innych sylwetek: kłoda z przekrojem, trzy deski, snop, worek mąki, okrągły chleb z nacięciami. src/ui/icons.ts:1691 wymienia komplet ikon; src/ui/panels.ts:63–65, src/ui/hud.ts:227–229 wykorzystują te ikony. Są monochromatyczne, więc ich identyfikacja nie polega wyłącznie na barwie. Należy jeszcze zweryfikować rozpoznawalność przy docelowych 20–24 px i 200% skali tekstu.
- **Powody przestoju: częściowo pozytywnie.** src/ui/format.ts:103–121 mapuje powody na osobne kształty i przekreśla brakujący towar. Jednak **priorytet krytyczny** używa tego samego kształtu dymku i zazwyczaj tego samego symbolu co niekrytyczny; zmiana priorytetu odbywa się kolorem (src/ui/markers.ts:108–119; main.css:459–460). Jest to ryzyko polegania na kolorze.
- **Nakładka ruchu i podgląd drogi: wynik negatywny w analizie implementacji.** src/render/terrain.ts:474–488 interpoluje barwy ochra → glina i rozróżnia prawidłowy/nieprawidłowy podgląd przede wszystkim kolorem, bez kreskowania, odrębnego obrysu czy legendy z wartościami. Barwy mogą zbliżać się w symulacjach protanopii i deuteranopii; dodatkowo teren/światło obniżają czytelność. Dokumentowane zrzuty nie dowodzą czytelności **aktywnej nakładki ruchu** we wszystkich trzech trybach, więc weryfikacja tego konkretnego stanu pozostaje otwarta.

## Kontrast WCAG 2.2 AA — pomiar statyczny

Metoda: względna luminancja sRGB według WCAG; współczynnik (Ljaśniejszy+0,05)/(Lciemniejszy+0,05). Próg dla zwykłego tekstu **4,5:1**, dla dużego **3:1**, dla istotnych elementów nietekstowych zasadniczo **3:1**. Tekst 17 px nawet pogrubiony nie kwalifikuje się automatycznie jako „duży”. Tekst na teksturze włókien i kolorach półprzezroczystych może wymagać osobnego pomiaru pikseli.

| Tekst / tło | Stosunek | AA tekst zwykły | Użycie / uwaga |
|---|---:|---|---|
| --ink #2b2620 / --parchment #e4dccb | 10,99:1 | OK | Podstawowy tekst pergaminu |
| --ink-soft #4d453a / --parchment | 6,91:1 | OK | Podpisy na pergaminie |
| --ink-soft / --parchment-dim #cfc5b0 | 5,51:1 | OK | Tekst pomocniczy |
| --parchment / --oak #3b3127 | 9,31:1 | OK | Narzędzia |
| --mist #c9c6bb / --oak | 7,42:1 | OK | Podpowiedź na mini rail |
| --clay #8c4a2f / --parchment | 4,91:1 | OK | Status ostrzegawczy; mały zapas |
| --meadow #56603f / --parchment | 4,90:1 | OK | Status ukończenia; mały zapas |
| #7d5d23 / --parchment | **4,45:1** | **FAIL** | main.css:728, ETA w karcie |
| #7d5d23 / #dcd3c0 | **4,08:1** | **FAIL** | main.css:663–674, przychód/rez. przy towarach |
| --ink / --ochre #b8893a | 4,77:1 | OK | Napis na etykiecie ETA |
| #f0e6d2 / --clay | 5,41:1 | OK | Główny przycisk |
| --ochre / --oak | 4,04:1 | UWAGA | Nie stosować jako małego tekstu bez poprawki; jako obrys fokusu podlega ocenie nietekstowej |
| --clay / --parchment-dim | 3,91:1 | UWAGA | Para tokenów potencjalnie zła dla zwykłego tekstu; nie stwierdzono takiej konkretnej aktywnej deklaracji tekstowej |
| --meadow / --parchment-dim | 3,91:1 | UWAGA | Analogiczna kombinacja warunkowa |

**Propozycja:** przyciemnić #7d5d23 do odcienia osiągającego ≥4,5:1 na jaśniejszym **i** docelowym tle czipa (#dcd3c0); wskazana rezerwa ≥5:1 dla faktury i antyaliasingu. Osobno testować tło po nałożeniu tekstury i warstwy transparentnej.

## Rozmiary tekstów i cele dotyku

**Potwierdzone zgodne z progiem projektu:** .btn 48×48 px lub większy (main.css:137–138); przycisk pierwotny 56 px (153–155); przyciski szybkości 48×48 (327); narzędzie min. 52×60 (338–346); znacznik 48×52 jako **zewnętrzny hitbox**, choć grafika ma 38×46 (427–445); zamknięcie sheet 48×48 (606); przyciski menu minimum 56 px (210–218); input .vol **wysokość obszaru 48 px** mimo kciuka 22×32 (742–772). 40-pikselowe .good-chip i .toast są prezentacją danych, a nie przyciskami, więc nie traktować ich jako naruszenia wymiaru celu dotykowego.

**Odstępstwa:** .kv .linkish ma min-height:40px (main.css:729, panels.ts:149/166); interaktywne wiersze .wb-line mają min-height:30px i są klikane przez delegację na .waybill (main.css:264, hud.ts:84–89,227–229); nie mogą być obsłużone z klawiatury. W trybie wąskim .tool .tl ma **12 px** (main.css:929), mimo projektowego „13 (min)” w docs/UI_STYLE.md; liczne drobne etykiety 13 px (np. main.css:229,263,674,739). Zalecana weryfikacja czytelności na najmniejszych ekranach, przy dużej czcionce systemowej i skalowaniu 200%.

## Rejestr problemów

| ID | Waga | Plik:linia | Problem i konkretna propozycja |
|---|---|---|---|
| A01 | **Krytyczna** | index.html:5; src/main.ts:55–57; main.css:64 | Viewport blokuje zoom (user-scalable=no, maximum-scale=1), dodatkowo blokady gesturestart/dblclick i touch-action:none. Umożliwić powiększanie użytkownika; kontrolę kamery ograniczyć do canvas, bez blokowania zoomu całej aplikacji. Sprawdzić reflow/tekst przy 200%. WCAG 1.4.4. |
| A02 | **Krytyczna** | index.html:20; src/ui/input.ts:30–35,57–110; src/ui/app.ts:126–136,480–495 | Gra na canvas ma wyłącznie ogólną etykietę „Dolina”; wybór obiektów, budowa dróg, przesuwanie/obrót/zoom mapy to gesty bez kompletnego odpowiednika na klawiaturze i czytniku. Zaprojektować dostępny, nawigowalny wykaz obiektów/celów i akcje alternatywne do gestów, opisy stanu/sąsiedztwa, sterowanie klawiszami i fokusem. WCAG 2.1.1, 1.1.1, 4.1.2. |
| A03 | **Wysoka** | src/ui/markers.ts:35–56,71–79,108–119; src/ui/icons.ts:1697–1708 | Pooled button.bubble nie ma aria-label ani nazwy tekstowej, a ikona tworzona bez title ma aria-hidden=true. Czytnik spotyka przyciski bez nazwy. Aktualizować nazwę: obiekt, numer, przyczyna, istotność; po recyklingu nadpisać atrybuty i ukryć niedostępne egzemplarze z tab order. WCAG 4.1.2. |
| A04 | **Wysoka** | src/ui/sheets.ts:53–81,123–139,84–97 | Sheet ma role=dialog, ale brak aria-labelledby/aria-label i aria-modal; brak przekierowania fokusu do dialogu, ograniczenia Tab i powrotu do wyzwalacza. Dodać identyfikator tytułu, aria-modal, obsługę fokusu i inert dla tła; przy closeTop() przywrócić fokus. WCAG 2.4.3 i 4.1.2. |
| A05 | **Wysoka** | src/ui/menu.ts:151–180 | List końcowy ma role=dialog i aria-modal=true, ale brak skojarzenia z h2, otwarcia z fokusem, pułapki i powrotu fokusu. Wdrożyć jak A04; nie wystarczy samo aria-modal. |
| A06 | **Wysoka** | src/ui/hud.ts:84–89,227–233; main.css:264 | Klikany wiersz listu przewozowego to div (data-wb=castle), cel 30 px; nie jest fokusowalny ani aktywowany Enter/Space. Zmienić semantycznie na button 48 px lub wydzielić prawdziwy button 48 px. WCAG 2.1.1; spec ≥48 dp. |
| A07 | **Wysoka** | src/render/terrain.ts:474–488; src/render/overlay.ts:1–3,44–54 | Nakładka obciążenia i wynik trasowania rozróżnia stan przez odcień i natężenie bez faktury/obrysu/legendy. Użyć dodatkowo wzoru, rodzaju linii i oznaczenia tekstowego; osobno stan OK, błąd, przeciążenie. Przetestować na 3 symulacjach przy deszczu/nocy. WCAG 1.4.1. |
| A08 | **Wysoka** | src/ui/markers.ts:68–73,108–119; main.css:458–463 | Krytyczny vs zwykły przestój odróżnia się glinianą barwą dymka przy tym samym bazowym kształcie; powód ma ikonę, ale sama istotność bywa tylko kolorem. Dodać obrys, kształt lub znak ostrzeżenia i słowo „Krytyczne” w nazwie a11y. WCAG 1.4.1. |
| A09 | **Wysoka** | main.css:663–674,725–729 | Dwa użycia #7d5d23 nie spełniają 4,5:1: ETA 4,45:1 na pergaminie i .good-chip .inc 4,08:1 na #dcd3c0. Zmienić token tekstowy, zweryfikować na tle rzeczywistym. WCAG 1.4.3. |
| A10 | **Średnia** | main.css:729; src/ui/panels.ts:149,166 | Interaktywne .linkish ma min-height 40 px, poniżej progu 48 dp z UI_STYLE. Powiększyć obszar aktywny (min-height 48 px, padding, odstęp). |
| A11 | **Średnia** | src/ui/menu.ts:75–90 | Grupy segmentów role=group nie mają etykiety dostępności, nagłówek jest osobnym span.s-label. Dodać aria-labelledby (ID etykiety) albo fieldset/legend; rozważyć radiogroup dla wyboru pojedynczego. |
| A12 | **Średnia** | src/ui/panels.ts:80–83; main.css:679–680 | Pasek produkcji to div.progress o szerokości procentowej i atrybucie title; czytnik nie otrzymuje role=progressbar, aria-valuemin/max/now ani nazwy. Dodać semantykę i czytelny tekst procentu. WCAG 1.3.1/4.1.2. |
| A13 | **Średnia** | main.css:1023–1025; src/ui/flatView.ts:140–152; src/render/terrain.ts:484–487; src/render/view.ts:270–283,306 | prefers-reduced-motion ogranicza animacje CSS do 1 ms, ale nie zatrzymuje obrotu kamery menu, pulsowania podglądu w shaderze ani animacji rendererów. Odczytać matchMedia i przekazać reducedMotion do kamer, shaderów i efektów, z domyślnie nieruchomą kamerą. |
| A14 | **Średnia** | src/ui/app.ts:480–495 | Globalne skróty (Space, 1/2/4, R/C/X/H) nie sprawdzają, czy fokus jest na button/input/range lub czy okno jest otwarte; mogą wywołać akcję podczas obsługi formularza. Ignorować zdarzenia z elementów interaktywnych (poza świadomie przypisanymi) i modalnych kontekstów, obsłużyć preventDefault tylko gdy skrót zadziałał. |
| A15 | **Średnia** | src/ui/hud.ts:190–196,112–124; main.css:157–161 | Niedostępny zakup wozu otrzymuje wyłącznie klasę .is-disabled (opacity 0,4); nadal jest aktywnym buttonem bez disabled/aria-disabled. Zsynchronizować stan programowy (wraz z komunikatem powodu) i uniemożliwić niepoprawną akcję. |
| A16 | **Średnia** | main.css:929; docs/UI_STYLE.md (Typography) | Tekst narzędzi w trybie narrow ma 12 px, mimo projektowego 13 px minimum; wiele etykiet 13 px obok małych ikon. Utrzymać ≥13 px z preferencją 14–16 px oraz sprawdzić zawijanie/tap targets przy zwiększonym tekście. To naruszenie zasad projektu, nie samodzielne stwierdzenie naruszenia WCAG. |
| A17 | **Niska / test** | src/ui/hud.ts:236–262,265–279 | aria-live=polite dla toastów i role=status dla notice to dobry początek, lecz automatyczne usuwanie po 2600/5200 ms może obciąć dłuższy odczyt. Test TalkBack/VoiceOver; rozważyć możliwość ponownego odczytu i dłuższe komunikaty. Nie traktować jako potwierdzonej niezgodności bez testu. |
| A18 | **Niska / test** | docs/shots/ui-settings-412x915.png; src/ui/menu.ts:68–90 | Przejrzany obraz nazwany „ui-settings” pokazuje główne menu zamiast otwartej karty ustawień. Sprawdzić scenariusz generowania zrzutów: wizualny audyt ustawień i kontrastu suwaków nie jest na tej podstawie kompletny. |

## Mocne strony obecnej implementacji

- Tło pergaminowe, tekst podstawowy i narzędzia mają duży kontrast.
- Główne przyciski, przycisk zamknięcia, hitboxy znaczników i całe suwaki spełniają 48 px zgodnie z deklarowaną geometrią CSS (do potwierdzenia na urządzeniu).
- Szybkość i aktywne narzędzia aktualizują aria-pressed (src/ui/hud.ts:161–166,183–187).
- Menu opiera się na natywnych button, listach ul/li, suwakach input[type=range] z label (menu.ts:20–50,84–87).
- Kontrakt ma region z nazwą, a toasty mają aria-live=polite (hud.ts:75,131); część dynamicznych informacji korzysta z role=status.
- Pięć ikon towarów różni się geometrią, a ikony stanów przestoju różnią się przyczyną.
- Reguła CSS prefers-reduced-motion istnieje (main.css:1023–1025); należy rozszerzyć ją o animacje renderera.
- Zmiana języka poprawnie ustawia document.documentElement.lang (src/i18n/index.ts:18–23).

## Plan napraw (poza zakresem tego zlecenia; src/ pozostaje niezmienione)

**P0 — przed premierą:** A01, A02, A03, A04, A05, A06 (możliwość interakcji i czytnik ekranu).  
**P1 — przed akceptacją AA:** A07, A08, A09, A12, A13, A14 (kolor, kontrast, status, motion, klawiatura).  
**P2 — dopracowanie:** A10, A11, A15, A16 oraz walidacje A17–A18.

**Testy odbiorowe:** przejście całego menu/gry/sheetów z klawiatury (Tab/Shift+Tab/Enter/Space/Escape), TalkBack na Androidzie, VoiceOver na iOS, trzy symulacje CVD na zrzutach w dniu i nocy z aktywnym ruchem i walidacją drogi, zoom i 200% text scale, 320 CSS px i Flip cover oraz Fold po zmianie orientacji, zbadanie kontrastu zrzutów piksel-po-pikselu na półprzezroczystych i teksturowanych tłach, weryfikacja klikanych prostokątów przez getBoundingClientRect(), ponowny test axe-core na DOM. Wymagane są testy manualne dostępnego odpowiednika mapy; sam skan axe nie wystarczy.

## Załączniki

- [VIEWER.html](VIEWER.html) — oryginał i trzy symulacje dla każdego z 61 zrzutów (otwierać po pobraniu repozytorium, z folderem docs/shots).
- [standalone/](standalone/) — **9 samodzielnych SVG z osadzonym PNG**: trzy symulacje dla UI/HUD, błędnej drogi i Flip cover; obrazy nie wymagają sąsiednich zrzutów źródłowych.
- [simulations/](simulations/) — 183 pliki SVG (3×61), każdy wskazuje odpowiedni PNG z docs/shots; obrazy nie są samodzielnymi rasterami.
- [README.md](README.md) — metoda, obsługa i ograniczenia wizualizacji.
