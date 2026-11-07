# Order 71 — missions XIV "Węgiel z lasu" and XV "Skład pod zamkiem": letters in 15 languages

Branch `claude/w-letters` (taken over from `docs/orders/gpt6-13/71-letters-14-15.md`). Original pl, model en
(both unchanged: they match `docs/missions/m14.md`, `m15.md`, D-210/D-211 and hint without dictating). Numbers kept
(test: XIV 30, 14:00; XV 30, 40, 5:30, 8:30, 12:00). The translations were sound; changes below, everything else
reviewed and kept.

| Lang | Mission/phase | Was → is | Reason |
|---|---|---|---|
| de | XIV opening, lost; XV opening | "Baust du…, bedenke", "baue", "Baue…, lass" → "Baut Ihr…, so bedenkt", "baut", "Baut…, lasst" | The castellan addresses the steward with Ihr in letters I–XIII. |
| fr | XIV opening, lost; XV opening | "Si tu bâtis…, demande-toi", "bâtis", "Bâtis" → vous forms | vous in letters I–XIII. |
| ru | XIV opening, won 2, won 3 | "телега дров — это полтелеги угля", "дрова или уже уголь", "вдвое меньшим числом грузов", "полными телегами" → "повозка брёвен — это полповозки угля", "брёвна или уже уголь", "вдвое меньшим числом повозок", "полными повозками" | повозка is the UI word for a wagon (65× in ru.ts, телега 0×); брёвна = `good.wood`; "грузов" was unidiomatic. (XIII ru also moved from телега to повозка.) |
| ru | XV lost | "Лесорубы стояли с полным двором — амбар… не дал бы им простаивать." → "Лесорубы простаивали с полным двором — амбар у замка дал бы им работу." | Double negative and "стояли с двором" read awkwardly. |
| uk | XIV won 2; XV lost | "удвічі меншою кількістю вантажів" → "…возів"; "стояли з повним двором…" → "простоювали з повним двором — комора… дала б їм роботу" | As ru. |
| ja | XIV opening | "木炭30量", "木炭一量" → "木炭30俵", "木炭一俵" | 量 is not a counter; 俵 (straw sack) is the natural measure for charcoal. |
| ko | XIV opening | "숯 30단위", "숯 한 단위" → "숯 30자루", "숯 한 자루" | 단위 ("unit") is technical; 자루 (sack) reads naturally and does not clash with 숯가마 (kiln). |
| tr | XIV won 2 | "uzun yolu yarı yükle gider" → "uzun yolu yarı sayıda yükle gider" | "yarı yükle" means "half-loaded"; the point is half as many loads. |
| ar | XIV won 1 | "عند كير بارد" → "عند موقد بارد" | كير is the bellows; the cold hearth is موقد. |
| hi | XV won 1, lost (and VIII, XIII elsewhere) | "क़िले" → "किले", "तख़्ते" → "तख्ते" | Spelling as in `src/i18n/hi.ts` (किला 64×). |

Kept on purpose: sv "borgen" in XIV–XV (all sv letters I–XV say borg; only XVI uses "slott" because of the castle
names); tr "çit" for palisade (common, understood); es/it/pt imperatives in tú/tu/você as in letters I–XIII; ar RTL
with Western digits and no direction marks (test). Native review still open (BACKLOG P3, D-210/D-212).
