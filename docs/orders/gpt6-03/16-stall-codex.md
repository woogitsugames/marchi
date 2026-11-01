# 16 — „Księga przyczyn” (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Treść do wbudowanego poradnika: dla KAŻDEGO statusu budynku i wozu (`src/sim/types.ts`: `BuildingStatus`, `WagonStatus`,
z wariantami `cause`) przygotuj: nazwę, 1 zdanie „co to znaczy”, „jak sprawdzić” (co dotknąć w grze), 2–3 typowe naprawy,
przykład łańcucha (np. piekarnia → młyn → gospodarstwo bez drogi). PL i EN, ton jak w `src/i18n/pl.ts`.
Dostarcz `docs/content/stall-codex.md` + `src/content/stallCodex.ts` (nowy plik: `export const STALL_CODEX: Record<string, {pl:…, en:…}>`
— klucze = `status.<k>` / `status.<k>.<cause>` / `wagon.<k>`), test, że pokrywa wszystkie warianty z types.ts.
Max 220 znaków na pole (telefon).
