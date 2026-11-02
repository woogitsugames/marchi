/** Audio catalogue. All files are original CC0 foley/soundscape renders (see docs/ASSETS.md). */
export type AudioChannel = 'ambient' | 'sfx' | 'ui';

export interface SoundDefinition {
  readonly channel: AudioChannel;
  readonly ogg: string;
  readonly m4a: string;
  readonly loop?: boolean;
  readonly gain: number;
  /** Metres from the listening point at which a positional sound fades out. */
  readonly radius?: number;
  /** Minimum time between identical one-shot events, in seconds. */
  readonly cooldown?: number;
}

const asset = (name: string, channel: AudioChannel, gain: number, options: {
  loop?: boolean; radius?: number; cooldown?: number;
} = {}): SoundDefinition => ({
  channel,
  ogg: `/assets/audio/${name}.ogg`,
  m4a: `/assets/audio/${name}.m4a`,
  gain, ...options,
});

export const SOUNDS = {
  'ambient.morning': asset('ambient/morning', 'ambient', 0.8, { loop: true }),
  'ambient.river': asset('ambient/river', 'ambient', 0.65, { loop: true }),
  'ambient.rain': asset('ambient/rain', 'ambient', 0.75, { loop: true }),
  'ambient.evening': asset('ambient/evening', 'ambient', 0.7, { loop: true }),

  'cart.dirt': asset('sfx/cart-dirt', 'sfx', 0.53, { loop: true }),
  'cart.cobble': asset('sfx/cart-cobble', 'sfx', 0.48, { loop: true }),
  'horse.snort': asset('sfx/horse-snort', 'sfx', 0.45, { radius: 38, cooldown: 25 }),
  'bridge.wood': asset('sfx/bridge-wood', 'sfx', 0.55, { radius: 50, cooldown: 0.3 }),
  'load.sack': asset('sfx/load-sack', 'sfx', 0.45, { radius: 48, cooldown: 0.8 }),
  'unload.sack': asset('sfx/unload-sack', 'sfx', 0.4, { radius: 48, cooldown: 0.8 }),
  'load.plank': asset('sfx/load-plank', 'sfx', 0.44, { radius: 48, cooldown: 0.06 }),
  'unload.plank': asset('sfx/unload-plank', 'sfx', 0.41, { radius: 48, cooldown: 0.06 }),
  'load.log': asset('sfx/load-log', 'sfx', 0.43, { radius: 48, cooldown: 0.06 }),
  'unload.log': asset('sfx/unload-log', 'sfx', 0.44, { radius: 48, cooldown: 0.06 }),
  'work.axe': asset('sfx/axe', 'sfx', 0.43, { radius: 55, cooldown: 0.2 }),
  'work.saw': asset('sfx/saw', 'sfx', 0.41, { radius: 55, cooldown: 0.2 }),
  'work.mill': asset('sfx/mill-wheel', 'sfx', 0.36, { loop: true }),
  'work.oven': asset('sfx/oven', 'sfx', 0.5, { radius: 40, cooldown: 0.3 }),
  'work.quarry': asset('sfx/quarry-chisel', 'sfx', 0.5, { radius: 55, cooldown: 0.2 }),
  'work.quarryRock': asset('sfx/quarry-rock', 'sfx', 0.52, { radius: 55, cooldown: 0.2 }),
  'work.fisher': asset('sfx/fisher-net', 'sfx', 0.38, { radius: 50, cooldown: 0.3 }),
  'work.fisherSplash': asset('sfx/fisher-splash', 'sfx', 0.36, { radius: 50, cooldown: 0.3 }),
  'work.charcoal': asset('sfx/charcoal-fire', 'sfx', 1.0, { radius: 45, cooldown: 0.3 }),
  'work.malt': asset('sfx/malt-bubbles', 'sfx', 0.24, { radius: 40, cooldown: 0.3 }),
  'work.brewery': asset('sfx/brewery-barrels', 'sfx', 0.36, { radius: 45, cooldown: 0.3 }),
  'load.stone': asset('sfx/load-stone', 'sfx', 0.43, { radius: 48, cooldown: 0.06 }),
  'unload.stone': asset('sfx/unload-stone', 'sfx', 0.43, { radius: 48, cooldown: 0.06 }),
  'load.fish': asset('sfx/load-fish', 'sfx', 0.4, { radius: 48, cooldown: 0.06 }),
  'unload.fish': asset('sfx/unload-fish', 'sfx', 0.4, { radius: 48, cooldown: 0.06 }),
  'load.barrel': asset('sfx/load-barrel', 'sfx', 0.36, { radius: 48, cooldown: 0.06 }),
  'unload.barrel': asset('sfx/unload-barrel', 'sfx', 0.3, { radius: 48, cooldown: 0.06 }),
  'contract.won': asset('sfx/wax-seal', 'ui', 0.64, { cooldown: 0.3 }),
  'stall.alert': asset('ui/stall', 'ui', 0.38, { cooldown: 1.5 }),
  'ui.wood': asset('ui/wood', 'ui', 0.4, { cooldown: 0.04 }),
  'ui.paper': asset('ui/paper', 'ui', 0.44, { cooldown: 0.04 }),
  'ui.error': asset('ui/error', 'ui', 0.36, { cooldown: 0.2 }),
} as const satisfies Record<string, SoundDefinition>;

export type SoundId = keyof typeof SOUNDS;
