# 58 — Tłumaczenia, paczka 08 (15 języków) — gałąź `gpt/58-i18n-08`

Klucze z `PENDING_KEYS` w `src/i18n/pl.ts` (28 w chwili wysłania; jeśli jest ich więcej — przetłumacz wszystkie):
menu misji X–XII (`menu.m10…m12Sub`), prognoza tempa (`contract.pace.*`, `why.pace.*`, `why.shared*`), F5
(`status.WAITING_UPSTREAM.supplierWaits`), nowy HUD (`hud.worst`, `hud.worstShow`, `hud.stallsNext`,
`contract.toSnow`, `tool.wagonShort`), listy i „brak drogi do zwycięstwa” (`letter.start`, `why.thin`, `deadEnd.*`).
Języki: de, fr, es, it, pt_BR, nl, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi. **Arabski ma już część kluczy** (HUD v3,
tempo) — sprawdź i uzupełnij brakujące, nie nadpisuj istniejących bez powodu.
Znaczenie: `pl.ts`; placeholdery i `{n, plural, …}` jak w `en.ts`. Tłumacz **aktualną** wersję po `git fetch`.
Teksty HUD są krótkie (żetony, karty narzędzi ~9 znaków): `tool.wagonShort` = „brak {n}” musi zmieścić się na karcie
~64 dp — podaj najkrótszą naturalną formę. Kolejność kluczy jak w `pl.ts` (`npx tsx tools/i18n-reorder.ts --write`).
Usuń przetłumaczone klucze z `PENDING_KEYS`. Testy `tests/i18n-*.test.ts` zielone.
