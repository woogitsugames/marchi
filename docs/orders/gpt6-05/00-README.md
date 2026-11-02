# Zlecenie GPT-6 — paczka 05: uzupełnienie tłumaczeń (MARCHIA — Szlaki Królestwa)

**Repo `woogitsugames/marchi`, gałąź bazowa `claude/eager-cori-08wt8e`** (nie `main`, nie `woogitsu/osadale`).
Jedna gałąź `gpt/i18n-pending-05`, **jeden PR** do bazy (nie pushuj bezpośrednio na bazę).

Od paczki 04 doszły nowe teksty (samouczek, przycisk naprawy, list końcowy, misje IV–VI, tryb swobodny jako
city builder: tablica miasteczka, targ, rangi, narzędzie Buduj). Lista: `keys.md` w tej paczce
(klucz, angielski = źródło znaczenia, polski = kontekst). To klucze z `PENDING_KEYS` w `src/i18n/pl.ts`.

Zadanie: dopisz te klucze do **wszystkich 15** plików `src/i18n/{de,fr,es,it,pt_BR,nl,sv,tr,ru,uk,ja,ko,zh_Hans,ar,hi}.ts`
(w tej samej kolejności co w pl.ts), z zasadami z `docs/orders/gpt6-04/00-README.md`: placeholdery `{...}` bez zmian,
bloki liczby mnogiej `{n, plural, …}` gdzie liczba, limity długości (przyciski ≤ 14 znaków, CJK ≤ 7), słowniczki
`docs/i18n/glossary-<kod>.md` (dopisz nowe terminy: ranga, renoma, targ, nasycenie, transza, kra/lód na moście, Buduj,
Cofnij). Nazwy rang: Osada / Wieś targowa / Miasteczko / Miasto — oddaj realia średniowieczne danego języka.
NIE edytuj `pl.ts`, `en.ts`, `index.ts` ani `PENDING_KEYS` (usuniemy po scaleniu). `npm test` i `npm run typecheck` zielone.
W opisie PR: klucze, których długość przekracza limity, i trudne miejsca.
