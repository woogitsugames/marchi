# 65 — Hindi: brakujące tłumaczenia z paczki 64 — gałąź `gpt/65-i18n-hi`

W `gpt/64-i18n-09` przetłumaczono ~178 kluczy z `PENDING_KEYS` na 13 języków, ale **pominięto hindi** (`src/i18n/hi.ts`).
Przetłumacz na hindi wszystkie klucze, które są w `PENDING_KEYS` (`src/i18n/pl.ts`) i nie ma ich w `hi.ts`
(kronika `chron.*`, zdarzenia `events.*`, `fix.*`, `wagon.BRIDGE_JAM.*`, `contract.half/twoMin/lastMin`,
`build.costRoad`, `diag.*`, `hud.rainSoon` i in.). Placeholdery i `{n, plural, …}` jak w `en.ts`. Zrób `git fetch` —
tłumacz aktualną wersję. Po dodaniu: klucze obecne we wszystkich 15 językach usuń z `PENDING_KEYS`
(narzędzie `npx tsx tools/i18n-reorder.ts` pokazuje, które są „translated everywhere”; z `--write` porządkuje
kolejność kluczy — uruchom je dopiero po usunięciu kluczy z `PENDING_KEYS`, inaczej pominie tłumaczenia).
Testy `tests/i18n-*.test.ts` zielone. **Zlecenie bez plików jest nieoddane.**
