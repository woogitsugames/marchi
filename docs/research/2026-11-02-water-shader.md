# Shader wody: weryfikacja P0 (`'z' : vector field selection out of range`)

Data: 2026-11-02 · branch `claude/w-research` · three.js ^0.181.2 · tylko badanie, kod gry bez zmian.

## Wniosek

**Błędu nie udało się odtworzyć.** Przy 8 konfiguracjach (poniżej) nie pojawił się żaden błąd `THREE.WebGLProgram`,
żaden `pageerror`, a rzeka renderuje się poprawnie (szaro-zielona, bez różu). Statyczna analiza `src/render/water.ts`
też nie znajduje przyczyny w obecnym kodzie. Rekomendacja: zamknąć P0 jako "nie do odtworzenia na HEAD",
dodać tani strażnik (sekcja "Zalecenia") i przy ponownym zgłoszeniu zebrać `renderer.info`/pełny log programu.

## Co sprawdzono

### Statyczna analiza
- `src/render/water.ts` (WATER_VERT/FRAG, MIST_VERT/FRAG): wszystkie swizzle są poprawne. `p = vW.xz` to `vec2`,
  używane tylko jako `p.x`/`p.y`. `.z` pojawia się wyłącznie na `vec3`/`vec4` (`wp.xyz`, `quad.xyz`, `R.y`, `N`).
  Uniformy typów zgodnych z deklaracjami (Color -> vec3, Vector3 -> vec3, float, sampler2D). Brak `defines`,
  brak `onBeforeCompile` w wodzie — shader nie zależy od wariantów jakości (low/high/ultra), cieni ani
  wersji chunków poza `fog_*`, `common`, `tonemapping_fragment`, `colorspace_fragment` (wszystkie istnieją w 0.181).
  `fog: true` + `UniformsLib.fog` poprawnie zadeklarowane.
- Jedyne miejsca z `.z` na pochodnych `vec2` w całym `src/render`: `src/render/terrain.ts:583` i `:592`
  (shader ducha budowy, `onBeforeCompile` w terrain.ts:613). Tam `uGhostGate` i `uGhostBad` są `vec4`
  (terrain.ts:290-291), więc `.zw` / `.z` jest legalne. `git log -S` pokazuje, że `uGhostGate`/`uGhostBad` były `vec4`
  od pierwszego commita (2bb6259) — nigdy `vec2`. Komunikat o `'z'` mógł więc pochodzić z jakiegoś pośredniego
  stanu WIP (commity "WIP snapshot ... resumed after limit") albo z terrain, nie z wody; w historii `water.ts`
  (6e3b6e7 ... 6f4fd5f) nie znalazłem swizzla `.z/.w` na `vec2`.
- Inne custom shadery: `fx.ts` (smoke/rain), `lighting.ts` (sky), `vegetation.ts` (blob), `models/trees.ts`,
  `models/wagon.ts`, `models/materials.ts` — `ShaderMaterial`/`onBeforeCompile`; żaden nie zgłosił błędu w testach.

### Uruchomienie (Playwright, chromium + SwiftShader, 915x412, `dynres=0&speed=4`, ~9 s na scenę)
Preview: `npx vite preview --port 5197` (po buildzie; zatrzymany po PID).

| URL | błędy konsoli | rzeka |
|---|---|---|
| `?play=m1&quality=low` | brak (tylko ostrzeżenie sterownika, niżej) | OK |
| `?play=m1&quality=medium` | brak | OK (uwaga: `medium` nie istnieje, patrz niżej) |
| `?play=m1&quality=high` | brak | OK |
| `?play=m1&quality=ultra` | brak | OK |
| `?play=m2&quality=high` | brak | OK |
| `?play=m7&quality=high` | brak | OK |
| `?play=sandbox&quality=high` | brak | OK |
| `?play=m1&quality=auto` | brak | OK |

Zrzuty: `docs/research/shots-water/` (`m1-low`, `m1-medium`, `m1-high`, `m1-ultra`, `m2-high`, `m7-high`,
`sandbox-high`, `m1-auto`). Wszystkie pokazują poprawną wodę z mgłą/odbiciem nieba.

### Uwagi poboczne
- Wartości jakości w kodzie: `auto | low | high | ultra` (`src/ui/tier.ts`, `src/render/api.ts` `QUALITIES`).
  `quality=medium` jest po cichu ignorowane (`isQualityPref` -> `null` -> auto). To nie błąd, ale zgłoszenia
  "medium" w backlogu/scenariuszach należy czytać jako auto.
- Jedyny komunikat konsoli: `GL Driver Message ... GPU stall due to ReadPixels` (SwiftShader, tylko `low`,
  powtórzony 2x) — artefakt środowiska testowego (screenshot/readPixels), nie błąd gry.
- Parametr `?play=sandbox` istnieje (`isMissionKey` w `src/ui/menu.ts:17`); `?play=m1|m2|m7` działa.
- Brak innych ostrzeżeń/błędów renderu w żadnej scenie.

## Prawdopodobne wyjaśnienia pierwotnego zgłoszenia (hipotezy, niezweryfikowane)
1. Różowa rzeka = nieskompilowany program (three.js przy błędzie linkowania nie rysuje, a w niektórych
   sterownikach/WebView daje magentę), a błąd `'z' : vector field selection out of range` był z przejściowego
   WIP-a (shader w trakcie edycji), który nie jest już w drzewie. Pasuje do tego, że zrzut pochodził z okresu
   commitów "WIP snapshot ... UI and render polish".
2. Sterownik mobilny (Mali/Adreno/WebView) jest surowszy niż SwiftShader: np. `precision` fragment shadera
   domyślnie `mediump` na części urządzeń. W `WATER_FRAG` `pow(max(dot(R, uSunDir), 0.0), 180.0)`
   i `p / 6.0` z `vW.xz` (współrzędne świata rzędu setek) na `mediump` dałyby artefakty (nie błąd kompilacji).
   three.js ustawia dla `ShaderMaterial` domyślnie `precision highp` (jeśli GPU wspiera), więc ryzyko jest niskie.

## Zalecenia (minimalne)
1. Zamknąć P0 jako "nie do odtworzenia" albo obniżyć do P2 z notatką "czekamy na powtórne zgłoszenie z urządzenia".
2. Opcjonalnie, tani strażnik diagnostyczny przy tworzeniu renderera (nie zmienia zachowania), żeby kolejny
   raport zawierał dokładny log shadera:
```ts
// src/render/view.ts (po utworzeniu WebGLRenderer)
renderer.debug.onShaderError = (gl, program, vs, fs) => {
  console.error('[shader]', gl.getProgramInfoLog(program));
};
```
   (`WebGLRenderer.debug.checkShaderErrors` jest domyślnie true; powyższy hook dodaje czytelny log do
   przechwycenia w Playwright/Sentry.) Można też w `?perf=1` wypisywać `renderer.info.programs?.length`.
3. Gdyby błąd wrócił na urządzeniu: najpierw sprawdzić `getProgramInfoLog` dla programów `water`/`mist`
   oraz programu terenu (`terrain.ts:613`, shader ducha), zanim zmieni się cokolwiek w `water.ts`.
