# HUD v2 — trzy koncepcje od zera

Język UI wzięty z Twoich trzech gier (grube ciemne obrysy wokół jasnych paneli, czipy statystyk z własną ikoną, okrągłe przyciski, jedna duża akcja, wstęga/tytuł, mocne kolory stanu z plakietkami), przełożony na średniowiecze: len, marzanna (czerwień alarmu), urzęt (błękit śniegu/wozów), rezeda (złoto postępu), mech (akcja). Tytuły: Ruslan Display, tekst: Alegreya Sans (oba lokalnie z @fontsource, latin + latin-ext). Ikony gry z `src/ui/icons.ts`. Nic z obecnego HUD-u Marchii nie zostało użyte.

**A · Wstęga** — kontrakt pod czerwoną wstęgą (tytuł, 3 pieczęcie, 4:52 do śniegu, paski desek i chleba). Najgorszy zastój „mówi” dymkiem prosto z pinezki nad młynem i od razu proponuje naprawę (Kup wóz 30); czerwony przycisk z „2” przy menu przeskakuje między zastojami. Narzędzia rozkładają się wachlarzem z dużego zielonego „Buduj”, prędkość w lewym dolnym rogu.

**B · Karty** — herbowy niebieski pasek u góry (srebro, godzina, pauza/×1/×2/×4, menu) i pod nim tabliczka kontraktu z okrągłym zegarem śniegu. Na dole rząd kart narzędzi z plakietką kosztu; karta „Kup wóz” jest podświetlona, bo naprawia najgorszy zastój. Główny przycisk to czerwona pieczęć alarmu z licznikiem „2” i dymkiem „Najgorszy zastój: Młyn: brak wolnego wozu” + „Pokaż”.

**C · Kolumna** — wszystkie narzędzia (i w pionie także prędkość) w jednej kolumnie okrągłych przycisków po lewej, kontrakt jako zawieszka z medalionami postępu (deski, śnieg, chleb). Zastój to toast na dole z przyciskiem „Pokaż”, a jedyna duża akcja to zielone „Kup wóz 30” — bezpośrednia odpowiedź na przyczynę zastoju.

Pliki: `hud-v2.html?c=A|B|C` (źródło), `render-v2.cjs` (Playwright, 412×915 i 915×412, DPR 2), `A/B/C-*.jpg`, `v2-sheet.jpg` (zestawienie, źródło `v2-sheet.html`).
