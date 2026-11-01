# 15 — Misje jako dane JSON (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Cel: nowe misje bez dotykania kodu. Zaprojektuj format `missions/*.json` odpowiadający `MissionDef` + `ValleySpec`
(`src/sim/missions.ts`, `src/sim/terrain.ts`), z wersją formatu.
- Nowe pliki (wolno): `src/sim/missionData.ts` (parser + walidacja bez bibliotek: typy, zakresy, budynki na mapie, brama, kontrakt,
  komunikaty błędów z ścieżką pola), `missions/m1.json`, `m2.json`, `m3.json` odtwarzające obecne misje 1:1,
  `tests/missionData.test.ts`: każdy JSON → `MissionDef` identyczny z obecnym (deep equal) i ten sam `stateHash` po 600 tickach
  co `createWorld(id)`. Czysty TS (zasady symulacji z CLAUDE.md: bez DOM, bez Math.random).
- W PR opisz 5-liniową integrację w `missions.ts` (zrobimy sami).
