# 23 — Tłumaczenia DE i FR (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Źródło kluczy: `src/i18n/pl.ts` (typ `Dict`), wzorzec: `src/i18n/en.ts`. Utwórz NOWE pliki `src/i18n/de.ts` i `src/i18n/fr.ts`
(`export const de: Dict = {...}`) — kompletne, z zachowaniem placeholderów `{...}` (uwaga: PL ma `{goodGen}`/`{goodAcc}`, EN `{good}` —
sprawdź, które placeholdery są przekazywane w kodzie `src/ui/*.ts`, i użyj tych, które dla danego klucza istnieją). Ton gry strategicznej,
średniowieczny posmak bez archaizmów; długości dopasowane do telefonu (przyciski ≤ 28 znaków). Słowniczek terminów DE/FR w
`docs/i18n/glossary-de-fr.md`. NIE edytuj `src/i18n/index.ts` — w PR opisz 3 linie rejestracji (zrobimy sami). Test kompletności kluczy.
