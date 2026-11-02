# Handover — MARCHIA (stan 2026-11-02, ~15:20 Europe/Brussels)

Nowa sesja przejmuje autonomiczny rozwój gry od poprzedniej (kończy się jej limit). Rozmawiaj z właścicielem
**po polsku**; kod/komentarze/commity po angielsku. Zasady: `CLAUDE.md` (najpierw!). Decyzje: `docs/DECISIONS.md` (D-01…D-35).

## Repo i gałęzie
- Repo `woogitsugames/marchi`, gałąź robocza i bazowa: **`claude/eager-cori-08wt8e`** (nigdy `main`; PR tylko na prośbę).
- Ostatni commit: `214966d` (wszystko wypchnięte, drzewo czyste). Stan symulacji **v6**, 10 towarów, rangi 0–5,
  misje I–IX w menu, Wolna dolina (sandbox, 3 sloty „Księgi osad”) z porami roku.
- Commity kończ: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + `Claude-Session: <link Twojej sesji>`.
  Bez identyfikatorów modelu w commitach/PR. Komentarze GitHub tylko na prośbę, ze stopką atrybucji.
- **Nie zamykaj PR-ów na GitHubie bez prośby właściciela.** Integracja = scalenie lokalne do bazy + push.

## Rytm pracy (ustalony przez właściciela)
- Praca autonomiczna, ciągła. Poprzedni godzinny cykl (stare konto) jest **wyłączony**, przypomnienie o APK usunięte.
  Utwórz własny godzinny trigger dla swojej sesji (create_trigger) — prompt cyklu: sekcja „Prompt cyklu” na końcu pliku.
- Maks. **3 agentów Opus** naraz + osobno researcher Sonnet (wąskie tematy, raport do `docs/research/`).
  Agentów uruchamiaj w ręcznych worktree: `git worktree add -B <gałąź> /workspace/marchi-<x> HEAD` +
  `ln -s /workspace/marchi/node_modules …` (izolacja `worktree` w Agent nie działa — /workspace nie jest repo).
  Agenci pushują swoje gałęzie, Ty scalasz do bazy (konflikty zwykle w `src/i18n/pl.ts`/`en.ts` PENDING_KEYS — zachowaj obie strony).
