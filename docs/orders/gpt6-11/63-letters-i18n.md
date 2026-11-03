# 63 — Listy kasztelana I–XII w 15 językach — gałąź `gpt/63-letters-i18n`

Listy są teraz w grze (D-46: list otwierający, list końcowy wg pieczęci, przegrana), ale `src/content/letters.ts`
ma tylko `pl` i `en`; pozostałe języki pokazują angielski. Dodaj w `CONTRACT_LETTERS.<misja>` wpisy dla:
de, fr, es, it, pt_BR, nl, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi — `opening`, `won` 1/2/3, `lost` dla m1…m12.
- Ton: list kasztelana z ok. XIV w., krótki, konkretny; podpis („— Wszebor…” itd.) zostaje w formie imienia,
  tytuł przetłumaczony. Nazwy własne miejsc (Łozinny Bród…) bez tłumaczenia, z zachowaniem polskich znaków.
- Limity długości jak w pl/en (komentarz na górze pliku: podpis wlicza się do limitu); liczby i jednostki zgodne
  z danymi misji (nie zmieniaj liczb).
- Typ `ContractLetterSet` / klucze języków zgodne z `Lang` w `src/i18n/index.ts`; test (nowy lub rozszerzony)
  sprawdzający, że każda misja ma komplet wpisów w każdym języku i limity długości.
- Arabski: tekst RTL bez wstawiania znaków sterujących ręcznie (gra izoluje liczby sama).
`npm test`, `npm run typecheck` zielone; w PR próbka: list I po de, ru, ja, ar.
