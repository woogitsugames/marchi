# 54 — Księga towarów i budynków (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)
Gałąź `gpt/54-goods-codex`. Treść do przyszłego ekranu „Księga” (UI zrobi Claude). Tylko `docs/content/codex.md`
+ `docs/content/codex.json` (dane strukturalne do importu).
Dla każdego z 10 towarów i każdego budynku (woodcutter, sawmill, farm, mill, bakery, fisher, quarry, charcoalBurner,
malthouse, brewery, warehouse, stable, castle):
- nazwa PL/EN (zgodna z `pl.ts`/`en.ts` — sprawdź klucze), 1–2 zdania opisu (≤ 160 zn.) w tonie kroniki,
- liczby z `src/sim/defs.ts`: wejście/wyjście, czas cyklu, ładunek wozu, cena na zamku (podaj klucz źródłowy, nie
  przepisuj ręcznie — w JSON pole `source: "defs.BUILDINGS.sawmill.cycle"` itd.),
- typowe przyczyny przestoju (StallReason) dla budynku i 1 zdanie „co zrobić” PL/EN (spójnie z `stall-codex`,
  `tests/stall-codex.test.ts`),
- wymagania miejsca (przy wodzie / na skale / płaski teren) i ranga odblokowania w Wolnej dolinie.
Bez emoji, bez marketingu. Sprawdź liczby skryptem `tools/codex-check.ts` (nowy), który porównuje JSON z defs.ts
i kończy się błędem przy niezgodności.
