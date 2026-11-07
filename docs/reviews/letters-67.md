# Order 67 — castellan letters VIII, XIII and the free-valley opening (pl/en)

Branch `claude/w-letters` (taken over from GPT order `docs/orders/gpt6-12/67-letters-edit.md`). Files:
`src/content/letters.ts` (`m8`, `m13`), `src/i18n/*.ts` (`letter.valleyOpening`). After the pl/en edit the
other 15 languages were re-translated in the same branch (no separate re-translation pass needed).

## Why

Letters I–VII name the order, describe the situation in the castellan's voice and point at the cause; the fix is
at most a direction ("lay cobbles where the wagons travel most"). The three letters had drifted from that:

| Letter | Was | Is | Reason |
|---|---|---|---|
| VIII opening | "Chcę 40 desek…" + "Wybrukuj trakt: potrzeba 23 kamieni w spichlerzach. 16 już tam leży, resztę… po cztery na wóz." | The lane will turn to mud after the rain; "w błocie więcej wozów nie znaczy szybciej"; "brukarze biorą kamień ze spichlerzy, lecz jest go tam za mało; resztę trzeba zwieźć z kamieniołomu." | The old text read like the "why stalled" card (exact 23/16/4 numbers, imperative fix). The new one keeps the lesson (wagons do not help in mud, paving needs stone, stone must be hauled) and leaves the numbers to `NO_STONE`. Facts per `docs/missions/m8.md` (D-165): one lane, rain from 1:30, 8+8 stone in two granaries, quarry. |
| VIII lost | "Ulewa zatrzymała wozy na trakcie. Przywieź kamień do spichlerzy…" | "Ulewa zatrzymała wozy w błocie. Następnym razem zwieź kamień z kamieniołomu i wybrukuj trakt…" | Names the source of the stone (the quarry), like the lost letters of I–VII name where to start. Won 1–3 unchanged. |
| XIII opening | "…Gdy warsztaty stoją, a „Dlaczego stoi?” mówi, że wszystkie wozy są zajęte, kup wozy w stajni." | "…tylko wóz na całą marchię jest jeden. Gdy warsztaty staną, choć niczego im nie brak, nie szukaj winy w zapasach. Policz wozy; stajnia jest blisko." | The castellan does not quote UI labels and does not dictate the button. The inverted flow (D-102: stock is there, wagons are not) is now the hint itself. 24, 16, 10:00 kept (test). |
| XIII won 1 | "kup wozy, gdy tylko wszystkie są zajęte" | "gdy wszystkie wozy są w drodze, dokup następne od razu" | Same advice in the letter's own words; won 2–3 and lost unchanged. |
| Valley opening | "…a rangę podnosi też liczba różnych towarów; tablica rangi pokaże…" | "tym razem nie wyznaczam ci zamówienia ani terminu…; do wyższej rangi trzeba też różnych towarów i stałego przepływu. Tablica rangi pokaże, czego jeszcze brak." | The rank needs renown, distinct goods **and** flow per minute (`RANKS`, plaque rows "Różne towary", "Przepływ na minutę"); the letter mentioned only two. "Tym razem" ties it to the contract letters. Farm-first advice kept (D-151). zh now says 马车 (wagon, as in the letters), not 货车 (lorry); ar uses الصيت (the UI's renown). |

Lengths: all within the test limits (400/200 UTF-16 code units); the valley letter stays at the old length per
language (en 394, pl 392, fr 433 — fr was 437).
