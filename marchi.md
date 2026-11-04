# Prompt startowy — nowa sesja Claude Code dla MARCHIA (repo woogitsugames/marchi)

Przejmujesz autonomiczny rozwój gry MARCHIA — Szlaki Królestwa. Repo `woogitsugames/marchi`; baza integracyjna
`claude/eager-cori-08wt8e`, `main` przesuwany fast-forward na bazę po każdym zielonym scaleniu. Rozmawiaj ze mną
po polsku; kod, komentarze i commity po angielsku.

**Najpierw, od razu:** `git fetch origin`, `git checkout claude/eager-cori-08wt8e`, `git pull`, a potem przeczytaj
**aktualny `docs/HANDOVER.md` z GitHuba** (górna sekcja „PRZEJĘCIE” = stan, zasady, niedokończone, prompt cyklu,
kolejka; niżej historia), następnie `CLAUDE.md`, `docs/BACKLOG.md` i `docs/DECISIONS.md`.

Na start:
1. Utwórz własny godzinny cykl (create_trigger, cron „42 * * * *”) z promptem z sekcji „Prompt cyklu” w HANDOVER.
2. `npm install`, `npm run setup:android` (SDK 36), `npm run typecheck`, `npm test`, `npm run build`; uruchom
   `vite preview --port 5193` jako proces w tle, odtwórz skrypt smoke (opis w HANDOVER) i zrób smoke + `npm run layout -- --quick`.
3. Zrób punkty z sekcji „Niedokończone” w HANDOVER (deweloper a11y `claude/w-day8d`, zrzuty render #4 do mojej decyzji,
   decyzje M7/M3, PR-y innych sesji `claude/x-trade-post` i `claude/x-m8-redesign`), scal, przesuń `main`, zbuduj i wyślij mi APK.
4. Dalej pracuj autonomicznie i w sposób ciągły z **maks. 2 agentami Opus naraz** (deweloper + researcher; ty też kodujesz),
   każ im commitować często. CI ma limit minut — nie zmieniaj workflowów, sprawdzaj lokalnie. APK w dzień co ~3 h,
   w nocy nic, jedno rano. Decyzje dawaj mi klikalnie z rekomendacją; w nocy zapisuj je w HANDOVER „Decyzje na rano”.
   **Aktualizuj HANDOVER na bieżąco i pushuj go na GitHuba.** Gdy masz pracę dla innej sesji Claude Code (inne konto),
   daj mi gotowy prompt startowy. Nie zamykaj PR-ów bez mojej prośby.
