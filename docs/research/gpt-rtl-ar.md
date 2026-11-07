# Arabic RTL review (order 100)

Date: 2026-11-07 · branch `claude/w-i18n2` · reviewer: Claude (taking over GPT order
`docs/orders/gpt6-13/100-rtl-review.md`). Text fixes are in `src/i18n/ar.ts` (listed in
`docs/reviews/i18n-66-105-other.md`, section ar); UI code was **not** changed — issues for the code are at the end.

## How the shots were taken

Own production build (`npm run build`), `npx vite preview --port 5282`, Playwright with SwiftShader,
`?lang=ar&quality=low&dynres=0`, phone portrait 412×915 and landscape 915×412. Scenes follow
`tools/shots-rtl.mjs` and `tools/m16-shots.mjs` (menu, HUD, why-sheet, wagon sheet, market/rank sheet, valley
ledgers) plus the m16 letter, the castle sheet, the haul card and its sheet, the free valley and the moderator
screen (3 s press on the menu title, D-189). Files: `docs/shots/gpt-rtl-ar-<scene>-<size>.jpg`.

| scene | 412×915 | 915×412 |
|---|---|---|
| menu | `gpt-rtl-ar-menu-412x915.jpg` | `gpt-rtl-ar-menu-915x412.jpg` |
| moderator screen | `gpt-rtl-ar-moderator-412x915.jpg` | `gpt-rtl-ar-moderator-915x412.jpg` |
| HUD (m1) | `gpt-rtl-ar-hud-412x915.jpg` | `gpt-rtl-ar-hud-915x412.jpg` |
| why-sheet (bakery) | `gpt-rtl-ar-why-412x915.jpg` | `gpt-rtl-ar-why-915x412.jpg` |
| wagon sheet | `gpt-rtl-ar-wagon-412x915.jpg` | `gpt-rtl-ar-wagon-915x412.jpg` |
| market / rank sheet | `gpt-rtl-ar-market-412x915.jpg` | `gpt-rtl-ar-market-915x412.jpg` |
| letter (XVI opening) | `gpt-rtl-ar-letter-412x915.jpg` | `gpt-rtl-ar-letter-915x412.jpg` |
| castle sheet (XVI) | `gpt-rtl-ar-castle-412x915.jpg` | `gpt-rtl-ar-castle-915x412.jpg` |
| haul card (XVI, 1:30) | `gpt-rtl-ar-haul-412x915.jpg` | `gpt-rtl-ar-haul-915x412.jpg` |
| haul sheet | `gpt-rtl-ar-haulsheet-412x915.jpg` | `gpt-rtl-ar-haulsheet-915x412.jpg` |
| free valley | `gpt-rtl-ar-valley-412x915.jpg` | `gpt-rtl-ar-valley-915x412.jpg` |
| valley ledgers | `gpt-rtl-ar-ledger-412x915.jpg` | `gpt-rtl-ar-ledger-915x412.jpg` |

## Mirroring

Matches D-37 (as amended) everywhere it was checked:
- **Menu:** medallions on the right, titles right-aligned. In landscape the two columns read right → left
  (I–V on the right, IX–XIII on the left). Help/Settings buttons are swapped.
- **HUD:** the tool rail starts with „طريق“ on the right (portrait order mirrored, landscape rail on the right
  for a right-hander). The stall card and alarm sit on the right, the waybill and mission banner are on the
  right in landscape, and the menu button is top-right. The speed strip (`II ×1 ×2 ×4`) keeps LTR order on
  purpose (D-37: playback-like controls).
- **Sheets:** in landscape they dock on the left (mirrored dock side). The close „×“ is on the left, the title
  and icon on the right. Cause-chain „→“ arrows (`.fwd`) and the route arrow „دقيق ← المخبز“ in the wagon sheet
  point left, which is correct for reading order.
- **Moderator screen:** the participant grid runs right → left (P01 top-right). The start rows put the
  mission title on the right; the `play=…` parameter line is monospaced and LTR, which is correct.
- **Letters:** the body is right-aligned. The signature „— Wszebor“ is laid out LTR (first strong character is
  Latin) and aligned to the inline end. This reads fine.

