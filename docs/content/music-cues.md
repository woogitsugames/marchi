# Arkusz muzyki / Music cue sheet

Propozycja zamówienia do Suno; nie są to gotowe pliki ani gwarancja bezszwowej
pętli. Docelowy kontekst: środkowoeuropejska dolina ok. 1300–1400, czytelna muzyka
pod odgłosami wozów i komunikatami. Instrumentalnie, bez wokalu, chóru, mowy,
nowoczesnych syntezatorów i cytatów cudzych melodii. Długość to cel montażu,
nie gwarancja narzędzia. Gotowy materiał wymaga odsłuchu, sprawdzenia pętli,
normalizacji i wpisu pochodzenia według `docs/ASSETS.md` i `docs/legal/`.

| Miejsce / cue | Nastrój | Tempo | Instrumenty | Długość | Pętla |
| --- | --- | ---: | --- | ---: | --- |
| Menu | spokojne zaproszenie | 72 BPM | lutnia, flet prosty, fidel | 60 s | tak |
| Misja | skupienie, ruch | 96 BPM | lutnia, bęben ramowy, fidel | 75 s | tak |
| Zima | chłód i ostrożność | 66 BPM | fidel, flet prosty, cichy bęben ramowy | 60 s | tak |
| List końcowy — wygrana | powściągliwe spełnienie | 76 BPM | lutnia, fidel, flet prosty | 20 s | nie |
| List końcowy — przegrana | zaduma bez kary | 60 BPM | fidel, lutnia | 20 s | nie |
| Dolina, ranga 4–5 | rozwój i spokojna skala | 84 BPM | fidel, lutnia, piszczałka, bęben ramowy | 75 s | tak |
| Posterunek | ruch handlowy, dyskretnie | 90 BPM | lutnia, flet prosty, lekka perkusja ręczna | 60 s | tak |

## Prompty / Prompts

### Menu
- **PL:** Instrumentalny średniowieczny pejzaż doliny, 72 BPM. Lutnia, flet prosty i fidel; spokojna, oszczędna melodia. Miękki początek i koniec do zapętlenia, bez głosu.
- **EN:** Instrumental medieval valley atmosphere, 72 BPM. Lute, recorder and fiddle; calm, spare melody. Gentle beginning and ending suitable for looping, no voice.

### Misja / Mission
- **PL:** Instrumentalny utwór do układania szlaków, 96 BPM. Lutnia, fidel i cichy bęben ramowy, miarowy puls bez napięcia bitewnego. Pętla, bez głosu.
- **EN:** Instrumental route-building cue, 96 BPM. Lute, fiddle and quiet frame drum, steady pulse without battle tension. Loop, no voice.

### Zima / Winter
- **PL:** Cicha zimowa dolina, 66 BPM. Fidel, flet prosty i oszczędny bęben ramowy; chłodny, skupiony nastrój, mało nut. Pętla bez głosu.
- **EN:** Quiet winter valley, 66 BPM. Fiddle, recorder and restrained frame drum; cool, focused mood, few notes. Loop without voice.

### Wygrana / Win
- **PL:** Krótkie instrumentalne zakończenie, 76 BPM. Lutnia, fidel i flet prosty; ciepła, skromna kadencja po wykonanej dostawie, bez fanfary. Bez głosu.
- **EN:** Short instrumental ending, 76 BPM. Lute, fiddle and recorder; warm, modest cadence after a completed delivery, no fanfare. No voice.

### Przegrana / Loss
- **PL:** Krótkie instrumentalne zakończenie, 60 BPM. Fidel i lutnia; spokojna zaduma i otwarta kadencja, bez grozy ani żałobnego patosu. Bez głosu.
- **EN:** Short instrumental ending, 60 BPM. Fiddle and lute; quiet reflection and an open cadence, without menace or funeral grandeur. No voice.

### Ranga 4–5 / Rank 4–5
- **PL:** Instrumentalny obraz rozwijającej się doliny, 84 BPM. Fidel, lutnia, piszczałka i delikatny bęben ramowy; szerzej niż w menu, ale bez triumfalnej orkiestry. Pętla, bez głosu.
- **EN:** Instrumental portrait of a growing valley, 84 BPM. Fiddle, lute, pipe and gentle frame drum; broader than the menu, but no triumphant orchestra. Loop, no voice.

### Posterunek / Trading post
- **PL:** Spokojny ruch przy posterunku handlowym, 90 BPM. Lutnia, flet prosty i lekka perkusja ręczna; powtarzalny motyw pozostawia miejsce na odgłosy handlu. Pętla, bez głosu.
- **EN:** Calm activity at a trading post, 90 BPM. Lute, recorder and light hand percussion; a repeating motif leaves room for market sounds. Loop, no voice.

## Uwaga integracji

W grze są już utwory `public/assets/music/` dla menu (`menu-*`), misji (`play-*`), deszczu (`rain-*`),
wygranej (`won-*`) i przegranej (`lost-*`) — zob. `docs/ASSETS.md`. Nowe zamówienia z tego arkusza to przede wszystkim
**zima**, **dolina ranga 4–5** i **posterunek**; menu/misja/wygrana/przegrana tylko jako ewentualne warianty.
