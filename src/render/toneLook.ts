// AgX "look" for the game (D-541): a gentle contrast curve inside three's AgX tone mapping, right after the sigmoid,
// where the AgX reference has its (unused) look step. AgX's default sigmoid squeezes the scene's albedo contrast into
// a milky, flat image (audit 11, D-502); this curve steepens the mid-tones around a pivot near the frame's mean value
// and leaves the ends fixed (0 → 0, 1 → 1), so nothing clips that did not clip before and the frame's mean barely
// moves. It acts on the luminance of the sigmoid output and scales the three channels together, so it adds contrast,
// not saturation (the terrain stays in the art direction's S < 35 % band). Patched into the shared shader chunk once,
// before the first program is built: no new program, no new pass; a few ALU per fragment in the tone-mapping tail.
import { ShaderChunk } from 'three';

/**
 * Pivot (sigmoid output, ~display value) and the extra slope the curve has at the pivot below / above it (0 / 0 =
 * plain AgX). Each side is a cubic in the normalised distance from its end, x + c·x²·(x − 1): value and slope 1 at the
 * end (black or white keep their value and their gradation: the deep shadows of dusk, night and the dark forest by the
 * HUD do not sink, the sky does not burn), slope 1 + c at the pivot. Plain arithmetic, no pow: the first try used
 * pow() with a smoothstep toe and cost +7,6 % frame time at the castle close-up on SwiftShader (D-543).
 */
export const LOOK = { pivot: 0.3, low: 0.3, high: 0.25 } as const;

const f = (x: number): string => x.toFixed(4);

const LOOK_GLSL = /* glsl */ `
	// game look (D-541): luminance contrast around a pivot, ends fixed, chroma scaled with the luminance
	{
		float lkL = dot( color, vec3( 0.2627, 0.6780, 0.0593 ) );
		const float lkP = ${f(LOOK.pivot)};
		float lkX = clamp( lkL < lkP ? lkL / lkP : ( 1.0 - lkL ) / ( 1.0 - lkP ), 0.0, 1.0 );
		float lkG = lkX + ( lkL < lkP ? ${f(LOOK.low)} : ${f(LOOK.high)} ) * lkX * lkX * ( lkX - 1.0 );
		float lkC = lkL < lkP ? lkP * lkG : 1.0 - ( 1.0 - lkP ) * lkG;
		color *= lkC / max( lkL, 1e-5 );
	}
`;

// the sigmoid line (three's build strips the reference's `agxLook` comment, so the code line is the anchor)
const MARK = 'color = agxDefaultContrastApprox( color );';
let patched = false;

/** Insert the look into three's AgX chunk (idempotent). False when the chunk has no look slot (three changed). */
export function installToneLook(): boolean {
  if (patched) return true;
  const src = ShaderChunk.tonemapping_pars_fragment;
  if (!src.includes(MARK)) return false;
  ShaderChunk.tonemapping_pars_fragment = src.replace(MARK, `${MARK}\n${LOOK_GLSL}`);
  patched = true;
  return true;
}
