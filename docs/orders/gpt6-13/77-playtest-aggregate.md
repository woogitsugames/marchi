# 77 — Narzędzie: zbiorcze wyniki playtestu — gałąź `gpt/77-playtest-aggregate`

`tools/playtest-aggregate.ts`: wczytuje CSV wg `docs/playtest/results-template.csv` (z kolumnami `auto_*`, D-190), liczy mediany czasu diagnozy, odsetek poprawnych diagnoz < 30 s per scenariusz, tabelę TOP problemów wg PROTOCOL §5; test na przykładowym CSV w `tests/`.
