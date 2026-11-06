# Prompt startowy — nowa sesja Claude Code dla MARCHIA (repo woogitsugames/marchi)

Przejmujesz autonomiczny rozwój gry MARCHIA — Szlaki Królestwa. Repo `woogitsugames/marchi`; baza integracyjna
`claude/eager-cori-08wt8e`, `main` przesuwany fast-forward na bazę po każdym zielonym scaleniu. Rozmawiaj ze mną
po polsku; kod, komentarze i commity po angielsku.

**Najpierw, od razu:** `git fetch origin`, `git checkout claude/eager-cori-08wt8e`, `git pull`, potem przeczytaj
**aktualny `docs/HANDOVER.md` z GitHuba** (górna sekcja „PRZEJĘCIE” = stan, zasady, niedokończone, prompt cyklu,
kierunki; niżej historia), następnie `CLAUDE.md`, `docs/BACKLOG.md`, `docs/DECISIONS-index.md` (i `docs/DECISIONS.md`
od D-150).

Na start:
1. Utwórz własny godzinny cykl (create_trigger, cron „42 * * * *”) z promptem z sekcji „Prompt cyklu” w HANDOVER;
   stary cykl `trig_01PAgKEUo171oE4A99BXL74i` wyłącz.
2. `npm install`, `npm run setup:android` (SDK 36), `npm run typecheck`, `npm test`, `npm run build`; uruchom
   `npx vite preview --port 5193` jako proces w tle, `node tools/smoke.cjs` i `npm run layout -- --quick`.
3. Zrób punkty z „Niedokończone” w HANDOVER: gałęzie `claude/w-onboard` (samouczek budowania + pomoc) i
   `claude/w-postroad` (droga do posterunku) — przejrzyj, dokończ, scal, przesuń `main`, zbuduj i wyślij mi APK;
   sprawdź gałęzie `gpt/*` (paczki 12 i 13) i zintegruj wg `docs/reviews/gpt-integration-13.md`.
4. Dalej pracuj autonomicznie i w sposób ciągły z **maks. 2 agentami Opus naraz** (ty też kodujesz), każ im commitować
   często. CI ma limit minut — nie zmieniaj workflowów, sprawdzaj lokalnie. APK w dzień co ~3 h, w nocy nic, jedno rano.
   Decyzje dawaj mi klikalnie z rekomendacją; w nocy zapisuj je w HANDOVER „Decyzje na rano”. **Aktualizuj HANDOVER na
   bieżąco i pushuj go na GitHuba.** Gdy jest praca dla GPT, przygotuj paczkę zleceń (wzór `docs/orders/gpt6-13/`).
   Nie zamykaj PR-ów bez mojej prośby.
