# 93 — Długi fuzz — gałąź `gpt/93-fuzz-long`

`npm run fuzz -- --runs 500` + `npx tsx tools/fuzz-late.ts` (więcej przebiegów); raport w `docs/research/gpt-fuzz-2026-11.md`; każdy błąd z minimalnym odtworzeniem jako test w `tests/known-failing/`.
