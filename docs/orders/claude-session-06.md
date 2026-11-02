Repozytorium: woogitsugames/marchi, gałąź bazowa: claude/eager-cori-08wt8e (zrób `git fetch` — baza poszła do przodu:
sloty zapisu na misję D-36, Twój RTL D-37 scalony (szyna zależy teraz tylko od ręki), prognoza tempa D-38, misje X–XII
w menu D-39). Pracuj na gałęzi **claude/s6-polish**; małe commity; na końcu JEDEN PR do bazy (bez scalania i zamykania).
Komunikacja po polsku, kod/komentarze/commity po angielsku. Zasady: CLAUDE.md (najpierw!), docs/UI_STYLE.md,
docs/DECISIONS.md (D-36…D-39), docs/BACKLOG.md. Nowe decyzje numeruj od **D-40**.

NIE edytuj (pracują nad tym inni): `src/render/**` (modele, drzewa, teren), `src/ui/hud.ts` i wygląd HUD
(szykujemy nowy HUD z grafik — nie zmieniaj jego stylu), `docs/mockups/**`. `src/sim/**` — tylko gdzie zadanie
wprost pozwala; złote hasze misji NIE mogą się zmienić (jeśli coś je zmienia — zatrzymaj się i opisz w PR).
Nowe teksty dla gracza tylko przez i18n: `src/i18n/pl.ts` + `en.ts` i dopisz klucze do `PENDING_KEYS`.

ZADANIA (kolejność = priorytet; rób po kolei, każde osobnym commitem, odhacz w docs/BACKLOG.md → „Zrobione”):

1. Listy kasztelana w grze (P3). Teksty listów otwierających i końcowych misji VII–XII są w `src/content/letters.ts`
   (oraz I–VI, sprawdź), ale gra ich nie pokazuje — ekran końcowy ma ogólny tekst. Podepnij: list otwierający przy
   starcie kontraktu (do zamknięcia jednym gestem, nie przy `?play=` debug) i list końcowy wg liczby pieczęci /
   przegranej na ekranie końcowym (`src/ui/menu.ts` / app.ts showEnd). Styl jak istniejące arkusze. Zrzuty.
2. „Drewno w drodze” maskuje niedobór w misji X (P2, D-39, BACKLOG). Gdy tartak czeka na wóz, który sam stoi przy
   drwalu z powodu braku drewna, karta powinna mówić o niedoborze u źródła (np. „wóz czeka u drwala — brak drewna”).
   Najpierw sprawdź, czy da się to zrobić w warstwie odczytu (diagnose/UI) BEZ zmiany hashy; zmierz udział czasu,
   w którym lekcja jest widoczna (narzędzie jak `tools/pace-readability.ts`), przed/po.
3. Wczesne wykrycie „brak drogi do zwycięstwa” (P2, BACKLOG): brak ścieżki do zamku, srebro < koszt najtańszej
   przeprawy i brak wozów do sprzedania → list z przyczyną zamiast czekania do końca czasu. Czysta funkcja + test.
4. Dostępność arkuszy (P2, BACKLOG): przycisk zamknięcia ma `aria-label` „Wznów” → klucz `sheet.close`;
   `role="dialog"` z `aria-modal` i `aria-labelledby`, przeniesienie fokusu i powrót; bąbelki przestojów
   (`button.bubble`, markers.ts) z dostępną nazwą (przyczyna). `aria-label` canvasa i `<title>`/`lang` w index.html
   z i18n przed pierwszym renderem; viewport bez blokady zoomu, jeśli nie psuje gestów (sprawdź na 412×915).
5. Twarde literały i cena wozu (P3): „−30” w karcie stajni → `WAGON_PRICE`; tooltip `hud.coins` z pustym `{n}`
   (tylko ten tooltip — bez zmian wyglądu HUD).
6. Formatowanie liczb/czasu przez Intl (P1 i18n, BACKLOG): `src/ui/fmt.ts` (`fmtInt`, `fmtDuration`, `fmtDayTime`,
   cache per język czyszczony w `onLangChange`), zastąp ręczne `String(n)`, `padStart`, `${m}:00` w końcowym liście,
   `'×'+n` — poza `hud.ts` jeśli to wymaga zmiany wyglądu (wtedy tylko w tekście). Test: ar/hi/de/en formatują poprawnie.
7. Zapis (P4, BACKLOG): w `src/platform/save.ts` cache połączenia IDB, bez ręcznego `JSON.parse(JSON.stringify())`
   przed `put` (structured clone), `listSaves` po metadanych bez ściągania całego stanu. Testy zapisu zielone,
   migracje D-36 nietknięte.
8. Kod deweloperski w buildzie (P4): `app.ts` importuje `../../tools/bot` i wystawia `window.__marchia` z całym App —
   rozdziel (np. `src/game/menuScene.ts`), uchwyt tylko przy `?debug=1` **ale** zachowaj `__marchia.ready`, bo używają
   go skrypty zrzutów i smoke testy (sprawdź tools/*.mjs, tools/*.cjs).
9. Android (P3): manifest — usuń `INTERNET`, jeśli gra nic nie pobiera (sprawdź, że `npx cap sync` go nie dodaje
   z powrotem; jeśli dodaje — opisz), `allowBackup` → `dataExtractionRules`/`fullBackupContent` z wykluczeniem
   lub opis w `docs/store/data-safety.md`.
10. Dokumentacja vs kod (P4): DESIGN.md / docs/missions/m2.md — liczby niezgodne z `defs.ts`/`missions*.ts`;
    zsynchronizuj albo oznacz jako nieaktualne.

Na każdym kroku: `npm run typecheck`, `npm test` (SUMMARY failed=0), `npm run build`. Przy zmianach UI zrzuty Playwright
(Chromium jest preinstalowany — nie instaluj; vite preview na wolnym porcie, zabijaj serwer po PID, nie `pkill -f`)
412×915 i 915×412, także `&lang=ar` dla nowych arkuszy; 0 błędów konsoli; obejrzyj i popraw wg zakazów z CLAUDE.md.
Jeśli zabraknie czasu — wypchnij to, co zrobione, i w PR wypisz, czego nie zrobiłeś.
Raport po polsku: link do PR-a, tabela zadań (zrobione / częściowo / pominięte + dlaczego), liczby z pomiarów,
3–5 zrzutów do obejrzenia.
