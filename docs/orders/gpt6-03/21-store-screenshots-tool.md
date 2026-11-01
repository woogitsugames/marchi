# 21 — Narzędzie do zrzutów sklepowych (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

`tools/store-shots.mjs` (Playwright jest w środowisku dev; w CI użyj `npx playwright install chromium` tylko w workflow, nie lokalnie u nas):
startuje `vite preview` (po `npm run build`), otwiera grę z parametrami debug (`?play=m1&bot=1&ff=180&lang=pl`, `?open=`, `?wagon=` —
zob. `src/ui/app.ts`), robi zrzuty 1080×1920 (DPR 2.625 dla wyglądu telefonu) i 1920×1080, nakłada podpisy z planu `docs/store/screenshots-plan.md`
w ramkach ze zlecenia 20 (jeśli niegotowe — prosta ramka zgodna z UI_STYLE). Wyjście: `art/store/screens/<lang>/NN-*.png`.
Opcjonalny workflow `.github/workflows/store-shots.yml` (workflow_dispatch, artefakt). Bez zmian w `src/`.
