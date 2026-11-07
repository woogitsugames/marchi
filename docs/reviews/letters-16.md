# Order 101 — mission XVI "Dwa zamki" letters: PL edit + 15-language review

Branch `claude/w-letters` (taken over from `docs/orders/gpt6-14/101-letters-16.md`). Facts: `docs/missions/m16.md`,
D-288..D-293 — East Castle 24 planks by 5:00, North 30 by 9:00, end 12:00; without a choice the dispatcher splits
evenly and East is late; "Ten zamek pierwszy" works as at 0:00 until ~1:30; 3★ needs the switch **and** a wagon;
+2 wagons without the switch also gives 2★ with East late.

## PL (and EN, which follows it)

| Phase | Was | Is | Reason |
|---|---|---|---|
| opening | "Same wozy podzielą deski po równo i Wschodni się spóźni. Na karcie zamku wybierz, który jest pierwszy — i zdecyduj wcześnie." | "Termin Wschodniego przychodzi pierwszy, a woźnice zostawieni sami sobie podzielą deski po równo. Wskaż im, który zamek jest pierwszy, i zrób to od razu — spóźniona decyzja nie odrobi straconych kursów." | From 0:00 the letter says East's deadline comes first and that the choice must be made at once (the window closes ~1:30). No UI reference ("na karcie zamku"); "wskaż, który jest pierwszy" echoes the button. No wagon hint. |
| won 1 | "…ale jeden list przyszedł po terminie." | "…ale jeden dostał je po terminie. … — wskaż go od razu." | A castle, not a letter, receives goods late. |
| won 2 | "Oba listy spełnione na czas. … jeszcze jeden wóz skróciłby…" | "Deski dotarły do obu bram. Dwie pieczęcie; trzecią dałaby trafna kolejka i wóz więcej na trakcie." | 2★ is also reached with East late (+2 wagons, no switch), so "both on time" could be false. The new text is true for every 2★ path and names both halves of 3★. |
| won 3 | "Wschodni dostał deski długo przed terminem, Północny wkrótce po nim." | "Zamek Wschodni miał deski na długo przed terminem, a Północny też nie czekał." | "Wkrótce po nim" read as "soon after its deadline" (= late). |
| lost | "Wybierz wcześnie, który zamek jest pierwszy, i pilnuj, by wozy jeździły." | "Następnym razem od razu wskaż woźnicom, który zamek jest pierwszy, i pilnuj, by wozy nie stały." | Same voice as the opening. |

## 15 languages — all five letters re-translated from the new PL/EN

| Lang | Was → is (main points) | Reason |
|---|---|---|
| de | du-form ("Wähle…") → Ihr-form ("Sagt ihnen…", "haltet die Wagen in Fahrt"); "Ostburg/Nordburg" kept | Castellan's register in letters I–XIII is Ihr; names = `castle.name.*`. |
| fr | tu ("choisis") → vous ("Dites-leur…"); "Château de l’Est/du Nord" with ’ as in `castle.name.*`; opening shortened to 400 | Register of I–XIII; length limit. |
| es | "tablas" → "tablones" | Letters I–XIII say tablones; castle names as `castle.name.*`. |
| it | "Sulla scheda di un castello scegli…" → "Di' loro quale castello va per primo, e fallo subito" | UI reference removed, PL meaning. |
| pt-BR | "Na ficha de um castelo, escolha…" → "Diga a eles qual castelo vem primeiro, e diga já"; won 1 "uma carta chegou atrasada" → "um as recebeu com atraso" | PL meaning; a castle, not a letter, is late. |
| nl | "Kies op de kaart…" → "Zeg hun welk kasteel eerst gaat"; won 1 "wijs het meteen aan" (het kasteel) | PL meaning; neuter pronoun. |
| sv | "Östra slottet blir sent" → "…frist kommer först"; dash "—" → "–" as in other sv letters; body keeps "slott" (names Östra/Norra slottet) | Idiom; typography; names = `castle.name.*`. |
| tr | "hızarhane" → "bıçkıhane" (`building.sawmill`); "Doğu" alone → "Doğu Kalesi" | UI building name; full castle name. |
| ru | "В карточке замка выбери…" → "Скажи им, какой замок первым, и скажи сразу"; "Северный вскоре после" → "да и Северному ждать не пришлось" | PL meaning; "вскоре после" was ambiguous (late). повозка = UI term. |
| uk | same as ru; "термін" → "строк" in the letters (XIV–XV use строк) | Consistency within letters. |
| ja | "城のカードで…選べ" → "どの城を優先するか御者に告げよ。それも今すぐに"; 書状 wording removed from won 1 | PL meaning; a castle, not a letter, is late. |
| ko | "성 카드에서… 골라라" → "어느 성이 먼저인지 마부들에게 일러라. 그것도 당장"; won 2 names the third seal | PL meaning; 해라체 kept. |
| zh-Hans | "在城堡卡片上选定" → "告诉他们哪座城堡优先，而且要立刻说" | PL meaning; names 东城堡/北城堡 = `castle.name.*`. |
| ar | "اختر من بطاقة القلعة" → "قل لهم أي القلعتين أولًا، وقلها فورًا"; feminine agreement for القلعة throughout (نالتها, إحداهما) | PL meaning; gender. |
| hi | "आरा मिल" → "चीरघर" (`building.sawmill`); "पूर्वी किला देर से पाएगा" → deadline-first sentence | UI building name; PL meaning. |

## `castle.*` keys (src/i18n)

| Lang | Key | Was → is | Reason |
|---|---|---|---|
| ru | `castle.rival` | "Здесь не хватает {short} к {time}." → "Здесь к {time} не хватает ещё {short}." | Natural order; plural forms (one/few/many/other: повозка/повозки/повозок/повозки) checked, unchanged. |
| uk | `castle.rival` | "Тут бракує {short} до {time}." → "Тут до {time} бракує ще {short}." | Same; віз/вози/возів/воза checked. |
| ar | `castle.rival` | "{rival} تتلقى {goodAcc} الآن…" → "تتلقى {rival} الآن شحنات {goodAcc}…" | `goodAcc` is indefinite (ألواح); "تتلقى … ألواح" needed the article. An indefinite iḍāfa (شحنات ألواح) is grammatical for any good; VSO; both rivals feminine (تتلقى). Plural zero/one/two/few/many/other checked, unchanged. |
| ar | `castle.lateBy`, `cause.paceCastleEven`, `cause.paceCastleAfter` | "تتأخر {time}" → "تتأخر بمقدار {time}" | A duration after تتأخر needs بمقدار. |
| ko | `castle.rival` | "{short} 모자랍니다" → "{short}개 모자랍니다" | A bare number needs a counter. Particle 이 after 성 (`castle.splitAfter`) is correct for both names. |
| tr | `castle.rival` | "{goodAcc} şu an {rival} alıyor" → "{goodAcc} şu an {rival} için taşınıyor" | "kalas … Doğu Kalesi alıyor" needed an accusative (kalasları) that a bare `goodAcc` cannot give; "için" needs no case on the name. |
| ja | `castle.rival` | "ここは{time}までに{short}足りません" → "ここでは{time}までにあと{short}足りません" | Particle and "still". |

Castle names in all 15 letter sets match `castle.name.east` / `castle.name.north`. Native review is still open
(BACKLOG P3, D-293).