## Numbers and times

- Clock times (`07:58`, `10:30 حتى الثلج`, `حتى الموعد 3:30`), durations (`1:30` on stall bubbles, `مدة التوقف:
  1:30`, `تتأخر بمقدار 2:20`) and fractions (`0/30`, `17/120`, `6/24`) all keep their LTR digit order inside
  Arabic sentences. Strings rendered through `tHtml` get `<bdi>`. Plain `t()` strings rely on the FSI/PDI marks
  written into `ar.ts`.
- **Fixed in `ar.ts`:** four strings reached the DOM through plain `t()` without isolation. In each, a time
  or a signed number could jump to the wrong side of its word:
  - `fix.pickupDue` {time}
  - `cause.paceCastleEven` / `cause.paceCastleAfter` {late}: HUD stall text and its aria-label
  - `events.order.done` „+{silver}“ / „+{renown}“: the toast, where the plus sign could end up after the number
  - `end.act.wagon` „(−30)“
  
  All four are now wrapped in ⁨…⁩. The XVI HUD card on the build shows „تتأخر بمقدار 2:00 — البضاعة مقسّمة
  بالتساوي“ in the correct order.
- Percent: „90% من السرعة العادية“ (wagon sheet) keeps the Latin order `90%`. This is readable and matches
  the Latin digits used across the UI (D-37); no change.
- **Signed numbers inside `<bdi>` flip.** The haul sheet shows the „شراء عربة“ button as „30−“ and the input row
  as „في الطريق: 2+“ (`gpt-rtl-ar-haulsheet-412x915.jpg`). A `<bdi>` (dir=auto) or a sign outside the
  isolate, with no strong character inside, takes the parent's RTL direction, so the sign lands after the
  digits.
  - Text fix: `why.inbound` → „في الطريق: ⁨+{n}⁩“. The sign is now inside the FSI, which falls back to LTR when
    it holds no strong character. (The shots were taken before this fix, so they still show „2+“.)
  - The price on every fix button (`` bdi(`−${price}`) `` in `src/ui/panels.ts`) needs a code change; see code
    issues.
- Roman numerals: „XVI. قلعتان“ reads correctly (numeral first, dot after it). The display face draws XVI in
  blackletter.

## Truncation and wrapping

- No visible text overflowed the screen. The automatic overflow check (scrollWidth > clientWidth on boxes with
  clipped overflow) found only the items below and the screen-reader-only live region.
- Free valley and valley ledgers: the rank plaque („17/120“, „51/120“), the „أخبار الوادي“ chip and the ledger
  slots (Roman I–III on the right, chevrons on the left) are all mirrored and uncut.
- **Stall card in landscape** (XVI haul/castle card): the text wraps to 2–3 lines. The kicker
  („وتيرة الطلب“) stays visible, and the card grows upward without covering the rail. With the m16 letter open,
  the letter covers the kicker, which is expected.
- **Waybill „first“ tag in landscape** (`gpt-rtl-ar-haul-915x412.jpg`,
  `gpt-rtl-ar-haulsheet-915x412.jpg`): only the flag icon shows, while portrait shows „أولًا“ beside it. The
  overflow check reports this box as **clipped** (scrollWidth > clientWidth), not hidden. See code issue 3.
- Menu, at 412×915 and 915×412: long subtitles wrap to two lines, for example „المنشرة والمفحمة تتنازعان على
  الخشب“ under IX. Nothing is cut.
- Text shortened in `ar.ts` during the 207-key pass: `end.act.wagon` lost the redundant „(شراء عربة، …)“.

## Text fixes made in `ar.ts` (summary)

25 strings in total: 24 in the 207-key pass plus `why.inbound`. The full was → is table is in `docs/reviews/i18n-66-105-other.md`.
- **Gender of buildings:** {who}/{name} can be feminine (المنشرة, الطاحونة).
  - Neutral forms now: „ابنِ مبنى آخر“, „{who}: المورّد الوحيد…“, „الإنتاج …“ (instead of „يصنع“), and
    verbal nouns in `end.act.*`.
  - `cause.paceFleet` now has the yard as its subject: „الساحة ممتلئة بـ…“.
