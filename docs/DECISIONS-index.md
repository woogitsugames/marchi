# Indeks decyzji

Generowany z `docs/DECISIONS.md`: `npx tsx tools/decisions-index.ts`.
Data jest podana tylko wtedy, gdy treść decyzji zawiera jedną jednoznaczną datę; status nieokreślony oznacza brak jawnego oznaczenia. Obszar jest orientacyjny, na podstawie tytułu. Przy kilku datach sprawdź źródło.

| Nr | Data | Tytuł | Status | Obszar |
|---|---|---|---|---|
| D-01 | — | Stack | decided | inne |
| D-02 | — | Simulation is pure TS on a 10 Hz fixed step | decided | inne |
| D-03 | — | Determinism by restricted math + state-held RNG | decided | inne |
| D-04 | — | Grid-cell road graph (4 m cells, 8-neighbourhood) | decided | sim |
| D-05 | — | Bridge capacity as gameplay | decided | sim |
| D-06 | — | Reservations as counters, goods as single-location units | decided | inne |
| D-07 | — | No demolishing a road cell under a wagon | decided | sim |
| D-08 | — | Fonts: Grenze Gotisch (headings) + Alegreya Sans (text) | decided | treść |
| D-09 | 2026-11-01 | Visual direction: late autumn, damp morning, palette of 10 named colours | decided | render |
| D-10 | 2026-11-01 | Monetisation implementation deferred | decided | inne |
| D-11 | — | i18n as typed TS dictionaries | decided | treść |
| D-12 | — | Capacitor 8.6 with Android compileSdk/targetSdk 36 | decided | inne |
| D-13 | — | Queue-aware routing at one-lane bridges | decided | inne |
| D-15 | — | Music as Opus 48 kbps in WebM, loudness-normalised | decided | inne |
| D-16 | 2026-11-01 | Music provenance is tracked per file | decided | inne |
| D-17 | 2026-11-01 | Owner decisions 2026-11-01 | decided | inne |
| D-18 | — | 17 languages (owner's list) | decided | inne |
| D-19 | — | Foldables and big screens (Galaxy Z Fold / Flip) | decided | inne |
| D-20 | — | Texture quality tiers low / high (2K) / ultra (4K), all GPU-compressed | decided | render |
| D-21 | 2026-11-01 | Owner decisions 2026-11-01 (night) | decided | inne |
| D-22 | — | 1024 normals for every tier; ship only files a tier loads (APK budget) | decided | inne |
| D-23 | — | Save gate before migration + golden terrain hash | decided | render |
| D-24 | — | 4K pack: own download, per-version folders, CDN hosting proposed | decided | inne |
| D-25 | — | Replay reports: allowlisted journal + checkpoint hashes, copy to clipboard only | decided | inne |
| D-26 | — | Missions IV–VI mechanics in the sim (STATE_VERSION 3) | decided | sim |
| D-27 | — | Free valley economy in the sim: market, undo, ranks (STATE_VERSION 4) | decided | sim |
| D-28 | — | Building inside contract missions is per mission | decided | sim |
| D-29 | 2026-11-02 | Owner decisions 2026-11-02 (morning) | decided | inne |
| D-30 | — | Data-driven goods, the valley chains and ranks 4-5 (STATE_VERSION 5) | decided | inne |
| D-31 | 2026-11-02 | Owner decisions 2026-11-02 (day) | decided | inne |
| D-32 | — | Missions VII–IX in the menu; road stone as mission data (STATE_VERSION 6) | decided | UI |
| D-33 | — | Seasons wired into the free valley (no state change) | decided | inne |
| D-34 | 2026-11-02 | Stall readability after the seasons / VII–IX playtest (no StallReason change) | decided | inne |
| D-35 | — | Wagon spacing is drawn, not simulated | decided | sim |
| D-36 | — | One save slot per contract mission; starting over always asks (no state change) | decided | sim |
| D-37 | 2026-11-02 | Arabic RTL: the whole HUD mirrors through logical CSS | decided | UI |
| D-38 | 2026-11-02 | Contract pace forecast and shared inputs are read-only diagnosis (F10, F3; no StallReason, no hash change) | decided | inne |
| D-39 | — | Missions X–XII in the menu; data rebalanced so each mission teaches its own cause | decided | UI |
| D-40 | — | Horse gait advances with distance, not time; three wagon detail levels | nieokreślony | sim |
| D-41 | 2026-11-02 | Trees: clump crowns, lit impostors baked from above, dithered LOD crossfade (render only) | decided | render |
| D-43 | — | HUD v3: concept "D" on the painted UI kit (UI only; no sim change, hashes identical) | decided | UI |
| D-44 | 2026-11-02 | Owner decisions 2026-11-02: one ledger row per held bridge, an honest "supplier" status, wagon fleet numbers (state v7) | decided | sim |
| D-45 | 2026-11-02 | Camera keeps the sheet's subject in the visible part of the map; idle wagons wait in a drawn row beside the stable (render only) | decided | render |
| D-46 | — | The castellan's letters are shown in game | decided | inne |
| D-47 | — | A thin load names the shortage at its source (mission X; read-only, no hash change) | decided | sim |
| D-48 | — | "No road to victory" is said at once (contracts; read-only) | decided | sim |
| D-49 | — | One formatting module for numbers and time (Intl) | decided | inne |
| D-50 | — | Saves: one IndexedDB connection, no JSON copy, a metadata store for the list | decided | inne |
| D-51 | — | No tools code in the bundle; the debug handle only on request | decided | inne |
| D-52 | — | Android: no INTERNET permission; Auto Backup keeps the saves, not the caches | decided | inne |
| D-53 | — | HUD v3 polish: a compact landscape contract, engraved bars, one kit button, seals inside the frame (UI only; no sim change) | decided | UI |
| D-54 | 2026-11-02 | Valley events in the Free Valley: royal orders, a dynamic fair, a travelling merchant (state v8) | decided | inne |
| D-55 | — | Landscape side sheet docks opposite the contract, between the top bar and the bottom rail (UI only) | decided | UI |
| D-56 | 2026-11-02 | On-device benchmark as a hidden second Vite entry (`?debug=1&bench=device`) | decided | inne |
| D-57 | — | Valley chronicle wired to the UI; the recorded list is UI-owned (localStorage per ledger), not state | decided | UI |
| D-58 | 2026-11-03 | Far trees: a multi-view impostor atlas (8 azimuths), per-tier cell size (render only; P3 of D-41) | decided | render |
| D-59 | — | Water edge and bridge detail (render only) | decided | render |
| D-60 | — | Contract progress you can feel: delivery tags at the castle gate, a flash on the waybill line, three milestone notices (UI only) | decided | UI |
| D-61 | 2026-11-03 | Building detail pass: thatch ridges, roof wear, daub weathering, ladders (render only) | decided | render |
| D-62 | — | Measured layout check; pins under the HUD fade; a bottom sheet folds the waybill | decided | UI |
| D-63 | 2026-11-02 | Evening ambience loop: constant gain and a calmer excerpt; one-shots preload, a slow first play is queued | decided | inne |
| D-64 | — | Far wagons (LOD1) cast no shadow on any quality tier; draw calls counted at the GL level | decided | render |
| D-65 | — | A quality switch links no shader inside a frame | decided | render |
| D-66 | 2026-11-03 | "Naprawa" for a stranded output: build a granary next to it (UI only; owner decision 2, 2026-11-03) | decided | UI |
| D-67 | 2026-11-03 | Speed hint, never a speed change (UI only; owner decision 7, 2026-11-03) | decided | UI |
| D-68 | 2026-11-03 | Valley chronicle in the save envelope; best seals and time per contract in a profile store (no sim change; owner decisions 1 + 13, 2026-11-03) | decided | sim |
| D-69 | 2026-11-03 | End of a won contract: the castle's seal is pressed before the letter; a quiet delivery sound (UI + audio only; owner decision 6, 2026-11-03; the rest of D-60's backlog entry) | decided | treść |
| D-70 | 2026-11-03 | Main menu on the painted kit (UI only; owner request 2026-11-03 from a phone screenshot) | decided | UI |
| D-71 | 2026-11-03 | Yard piles follow the stock (render only; owner decision 15, 2026-11-03) | decided | render |
| D-72 | — | The pressed seal is a vector redraw of the kit seal (UI only; day-1 note) | decided | UI |
| D-73 | — | Contract numerals stay Roman in every language (UI; day-1 question) | decided | UI |
| D-74 | — | Yard pile spots checked on all 10 producers (render only; day-1 question) | decided | render |
| D-75 | — | The last chamfered parchment surfaces move onto the kit cards (UI only) | decided | UI |
| D-76 | — | Market & rank sheet on the kit (UI only) | decided | UI |
| D-77 | — | The mill loop keeps its rhythm across the seam (audio only; BACKLOG P3 from night 4) | decided | inne |
| D-78 | — | Pace forecast for orders in tranches (UI; BACKLOG P3 from D-38) | decided | UI |
| D-79 | — | Yard piles at the warehouse and the contract castle (render only; continues decision 15 / D-71) | decided | render |
| D-80 | — | The cobble cart loop keeps its rhythm across the seam (audio only; the open half of D-77) | decided | inne |
| D-81 | — | Beer barrels lie on the wagon bed and in their pile (render only; bug) | decided | render |
| D-82 | — | A won contract's seal is pressed onto the waybill, not over the middle of the screen (UI only) | decided | UI |
| D-83 | — | Mud on the wagon card: one plain comparison with cobbles, both against the normal (dry dirt) pace (BACKLOG H4) | decided | UI |
| D-84 | — | Full storage says its count, its cap and its effect (BACKLOG H5; UI only) | decided | UI |
| D-85 | 2026-11-03 | A full yard nobody needs is a calm surplus; a fleet held at a bridge is the cause of "no wagon" (diagnosis audit 2026-11-03, fixes 1 + 2; UI and read-only diagnosis, no hash change) | decided | UI |
| D-86 | 2026-11-03 | "Co to znaczy?" explains the last stall of the chain (diagnosis audit 2026-11-03, fix 4; UI only) | decided | UI |
| D-87 | 2026-11-03 | A full granary points at the granary to link, or stays calm when another has room (diagnosis audit 2026-11-03, fix 3; UI and read-only diagnosis, no hash change) | decided | UI |
| D-88 | 2026-11-03 | "Every wagon busy" with no source in reach of the stable is a missing road (diagnosis audit 2026-11-03, fix 5; UI only) | decided | UI |
| D-89 | 2026-11-03 | A good whose order is filled is the end of the job, not a stall (diagnosis audit 2026-11-03, fix 6; UI and read-only diagnosis, no hash change) | decided | UI |
| D-90 | — | Calm lines sit above the codex fold; m8's quarry left as it is (diagnosis audit follow-up) | decided | inne |
| D-91 | — | Mission I tutorial, step 5: the ghost is the part to draw, on screen, never under the note (day 6, first-ten-minutes research P0; UI only, no hash change) | decided | UI |
| D-92 | — | The worst-stall card waits until the tutorial's re-check note (day 6, research P3; UI only) | decided | UI |
| D-93 | — | A won contract leads on; the cold-start menu says where to begin (day 6, research P4-P5; UI only) | decided | UI |
| D-94 | 2026-11-03 | Free valley: workshops top up in loads of at least four (owner decision A, day 6; research 2026-11-03-partial-loads.md, rule "sb4") | decided | inne |
| D-95 | — | Mission VIII: a quarry waiting for the reserve run says the granary already has paving stone; no "Kup wóz" (owner decision, day 6; UI and read-only diagnosis, no hash change) | decided | UI |
| D-96 | — | Tutorial note placement: free-slot scan before the fallback; the fallback looks at both sides and spares the rail and the open card's head (day 7; BACKLOG P2 from D-91) | decided | UI |
| D-97 | — | Free valley rank 5: 13 000 → 14 500 renown (day 7; sim constant only, missions untouched) | decided | sim |
| D-98 | — | Calm codex variant for a full yard that needs nothing ("Pełno — nic pilnego"; day 7; UI/content only) | decided | treść |
| D-99 | — | Watch mode (Flip cover): the folded seal shows "gotowe za M:SS" under its clock (day 7; UI only; BACKLOG P3 from D-43) | decided | UI |
| D-100 | — | "Naprawa" docks to the bottom edge of the "Dlaczego stoi?" sheet (UI only; first-10-minutes-b items 1, 2, 4) | decided | UI |
| D-101 | — | Workers at the sawmill, farm and fisher (night 6; render only) | decided | render |
| D-102 | — | Mission XIII "Pierwsze piętro łańcucha": one wagon for the whole map (night 6; data only) | decided | sim |
| D-103 | 2026-11-04 | Gap finder links from the supplier's side, straight before diagonal (night 6; research 2026-11-04 P2; read-only, no hash changes) | decided | inne |
| D-104 | — | The worst-stall card names a single producer shared by two workshops (night 6; research P5; UI only) | decided | UI |
| D-105 | — | A wagon held at a wooden span reaches the card, with "pave the bridge in stone" (night 6; research P4; UI only) | decided | UI |
| D-106 | — | A later letter's goods are a surplus on the card, not "Kup wóz" (night 6b; BACKLOG P2 from D-103; UI read helper only) | decided | treść |
| D-107 | — | Authored build sites as mission data; the "Naprawa" ghost starts there (night 6b; BACKLOG P2 from D-104) | decided | sim |
| D-108 | 2026-11-04 | Mission I seal thresholds 3★ 9:15, 2★ 10:45 (day 8; research P1; owner 2026-11-04 morning) | decided | sim |
| D-109 | 2026-11-04 | Mission IV: 140 silver, seals 3★ 7:30, 2★ 10:00 (day 8; research P3; owner 2026-11-04 morning) | decided | sim |
| D-110 | 2026-11-04 | The "one producer for two workshops" card waits 30 s (day 8; owner 2026-11-04 morning; amends D-104) | decided | UI |
| D-111 | 2026-11-04 | Short landscape cause chain: subject, then directly the root; middle links behind "+N" (day 8b; owner 2026-11-04) | decided | inne |
| D-115 | — | The pace card: a producer too slow for the next seal takes the card slot (day 8c; mission VII) | decided | UI |
| D-116 | — | Mud on a contract delivery: a calm line on the pace card, the cobble cure only when seals are at risk (day 8c; mission III) | decided | UI |
| D-117 | — | Before the ice, "Kup wóz" yields to the stone span when a wagon would cost the bridge (day 8c; D-109 follow-up, mission IV) | decided | sim |
| D-118 | 2026-11-04 | Letters are real modals, game sheets are non-modal dialogs (day 8d; a11y audit 2026-11-04 F3/F4) | decided | inne |
| D-119 | 2026-11-04 | Keyboard shortcuts never take a key from a control; a setting turns them off (day 8d; a11y audit F5) | decided | inne |
| D-120 | 2026-11-04 | Large system text: side sheets take the full height; focus stays above the docked fix (day 8d; a11y F1/F2) | decided | treść |
| D-121 | 2026-11-04 | Stall pins: severity and time in the name, a parchment halo, a scalloped seal for critical (day 8d; a11y F7) | decided | inne |
| D-122 | — | Contrast: menu subtitles, "brak N", ETA/income, slate (day 8d; a11y F11, F12, F13, F21) | decided | UI |
| D-123 | — | Two-tone focus ring (day 8d; a11y F8) | decided | inne |
| D-124 | — | Reduced motion reaches the renderer (day 8d; a11y F14) | nieokreślony | inne |
| D-125 | 2026-11-04 | Owner decisions on day 8c (2026-11-04 ~18:00): VII's fisher ghost on the nearest bank, III's mud line only at risk | decided | inne |
| D-126 | 2026-11-04 | Render #4: the mid wagon rig casts no shadow on low and high; far cargo never casts (owner 2026-11-04, option B) | decided | render |
| D-127 | — | The pace card's fleet kind: a long pickup wait with the whole fleet on the road cues "Kup wóz" (day 9a; mission XI, I at 60 s) | decided | UI |
| D-128 | — | A long "waiting for pickup" gets "Kup wóz" on its own sheet, under the fleet rule (day 9a; first-10-minutes-c N2; decided by coordinator — owner to confirm) | decided | UI |
| D-129 | — | The tutorial's end closes the sheets (day 9a; first-10-minutes-c N1) | decided | inne |
| D-130 | — | The loss letter gives one action line for the #1 cause; I's loss letter no longer advises a crossing (day 9a; first-10-minutes-c N3) | decided | treść |
| D-131 | — | A11y leftovers of day 8d: the disabled "Sprzedaj za 15" reads; the HUD under a letter is out of the contrast count (day 9b; audit F19) | decided | treść |
| D-132 | — | The mud stretch to pave has its own ghost: pale setts, not the dirt-road ochre (day 9b; BACKLOG P3 from D-116) | decided | sim |
| D-133 | 2026-11-05 | Render #5: instanced parts draw a mirror of each kind's material, with a guard (night 9; coordinator) | decided | render |
| D-134 | — | The stone-span cure draws the sett ghost on the wooden deck (day 9c; BACKLOG P3 from D-132) | decided | inne |
| D-135 | — | Research c's N5 ("0 words at three stalls") was the audit reading a sheet mid-fade; the fade itself was broken (day 9c; first-10-minutes-c N5, fix list item 6) | decided | UI |
| D-136 | — | Day 9d: the full layout matrix green again (castle 915×412 de/pseudo), the landscape valley events card keeps its open item's actions in view, and quality switches link no program inside a frame (D-65 gap closed) | decided | UI |
| D-137 | — | The focus ring is painted on chamfered (`.cf`) surfaces too (day 9e; ui audit day 9, P1) | decided | UI |
| D-138 | — | Short landscape: the fix's hint docks beside the button; the chain's subject is a plain row (day 9e; ui audit day 9, P2-2/P2-3) | decided | UI |
| D-139 | — | The Flip cover screen folds the cause chain like a short landscape sheet (day 9e; ui audit day 9, P2-4) | decided | UI |
| D-140 | 2026-11-05 | The fleet cue in the free valley (owner 2026-11-05; research sandbox-first-30) | decided | inne |
| D-141 | — | Queued wagons walk the road back once per change, not per frame (research frame-cost day 9 #2) | decided | sim |
| D-142 | — | The end letter's action line and buttons: under the signature in landscape, under the title on Flip (day 9e; ui audit day 9, P2-5) | decided | treść |
| D-143 | — | A pin hidden under the HUD leaves the Tab order (day 9e; ui audit day 9, P2-6) | decided | UI |
| D-144 | 2026-11-05 | The sett ghost of a mud stretch or stone span is framed once in the free map (day 9e; ui audit day 9, P2-7; owner 2026-11-05) | decided | UI |
| D-145 | — | The side sheet on a tall unfolded screen is only as tall as its content (day 9e; ui audit day 9, P3-1) | decided | treść |
| D-146 | — | The cause chain's root stands above the fix dock; the layout check reads it strictly (day 9f; ui audit day 9, P3-5 + day 9e measurement) | decided | UI |
| D-147 | — | Round focus rings on the stall card's eye and on pins (day 9f; ui audit day 9, P3-3) | decided | UI |
| D-148 | — | Pace fix reasons start with a complete short sentence; English fallbacks get their own direction (day 9f; day 9e D-138 note, ui audit P3-2) | decided | UI |
| D-149 | — | Rank card follow-ups: a card-following player test, the bottom sheet's dock clears the frame (day 9f; D-152) | decided | UI |
| D-150 | 2026-11-05 | Shadow map refreshed every 2nd frame on low and high (owner 2026-11-05, option A; research shadow pass) | decided | render |
| D-151 | 2026-11-05 | The free valley opens with the castellan's letter and on the castle (owner 2026-11-05; research sandbox-first-30) | decided | treść |
| D-152 | 2026-11-05 | Free-valley rank card (2026-11-05) | nieokreślony | UI |
| D-153 | — | The HUD rebuilds its cards once per state change, the waybill pill once per shown second (research frame-cost day 9 #3, HUD part) | decided | UI |
| D-154 | 2026-11-05 | No program rebuilds left per render: one instanced depth material, a grass-tuft mirror (research rebuilds) | decided | render |
| D-155 | 2026-11-05 | Watch mode (Flip cover): one "tempo" line under the folded seal, the full pace card on tap; i18n round day 9 (owner 2026-11-05 ~14:30) | decided | treść |
| D-156 | 2026-11-05 | Dispatcher 2 "L1": rule A only with a fleet well above the authored one; rule C off (owner 2026-11-05, ~15:00) | decided | inne |
| D-157 | — | Layout is read at the start of the frame; the "Naprawa" dock height comes from a ResizeObserver (research frame-cost day 9 #3, part a) | decided | UI |
| D-158 | — | Season notices, the plaque and the event card follow the HUD's state key too (frame-cost day 9, rest of D-153) | decided | UI |
| D-159 | — | `status.WAGON_DUE` uses `{goodAcc}` in every language; the dispatcher-2 keys are translated (PENDING_KEYS empty) | decided | inne |
| D-160 | — | A surplus yard's status title follows the calm variant (day 9h; first-10-minutes-e N7) | decided | inne |
| D-161 | — | A wagon wait that resolved while its sheet opened keeps "Kup wóz" for 20 s (day 9h; first-10-minutes-e N8) | decided | UI |
| D-162 | — | Every sheet: the body scrolls above the fix dock, never under it (day 9h; first-10-minutes-e N6) | decided | UI |
| D-163 | — | Free valley: the rank card goes before the fleet card from two wagons per producer; rank 1 timing is an economy question (day 9h; first-10-minutes-e V2, V1) | decided | UI |
| D-165 | — | Mission VIII redesigned around one muddy lane that every load crosses (owner 2026-11-05 ~17:40, BACKLOG P4) | decided | sim |
| D-166 | — | Two granaries in mission VIII, 8 stone each at the start; the quarry's 8 must still be hauled | decided | sim |
| D-167 | — | Mission VIII tests follow the lane, not the old numbers | decided | sim |
| D-168 | 2026-11-05 | Free valley rank 1 at renown 120 instead of 200 (owner 2026-11-05 ~18:50) | decided | sim |
| D-170 | — | Free valley late game: the trading post across the river (owner 2026-11-04, reconfirmed 2026-11-05) | decided | inne |
| D-171 | — | "Wąskie gardło": the free valley's bottleneck card, and its place in the calm slot | decided | UI |
| D-172 | 2026-11-06 | A placement never cuts a diagonal road step (sim `validatePlace`) (decided — owner 2026-11-06) | decided | sim |
| D-173 | — | A producer cut off from the network gets the road cure | decided | sim |
| D-174 | — | "Kup wóz" for a full granary only when a market takes another load; otherwise calm "rynek nasycony" | decided | sim |
| D-175 | — | The rank card skips a building the ghost finds no site for | decided | UI |
| D-176 | — | A ghost refused for cutting a diagonal road says "Przetnie drogę" | decided | sim |
| D-177 | — | The ghost's access-road estimate is the sheet's link | decided | UI |
| D-178 | — | A calm stall heading the stall list keeps its brass pin | decided | inne |
| D-179 | — | The long fuzz covers every mission | decided | sim |
| D-180 | — | A calm stall reads calm in its whole sheet: "Spichlerz pełny — rynek nasycony", ink title, plain row | decided | UI |
| D-181 | — | The alarm seal is crimson wax only while a real stall stands | decided | inne |
| D-182 | — | Audit of calm states shown red (day 9k) | decided | inne |
| D-184 | — | A calm stall heading the stall card gets a calm kicker (D-182 item b) | decided | UI |
| D-185 | — | Playtest fixtures play the real sim to the stall, then pause and validate (`?fixture=`) | decided | sim |
| D-186 | — | A fixture page never touches the save store | decided | sim |
| D-187 | — | `openId` / `wagonId` open an exact card; `open` / `wagon` unchanged | decided | UI |
| D-188 | — | S6 (`warehouse-full`) cuts the castle road: mission I cannot fill its granary otherwise | decided | sim |
| D-189 | — | A hidden moderator screen starts the playtest setups on the APK: a 3 s press on the menu title | decided | UI |
| D-190 | — | The game fills only what it measured; a results row with five `auto_*` columns | decided | inne |
| D-191 | — | Playtest screen in the steward's ledger style, checked by a browser script | decided | UI |
| D-192 | — | Free valley "rozbuduj": the grow card names one more producer when the next rank lacks only renown (decided — owner 2026-11-06) | decided | UI |
| D-193 | 2026-11-06 | Calm everywhere: every brass-pinned stall reads calm in its sheet (D-182 item a; decided — owner 2026-11-06) | nieokreślony | UI |
| D-197 | 2026-11-06 | Playtest S6 "pełny magazyn" moves to mission VI; the `warehouse-full` fixture plays m6 with no commands (decided — owner 2026-11-06) | decided | sim |
| D-200 | 2026-11-06 | Workers at the late-chain yards and the open trading post; legs and torso batched per clothing variant (graphics polish 10, owner direction 2026-11-06) | nieokreślony | render |
| D-201 | — | Malt travels in hooped tubs, not small pale bags (goods by shape) | nieokreślony | inne |
| D-202 | — | Building looks that change with the rank rebuild at the rank-up, not at the next road | nieokreślony | sim |
| D-203 | — | Winter hoarfrost on the buildings, sleet flecks instead of rain streaks | nieokreślony | inne |
| D-210 | 2026-11-06 | Missions XIV "Węgiel z lasu" and XV "Skład pod zamkiem" in the game, appended after XIII (owner 2026-11-06) | decided | inne |
| D-211 | 2026-11-06 | XIV/XV thresholds: the wrong site with a wagon misses three seals by >= 20 s (owner 2026-11-06) | decided | sim |
| D-212 | 2026-11-06 | A full granary of goods nobody wants reads calm (owner 2026-11-06; generic rule) | decided | inne |
| D-213 | 2026-11-06 | Names: "Posterunek handlowy" and "sława"; UI kit rights confirmed (owner 2026-11-06 ~14:30) | decided | UI |
| D-230 | — | A wagon without a route never parks on a one-lane span (GPT long fuzz, order 93) | decided | sim |
| D-231 | — | fuzz `shrink` counts duration relative to the snapshot start | decided | sim |
| D-232 | — | valley-3h `grow` plan: third malthouse at (46, 25) | decided | inne |
| D-233 | — | a granary's "Kup wóz" counts only markets reachable by road (UI, real cue loop) | decided | UI |
| D-235 | 2026-11-06 | Build tutorial: a second, optional lesson on a new free valley (GPT order 90, owner 2026-11-06 ~14:30) | decided | inne |
| D-236 | — | Help sheet from the pause menu and the main menu (GPT order 78) | decided | UI |
