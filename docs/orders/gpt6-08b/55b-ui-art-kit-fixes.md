# 55b — Poprawki zestawu UI (ta sama gałąź `gpt/55-ui-art-kit`, ten sam PR #60)

Właściciel ocenił PR #60: **kierunek dobry** (malowany pergamin, mosiądz, wosk — pierwsza wersja, która nie wygląda
jak szablon). Przed wdrożeniem do gry popraw:

1. **Ostrość drobnych elementów.** `badge`, `badge-red`, `seal-empty`, `seal-full`, `seal-alert`, `button-*`, `menu`,
   `pin-*` są w @2x rozmyte / „mydlane” (widać na `docs/ui-kit-sheet.png`). Przerysuj je w docelowej rozdzielczości
   (nie skaluj w górę z mniejszych): ostre krawędzie mosiądzu i wosku, wyraźny grawer. Sprawdź w 100 % powiększenia
   na @3x i @2x.
2. **Tło przełącznika prędkości** `segment-bg` jest prawie czarne i odstaje od reszty — zrób je z ciemnego mosiądzu
   albo ciemniejszego pergaminu (jak `panel-dim`), `segment-active` zostaje.
3. **Żetony `stat`**: w makiecie tekst jest ucięty („09:1”, „84”). Sprawdź marginesy 9-slice tak, by środek był
   rozciągalny i wąskie żetony (60–90 dp) mieściły 5 znaków; ozdobne końce nie mogą zjadać miejsca na tekst.
4. **Nowy element `frame-sheet`** (9-slice, min 280×180 dp): rama dużych arkuszy — listy kasztelana, menu misji,
   „Dlaczego stoi?”, karta wozu, rynek. **Wzór od właściciela: `ref/frame-owner.webp`** (pergamin w mosiężnej ramie
   z liliami w narożnikach) — trzymaj się go wiernie: mosiężna rama z rytym ornamentem, nity w narożnikach,
   lilie wystające poza ramę, pergamin z falistą krawędzią i delikatnymi przetarciami. Wymagania: kanał alfa,
   narożniki nierozciągane (podaj marginesy), rozciągalne boki bez widocznych powtórzeń, @2x i @3x, wariant
   `frame-sheet-dim` (ciemniejszy pergamin do arkuszy na ciemnym tle). Waga obu ≤ 400 KB.
5. Zaktualizuj `docs/ui-kit.md`, `docs/ui-kit-sheet.png`, obie makiety D oraz **nową makietę** arkusza
   „Dlaczego stoi?” w ramie `frame-sheet` (412×915: arkusz od dołu na ~55 % ekranu, tytuł „Młyn”, łańcuch przyczyn
   2 wiersze, przycisk „Kup wóz 30”) → `docs/ui-kit-sheet-why-412x915.png`.
Łącznie cały kit ≤ 1,5 MB. Nie podpinaj do kodu. Commit na tę samą gałąź, w PR #60 krótki komentarz, co zmieniłeś.