- **Goods:** goods are bare plurals of mixed gender (ألواح, جذوع, جعة), so `fix.rankWhy` now refers to
  „هذه البضاعة … ينتجها“.
- **Rank names:** these have both genders (مدينة حصينة, عاصمة, but the old „حصن“ was masculine), so
  „تحتاجها {rankName}“ became „المطلوب لمرتبة {rankName}“. Also „البضائع والتدفق متوفران“ now uses the dual.
- **Terms:** renown = „الصيت“ (was „سمعة“ in `events.order.*`). Rank 4 = „مدينة حصينة“ in
  `chron.stronghold_rank.s`. The XIII title „الطابق“ (floor) became „الحلقة“ (link).
- **Plurals:** `castle.rival` already has zero/one/two/few/many/other („عربتان“, „# عربات“, „# عربة“) and
  needed no change. `fix.mud` and `why.more` were checked for all six categories.

## UI code issues (not changed, for the code owner)

*Resolved 2026-11-07 on `claude/w-rtlui`: D-340 (items 1–3, 5–7; item 1 was already handled by D-284, the CSS flip) and D-341 (item 4). Shots `docs/shots/rtlui-*-ar.jpg`.*

1. **Sheet help button shows a Latin „?“** (`src/ui/sheets.ts:285`, `h('button.sh-help', …, '?')`). In Arabic
   the question mark is the mirrored „؟“. Either use `t()` for the glyph, or flip it with `.rtl-flip`.
   It shows on every sheet header (`gpt-rtl-ar-why-*.jpg`, `gpt-rtl-ar-castle-*.jpg`).
2. **Pointing-hand icons do not mirror.** The „☛“ on the moderator-screen title, in the help button of the
   menu and in the „ماذا يعني هذا؟“ row of the why-sheet still points right. In RTL, a hand that marks the
   start of a line should point left; give these icons `.rtl-flip`, as was done for back/undo.
3. **Waybill „first“ tag in landscape is clipped** (`gpt-rtl-ar-haul-915x412.jpg`): the castle row of the
   waybill is too narrow at 915×412, so the „أولًا“ label is cut and only the flag shows. Give the tag
   `flex-shrink: 0` and let the castle name shrink/ellipsize (`min-width: 0`), or keep the flag and give it an
   aria-label.
4. **Roman numeral „I.“** at the start of a mission title („I. الخبز والألواح“) looks like the Arabic alef „ا“
   in the banner font. Consider Arabic ordinals or Arabic-Indic numerals in the title (content decision) or a
   distinct style for the numeral span.
5. **Plain `t()` with numbers in RTL:** the HUD stall text, toasts and `fix.*` hints depend on FSI/PDI marks
   written into each `ar.ts` string. New keys with {time}/{n} reached the DOM unisolated four times in this
   batch. `iso()` on the parameters at the call sites (`hud.ts` pace card, `eventCard.ts` toast, `panels.ts`
   pickup hint), or a `t()` variant that isolates parameters in RTL, would make this independent of the
   translator.
6. **Signed prices in fix buttons flip to „30−“** (`src/ui/panels.ts`, every `` bdi(`−${…}`) ``; also
   `+${refund}` in the undo button). `bdi()` in `src/ui/format.ts` emits `<bdi class="num">` with dir=auto. With
   no strong character inside, Chrome gives it the parent's RTL direction, so the minus lands after the digits.
   Fix: `<bdi dir="ltr">` for numbers in `bdi()` (or `unicode-bidi: isolate; direction: ltr` on `.num`).
7. **Device field on the moderator screen** (`playtest.device`, `src/ui/playtestSheet.ts:156` `<input class="pt-dev">` without `dir`): device names are Latin („Pixel 7, Android
   14“); the input should have `dir="auto"` so the caret and text start on the left.

## Verification

`npm run i18n:coverage` (0 placeholder errors), `npm run typecheck`, `npm test`
(SUMMARY passed=623 failed=0), `npm run build` — all green on this branch.
