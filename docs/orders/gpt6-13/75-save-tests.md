# 75 — Testy migracji zapisu v9 — gałąź `gpt/75-save-tests`

W `tests/` dodaj testy: zapis v9 z posterunkiem (D-170) → zapis → wczytanie → 5 min gry → ten sam hasz co bez przerwy; zapis z `WAGON_DUE` w trakcie; losowe zapisy z fuzz (`tools/fuzz-lib.ts`). Bez zmian w `src/`.
