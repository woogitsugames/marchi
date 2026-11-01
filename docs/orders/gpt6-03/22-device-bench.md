# 22 — Benchmark na telefon (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Właściciel ma Galaxy Z Fold 8 Ultra. Potrzebna strona `tools/device-bench.html` + `tools/device-bench.ts` (Vite serwuje `/tools/...`;
dołącz ją też do buildu jako dodatkowy entry w osobnym `vite.bench.config.ts`, NIE zmieniaj `vite.config.ts`), która:
- używa `createWorldView()` (`src/render/view.ts`) i `tools/bench.ts` (`benchWorld(n)`) — 3 przebiegi po 60 s: 50, 100, 200 wozów, ×4,
  stała ścieżka kamery (bliski / średni / daleki zoom), jakość low/high/ultra (jeśli `Quality` ma 'ultra');
- mierzy: FPS (średnia, 1% low), czas klatki CPU (sim + render osobno), `renderer.info` (draw calls, trójkąty, tekstury),
  `performance.memory` jeśli jest, rozmiar viewportu i DPR, renderer WebGL (`WEBGL_debug_renderer_info`);
- wynik pokazuje na ekranie i pozwala skopiować JSON / zapisać plik; format pasujący do tabeli w `docs/PERF.md`.
Instrukcja dla właściciela w `docs/PERF.md` (sekcja „Pomiar na urządzeniu”) — jak uruchomić w APK (np. parametr w URL / ukryty przełącznik
opisz jako propozycję integracji) oraz w Chrome na telefonie przez `npm run preview -- --host`.