- Decyzje właściciela — **klikalnie** (AskUserQuestion) z rekomendacją; nie blokuj się.
- **APK**: w dzień (7–23 Brussels) gdy wersja istotnie lepsza, nie częściej niż co ~3 h; w nocy nic, jedno rano.
  Przed wysłaniem: `npm run typecheck`, `npm test` (SUMMARY failed=0), `npm run build`, smoke test w przeglądarce
  (skrypt `/tmp/claude-0/smoke2.cjs` jeśli przetrwał; inaczej: vite preview na porcie 5193, `?play=mN&quality=low&dynres=0&speed=4`
  dla m1–m9 + sandbox, 0 błędów konsoli). Budowa: `npm run setup:android` (raz w nowym kontenerze), `npm run apk -- --skip-web`
  → `dist-apk/marchia-debug-<sha>.apk` (~48 MB), wyślij SendUserFile. Ostatnie APK: **d58ef72** (11:28 Brussels).
  **Następne APK do wysłania ~14:30 Brussels** — zmiany od d58ef72: rozbiórka z potwierdzeniem w misjach, narzędzie
  budowy zostaje otwarte, skrócone podtytuły VII/VIII, czytelność pór roku (D-34), odstęp wozów w obrazie (D-35),
  UI/render nowych łańcuchów (PR #49: CONTESTED „idzie do”, koszt kamienia, nakładki skał/wody, dym, wariant zamku).
  Poproś właściciela o ocenę kreskowania terenu na telefonie.
- Uwaga: `pkill -f` z wzorcem pasującym do własnej komendy zabija powłokę — zabijaj po PID.

## Współpracownicy
- **GPT-6** (właściciel przekazuje zip-y, GPT pushuje gałęzie `gpt/*` i PR-y). Paczka **07** zlecona (zlecenia 48–54:
  i18n 06, misje X–XII, pliki 13 dźwięków CC0, Kronika doliny, balans sandboxa z porami roku, testy odporności,
  Księga towarów) — `docs/orders/gpt6-07/`. Z paczki 06 nieoddane: 44 (zdarzenia w dolinie), 47 (playtest v2).
  Przegląd: tylko dozwolone ścieżki, bez workflowów pushujących, bez `mission.id === …` w sim, bez wpisów w sounds.ts
  bez plików; wzór raportu: `docs/reviews/gpt-integration-2.md`. Po scaleniu tłumaczeń usuń przetłumaczone klucze z `PENDING_KEYS`.
- **Druga sesja Claude Code** (właściciel przekazuje prompty z `docs/orders/claude-session-NN.md`). Zlecenie **05**
  (układ RTL dla arabskiego, gałąź `claude/s5-rtl`) — przekazane przez właściciela teraz. PR-y #48/#49 tej sesji już scalone.

## Otwarte (kolejność wg backlogu: błędy > Fold/wydajność > czytelność < 30 s > grafika > treść)
- `docs/BACKLOG.md` — po audycie 53 pozycji przeniesiono do „Zrobione”. Otwarte m.in.: P0 do weryfikacji — błąd
  shadera wody (sprawdzić przy quality=high/ultra); restart/nadpisanie kontraktu bez potwierdzenia;  budżet przeplanowań; `{n, plural}` w pl/en; koszt drogi dojazdowej w etykiecie budowy.
- `docs/research/2026-11-02-seasons-m7-9.md`: F3 (m9 — CONTESTED widoczny tylko 34 s) i F10 (m7 — brak sygnału
  niedoboru przepustowości; propozycja: tempo dostaw + prognoza „przy tym tempie spóźnisz się” na liście przewozowym
  i karcie zamku, bez nowego StallReason) — do zrobienia; druga połowa F5 (piekarnia „dostawca produkuje”, gdy młyn
  czeka) wymaga zmiany statusów w sim → zmienia hashe misji, decyzja.
- D-34: podwójne liczenie zamkniętego mostu w liście końcowym misji kontraktowych — poprawka zmieni złote hashe
  (m2, m4, m8); ewentualnie zapytać właściciela.
- 24+ nowych kluczy i18n w `PENDING_KEYS` (czekają na GPT 48).
- Hosting pakietu 4K odłożony (D-21: „na razie nigdzie”). Gra darmowa, bez reklam (D-29).

## Decyzje właściciela z dziś
3 sloty doliny; bez reklam na razie; rangi Gród/Stolica; pory roku łagodnie (tylko dolina); nazwa „Marchia” wszędzie;
odstęp wozów zostaje tylko w obrazie (D-35); druga sesja → RTL arabski.

## Prompt cyklu (do create_trigger, co godzinę)
Godzinny cykl autonomicznego rozwoju MARCHIA (właściciel zlecił ciągłą pracę; ten cykl wznawia sesję także po limicie/restarcie). Limit: najwyżej 3 agentów Opus naraz (researcher Sonnet osobno). Kontynuuj:
1. Zbierz wyniki agentów (przerwanych — wznów; zakończonych: przejrzyj zrzuty, zintegruj, `npm test`, `npm run typecheck`, `npm run build`, commit + push na claude/eager-cori-08wt8e).
2. PR-y GPT i drugiej sesji Claude (claude/s*-*, gpt/*): przejrzyj, scal lokalnie, testy, popraw drobiazgi, odrzuć szkodliwe elementy, wypchnij; raport: przyjęto / poprawiono / odrzucono. Nie zamykaj PR-ów bez prośby właściciela.
3. docs/BACKLOG.md: 1–3 najważniejsze pozycje (błędy > wydajność/Fold > czytelność przyczyn < 30 s > grafika > treść); kolejność wg D-17, D-21, D-29. Realizuj sam albo przez agentów, aktualizuj backlog.
4. Jeśli researcher Sonnet nie pracuje, uruchom go z nowym, wąskim tematem.
5. APK: w dzień (7:00–23:00 Europe/Brussels) gdy jest istotnie lepsza wersja, nie częściej niż co ~3 h (typecheck, testy, smoke test bez błędów konsoli). W nocy nie — jedno APK rano.
6. Krótki raport po polsku. Decyzje właściciela — klikalnie (AskUserQuestion) z rekomendacją. Zasady z CLAUDE.md.

## Stan 2026-11-02 ~15:20 (sesja session_01QWRid6hScCk3PSEu7RfFHs)
- Godzinny cykl: trigger `trig_01SUuiU1pXy1yo2Wj2sfPrJx` (:42 UTC) przypięty do tej sesji.
- Scalone dziś: paczka GPT 07 (48–54, raport `docs/reviews/gpt-integration-3.md`) i 57 (tłumaczenia); sloty zapisu
  na misję (D-36); RTL arabski (D-37, szyna zależy tylko od ręki); prognoza tempa i „drewno bierze też” (D-38);
  misje X–XII w menu (D-39); poprawka dyspozytora (hasze bez zmian); łąka bez powtórzeń kafla.
- Ostatnie APK: **9618287** (14:05 Brussels). Następne najwcześniej ~17:00.
- W toku (agenci w worktree): `claude/w-models` (koń/wóz/ludzie + krok konia od dystansu — właściciel: „koń biegnie
  szybciej niż nogi”), `claude/w-trees` (drzewa wg `docs/research/2026-11-02-trees.md`).
- HUD: właściciel odrzucił CSS-owe wersje jako „AI slop”; układ **D** (góra z A, dół z B, klasycznie —
  `claude/hud-mockups`, `docs/mockups/hud/v2/D-*.jpg`) akceptowany co do układu. Grafiki: zlecenie GPT **55**
  (paczka 08, `docs/orders/gpt6-08/`) — ręcznie malowany kit UI; wdrożenie dopiero po akceptacji właściciela.
- GPT paczka 08 wysłana: 55 kit UI, 56 dźwięki (powtórka 50), 57 tłumaczenia (oddane, scalone).

## Stan 2026-11-02 ~19:00
- Baza `d1c1d84`: + nowy HUD v3 (D-43, kit GPT 55/55b), kamera nad arkuszem i wozy przy stajni (D-45), sim D-44
  (most raz, F5, numery floty — STATE_VERSION 7), dźwięki 56 + miks, drzewa (D-41), koń (D-40), sesja 06 (D-46…D-52).
- Ostatnie APK: **2bae80f** (17:2x Brussels) — jeszcze bez nowego HUD. Następne: po szlifie HUD (`claude/hud-polish`)
  i akceptacji właściciela; w nocy nic, rano jedno.
- Właściciel: HUD — „najpierw poprawki” (szczegółów nie podał; robimy: mniejszy panel w poziomie, jaśniejsze paski,
  ikona oka, styl przycisków w arkuszach/listach). Kolejne decyzje numeruj od **D-53**.
- Do tłumaczenia (PENDING_KEYS): menu X–XII, tempo D-38, HUD v3, F5, listy/dead-end sesji 06 → paczka GPT 09.

## Stan 2026-11-02 ~21:00 (limit użycia prawie wyczerpany)
- Baza `0007f5a`. Ostatnie APK: **8b59953** (20:30) — nowy HUD po szlifie, shadery pre-warm. W nocy bez APK, rano jedno.
- W toku (WIP pushowany na bieżąco): `claude/w-events` — integracja zdarzeń doliny (zgoda właściciela, D-54,
  STATE_VERSION 8, karta w HUD); `claude/w-hudp3` — cache rankStalls + boczny arkusz w poziomie (D-55 jeśli reguła).
  Po wznowieniu: sprawdź obie gałęzie, scal (konflikty zwykle BACKLOG/DECISIONS/i18n PENDING_KEYS), testy, smoke I–XII.
- GPT: oddane 44/47/57/58/59/55/56; czeka 60 (korekta PL, paczka 09R) i paczka 10 (61 grafiki sklepu, 62 opisy).
- Następne decyzje od **D-56**.

## Stan 2026-11-02 ~22:50
- Baza po scaleniu zdarzeń doliny (D-54, STATE_VERSION 8) i HUD P3 (D-55). Testy 374/374, smoke I–XII OK.
- GPT: 62 przyjęte; 61 bez grafik (przyjęty tylko skrypt `tools/store-shots-v2.mjs`, workflow z pushem odrzucony) —
  rano wygenerować zrzuty sklepu tym skryptem; 60 (korekta PL) nadal czeka.
- Rano: jedno APK (od 8b59953: zdarzenia doliny, HUD P3, opisy sklepu), zrzuty sklepu, P2 karta wieści zwinięta.
- Następne decyzje od **D-56**.
