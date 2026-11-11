# Handover — MARCHIA (stan 2026-11-08 ~12:30 Europe/Brussels) — koniec sesji `session_01V6ZttXS1AFjiGAx6Mvg1nL` (limit tygodniowy)

## Start następnej sesji — najpierw to
- Repo: **woogitsugames/marchi**, baza integracyjna **`claude/eager-cori-08wt8e`** = `main` (po każdym zielonym scaleniu
  fast-forward `main`). Prompt startowy: `docs/START_PROMPT.md`.
- Stan bazy: testy **667/0**, typecheck, build, smoke 0, `layout --quick` 138/0, 71 starych haszy misji bez zmian (+15 XVII).
- Ostatnie APK: **d49a64a** (8 XI ~12:45, z D-390/D-391) — misja XVII, karta-para D-380, światła D-370, pasek tempa na Foldzie.
- Cykl godzinny `trig_017HkVx1C3bfqf3vFDobFdnR` („42 * * * *”) **wyłączony** na koniec limitu — włączyć
  (`update_trigger enabled=true`) albo założyć nowy w nowej sesji. Przypomnienie „Raport z testu Free.AI (24 h)”
  `trig_01CrY9mMKNSZwrsvrEyTg76J` (8 XI 20:00) zostaje — wpadnie do tej sesji.

## Decyzje na rano (10/11 XI noc)
- Misja X, otwarcie 0:02–0:20: czerwony spór o drewno bez przycisku zostaje celowo (D-110). Czy pokazywać „Postaw drwala” od razu, czy czekać do playtestu? (BACKLOG)
- Scalone w nocy: D-610..D-619 (karty późnych misji, list „Szlak nie do uratowania” przy rozebranym niezastępowalnym producencie). Testy 711/0, layout 138/0, sim nietknięty.

- (11 XI noc) Scalone D-630..D-639 (P4 kart, list „Szlak nie do uratowania” rozszerzony: drugi zamek bez drogi, brak srebra, za późno; 0 fałszywych alarmów w >3000 grach). Testy 720/0, layout 138/0, sim nietknięty. Do decyzji: (1) list „za późno” w misji I (samouczek) — zostawić czy wyłączyć; (2) droga zbudowana w pauzie — odświeżać odczyt po komendzie czy zostawić. 6 kluczy `PENDING_KEYS` do tłumaczenia.

- (11 XI rano) Scalone D-650..D-655 (karty misji I–IX; najważniejsze: wóz z rybami bez drogi w VII dostaje czerwoną kartę `cause.routeLost`). Testy 725/0, layout 138/0, sim nietknięty. Dodatkowe pytanie: misja IX na otwarciu (0:02–0:21) pokazuje spór o drewno bez przycisku jak lekcja X — „Postaw drwala” od razu czy zostawić (D-110)? 7 kluczy `PENDING_KEYS` do tłumaczenia. APK 12b3af3 jest przed D-650.

- (11 XI przed południem) Wdrożone decyzje właściciela: D-670 (IX/X „Postaw drwala” od razu przy sporze o drewno), D-671 (list „za późno” w I bez zmian), D-672 (komenda w pauzie odświeża karty na kopii świata; `pausedReading` w sim to tylko odczyt, hasze identyczne). Testy 730/0, layout 138/0. Do obejrzenia na telefonie: budowa drogi w pauzie. Wszystkie wcześniejsze „Decyzje na rano” zamknięte.

## Scalone 10 XI wieczór (ta sama sesja)
- Scalone i na `main`: D-500..502, D-520..522, D-540..543 (grafika 12), D-560..565, **D-570..574** (render: culling kafli 64 m, −33 % trójkątów w dolinie, bez zmiany obrazu; P1 do sprawdzenia na telefonie, bo +wywołania rysowania), **D-590..594** (arkusz zamykany nie przyjmuje tapnięć, szary kamień, pełne podwórze producenta, cache UI między grami). Testy 701/0, layout 138/0, hashe misji bez zmian.
- Ostatnie APK: **8c2caef** (10 XI ~22:30). Otwarte: test Androida „Wstecz” (D-522) na prawdziwym urządzeniu; pytanie o LOD/cienie na low (BACKLOG); 3 klucze (`cause.stoneWagon`, `fix.stoneWagon`, `cause.yardRoom`) do tłumaczenia; sprawa desaturacji rdzawych koron jesienią.

## Scalone 10 XI (sesja `session_01QWRid74YcFi21Wc62DrCAR`)
- **D-430/D-431** fuzz 1 100 przebiegów (0 błędów sim); naprawiona martwa karta mostu (kamieniołom czeka na wóz); `tools/dead-seconds.ts`.
- **D-450..D-455** audyt czytelności kart (spichlerz „zapełnia się”, „Rozbierz”, kamieniołom, kra na moście); `tools/read-states.ts`, `tools/read-shots.mjs`, zrzuty `docs/shots/read-*`.
- **D-470..D-473** sim 2–9 % mniej instrukcji na tick, hasze misji bez zmian (86/86), `tools/perf-late.ts`.
- **D-490..D-492** numeracja budynków o tej samej nazwie, pusty nagłówek „NAPRAWA” ukryty (decyzje właściciela).
- GPT 106–108 scalone; 109 (4 klucze kamienia, D-420) czeka u GPT. APK `858e3b5`. Stan bazy: testy 684/0, smoke 0, layout 138/0.
- Uwaga: layout na worktree wymaga `LAYOUT_URL=http://127.0.0.1:<port>/` z `vite preview`.

## Scalone 8 XI (wieczór, sesja `session_01QWRid74YcFi21Wc62DrCAR`)
- **D-392..D-394** card-10 nie zabudowuje doliny (świeży producent liczy się jako obsłużony, spichlerz „zapełnia się”, droga dla odciętego browaru); spichlerze 30–45 → 3–18, zarobek bez zmian.
- **D-400..D-402** smolarnia w XVII bez „przyda się drugi”; `balance-night6` i scena S16 znają `chainFirst`.
- **D-410..D-412** odcięty później budynek bez możliwej drogi: arkusz „Rozbierz”, karta „bez dojazdu”; martwe minuty 41–45 → 0 (seedy 1305, 1307).
- Stan bazy `d669e1d`: testy 674/0, smoke 0, layout 138/0. APK z `e67bc4a` (bez D-410..D-412).
- Cykl godzinny: nowy `trig_01UncL4peHHBWyuGYZWSvvWK`. Decyzje XVII (zostawić do playtestu) podjęte.
- Nowe: P3 tłumaczenia kluczy z D-393/D-410 na 15 języków; P2 szary „Wyłóż most kamieniem” przy `pave?NO_STONE`.
- Uwaga: layout z `npm run layout` na worktree dawał 403 (node_modules poza katalogiem) — użyć `LAYOUT_URL=http://127.0.0.1:5193/` z `vite preview`.

## Scalone 8 XI
- **Pasek tempa ucięty na Foldzie** (zgłoszenie właściciela): przy 720–879 px CSS (split) i < 820 px (landscape) tempo
  schodzi pod kafelki; layout-check ma widok **772x854** (bez poprawki łapie „offscreen ×2/×4”).
- **D-353..D-355** a11y: list przewozowy przy 200 % tekstu, forced-colors, fokus pomocy, codex XVI.
- **D-352** podłużne kosze chleba (właściciel: tak).
- **D-380** karta rangi/„rozbuduj” stawia **parę** (producent + odbiorca, np. Słodownia + Browar) jednym dotknięciem;
  card-60 ranga 5 w 4/4 dolinach (108–118 min, wcześniej 2/4). Bez zmian w sim.
- **D-370** światła: kolumny klatek kluczowych (bez domknięć), bramka `src/render/lightGate.ts` (natychmiast przy resize,
  zmianie tempa/pauzie, nic w pauzie). Co-2.-klatkę było już od D-257.
- **D-356..D-359 misja XVII „Drewno na dwa listy”** (prototyp): komenda `chainFirst` (cały łańcuch dla zamku, tylko
  `chainPriority` w definicji misji), przyczyna `NO_INPUT.CHAIN_FIRST`, karta zamku „Tartak stoi — drewno idzie na węgiel
  drzewny dla Zamku Północnego”, listy w 17 językach (15 do przeglądu natywnego), `tools/bot-m17.ts`.
  Drabina: nic 2★, „Ten zamek pierwszy” 2★ (bez pomocy, nie gorzej), „Cały łańcuch” do 2:00 → 3★, za późno 2★, zły zamek 1★.

## W toku przy zamknięciu
- Nic — wszyscy agenci oddali pracę i są scaleni. Ostatnie: **D-390/D-391** martwe karty doliny (karta „Wąskie gardło”
  nie nazywa budynku bez miejsca, „Postaw” buduje właściwy typ, kamieniołom dla bruku mostu, kotwica spichlerza);
  martwe minuty kart 7–55 → ≤ 1 na 120 min. Nowe P2 w BACKLOG: card-10 stawia 30–45 spichlerzy i do 79 farm (każda
  karta wykonalna, nic nie czeka na rozruch nowego budynku); producent odcięty później bez drogi — karta krytyczna bez
  naprawy.

## Decyzje dla właściciela (klikalnie w następnej sesji)
1. XVII: „Ten zamek pierwszy” nie pomaga, ale nie szkodzi (wozów nie brakuje). Zostawić, czy szukać układu, w którym
   szkodzi (margines 1–5 s, kruchy)? Rekomendacja: zostawić do playtestu.
2. XVII: progi gwiazdek robocze (2★ za nic ma 19 s marginesu) — po playteście.
3. Dźwięki z własnej syntezy (D-350/D-351): właściciel miał posłuchać i wskazać złe.
4. Karta-para D-380: sprawdzić na telefonie, czy duch browaru pojawia się sam obok nowej słodowni.

## Otwarte drobne (XVII)
- Arkusz smolarni w XVII nadal podpowiada „przyda się drugi” (dostawca), choć w misji nic nie można budować.
- `tools/balance-night6.ts` (rozsądny gracz) i scena playtestu typu S16 nie znają przełącznika łańcucha.

---

# Handover — MARCHIA (stan 2026-11-06 ~23:15 Europe/Brussels) — sesja `session_01V6ZttXS1AFjiGAx6Mvg1nL`

## Stan teraz (ta sesja)
- Repo w kontenerze: **`/workspace/marchi`**; worktree: `/workspace/marchi-<nazwa>` (gałąź `claude/w-<nazwa>`), symlink
  `node_modules` — **nigdy `git add -A` w worktree** (symlink trafił raz do commita i podmienił `node_modules` bazy;
  `.gitignore` ma teraz `node_modules` bez ukośnika). Preview bazy: `npx vite preview --port 5193`.
- Cykl godzinny: **`trig_017HkVx1C3bfqf3vFDobFdnR`** („42 * * * *”); stary `trig_01PAgKEUo171oE4A99BXL74i` już nie istnieje.
- Baza = `main` = **D-284..D-286 scalone** (7 XI ~04:00): testy **585/0**, build, smoke 0, layout 114/0. `setup:android` OK.
  Ostatnie APK: **58cc3a0** (8 XI przedpołudnie, poprawka paska tempa + a11y).
- Scalone wieczorem 6 XI: **D-254** „?” na kartach → pomoc; **D-250/D-251** karta rangi zna węglarnię/słodownię/browar,
  „rozbuduj” rośnie te łańcuchy (card-10 ranga 5 po 104–109 min, wcześniej nigdy; DECENT i hasze bez zmian); **D-255..D-258**
  budowa świata menu −23…−28 % CPU (geometria bit w bit), leniwe LOD-y wozów, **światła co 2. klatkę** (decyzja właściciela),
  `precompile` przy `KHR_parallel_shader_compile` (do zmierzenia na Foldzie).
- Scalone ~23:50: **D-259** samouczek budowania — odcięta chata zapełnia podwórze i **naprawdę staje** („brak drogi”, 80 s
  gry, krok 7 wskazuje ×4), potem diagnoza (krok 5), potem droga; zrzuty `onboard-s7-*`, `onboard-s5road-*`.
- Scalone ~00:30: **D-264..D-267** luka sławy — karta „rozbuduj” także przy braku przepływu i dla nigdy niesprzedanych
  towarów, duch w dolinie na miejscu osiągalnym drogą, słodownia rośnie przed browarem. card-30 ranga 5 na 4/4 ziaren
  (97–105 min), card-60 1/4; misje i DECENT bez zmian. Research `docs/research/2026-11-07-valley-fame-gap.md`.
- Scalone ~02:00: **D-268..D-270** „Wąskie gardło” pomija łańcuchy z nasyconym towarem, poprawka `siteLinked` (browar nie
  rodzi się odcięty), linia „rozbuduj” zawija się w poziomie. card-10 R5 śr. 90 min, card-30 95–100, card-60 2/4 ziaren.
- Research **„dwa zamki”** gotowy: `docs/research/2026-11-07-two-castles.md` (w bazie); prototyp sim tylko na gałęzi
  `claude/research-castles` (eksperymentalny, hasze misji bez zmian) — pytania w „Decyzje na rano” pkt 3.
- Scalone ~03:00: **D-276/D-277** rosnące `jsEventListeners` to nie wyciek — Chrome obniża licznik dopiero po
  zamieceniu właściciela; „settled” (GC, 3 s, GC) stoi płasko (~100). Narzędzie `tools/listeners-probe.mjs`. Do
  potwierdzenia na telefonie: godzina gry, licznik po GC + ~5 s.
- Scalone ~03:00: **D-280..D-283** teren: szybszy `Heightfield` (pomija interpolację maski wody tam, gdzie zero),
  `vnoise` 7 zamiast 32 mnożeń, pamięć gruntu dla 2 ostatnich światów (zmiana świata: teren/woda ~0,3 ms). Menu −13 % CPU
  (high), wynik bit w bit (SHA na 14 światach, jam-diff 0 px). Dalsze kroki w `view.ts` po scaleniu `w-winter`.
- Scalone ~04:00: **D-284..D-286** przegląd jakości nocy (pełny layout 475/0): „?” lustrzany po arabsku, uchwyt 8 px na
  krótkich arkuszach RTL, pomoc z „?” przewija się do tematu; narzędzia zrzutów z `--lang`. Restart przerwał audyt a11y
  po arabsku i zrzuty samouczka de/pseudo — powtarzane przez koordynatora.
- **Decyzje właściciela 7 XI ~09:45:** drzewa zimą — scalić (**scalone**, D-260..D-263); misja XVI „Dwa zamki” — **tak,
  wariant A** (wszystkie rekomendacje raportu); card-60 — czekać na playtest.
- **Decyzje właściciela 7 XI ~12:00:** D-128 (misja I bez „Kup wóz” w oknie samouczka) — zostaje, po playteście; wiosenny
  odcień koron — **tak** (kolejka); 4K do pobrania — przed wydaniem; przeniesienie XIII — po playteście.
- Scalone ~13:30: **misja XVI „Dwa zamki”** (D-288..D-293): dwa zamówienia zamków, przełącznik „Ten zamek pierwszy” (komenda
  `castleFirst`, priorytet tylko na ostatnim odcinku), diagnoza `castleRival`, karta zamku z prognozą, `STATE_VERSION` 10.
  Drabina: nic 1★, przełącznik 2★, przełącznik + wóz 3★ (+21 s), za późno (≥1:40) 1★. Hasze I–XV bez zmian. Otwarte:
  rozsądny gracz 2★ (prognoza ~20 s za optymistyczna — karta floty się nie pojawia), progi robocze, przegląd tłumaczeń.
- Scalone ~14:30 (akceptacja właściciela): **D-303..D-305** wiosenna, stonowana zieleń odrastających koron, znika w 40 % lata.
- Scalone ~14:15: **D-300** dostępność (ETA na pasku AA, fokus pinezki w forced colors, podpowiedź zawija się przy 200 %);
  **D-306..D-309** XVI: uczciwa prognoza dwóch zamków (tempo długiego biegu, ostatni zamek, czekanie na wóz) i nowa
  karta „przewóz” (tartak robi mniej niż potrafi, wszystkie wozy w trasie → „Kup wóz”). Rozsądny gracz 3★ przy 10/30/60 s;
  I–XV bez zmian (148 wierszy bilansu i 71 haszy identyczne). Słabe miejsce: oko z przesunięciem fazy 60 s → 2★ (BACKLOG).
  Paczka GPT 14 wysłana (listy XVI, kodeks zamków, playtest S10, temat pomocy). Weryfikacja: testy 600/0, smoke 0, layout 126/0.
- Scalone ~15:30: **D-313..D-316** XVI — jeden model łańcucha (tartak 85 % vs flota) dla prognozy całości i zamków: błąd od 1:10
  −36…+27 s (było do +192 s), karta zamku przy równym podziale mówi „spóźni się o 2:00” (było 0:33), arkusz „przewóz” znów
  podaje godzinę (nowy klucz `fix.paceHaulAt`); oko 60 s z przesunięciem fazy 2★ → 3★. **D-310..D-312** szybsza budowa świata
  (maska dróg tylko w dotkniętych wierszach, trzcina i plan drzew raz na grunt): menu → misja I 34 → 20 ms, menu −10 % CPU,
  0 px różnicy na 15 scenach. Weryfikacja: testy 603/0, smoke 0, layout 126/0.
- Scalone ~16:00: **D-317** „nieaktualny list” w XVI to artefakt narzędzia zrzutów (zwinięty list w pionie), UI spójne;
  narzędzie sprawdza teraz zgodność ze stanem. **D-318** arkusz zamku zaokrągla spóźnienie w górę do 10 s jak karta i list.
- APK **e9b389a** wysłany ~16:05; **d359249** ~18:50 (kupiec, szybsze modele). Następny rano.
- Scalone ~18:10: **D-320..D-322** szybsza budowa modeli (wspólne prymitywy, typowane tablice w `PartBuilder`, szum raz na
  wierzchołek): modele menu 167 → 125 ms (node), w przeglądarce 137 → 105 ms; 0 px na 18 scenach, geometria bit w bit.
  Testy 606/0, smoke 0, layout 126/0. (Agenci stanęli ~16:00 na limicie użycia, wznowieni ~17:45.)
- **Decyzje właściciela ~20:20:** noc → wydajność i jakość (nic nie zmienia rozgrywki ani haszy); dyspozytor (D-127, wóz
  dokupiony w połowie gry) → po playteście; przegląd tłumaczeń agenta w 15 językach → paczka dla GPT (gpt6-15: najpierw 66, potem 105; wysłana).
- **Eksperyment Free.AI (7 XI ~20:00 → 8 XI ~20:00, decyzja właściciela):** konektor Free.AI MCP (Qwen3-30B, self-hosted)
  do odciążenia limitu — łatwiejsze zlecenia zamiast agentów Claude: pierwszy przegląd diffów, podsumowania dużych plików,
  skrypty/testy, zbiorcze prace tekstowe. Pliki przez upload `curl --data-binary` → `blob:ID` (repo prywatne). Wynik zawsze
  weryfikuje koordynator. Przypomnienie 8 XI 20:00: raport właścicielowi + reguła w CLAUDE.md. Dziennik:
  - 20:25 `qwen_review` diffu D-325..D-327 (300 linii): 1. „mipy odwrócone” — fałszywy alarm (mip z poziomu 0 raz na atlas
    jest celowy, atlasy bit w bit); 2. MSAA + MRT (`samples: 4, count: 2`) — trafna uwaga do sprawdzenia na urządzeniu
    (WebGL2 to wspiera, ale sterowniki bywają różne) → BACKLOG; odpowiedź ucięta. ~11 tys. tokenów po stronie Qwena.
  - 21:40 `repo_search`/klasyfikacja „zdań łączonych spacją” — niepotrzebne: grep znalazł 1 miejsce, poprawione ręcznie.
  - 21:50 `qwen_code` (zrzut w layout-check nie może psuć zmierzonego zadania): logika trafna, ale zgubiony warunek `!css`
    i rozjechane wcięcia → poprawione ręcznie. ~5 tys. tokenów Qwena; mój koszt: opis zadania + przegląd ≈ tyle co sam kod.
    Wniosek wstępny: przy jednoliniowych zmianach nie opłaca się; sensowne dla większych, dobrze opisanych plików/testów.
  - ~01:00 zlecenie 70 (opisy sklepu): `qwen_ask` z plikiem EN + starym plikiem języka → zaktualizuj 8 języków. de dobre po 3
    poprawkach; es/fr/it/nl/pt_BR: w każdym błąd logiczny (warunek „jeśli droga dochodzi” sklejony z zimą), „skład” jako
    „sklep”, it „17 misji”; sv rozsypany (akapity zamienione, zdanie po angielsku), tr literówki i zła składnia. Poprawione
    ręcznie; 9 pozostałych języków (sv, tr, ru, uk, ja, ko, zh, ar, hi) napisał koordynator. **Wniosek: tłumaczenia Qwen3-30B
    nie nadają się bez pełnej korekty — czas korekty ≈ czas pisania.** Tokeny Qwena ~7 tys./plik.
- Scalone ~18:40: **D-323/D-324** kupiec przy ladzie faktorii: po sprzedaży gest 3 s (sięga po monetę, waży, wrzuca do skrzyni),
  wykrycie z `tradePost.recent` (tylko odczyt), te same wywołania rysowania. Testy 611/0, smoke 0, layout 126/0.
- Scalone ~21:00: **D-325..D-327** billboardy drzew (programy przy starcie, ArrayCamera na wiersz, albedo+normalne w jednym
  przebiegu): CPU bake w 1. klatce 74 → 36 ms, GPU ponad 2× krócej, atlasy bit w bit, 0 px na 20 scenach. **QA dnia**
  (`claude/w-qa2`, pełny layout 525/0): **D-328** cokół na zboczu bez szablonu `prim` (wyciek geometrii), **D-329** list w
  krótkim poziomie (fr „d'abord” → tylko dla czytnika), dwuliniowe żetony towarów, CJK bez spacji między zdaniami
  (`sentences()`), ru/uk „jedyny wóz” tylko dla 1. Pamięć: 30 zmian świata — sterta płaska po 1. rundzie.
  Koordynator: **D-330** lód mostów też bez `prim` (losowy promień kry = wyciek) + test `prim-guard`; zimowy efekt sezonu
  przez `sentences()`. Testy 614/0, smoke 0, layout 138/0.
- Scalone ~22:30 (**decyzja właściciela: scal, sprawdzi w porannym APK**): **D-331..D-333** katalog modeli wypiekany przy
  `vite build` (`models-*.bin`, 6,0 MB, 2,4 MB gzip; APK ~51,6 → ~54 MB), dekodowany przy starcie zamiast zimnego budowania:
  `ready` −14 % (1×) / −15 % (CPU 4×), `first-frame` −200 / −590 ms; 0 px na 20 scenach; bez pliku (`?baked=0`, dev, testy,
  błąd pobierania) budowa jak dawniej. Plik generowany przy buildzie, nie w repo. **Rano zmierzyć na Foldzie** start i rozmiar.
- Scalone ~23:00: **D-334** proporczyk „pierwszy” i `no_route` odbite po arabsku (audyt ikon kierunkowych); **D-335** list
  porażki pomija spokojne postoje w „trzech kosztach” (próbkowanie UI raz na sekundę gry): XV/VI/XII po spichlerzu radzą
  „wóz”, IV pokazuje lód na moście, X sporny tartak; 225 odczytów, żadna misja nie straciła sensownej przyczyny.
  Testy 621/0, smoke 0, layout 138/0. `main` = baza.
- Scalone ~23:30: **D-336..D-338** tańszy tick symulacji (pamięć odległości dyspozytora między tickami, Dijkstra na listach
  sąsiadów, dolna granica w regule A): 50/100/200 wozów 0,108/0,222/0,234 → 0,056/0,058/0,067 ms/tick, p99 ~1,6 → ~0,6 ms;
  hasze misji bajt w bajt (sprawdzone też przez koordynatora), bot 7,94 min 3★ jak przedtem. Testy 623/0, smoke 0, layout 138/0.
- **Polecenie właściciela 7 XI ~23:45:** praca autonomiczna i ciągła; zlecenia, których inne AI (GPT) nie oddały, robimy sami
  agentami Claude. Nieoddane: 66, 67, 68, 69, 70, 71, 72, 79, 80, 81, 82, 83, 84, 100, 101–105. Plan fal (po 2 agentów):
  1) **scalone ~00:30:** 66+105 i18n de/es/fr/it/nl/pt_BR/sv/tr (207 kluczy/język, 317 zmian, `docs/reviews/i18n-66-105-latin.md`)
  ‖ 67+71+101 listy (VIII/XIII bez zdradzania rozwiązania, XVI na nowo w 17 językach, XIV–XV przegląd, list doliny; `docs/reviews/letters-*`);
  2) **scalone ~01:45:** 66+105 i18n ru/uk/ja/ko/zh_Hans/ar/hi (132 zmiany, `docs/reviews/i18n-66-105-other.md`) + 100 RTL
  (`docs/research/gpt-rtl-ar.md`, 7 uwag do kodu UI) ‖ 72+102 księga przestojów: 8 wpisów sytuacyjnych w 17 językach (D-339);
  70 opisy sklepu — koordynator (17 języków, App Store pl/en);
  3) **scalone ~02:50:** RTL w UI (D-340/D-341: ceny „−30”, ☛ odbita, rzymskie liczby, izolacja liczb w `t()` dla ar) + 81
  audyt kształtów (D-342: ikony OK; kosze chleba vs cebrzyki słodu na wozie mylą się z bliska → P3) ‖ 103 jako **S16** (S10–S15
  zajęte przez VII–XII; D-343) z fixturą i kolumnami CSV + 104 pomoc „Kilka zamków” (D-344). Do sprawdzenia na telefonie:
  przytrzymanie tytułu 3 s w poziomie nie otworzyło ekranu prowadzącego w skrypcie zrzutów.
  4) **scalone ~03:30:** 68 ikony (D-345: wagon_due, market_full, grow, cut_road; posterunek i wąskie gardło już miały) ‖
  **scalone ~06:00:** 82 audyt a11y z poprawkami (D-347..D-349: przełącznik zamku bez sprzecznego aria-pressed, nazwy pasków
  z zamkiem, kontrast, forced colors) + 83 zrzuty de/ru/ar/ja/hi (ja/ru skrócone); 84 pomiar wydajności — zrobione przez agentów 7 XI (PERF.md dni 14–17). 5) **scalone ~04:15:** 69/79/80 dźwięki — własna synteza, 9 plików, podpięte (D-350/D-351). Agenci stanęli ~01:30 na limicie, wznowieni
  ~03:45.
  Gdy GPT odda coś później — porównać i wziąć lepsze.
- Rano: APK (katalog modeli + tańsza symulacja), raport Free.AI 8 XI 20:00.
- Scalone ~11:30: **D-296..D-298** chunki terenu poza kadrem po 1. klatce (menu klatki 1–5 0 px różnicy), bez wymuszonego
  `vegetation.update` (naprawia stare sortowanie drzew po zmianie świata).
- **GOTOWE, czeka na akceptację właściciela:** `claude/w-winter` (D-260..D-263) — gołe korony dębów/brzóz/krzewów zimą,
  liście opadają w ostatnich 6 min jesieni, wracają wiosną; iglaste zielone; dalekie drzewa i cienie też gołe. Draw calls i
  alokacje bez zmian, trójkąty +0,6…0,9 %, 0 nowych kompilacji przy zmianie pory. Zrzuty przed/po na gałęzi:
  `docs/shots/winter-trees-{before,after}-*` (np. `after-winter-high-915x412`, `after-winter-near-high-412x915`).

### 8 XI przedpołudnie
- **Ucięte tempo w prawym górnym rogu (zgłoszenie właściciela, Fold):** przy 720–879 px CSS (rozłożony Fold z powiększonym rozmiarem ekranu) i landscape < 820 px przełącznik tempa schodzi pod kafelki czasu/srebra. Nowy widok w layout-check: 772x854 (bez poprawki zgłasza „offscreen ×2/×4”). Zrzut: docs/shots/topbar-772x854-after.png.
- **Scalone a11y follow-ups (D-353..D-355):** list przewozowy przy 200 % tekstu w krótkim landscape, forced-colors, fokus pomocy, codex XVI. Zostaje: ar + dwa zamki 915×412 200 % (ok. 10 px do przewinięcia); forced-colors sprawdzone tylko w emulacji Chromium.

- **Decyzje 8 XI ~10:00 (klikalne):** właściciel wybrał wszystkie 4: misja XVII (agent `claude/w-m17`, D-356+), gołe korony zimą (już były: D-260..D-263), karta „słodownia + browar” (**scalone D-380**: karta stawia parę jednym dotknięciem, card-60 ranga 5 w 4/4 dolinach), światła co 2. klatkę (agent `claude/w-lights`, D-370+).

### Decyzje na rano (8 XI) — rozstrzygnięte ~09:45: kosze scalone, S16 zostaje, dźwięki — właściciel posłucha i da znać
1. **Dźwięki z własnej syntezy (D-350/D-351, scalone ~04:15):** awans rangi (dzwon), stuk karty, ciesielka „rozbuduj”,
   okiennica + dzwonek posterunku, pękający lód, monety, pętle: wiatr zimą, skrzypienie lodu, gwar targu. Nikt ich jeszcze
   nie słyszał — **posłuchaj w porannym APK na telefonie**. Rekomendacja: zostawić; jeśli któryś brzmi źle, cofnę tylko jego
   podpięcie (stary dźwięk wraca).
2. **Scenariusz playtestu XVI nazwany S16, nie S10** (S10–S15 zajęte przez VII–XII, CSV grupuje po ID; D-343).
   Rekomendacja: zostawić S16.
3. **Kosze chleba vs cebrzyki słodu na wozie** mylą się z bliska w skali szarości (D-342). Propozycja: podłużne kosze
   chleba (zmiana modelu 3D + katalog D-331). **Gotowe na gałęzi `claude/w-bread` (D-352):** podłużne tace, 3 długie
   bochenki, 186 trójkątów/szt. (było 180), te same wywołania rysowania, 0 px poza ładunkiem chleba; porównanie w szarości
   `docs/shots/bread-cargo-compare-gray.jpg` na gałęzi. Rekomendacja: scalić.
4. **Zmierz na Foldzie:** start z katalogiem modeli (D-331), rozmiar APK; przytrzymanie tytułu 3 s w poziomie otwiera
   ekran prowadzącego? (w skrypcie zrzutów nie zadziałało).

### Decyzje na rano (7 XI) — rozstrzygnięte ~09:45 (wyżej)

# Handover — MARCHIA (stan 2026-11-06 ~19:00 Europe/Brussels) — PRZEJĘCIE PRZEZ NOWĄ SESJĘ

> Sesja `session_01Xqzfc3EMpVJFqLiHix1voE` kończy (limit 5-godzinny i tygodniowy). Prompt startowy: `marchi.md` w katalogu
> głównym repo. Niżej historia (sekcje „Dzień 2026-11-06”, „Noc 2026-11-05/06”, …) — czytaj po kontekst.

## Stan teraz
- Repo `woogitsugames/marchi`. Baza integracyjna **`claude/eager-cori-08wt8e`**; **`main` przesuwany fast-forward na bazę
  po każdym zielonym scaleniu** (typecheck, test, build, smoke `node tools/smoke.cjs`, `npm run layout -- --quick`).
- W kontenerze tej sesji repo było w `/home/user/marchi` (nie /workspace); worktree agentów: `/home/user/marchi-saves`,
  `/home/user/marchi-research` (ręczne `git worktree add -B <gałąź> <dir> origin/claude/eager-cori-08wt8e` + symlink
  `node_modules`). W worktree serwer dev Vite zwraca 403 (symlink) — do layoutu/a11y używaj `LAYOUT_URL`/`A11Y_URL`
  wskazującego `npx vite preview --outDir <dist> --port <wolny>`.
- Baza = `main` ≈ **36e505b + content10** (sprawdź `git log origin/main`): testy **559/0**, build, smoke I–XV + dolina,
  layout 102/0. Stan symulacji **v9** (posterunek handlowy). Misje **I–XV** w menu.
- **APK działa** (sieć środowiska przepuszcza `dl.google.com`/`maven.google.com`): `npm run setup:android` raz w nowym
  kontenerze, potem `npm run apk -- --skip-web` (Maven Central 429 → ponawiaj w pętli). Ostatnie APK: **b2625c6** (~20:00
  6 XI).
- Numeracja decyzji: zajęte do **D-249** (D-243/244, D-234, D-198/199, D-185..D-188 itd. — sprawdź `docs/DECISIONS-index.md`,
  odśwież `npx tsx tools/decisions-index.ts`). Następna bezpieczna: **D-250**. Przy dwóch agentach daj każdemu osobny zakres.
- Cykl godzinny tej sesji `trig_01PAgKEUo171oE4A99BXL74i` — **wyłącz/usuń** i utwórz własny (prompt niżej).

## Niedokończone (dokończ najpierw)
1. ~~`claude/w-onboard`~~ **scalone** (b2625c6, APK wysłane ~20:00): samouczek budowania w Wolnej dolinie (D-235,
   `?tut=build`), ekran pomocy (D-236). Pytania właściciela: krok 5 (przestój) zwykle się nie pojawia — wywołać celowo?
   pomoc także z mapy („?” na karcie)?
2. ~~`claude/w-postroad`~~ **scalone** (D-245/D-246): karta „Posterunek handlowy kupi więcej — doprowadź drogę z mostem”,
   arkusz spichlerza z drogą do posterunku, poprawki kadrowania kamery (tablica rangi i „Wieści z doliny” liczą się
   jako zasłona). **Nowe P2 z pomiaru:** gracz „karta” nie dochodzi do rangi 5 (7 z 9 towarów — karta rangi nie nazywa
   węglarza/słodowni/browaru); niewydane srebro rośnie. Agentów w toku: **brak** (sesja zakończona ~21:00 6 XI).
3. **GPT:** paczka 12 (`docs/orders/gpt6-orders-12.zip`, zlecenia 66–70) **nieoddana**; z paczki 13 nieoddane 71, 72,
   79–84, 100. Oddane 73–78, 85–99 scalone (`docs/reviews/gpt-integration-13.md`). Gałęzie `gpt/*` przeglądaj wg wzoru
   tego raportu (dozwolone ścieżki, testy zielone, treści-propozycje wdraża koordynator).
4. **Do decyzji właściciela (klikalnie):** światła pory dnia co 2. klatkę (największy alokator, zmienia obraz, D-223
   follow-up); gołe korony drzew zimą (D-203); progi XIV/XV po playteście (słaby punkt XIV: węglarz po 1:40 → 2★);
   wyzwanie kontraktu (3. oś oceny) — po playteście.
5. Właściciel: usunąć `/mono-before.txt`, `/bot-before.txt`, `/bots-before.txt` (artefakty agenta w katalogu głównym).

## Zasady pracy (właściciel)
- Rozmowa po polsku; kod/komentarze/commity po angielsku; `CLAUDE.md` najpierw. Teksty gracza tylko przez i18n — nowe
  klucze od razu w pl/en **i 15 językach** (PENDING_KEYS jest pusty; tłumaczenia agentów oznaczaj w BACKLOG do przeglądu).
- **Do 2 agentów Opus naraz** (deweloper + researcher/drugi deweloper); koordynator też koduje i scala. Agenci commitują
  często (restarty kontenera/procesu zdarzają się kilka razy dziennie), nie pushują; koordynator scala, sprawdza, pushuje
  bazę i `main`. Po restarcie: sprawdź worktree, wznów agentów przez SendMessage (`resume`), serwer preview 5193 uruchom
  ponownie.
- **Limit 5-godzinny:** agenci padają z 429 — wznów po resecie (godzina w komunikacie).
- **CI ma limit minut** — nie zmieniaj workflowów; sprawdzaj lokalnie. Nie zamykaj PR-ów bez prośby.
- Layout: nie puszczaj dwóch przebiegów naraz (wspólny plik raportu); pojedyncze `page.goto: Timeout` pod obciążeniem —
  powtórz samo zadanie `--only '<scena>\|<widok>\|<język>'`.
- APK w dzień (7–23 Brussels) co ~3 h przy istotnej zmianie, w nocy nic, jedno rano. Decyzje w dzień klikalnie
  (AskUserQuestion) z rekomendacją; w nocy do „Decyzje na rano” tutaj.
- Paczki dla GPT: `docs/orders/gpt6-NN/` + zip (wzór paczek 12/13: zasady wspólne, dozwolone ścieżki, „zlecenie bez
  plików jest nieoddane”). Commity kończ `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + `Claude-Session: <link>`.
- **Aktualizuj ten plik na bieżąco i pushuj** (właściciel czyta go z GitHuba).

## Prompt cyklu (create_trigger, „42 * * * *”)
Godzinny cykl MARCHIA (praca ciągła, autonomiczna; do 2 agentów Opus naraz; koordynator też rozwija). Baza
claude/eager-cori-08wt8e; po każdym zielonym scaleniu (typecheck, test, build, smoke, layout --quick) push bazy
i fast-forward main. 1) Agent skończył/przerwany — scal, sprawdź, push, main; od razu kolejna paczka (HANDOVER
„Niedokończone”, potem backlog: błędy > czytelność < 30 s > wydajność > grafika > treść). 2) gpt/* i claude/x-* —
przejrzyj, scal, raport. 3) APK w dzień co ~3 h, w nocy nic, jedno rano. 4) Decyzje: dzień klikalnie, noc do HANDOVER
„Decyzje na rano”. HANDOVER aktualny na GitHubie. Raport krótki po polsku.

## Kierunki właściciela (6 XI) i co dalej
Grafika i animacje (zrobione D-200..D-203; dalej: drzewa zimą po decyzji, kupiec reagujący na sprzedaż), nowe misje
(XIV–XV zrobione; kolejne lekcje: „dwa zamki” wymaga rozszerzenia sim — najpierw research), wydajność telefonu (D-220..D-223;
dalej: budowa świata menu ~1,4 s CPU, kompilacja shaderów w 1. klatce 1,0–1,3 s — wymaga pomiaru na Foldzie), samouczek
i onboarding (w toku). Playtest wg `docs/playtest/PROTOCOL.md` gotowy (fixtury S2/S3/S4/S6, ekran moderatora: przytrzymaj
tytuł „Marchia” 3 s).

---

# Handover — MARCHIA (stan 2026-11-05 ~23:50 Europe/Brussels) — sesja `session_01Xqzfc3EMpVJFqLiHix1voE`

## Stan teraz (ta sesja)
- Repo w kontenerze: **`/home/user/marchi`** (nie /workspace). Worktree: deweloper `/home/user/marchi-saves`,
  researcher `/home/user/marchi-research` (ręczne `git worktree add` + symlink `node_modules`). Gałąź koordynatora:
  `claude/focused-carson-c3s2ff` (fast-forward do bazy).
- Cykl godzinny: `trig_01PAgKEUo171oE4A99BXL74i` („42 * * * *”).
- Baza = `main` = **b6e7cca**: testy 457/0, build, smoke (`node tools/smoke.cjs`), layout --quick 84/0.
- **APK zablokowane:** polityka sieci środowiska odrzuca `dl.google.com` (403) — `npm run setup:android` nie pobierze
  SDK. Właściciel: dodać `dl.google.com` i `maven.google.com` w Allowed domains (albo szerszy dostęp).
- Scalone dziś wieczorem: **D-125** (M7 duch rybaka przy najbliższym brzegu → VII oko 2/2/2★; M3 linia błota tylko
  przy zagrożonej pieczęci), **D-126** (render #4, wariant B: mid rig bez cienia na low/high, ultra pełny; daleki
  ładunek bez cienia), paczka a11y **D-118..D-124** (listy jako modale, skróty mysz wł./dotyk wył., pinezka-pieczęć z
  obwódką i nazwą, kontrast, dwukolorowy fokus, reduced motion; zrzuty `docs/shots/day8d/`), research
  „pierwsze 10 minut c” (`docs/research/2026-11-04-first-10-minutes-c.md`).
- W toku: deweloper `claude/w-day9a` — czytelność: XI/I przy reakcji 60 s 1★ (WAITING_PICKUP spokojne bez naprawy,
  karta błota z niemożliwym brukiem w I), N1 (arkusz zamku po samouczku zasłania kartę zastoju), N3 (list porażki
  radzi most, który stoi). Researcher `claude/research-day9a` — render #5 (osobne materiały InstancedMesh).
- Inne sesje: brak `claude/x-trade-post` / `claude/x-m8-redesign`, brak nowych `gpt/*`, brak otwartych PR.

## Dzień 2026-11-06
- Decyzje właściciela rano: F1 „rozbuduj” scalona (D-192), D-172 zostaje wszędzie, spokojne stany wszędzie (D-193,
  scalone), S6 przeniesione do misji VI (D-197, scalone), posterunek OK, przegląd tłumaczeń + ikony + dźwięki + listy +
  opisy sklepu → **paczka GPT 12** (`docs/orders/gpt6-orders-12.zip`, zlecenia 66–70), wyzwanie kontraktu po playteście.
- **APK odblokowane** (sieć środowiska przepuszcza `dl.google.com`/`maven.google.com`): `npm run setup:android`, potem
  `npm run apk -- --skip-web` (Maven Central 429 → ponawiać). Ostatnie APK: **ddac168** (~11:00).
- Po południu scalone: D-200..D-203 grafika (pracownicy w nowych warsztatach, słód w beczkach, szron, deszczośnieg),
  D-210..D-212 **misje XIV „Węgiel z lasu” i XV „Skład pod zamkiem” w menu**, spokojny spichlerz z niepotrzebnym towarem,
  D-213 nazwy „Posterunek handlowy” / „sława” + prawa do UI kit, integracja GPT paczka 13 (21 zleceń,
  `docs/reviews/gpt-integration-13.md`), D-230..D-233 wóz bez trasy zjeżdża z przęsła (zakleszczenie z fuzza GPT).
  APK: ddac168, b6b86d9, **6d43284** (~17:00). GPT: paczka 12 i zlecenia 71, 72, 79–84, 100 z paczki 13 nieoddane.
- W toku: deweloper `claude/w-onboard` (samouczek budowania + ekran pomocy wg treści GPT 90/78), drugi agent
  `claude/w-perf10` (wydajność telefonu). Potem: zdarzenia+kronika rang 4–5 (GPT 73/74), podtytuły menu (91).
- Kierunek właściciela: grafika/animacje (deweloper `claude/w-gfx10`), misje XIV–XV (researcher `claude/research-m14`),
  potem wydajność telefonu i samouczek/onboarding.

## Noc 2026-11-05/06 — stan i Decyzje na rano
- `main` = baza = **5415373**: testy 507/0, smoke, layout 102/0. Scalone wieczorem: D-160..D-163 (paczka 9h: tytuł
  nadwyżki, „Kup wóz” na zamku po niedawnym czekaniu, dok nigdy nie zasłania treści, kolejność kart w dolinie),
  **D-165..D-167 misja VIII przeprojektowana** (jedna błotnista droga: same wozy ≤ 2★, bruk + 1 wóz 3★ z zapasem
  38–61 s, rozsądny gracz 3★ przy 10/30/60 s), **D-168 ranga 1 doliny przy renomie 120** (gracz „karta” 7,7–10,4 min),
  **D-170/D-171 posterunek handlowy za rzeką od rangi 4 + karta „Wąskie gardło”, zapis v9** (DECENT R5 117 min z
  posterunkiem, 132 bez; złote hasze misji bez zmian), nagłówek karty floty w dolinie „Droga do rangi”, raport rang 2–3.
- Scalone w nocy: D-172..D-175 (F2–F4: duch/stawianie nie przecina drogi, „Kup wóz” tylko gdy rynek przyjmie ładunek,
  karta rangi pomija budynek bez miejsca), raport odporności `docs/research/2026-11-06-robustness.md` (0 błędów sim;
  test czystości obejmuje teraz podkatalogi). W toku: `claude/w-day9j` drobiazgi UI.
- (było) W nocy: deweloper `claude/w-day9i` — błędy F2–F4 z raportu rang 2–3 (duch nie przecina drogi, pętla „Kup wóz” przy
  nasyconym rynku, karta rangi pomija budynek bez miejsca).

### Decyzje na rano
1. **[GOTOWE DO SCALENIA — gałąź `claude/w-valley-grow`, D-192 proposed] Dolina, rangi 2–3 (raport `docs/research/2026-11-05-valley-ranks-2-3.md`):** gracz „karta” ma rangę 2 po 30–32 min
   (cel 20–30) i 3 po 65–72 min (cel 40–50); hamuje tylko renoma, 850–2 800 srebra leży. **F1 — karta „rozbuduj”**
   (od rangi 1, gdy brakuje tylko renomy: „postaw jeszcze jednego producenta” działającego łańcucha, z proporcjami)
   → ranga 2 23–29 min, ranga 3 40–51 min, DECENT bez zmian. Alternatywa: progi renomy 750/2 000 (DECENT wypada z
   okien testu). Rekomendacja: **F1**. Zrobione na zapas: ranga 2 po 23–28 min, ranga 3 po 39–55 min (card-10/30/60, 4 seedy;
   1 z 12 przebiegów 54,6 min, bo rynek nasycony), DECENT i hasze misji bez zmian, testy 536/0, zrzuty
   `docs/shots/valley-grow-*.jpg` na gałęzi. Na „tak” scalam od razu.
1b. **F2 (D-172): blokada stawiania budynku, który przetnie ukośny odcinek drogi** — wdrożona w symulacji
   (`validatePlace`), więc działa też przy stawianiu ręcznym; hasze wszystkich misji bez zmian. Zostawić tak
   (rekomendacja) czy tylko dla ducha z kart?
1c. **Spokojne stany bez „calmWhy” (D-182 a):** wóz już jedzie po ładunek (`WAITING_PICKUP`), pełne podwórze z odbiorcą
   wciąż biorącym towar, wejście spowolnione porą roku — pinezka mosiężna, ale w arkuszu czerwony tytuł. Uznać za
   spokojne (spójny wygląd) czy zostawić czerwone (bo „Kup wóz” czasem pomaga)? Rekomendacja: spokojne, z linią
   „wóz N już jedzie” zamiast czerwieni; „Kup wóz” zostaje tam, gdzie karta floty go podaje.
1d. **Playtest S6 (pełny magazyn):** w misji I spichlerz nigdy sam się nie zapełnia przed terminem, więc fixtura
   `warehouse-full` przecina drogę do zamku — karta pokazuje zamek (prawdziwy korzeń), spichlerz 60/60. Liczyć S6 z
   pytaniem skierowanym na spichlerz, uznać za eksploracyjny, czy przenieść „pełny magazyn” do misji VI / doliny?
   Rekomendacja: **przenieść do VI** (tam można postawić spichlerz, stan powstaje naturalnie). Fixtury S2/S3/S4/S6
   gotowe (`?fixture=…&debug=1`, opis w `docs/playtest/PROTOCOL.md`).
2. **Posterunek handlowy (D-170/D-171)** — obejrzeć zrzuty `docs/shots/trade-*.jpg` (model zamknięty/otwarty, kra na
   drewnianym moście, karta „Wąskie gardło”).
3. **Przegląd tłumaczeń przez native speakerów** — lista niepewnych miejsc w raporcie D-155 (tytuł XIII, „marchia”,
   telegraficzne linie tempa, ar/tr odmiany) i nowy list misji VIII w 17 językach (D-167).
4. APK — odblokować `dl.google.com` + `maven.google.com` w sieci środowiska; usunąć `/mono-before.txt`,
   `/bot-before.txt`, `/bots-before.txt`.

## Dzień 2026-11-05 (wieczór)
- Scalone: D-156 dyspozytor 2 w wariancie L1 (decyzja właściciela; straty pieczęci od dokupionego wozu 28 → 19 / 193,
  drabiny lekcji całe, rozsądny gracz 61 → 63, nowe złote hasze, status `WAGON_DUE` „Wóz N przyjedzie”), D-155
  tłumaczenia wszystkich kluczy na 15 języków + linia „tempo” na Flipie (lista do przeglądu native speakerów w raporcie
  agenta — `docs/DECISIONS.md` D-155), D-157..D-159 (odczyt layoutu na początku klatki, bramkowanie HUD, klucze
  WAGON_DUE), raport „pierwsze 10 minut e” (`docs/research/2026-11-05-first-10-minutes-e.md`).
- Decyzje właściciela ~17:40: **misja VIII przeprojektowana tutaj** (deweloper `claude/w-m8-redesign`, kryterium: same
  wozy ≤ 2★, bruk + 1 wóz 3★ z zapasem ≥ 20 s); potem **posterunek handlowy doliny** wg `docs/specs/2026-11-04-valley-trade-post.md`.
  Inne sesje dla tych zadań nieaktualne.
- W toku: drugi agent `claude/w-day9h` — poprawki run e: N7 (tytuł nadwyżki), N8 (zamek bez naprawy), N6 (dok zasłania
  ogniwo), V2 (karta rangi wraca w dolinie; cel ranga 1 < 8 min).

## Dzień 2026-11-05 (po południu)
- Scalone: D-151 list otwierający dolinę + kamera na zamku, D-152 karta rangi w dolinie, D-153 bramkowanie HUD
  (−40…75 % `Hud.update`), D-154 zero przebudów programów na render (−22 % alokacji renderu), paczki 9e (audyt UI
  1–8: D-137..D-139, D-142..D-145) i 9f (D-146..D-149: korzeń łańcucha nad dokiem, krótsze zdania tempa, okrągły
  fokus, test karty rangi), raporty: przebudowy programów, „więcej wozów = wolniej”.
- **Dyspozytor 2** (`claude/w-dispatch2`, NIE scalony): reguły C+A zmniejszają szkodę dokupionego wozu (straty
  pieczęci 28 → 4 / 195 prób), ale psują drabiny lekcji botów VIII, X, XII, XIII. Właściciel: nowa runda badawcza
  (`claude/research-dispatch2b`, researcher w toku) — szukamy wersji, która trzyma lekcje.
- W toku: deweloper `claude/x-i18n-day9` — tłumaczenia PENDING_KEYS na 15 języków (decyzja właściciela: robimy tu,
  nie w innej sesji) + linia „tempo” pod pieczęcią na Flipie (D-155).
- Właściciel do zrobienia: usunąć `/mono-before.txt`, `/bot-before.txt`, `/bots-before.txt` (artefakt agenta,
  usuwanie zablokowane przez filtr); APK — odblokować `dl.google.com` w sieci środowiska.

## Dzień 2026-11-05 (przed południem)
- Scalone: D-140 (wskazówka wozu w dolinie), D-141 (kolejka wozów liczona raz na zmianę, 0 px różnicy), D-150 (cień co
  2. klatkę na low/high — decyzja właściciela A; ultra bez zmian), raporty: koszt klatki dzień 9
  (`docs/research/2026-11-05-frame-cost-day9.md`), pass cienia (`docs/research/2026-11-05-shadow-pass.md`).
- W toku: deweloper `claude/w-day9e` (poprawki audytu UI; przenumerowuje swoje D-140/141 → D-142+), researcher
  `claude/research-day9f` (pozostałe przebudowy programów: głębia cienia, trawa).
- Następne: paczka doliny dla dewelopera (karta rangi, list otwierający, kamera na zamku — decyzje 09:50), potem
  frame-cost #3 (wymuszony layout co 250 ms, HTML listu przewozowego co klatkę).
- Numeracja decyzji: koordynator używa od D-150 w górę, deweloper D-142..D-149 (kolizje w nocy).

## Decyzje właściciela 2026-11-05 ~09:50
- D-128 zostaje wąsko (bez ogólnej reguły, bez zmiany dyspozytora).
- Dolina: **„Kup wóz” przy długim czekaniu na odbiór — tak** (karta floty bez kontraktu, rezerwa ~40 srebra);
  **karta rangi** w spokojnym miejscu karty („brakuje towaru — postaw …”) zamiast obniżania progu; **list otwierający
  doliny + kamera startowa na zamku** w pionie. Robi koordynator (`claude/focused-carson-c3s2ff`).
- Duch bruku (D-132/D-134) — wygląd OK. Kamera raz kadruje odcinek ducha poza ekranem / pod arkuszem — tak (w paczce
  9e dewelopera).
- Paczka 9d scalona (D-136: zamek 915x412 de/pseudo, karta zdarzeń doliny w poziomie, prewarm przełączenia jakości);
  audyt UI dni 8c–9 (`docs/research/2026-11-05-ui-audit-day9.md`) → paczka 9e (fokus na `.cf`, krótki poziom, Flip,
  list porażki, piny pod HUD, kadrowanie ducha).

## Decyzje na rano
0. **Stan po nocy (03:30):** scalone **D-127..D-130** (paczka 9a): karta floty na karcie tempa („wszystkie wozy w
   trasie — kup wóz”), karta błota z niemożliwym brukiem ustępuje karcie floty, samouczek po zakończeniu zamyka
   arkusze (N1), list porażki ma jedną linię czynności dla straty nr 1 (N3). Rozsądny gracz: **XI 60 s 1★ → 2★,
   IV 60 s 2★ → 3★, II oko+ 10 s 2★ → 3★**, żadna misja nie traci pieczęci. I przy 60 s zostaje 1★ — po 5:00 żaden
   wóz już nie pomaga (most jednopasmowy się korkuje). Testy 467/0.
0b. **Paczka 9b scalona (04:40):** D-131 „Sprzedaj za 15” czytelne jako wyłączone (6,6:1, powód pod spodem),
   D-129 w osobnym module z testem, **D-132 odcinek błota do brukowania ma własnego ducha — jasną kostkę**
   (`docs/shots/day9b-m3-mud*.jpg`; obejrzyj — jeśli za jasny, przyciemnimy). Testy 470/0. Layout-check: limit
   ładowania 90 s (30 s dawało fałszywe timeouty przy pracy agentów).
0c. **Render #5 wdrożony (D-133, 06:00):** lustrzane materiały InstancedMesh — piksele identyczne (0 różnic
   dzień i zimowa noc), przebudowy parametrów 10 → 6 na klatkę. Bez decyzji (obraz bez zmian).
0d. **Prompt dla innej sesji Claude (tłumaczenia 66 kluczy PENDING_KEYS na 15 języków):**
   `docs/orders/claude-session-07-i18n.md`, gałąź `claude/x-i18n-day9`.
0f. **Paczka 9c scalona (08:30, main a385075):** D-134 duch bruku na drewnianym przęśle („Wyłóż most kamieniem”),
   D-135 poprawka wejścia arkuszy + narzędzia (N5 był artefaktem pomiaru). Pomiar „pierwsze 10 minut” d: misja I w
   pionie **wygrana** (run c przegrał o 2 chleby), „Kup wóz” przy każdym braku wozu. Pieczęci bez zmian. Testy 473/0.
   Pytanie: kamera ma jeden raz podjechać do ducha bruku/błota poza ekranem (jak D-107)?
   W toku: deweloper `claude/w-day9d` (zamek 915x412 de/pseudo, „Odłóż” pod pieczęcią w dolinie, prewarm low→high);
   researcher `claude/research-day9c` (audyt UI dni 8c–9 na Fold/Flip/RTL).
0e. **Wolna dolina — pierwsze 30 minut (research `docs/research/2026-11-05-sandbox-first-30.md`):** karta zastoju
   w dolinie > 99 % czasu pusta lub spokojna; gracz „tylko karta” ma rangę 1 po 14–17 min (cel 7–10), rangę 2 rzadko
   (cel 18–22); 600–1000 niewydanego srebra. Naprawione od razu: ostrzeżenie o deszczu nie radzi bruku, gdy bruk
   zablokowany. **Pytania:** (a) wskazówka „Kup wóz” przy długim czekaniu na odbiór w dolinie (bez pieczęci —
   prototyp: ranga 1 po 11,3 min, +27 % srebra)? (b) próg rangi 2 1000 → ~800 sławy albo karta rangi z drugim
   łańcuchem? (c) krótki list otwierający dolinę + kamera startowa na zamku w pionie?
1. **„Czekanie na odbiór” (WAITING_PICKUP) z czynnością? — D-128 wdrożone wąsko.** Reguła ogólna („Kup wóz” przy
   każdym czekaniu ≥ 30 s, gdy wszystkie wozy zajęte) kosztowała pieczęcie: jako sama naprawa w arkuszu −7 wierszy
   (VI, VIII, XII skan, X 30 s), z wyjęciem ze spokojnych pinezek −21 (np. IV 2→1★, VIII 3→2★). Wdrożono ją więc
   tylko pod warunkami karty floty (łańcuch wąskiego gardła, flota w trasie ≥ 90 % ostatniej minuty, następna
   pieczęć ≥ 3:30 dalej, stać na wóz). Skutek: w oknie samouczka misji I (2:00–5:00) nadal brak wskazówki wozu.
   Opcje: (a) zostawić tak (rekomendacja), (b) przyjąć straty pieczęci, (c) wyjątek tylko dla misji samouczka
   (dziś zakazane — brak `mission.id` w regułach), (d) zmiana dyspozytora w sim (zmienia hasze). Też potwierdzić
   D-129, D-130 („decided by coordinator”). Nowe teksty `cause.paceFleet`, `fix.paceFleet*`, `end.act.*` tylko pl/en.
   Pierwotny opis pytania: Research c: w misji I to strata czasu nr 1 na liście
   końcowym (4–5 min), arkusz nie daje naprawy; portret przegrał I o 2 chleby przez brak jednego wozu. Koordynator
   zlecił (do potwierdzenia): długie czekanie (≥ ~30 s lub pełny magazyn) przy zajętych wszystkich wozach i stać
   na wóz → „Kup wóz” z czasem dojazdu; inaczej zostaje spokojne. Alternatywa: zostawić spokojne (czysta lekcja
   „samo przejdzie”).
2. Render #5 — po raporcie researchera (wdrożyć / nie / z zabezpieczeniem).
3. APK — odblokowanie `dl.google.com` w ustawieniach sieci środowiska.
4. Drobne z audytu a11y do decyzji później: „Sprzedaj za 15” na karcie wozu ma kontrast ~2:1 (wygląda na wyłączony);
   przełącznik „Ogranicz ruch” w Ustawieniach — dopiero po sprawdzeniu na telefonie, czy Android WebView przekazuje
   „Usuń animacje” jako `prefers-reduced-motion`.

# Handover — MARCHIA (stan 2026-11-04 ~19:00 Europe/Brussels) — PRZEJĘCIE PRZEZ NOWĄ SESJĘ

> Sesja `session_01Hk8EbiYMw1x9CXhyu3HM9n` kończy (limit tygodniowy). Starsze sekcje niżej = historia (czytaj od
> „Stan dnia 8”/„Decyzje właściciela 2026-11-04” po kontekst). Prompt startowy: `marchi.md` w katalogu głównym.

## Stan teraz
- Repo `woogitsugames/marchi`. Baza integracyjna **`claude/eager-cori-08wt8e`**; **`main` przesuwany fast-forward
  na bazę po każdym zielonym scaleniu** (typecheck, test, build, smoke, layout --quick) — decyzja właściciela 11-03.
- Baza: testy **457/0**, typecheck/build zielone, smoke I–XIII + dolina bez błędów konsoli. `main` = `e36726c`
  (ostatnio zweryfikowany layoutem); baza nowsza: day8c (karty VII/III/IV), audyt a11y, render #4 (częściowy).
  **layout --quick na bazie po day8c:** 3 błędy to wyłącznie `page.goto: Timeout` przy obciążeniu (settings/why);
  powtórz przy spokojnej maszynie (`npm run layout -- --quick`, ew. `--only 'settings|why'`), potem `git push origin <sha>:main`.
- Uwaga: osobny przebieg layoutu `--only 'settings|why'` przy pracującym agencie też dał 3/12 timeoutów — przy
  spokojnej maszynie sprawdź, czy to nie regresja wczytywania (day8c: karta tempa liczy prognozę), zanim przesuniesz main.
- Ostatnie APK: **e36726c** (~17:00). Następne: gdy istotnie lepsze, w dzień co ~3 h (7–23 Brussels), w nocy nic.
- Stan symulacji **v8**. Następna wolna decyzja: **D-118** (inna sesja mogła wziąć D-111/112 — sprawdź DECISIONS.md).
- Godzinny cykl tej sesji `trig_01TCkYqpaE2pikhXkeMNAEq9` **wyłączony** — nowa sesja tworzy własny (prompt niżej).

## Niedokończone (dokończ najpierw)
1. **Deweloper a11y (gałąź `claude/w-day8d`, wypchnięta, NIE scalona)** — poprawki 1–4 gotowe (D-118 listy jako modale
   z `inert`, arkusze bez `aria-modal`; D-119 skróty nie łapią Spacji z kontrolek + przełącznik „Skróty klawiszowe”;
   D-120 dok „Naprawa” przy dużym tekście). Ostatni commit `dc13601` = **WIP 5–7** (pinezki z nazwą i kształtem
   pieczęci, reduced motion `src/render/motion.ts`; CSS czeka w `tools/wip-day8d/fix5-7.py`). Zrób: zastosuj skrypty,
   zrzuty pinezek dzień/noc/zima, rozbij WIP, D-121..D-123, pełny audyt po, `npm test` (ostatni 457/0 sprzed fix 4),
   usuń `tools/wip-day8d/`, scal. Pytania do właściciela: skróty domyślnie wł. z myszą / wył. na dotyku (D-119)?
   przy 200 % tekstu arkusz w poziomie zasłania żetony i tempo (D-120) — OK? czerwona pinezka jako zębata pieczęć — OK?
2. **Render #4 (cienie wozów mid / dalekich ładunków)** — `docs/research/2026-11-04-render4-shadows.md` (częściowy),
   łatka `...-render4-shadows.patch`, narzędzia `tools/render4-*.{mjs,py}`. Brakuje par zrzutów low/ultra, 80/110 m,
   poziom. Właściciel chce **zobaczyć zrzuty przed decyzją** (rekomendacja: B — tylko low+high, dalekie ładunki
   wszędzie bez cienia). Zrób zrzuty, pokaż (SendUserFile), zapytaj klikalnie.
3. **Decyzje właściciela do wdrożenia (11-04 ~18:00):** M7 — duch rybaka startuje przy **najbliższym brzegu**, nie na
   autorskim miejscu (karta tempa zostaje); M3 — linia „błoto… bruk przyspieszy o N %” **tylko gdy pieczęć zagrożona**;
   M4 — 2★ dla wolnej reakcji OK (bez zmian).
4. **Inne sesje Claude (PR do bazy):** `claude/x-trade-post` (późna gra doliny wg `docs/specs/2026-11-04-valley-trade-post.md`,
   zapis v9) i `claude/x-m8-redesign` (przeprojektowanie misji VIII) — prompty dano właścicielowi; sprawdź, czy są
   gałęzie/PR, przejrzyj, scal, raport przyjęto/poprawiono/odrzucono. Nie dubluj tej pracy.
5. GPT: brak nowych `gpt/*` (65/hindi scalone 11-03).

## Zasady pracy (właściciel)
- Rozmowa po polsku; kod/komentarze/commity po angielsku; `CLAUDE.md` najpierw.
- **Do 2 agentów Opus naraz** (deweloper w worktree `/workspace/marchi-saves`, researcher w `/workspace/marchi-research`;
  ręczne worktree: `git worktree add -B <gałąź> /workspace/marchi-<x> claude/eager-cori-08wt8e` +
  `ln -s /workspace/marchi/node_modules …/node_modules`); koordynator też koduje. Ciągle zlecaj pracę.
- Agenci commitują często (kontener bywa restartowany), nie pushują; koordynator scala, sprawdza, pushuje bazę i `main`.
- **CI ma limit minut** — nie dodawać kroków, nie zmieniać workflowów; sprawdzać lokalnie.
- Smoke: `vite preview --port 5193` uruchom jako proces w tle z długim timeoutem; skrypt smoke = Playwright: menu +
  `?play=m1…m13|sandbox&quality=low&dynres=0&speed=4`, 0 błędów konsoli (odtwórz, jeśli nie ma `/tmp/claude-0/smoke.cjs`).
- APK: `npm run setup:android` raz w kontenerze, `npm run apk -- --skip-web` (Maven 429 → ponów), SendUserFile.
- Decyzje: w dzień klikalnie (AskUserQuestion) z rekomendacją; w nocy do „Decyzje na rano”.
- Prace dla innych sesji Claude Code (inne konto): napisz właścicielowi prompt startowy (gałąź `claude/x-…`, PR do bazy).
- Nie zamykać PR-ów bez prośby. Commity kończyć `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + `Claude-Session: <link>`.
- **Aktualizuj ten plik na bieżąco i pushuj** (właściciel czyta go z GitHuba).
- Przy ostrzeżeniu o limicie: zatrzymaj agentów (WIP commit), budzik `send_later` minutę po resecie.

## Prompt cyklu (create_trigger, „42 * * * *”)
Godzinny cykl MARCHIA (praca ciągła, autonomiczna; do 2 agentów Opus naraz: deweloper w /workspace/marchi-saves i
researcher w /workspace/marchi-research; koordynator też rozwija). Repo /workspace/marchi, baza
claude/eager-cori-08wt8e; po każdym zielonym scaleniu (typecheck, test, build, smoke, layout --quick) push bazy i
fast-forward main. 1) Deweloper skończył/przerwany — scal, sprawdź, push, main; od razu kolejna paczka (HANDOVER
„Niedokończone”, potem backlog: błędy > czytelność < 30 s > wydajność > grafika > treść). 2) Researcher skończył —
scal raport, wnioski do backlogu/decyzji, nowy wąski temat. 3) gpt/* i claude/x-* — przejrzyj, scal, raport.
4) APK w dzień co ~3 h, w nocy nic, jedno rano. 5) Decyzje: dzień klikalnie, noc do HANDOVER. HANDOVER aktualny na GitHubie.

## Kolejka po „Niedokończonych” (backlog, kolejność)
- Tłumaczenia kluczy PENDING_KEYS z dni 5–8 (paczka GPT/innej sesji; listy w BACKLOG P4).
- Powtórzyć pomiar pierwszych 10 minut (`tools/first10-minutes.mjs`, osobno 915x412 i 412x915).
- Render #5 (osobne materiały InstancedMesh) ze zrzutami low/high/ultra.
- Playtest wg `docs/playtest/PROTOCOL.md` (właściciel) — potem progi M2 2★, H1–H5.
- Misja XIII: tytuły w 15 językach, przegląd listów przez native speakerów.

---

# Handover — MARCHIA (stan 2026-11-03, ~15:00 Europe/Brussels) — PRZEJĘCIE PRZEZ NOWĄ SESJĘ

> Sesja `session_01QWRid6hScCk3PSEu7RfFHs` kończy pracę (limit tygodniowy). Poniżej: stan, zasady, otwarte sprawy.
> Starsze sekcje niżej to historia dnia 2–3 XI (decyzje i stany nocy/dnia) — czytaj je jako kontekst.

## Stan teraz
- Repo `woogitsugames/marchi`, baza **`claude/eager-cori-08wt8e`** (nigdy `main`). Wszystko wypchnięte; drzewo czyste.
  Testy **412/412**, typecheck i build zielone, smoke I–XII + dolina bez błędów konsoli. Stan symulacji **v8**.
- Ostatnie APK: **e29f7f0** (~21:30, diagnoza day5 + samouczek/dolina day6). Kolejne: jedno rano.
  strzałka samouczka, Flex/Book posture, ostrzeżenia transz, beczki na wozie).
- **Zrobione (sesja `session_01Hk8EbiYMw1x9CXhyu3HM9n`):** WIP `1630083` z `claude/w-day3` dokończony i scalony —
  zwinięte „Co to znaczy?” (Księga przestojów, `src/ui/codex.ts`) w karcie budynku i wozu, dla przyczyny u korzenia
  łańcucha; inne języki czytają wpis EN (lang/dir=ltr, szewron fizyczny, `dir=auto` w RTL). Plus tempo dostawcy
  „4,9/min” obok towaru w poziomym liście. Nowy cykl: `trig_01TCkYqpaE2pikhXkeMNAEq9`. Właściciel: do **2 agentów Opus**
  naraz, jeden stale od researchu.
- Decyzje: ostatnia **D-79** w docs/DECISIONS.md (sprawdź, czy day3 dodał nowsze); następna wolna — sprawdź plik.
- GPT: oddane i scalone do 64; **czeka 65** (hindi, `docs/orders/gpt6-11b/`). 61 (grafiki sklepu) — właściciel: „zrobi kto
  inny, zapomnij”.
- Gałęzie do usunięcia: lista i polecenie w `docs/branches-audit-2026-11-02.md` — **z sesji Claude usuwanie jest
  zablokowane (proxy 403)**, robi właściciel.

## Zasady pracy (właściciel)
- Rozmowa po polsku; kod/komentarze/commity po angielsku; zasady `CLAUDE.md`.
- **Praca ciągła i autonomiczna z JEDNYM agentem Opus naraz** (koordynator też może kodować). Agent w worktree
  `/workspace/marchi-saves` (ręczny worktree + symlink `node_modules`), gałąź `claude/w-*`; koordynator scala do bazy,
  `npm run typecheck`, `npm test`, `npm run build`, smoke (skrypt Playwright: menu + `?play=m1…m12|sandbox&quality=low&dynres=0&speed=4`,
  0 błędów konsoli), `npm run layout -- --quick` (84 zadania, ~3,5 min), push.
- **CI ma limit minut**: `ci.yml` tylko ręcznie i przy otwarciu PR — nie dodawać kroków, nie zmieniać workflowów,
  sprawdzać lokalnie; agenci pushują rzadko (paczkami) i scalają bazę przed pushem.
- APK: w dzień (7–23) nie częściej niż co ~3 h, gdy istotnie lepsze; w nocy nic, jedno rano. `npm run setup:android`
  raz w kontenerze, `npm run apk -- --skip-web` (Maven 429 → ponawiać), SendUserFile.
- Decyzje właściciela: klikalnie (AskUserQuestion) z rekomendacją; w nocy zapisywać do „Decyzje na rano”.
- Nie zamykać PR-ów bez prośby. Commity kończyć `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` +
  `Claude-Session: <link nowej sesji>`.
- Limit 5-godzinny: przy ostrzeżeniu zatrzymaj agenta, zapisz WIP, wznów po resecie.
- Triggery: utwórz w nowej sesji godzinny cykl (min. odstęp 1 h) z promptem z sekcji „Prompt cyklu” niżej; stary cykl
  `trig_01SUuiU1pXy1yo2Wj2sfPrJx` jest **wyłączony**.

## Prompt cyklu (do create_trigger, „42 * * * *”)
Godzinny cykl MARCHIA (praca ciągła, jeden agent Opus naraz; koordynator też rozwija). Repo /workspace/marchi, baza
claude/eager-cori-08wt8e (nigdy main). 1) Agent w /workspace/marchi-saves: jeśli skończył/przerwany — scal (konflikty
BACKLOG/DECISIONS/i18n PENDING_KEYS: obie strony), typecheck, test, build, smoke, layout --quick, push; uruchom
następnego z kolejnymi pozycjami (HANDOVER „Plan”, potem backlog: błędy > wydajność > czytelność > modele/animacje >
treść). Jeśli pracuje — tylko sprawdzenie. 2) Nowe gpt/* — przejrzyj, scal, raport przyjęto/poprawiono/odrzucono.
3) APK w dzień co ~3 h, w nocy nic. 4) Decyzje: w dzień klikalnie, w nocy do HANDOVER. Raport krótki po polsku.

## Kolejka na start
00. **Z researchu „pierwsze 10 minut” (częściowy, `docs/research/2026-11-03-first-10-minutes.md`)** — po paczce day5:
   (1) sprawdzić, czy samouczek m1 krok 5 (most) się nie zacina — notatka zostaje z tekstem kroku 4, przeciągnięcia
   po duchu nie budują mostu (może artefakt skryptu/SwiftShader; jeśli prawdziwe — P0); (2) notatka samouczka zasłania
   list przewozowy (`placeNote`); (3) karta „Najgorszy zastój” z alarmem w trakcie samouczka (kroki 4–5); (4) brak
   „Następna misja” w liście końcowym (`buildEndLetter`); (5) menu na zimno: nic nie wskazuje misji I, „Ustawienia”
   pod ekranem 412×915; (6) karta zamku gęsta w kroku 2. Poziom i reszta ścieżki — nie zmierzone, ponowić.
0. **Decyzja właściciela 2026-11-03 ~18:00 (research partial-loads): A — reguła „dowóz dopiero, gdy zmieści się ≥4”
   tylko w wolnej dolinie**; misje i ich hasze bez zmian; przestroić progi rang 3–4 (~+10 %) i test F1, jedno zdanie
   na karcie warsztatu („czeka na pełniejszy wóz”). Spec: `docs/research/2026-11-03-partial-loads.md`. Następna paczka
   dewelopera po poprawkach audytu diagnozy (`claude/w-day5`).
1. Dokończ WIP `claude/w-day3` (Księga przestojów „Co to znaczy?”), scal, APK.
2. Scal GPT 65 (hindi) gdy przyjdzie; zdejmij przetłumaczone klucze z PENDING_KEYS (`npx tsx tools/i18n-reorder.ts`).
3. Czekają na właściciela: ocena postaci przy pracy (decyzja: dodać kolejnych po jego ocenie), benchmark Fold
   (`?debug=1&bench=device`, `?diag=1` → JSON do docs/PERF.md), motyw muzyczny końca kontraktu (Suno — właściciel).
4. Po playteście: łańcuch misji X do producenta, strojenie nagród zdarzeń doliny, okno prognozy tempa.
5. Dalej backlog (docs/BACKLOG.md).

---

Nowa sesja przejmuje autonomiczny rozwój gry od poprzedniej (kończy się jej limit). Rozmawiaj z właścicielem
**po polsku**; kod/komentarze/commity po angielsku. Zasady: `CLAUDE.md` (najpierw!). Decyzje: `docs/DECISIONS.md` (D-01…D-35).

## Repo i gałęzie
- Repo `woogitsugames/marchi`, gałąź robocza i bazowa: **`claude/eager-cori-08wt8e`** (nigdy `main`; PR tylko na prośbę).
- Ostatni commit: `214966d` (wszystko wypchnięte, drzewo czyste). Stan symulacji **v6**, 10 towarów, rangi 0–5,
  misje I–IX w menu, Wolna dolina (sandbox, 3 sloty „Księgi osad”) z porami roku.
- Commity kończ: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + `Claude-Session: <link Twojej sesji>`.
  Bez identyfikatorów modelu w commitach/PR. Komentarze GitHub tylko na prośbę, ze stopką atrybucji.
- **Nie zamykaj PR-ów na GitHubie bez prośby właściciela.** Integracja = scalenie lokalne do bazy + push.

## Rytm pracy (ustalony przez właściciela)
- Praca autonomiczna, ciągła. Poprzedni godzinny cykl (stare konto) jest **wyłączony**, przypomnienie o APK usunięte.
  Utwórz własny godzinny trigger dla swojej sesji (create_trigger) — prompt cyklu: sekcja „Prompt cyklu” na końcu pliku.
- Maks. **3 agentów Opus** naraz + osobno researcher Sonnet (wąskie tematy, raport do `docs/research/`).
  Agentów uruchamiaj w ręcznych worktree: `git worktree add -B <gałąź> /workspace/marchi-<x> HEAD` +
  `ln -s /workspace/marchi/node_modules …` (izolacja `worktree` w Agent nie działa — /workspace nie jest repo).
  Agenci pushują swoje gałęzie, Ty scalasz do bazy (konflikty zwykle w `src/i18n/pl.ts`/`en.ts` PENDING_KEYS — zachowaj obie strony).
- Decyzje właściciela — **klikalnie** (AskUserQuestion) z rekomendacją; nie blokuj się.
- **APK**: w dzień (7–23 Brussels) gdy wersja istotnie lepsza, nie częściej niż co ~3 h; w nocy nic, jedno rano.
  Przed wysłaniem: `npm run typecheck`, `npm test` (SUMMARY failed=0), `npm run build`, smoke test w przeglądarce
  (skrypt `/tmp/claude-0/smoke2.cjs` jeśli przetrwał; inaczej: vite preview na porcie 5193, `?play=mN&quality=low&dynres=0&speed=4`
  dla m1–m9 + sandbox, 0 błędów konsoli). Budowa: `npm run setup:android` (raz w nowym kontenerze), `npm run apk -- --skip-web`
  → `dist-apk/marchia-debug-<sha>.apk` (~48 MB), wyślij SendUserFile. Ostatnie APK: **d58ef72** (11:28 Brussels).
  **Następne APK do wysłania ~14:30 Brussels** — zmiany od d58ef72: rozbiórka z potwierdzeniem w misjach, narzędzie
  budowy zostaje otwarte, skrócone podtytuły VII/VIII, czytelność pór roku (D-34), odstęp wozów w obrazie (D-35),
  UI/render nowych łańcuchów (PR #49: CONTESTED „idzie do”, koszt kamienia, nakładki skał/wody, dym, wariant zamku).
  Poproś właściciela o ocenę kreskowania terenu na telefonie.
- Uwaga: `pkill -f` z wzorcem pasującym do własnej komendy zabija powłokę — zabijaj po PID.

## Współpracownicy
- **GPT-6** (właściciel przekazuje zip-y, GPT pushuje gałęzie `gpt/*` i PR-y). Paczka **07** zlecona (zlecenia 48–54:
  i18n 06, misje X–XII, pliki 13 dźwięków CC0, Kronika doliny, balans sandboxa z porami roku, testy odporności,
  Księga towarów) — `docs/orders/gpt6-07/`. Z paczki 06 nieoddane: 44 (zdarzenia w dolinie), 47 (playtest v2).
  Przegląd: tylko dozwolone ścieżki, bez workflowów pushujących, bez `mission.id === …` w sim, bez wpisów w sounds.ts
  bez plików; wzór raportu: `docs/reviews/gpt-integration-2.md`. Po scaleniu tłumaczeń usuń przetłumaczone klucze z `PENDING_KEYS`.
- **Druga sesja Claude Code** (właściciel przekazuje prompty z `docs/orders/claude-session-NN.md`). Zlecenie **05**
  (układ RTL dla arabskiego, gałąź `claude/s5-rtl`) — przekazane przez właściciela teraz. PR-y #48/#49 tej sesji już scalone.

## Otwarte (kolejność wg backlogu: błędy > Fold/wydajność > czytelność < 30 s > grafika > treść)
- `docs/BACKLOG.md` — po audycie 53 pozycji przeniesiono do „Zrobione”. Otwarte m.in.: P0 do weryfikacji — błąd
  shadera wody (sprawdzić przy quality=high/ultra); restart/nadpisanie kontraktu bez potwierdzenia;  budżet przeplanowań; `{n, plural}` w pl/en; koszt drogi dojazdowej w etykiecie budowy.
- `docs/research/2026-11-02-seasons-m7-9.md`: F3 (m9 — CONTESTED widoczny tylko 34 s) i F10 (m7 — brak sygnału
  niedoboru przepustowości; propozycja: tempo dostaw + prognoza „przy tym tempie spóźnisz się” na liście przewozowym
  i karcie zamku, bez nowego StallReason) — do zrobienia; druga połowa F5 (piekarnia „dostawca produkuje”, gdy młyn
  czeka) wymaga zmiany statusów w sim → zmienia hashe misji, decyzja.
- D-34: podwójne liczenie zamkniętego mostu w liście końcowym misji kontraktowych — poprawka zmieni złote hashe
  (m2, m4, m8); ewentualnie zapytać właściciela.
- 24+ nowych kluczy i18n w `PENDING_KEYS` (czekają na GPT 48).
- Hosting pakietu 4K odłożony (D-21: „na razie nigdzie”). Gra darmowa, bez reklam (D-29).

## Decyzje właściciela z dziś
3 sloty doliny; bez reklam na razie; rangi Gród/Stolica; pory roku łagodnie (tylko dolina); nazwa „Marchia” wszędzie;
odstęp wozów zostaje tylko w obrazie (D-35); druga sesja → RTL arabski.

## Prompt cyklu (do create_trigger, co godzinę)
Godzinny cykl autonomicznego rozwoju MARCHIA (właściciel zlecił ciągłą pracę; ten cykl wznawia sesję także po limicie/restarcie). Limit: najwyżej 3 agentów Opus naraz (researcher Sonnet osobno). Kontynuuj:
1. Zbierz wyniki agentów (przerwanych — wznów; zakończonych: przejrzyj zrzuty, zintegruj, `npm test`, `npm run typecheck`, `npm run build`, commit + push na claude/eager-cori-08wt8e).
2. PR-y GPT i drugiej sesji Claude (claude/s*-*, gpt/*): przejrzyj, scal lokalnie, testy, popraw drobiazgi, odrzuć szkodliwe elementy, wypchnij; raport: przyjęto / poprawiono / odrzucono. Nie zamykaj PR-ów bez prośby właściciela.
3. docs/BACKLOG.md: 1–3 najważniejsze pozycje (błędy > wydajność/Fold > czytelność przyczyn < 30 s > grafika > treść); kolejność wg D-17, D-21, D-29. Realizuj sam albo przez agentów, aktualizuj backlog.
4. Jeśli researcher Sonnet nie pracuje, uruchom go z nowym, wąskim tematem.
5. APK: w dzień (7:00–23:00 Europe/Brussels) gdy jest istotnie lepsza wersja, nie częściej niż co ~3 h (typecheck, testy, smoke test bez błędów konsoli). W nocy nie — jedno APK rano.
6. Krótki raport po polsku. Decyzje właściciela — klikalnie (AskUserQuestion) z rekomendacją. Zasady z CLAUDE.md.

## Stan 2026-11-02 ~15:20 (sesja session_01QWRid6hScCk3PSEu7RfFHs)
- Godzinny cykl: trigger `trig_01SUuiU1pXy1yo2Wj2sfPrJx` (:42 UTC) przypięty do tej sesji.
- Scalone dziś: paczka GPT 07 (48–54, raport `docs/reviews/gpt-integration-3.md`) i 57 (tłumaczenia); sloty zapisu
  na misję (D-36); RTL arabski (D-37, szyna zależy tylko od ręki); prognoza tempa i „drewno bierze też” (D-38);
  misje X–XII w menu (D-39); poprawka dyspozytora (hasze bez zmian); łąka bez powtórzeń kafla.
- Ostatnie APK: **9618287** (14:05 Brussels). Następne najwcześniej ~17:00.
- W toku (agenci w worktree): `claude/w-models` (koń/wóz/ludzie + krok konia od dystansu — właściciel: „koń biegnie
  szybciej niż nogi”), `claude/w-trees` (drzewa wg `docs/research/2026-11-02-trees.md`).
- HUD: właściciel odrzucił CSS-owe wersje jako „AI slop”; układ **D** (góra z A, dół z B, klasycznie —
  `claude/hud-mockups`, `docs/mockups/hud/v2/D-*.jpg`) akceptowany co do układu. Grafiki: zlecenie GPT **55**
  (paczka 08, `docs/orders/gpt6-08/`) — ręcznie malowany kit UI; wdrożenie dopiero po akceptacji właściciela.
- GPT paczka 08 wysłana: 55 kit UI, 56 dźwięki (powtórka 50), 57 tłumaczenia (oddane, scalone).

## Stan 2026-11-02 ~19:00
- Baza `d1c1d84`: + nowy HUD v3 (D-43, kit GPT 55/55b), kamera nad arkuszem i wozy przy stajni (D-45), sim D-44
  (most raz, F5, numery floty — STATE_VERSION 7), dźwięki 56 + miks, drzewa (D-41), koń (D-40), sesja 06 (D-46…D-52).
- Ostatnie APK: **2bae80f** (17:2x Brussels) — jeszcze bez nowego HUD. Następne: po szlifie HUD (`claude/hud-polish`)
  i akceptacji właściciela; w nocy nic, rano jedno.
- Właściciel: HUD — „najpierw poprawki” (szczegółów nie podał; robimy: mniejszy panel w poziomie, jaśniejsze paski,
  ikona oka, styl przycisków w arkuszach/listach). Kolejne decyzje numeruj od **D-53**.
- Do tłumaczenia (PENDING_KEYS): menu X–XII, tempo D-38, HUD v3, F5, listy/dead-end sesji 06 → paczka GPT 09.

## Stan 2026-11-02 ~21:00 (limit użycia prawie wyczerpany)
- Baza `0007f5a`. Ostatnie APK: **8b59953** (20:30) — nowy HUD po szlifie, shadery pre-warm. W nocy bez APK, rano jedno.
- W toku (WIP pushowany na bieżąco): `claude/w-events` — integracja zdarzeń doliny (zgoda właściciela, D-54,
  STATE_VERSION 8, karta w HUD); `claude/w-hudp3` — cache rankStalls + boczny arkusz w poziomie (D-55 jeśli reguła).
  Po wznowieniu: sprawdź obie gałęzie, scal (konflikty zwykle BACKLOG/DECISIONS/i18n PENDING_KEYS), testy, smoke I–XII.
- GPT: oddane 44/47/57/58/59/55/56; czeka 60 (korekta PL, paczka 09R) i paczka 10 (61 grafiki sklepu, 62 opisy).
- Następne decyzje od **D-56**.

## Stan 2026-11-02 ~22:50
- Baza po scaleniu zdarzeń doliny (D-54, STATE_VERSION 8) i HUD P3 (D-55). Testy 374/374, smoke I–XII OK.
- GPT: 62 przyjęte; 61 bez grafik (przyjęty tylko skrypt `tools/store-shots-v2.mjs`, workflow z pushem odrzucony) —
  rano wygenerować zrzuty sklepu tym skryptem; 60 (korekta PL) nadal czeka.
- Rano: jedno APK (od 8b59953: zdarzenia doliny, HUD P3, opisy sklepu), zrzuty sklepu, P2 karta wieści zwinięta.
- Następne decyzje od **D-56**.

## Plan nocy 2026-11-02/03 (właściciel śpi; jeden agent Opus naraz, ciągle)
Decyzje właściciela 23:55: benchmark na telefon — TAK jako ukryta strona `?debug=1`; zrzuty do sklepu — NIE (zrobi kto inny,
zapomnieć); `task/20-store-graphics` i `claude/hud-mockups` do usunięcia (polecenie w docs/branches-audit-2026-11-02.md);
praca nocna: „wszystko po kolei, w sposób ciągły: poprawki, błędy, ulepszanie modeli, treści”.
Kolejka (agent bierze po kolei, każda pozycja osobnym commitem; koordynator scala po każdym agencie):
1. Integracja `gpt/device-bench-22` jako ukryta strona benchmarku (`?debug=1`), bez wpływu na build gracza.
2. Błędy P0/P2 z docs/BACKLOG.md (otwarte pozycje), m.in. zgłoszenia z audytów (fold, save, audio).
3. Wydajność P1: audyt alokacji pod GC (frame-cost research pkt 5), dispatcher/DistMap.
4. Czytelność < 30 s: pozostałe P2 z backlogu (np. bąbelki klas przestojów, toasty „brak N srebra”).
5. Modele/animacje: budynki (detal, ludzie przy pracy: drwal, młynarz, piekarz — pętle animacji), drzewa impostor
   wielowidokowy (P3 z D-41), woda/most detale.
6. Treść: zdarzenia doliny — dodatkowe warianty, kronika doliny (gpt/51 proposal) podpięta do UI.
## Decyzje na rano
(dopisuj tu w nocy)
1. **Kronika doliny — gdzie trzymać zapisane wpisy (D-57).** Teraz: localStorage per księga (bez zmiany sim i zapisu).
   Opcje: (a) zostawić; (b) pole w kopercie zapisu (`chronicle: string[]`, bramka zapisu + test, bez zmiany hasza stanu);
   (c) `SimState.chronicle` z migracją v8→v9 (zmienia hasze doliny, nie kontraktów). **Rekomendacja: (b)** — wpisy
   podróżują z kopią zapasową Androida i nie dotykają symulacji.
2. **Karta przestoju „Naprawa” dla OUTPUT_FULL / NO_DESTINATION** — dodać przycisk otwierający narzędzie Buduj z
   podświetlonym spichlerzem? (teraz brak przycisku; „Kup wóz” i wskazówka korka mostowego są). **Rekomendacja: tak**,
   po playteście H5.
3. **Benchmark na Foldzie (D-56)** — strona gotowa: w APK otworzyć z `?debug=1&bench=device` (np. `chrome://inspect`
   → konsola WebView: `location.search='?debug=1&bench=device'`); wyniki JSON wkleić do tabeli w docs/PERF.md.
4. **Postacie przy pracy** — drwal/młynarz/piekarz są; czy dodać tartak (dwóch przy pile), rolnika, rybaka? Koszt:
   +3 wywołania rysowania na rodzaj (+cienie). **Rekomendacja: tak, ale po ocenie obecnych na telefonie.**
5. **Pamięć atlasu drzew (D-58)** — impostor 8-widokowy: low 2×7 MB, high 2×21 MB, ultra 2×28 MB (wcześniej ~2×7 MB
   razem z buforami MSAA). Na Foldzie sprawdzić w benchmarku/`chrome://inspect` → Memory. **Rekomendacja: zostawić
   224 px na high**; jeśli WebView zacznie gubić kontekst — 192 px (2×16 MB). Drugi wariant drzew bez własnych widoków
   (karta zawsze wariant 0) — **rekomendacja: nie** (2× pamięci za drobną różnicę w paśmie przejścia).
6. **Kontrakt „odliczanie z nadzieją” (D-60), reszta wpisu P2** — animacja odciśnięcia pieczęci (1,2 s) przed listem
   końcowym, nastrój muzyki „hurry” przy < 2 min, dźwięk dostawy do zamku. To zmiany smaku i przepływu (app.ts
   showEnd, music.ts). **Rekomendacja: pieczęć tak (200 ms + 1 s trzymania, bez sprężyny); muzyka dopiero po
   playteście; dźwięk dostawy cichy, ten sam co przyjęcie ładunku.**
7. **Podpowiedź tempa / auto-powrót do ×1 (BACKLOG P3 „prędkość jako narzędzie”)** — zmienia to, co robi gra bez
   pytania gracza. **Rekomendacja: tylko podpowiedź raz na misję; auto-×1 nie** (ukryta zmiana prędkości myli).
8. **Wygląd kalenicy strzechy (D-61)** — lasce na krzyż czytają się z bliska jako wyraźna kratka. Ocenić na telefonie;
   jeśli zbyt „graficzne”: kolor bliżej strzechy (`#655640`) albo tylko dwa pręty bez krzyży. **Rekomendacja: zostawić.**
9. **Arkusz od dołu zwija list przewozowy (D-62, noc 3 — zrobione, do oceny).** W pionie, gdy otwarta jest karta
   (Dlaczego stoi? / wóz / zamek), list zwija się do pieczęci, a po zamknięciu karty wraca; własne ustawienie
   gracza (zwinięty/rozwinięty) bez zmian; pieczęć zwiniętego listu otwiera wtedy kartę zamku (jak na Flipie). Powód: na 412×915 rozwinięty list i karta zabierały całą mapę, a
   piekarnia z czerwoną pinezką siedziała pod listem. **Rekomendacja: zostawić**; jeśli przeszkadza na telefonie —
   cofnięcie to jedna linia (`syncSheetFold()` w app.ts).
10. **Pinezki pod panelami HUD znikają (D-62)** zamiast wystawać zza listu/paska tempa (i łapać ich dotyk).
   Najgorszy przestój nadal widać w karcie „najgorszy” na dole. **Rekomendacja: zostawić**; alternatywa (droższa) —
   pinezka „przyklejona” do krawędzi panelu ze strzałką.
11. **Listy kasztelana po niemiecku (i w 14 innych językach) są po angielsku** (`src/content/letters.ts`, widać na
   `docs/shots/night3-de-end-360x740.jpg`). To treść do paczki tłumaczeń, nie układ. **Rekomendacja: dołożyć do
   najbliższej paczki GPT razem z kluczami PENDING_KEYS.**
12. **`npm run layout` w CI?** Pełny przebieg ~14 min (350 zadań), `--quick` ~3,5 min (412×915 + Flip × pl/de/pseudo, 84 zadania).
   Wymaga Playwright + Chromium w CI (dziś nie ma ich w `package.json`, są globalnie w kontenerze). **Rekomendacja:
   `--quick` w `ci.yml` na każdy push (z `npx playwright install chromium`), pełny przed wydaniem/APK.**
13. **Pieczęcie nigdzie nie zostają (BACKLOG P3 „Opisy”).** Opis sklepu mówi „zdobywaj pieczęcie” i „postępy
   zapisują się”, a po liście końcowym zapis `auto`/slot kontraktu jest kasowany i nie ma rekordu pieczęci.
   Opcje: (a) najlepsze pieczęcie per misja w `localStorage` (jak kronika) i trzy małe pieczęcie w wierszu misji w
   menu — bez zmiany sim i koperty zapisu; (b) to samo w IDB obok zapisów (kopia zapasowa Androida); (c) zmienić opis
   sklepu. **Rekomendacja: (a) teraz, (b) razem z decyzją 1 (kronika do koperty)** — jedna zmiana formatu zamiast dwóch.
14. **Misja X: „drewno w drodze — wóz N” maskuje niedobór drewna (BACKLOG P2).** Łańcuch kończy się na wozie, który
   czeka u drwala. Propozycja: gdy wóz z tym zleceniem jest w odbiorze (`LOADING`/w drodze po towar), dodać ogniwo
   „producent” (drwal pracuje / stoi) w `explainBuilding` — funkcja tylko czyta stan, hasze bez zmian, ale to
   `src/sim/diagnose.ts` i zmienia to, co gracz czyta w misjach I–XII (testy czytelności do przejrzenia).
   **Rekomendacja: tak, po playteście H2** (ta sama pomyłka „brak wozu” vs „brak surowca”), nie przed nim.
15. **Zapasy na podwórzach według stanu magazynu (propozycja, noc 5 — nie zrobione).** Dziś stosy kłód, desek,
   worków i beczek przy budynkach są stałą dekoracją modelu, niezależną od `stock`. Propozycja: każdy model dostaje
   miejsca na 6 jednostek wyrobu (`stockSlots`), rysowane tymi samymi instancjami co ładunek wozów (`cargo-*`, bez
   nowych wywołań rysowania), więc pełne podwórze = `OUTPUT_FULL` widać bez dotykania. Koszt: przejrzenie 12 modeli
   (stałe stosy wyrobu zamienić na dynamiczne), zrzuty z bliska. **Rekomendacja: tak, po ocenie postaci przy pracy
   (decyzja 4)** — ten sam przegląd modeli na telefonie.

## Stan nocy 2026-11-02/03 (gałąź `claude/w-night`, agent nocny)
Zrobione z kolejki „Plan nocy” (każde: typecheck, testy 376/376, build, push; hasze kontraktów bez zmian):
1. `5731c9d` benchmark telefonu — ukryta strona `tools/device-bench.html`, wejście `?debug=1&bench=device` (D-56).
2. `3a41b86` błędy: przyczyna korka na moście w karcie wozu (z naprzeciwka / pełne przęsło / przepuszcza), baza IDB
   nowsza niż aplikacja (B6); restart z potwierdzeniem i B1–B5 były już zrobione.
3. `7bcd420` GC: −41 % alokacji (sandbox 50 wozów ×4), `tools/alloc-probe.mjs`; `frame-cost.mjs` rank 5.
4. `3ab1054` czytelność: „Naprawa → Kup wóz −30” w karcie przestoju, wskazówka korka, licznik czasu pod pinezką od 20 s.
5. `a8f235a` ludzie przy pracy: drwal, młynarz, piekarz (pętle animacji, tylko przy `WORKING`). Nie zrobione: impostor
   drzew wielowidokowy, detale wody/mostu.
6. `52c09ec` kronika doliny w UI (D-57), `5c31a4a` +6 wariantów zamówień (rangi 3–5).
Nowe klucze i18n (PENDING_KEYS): `wagon.BRIDGE_JAM.*`, `fix.wagon*`, `fix.jam*`, `chron.*` (66), `events.order.t.*` (6).

## Stan nocy 2 — 2026-11-03 (gałąź `claude/w-night2`, agent nocny 2)
Kolejka nocy 2 (każde: typecheck, testy 376/376, build, push; hasze kontraktów bez zmian, sim nietknięta):
1. `004e1c2` **D-58** impostor drzew 8 widoków (azymut w układzie drzewa, high miesza, low dithering bez dodatkowych
   próbek), atlas per jakość (128/224/256 px), wypiekany po wierszu przez mały cel MSAA. Wywołania/trójkąty bez zmian.
2. `516ced9` **D-59** woda: falujący brzeg i piana (high), mokry pas brzegu (wszystkie); mosty: przyczółki (rampa,
   kłody / skrzydła murowane), odbojnice, gzyms i ciosy, piana i ślad za palami/filarami (+1 wywołanie rysowania).
3. `8a3b68b` **D-60** dostawa do zamku „+6” przy bramie, błysk wiersza listu, powiadomienia: połowa / 2 min / ostatnia
   minuta; `63161ae` Buduj — koszt drogi dojazdowej w etykiecie, etykieta nigdy na duchu; backlog: stare
   pozycje oznaczone jako zrobione (`702f131`: listy kasztelana, pierścień na moście, kadr po arkuszu, cena wozu).
4. `eddd186` **D-61** detal budynków: lasce na kalenicy, łaty świeżej słomy, porost na gontach, zacieki/zachlapanie
   gliny, drabiny, ława (bez nowych wywołań; +0,5–1,3 tys. trójkątów na budynek ze strzechą).
5. `885cd09` narracja zamówień (36 × PL/EN) w rozwiniętej ofercie; 4 brzmienia przyjazdu kupca.
Nowe klucze (PENDING_KEYS): `contract.half|twoMin|lastMin`, `build.costRoad`, `events.order.d.*` (36),
`events.merchant.new.1–3`. Zrzuty `docs/shots/night2-*`. Uwaga do skryptów zrzutów: tekstury high dochodzą pod
SwiftShaderem po 10–20 s — wcześniejsze zrzuty „bez tekstur” to za krótki czas oczekiwania, nie błąd gry.
Następne decyzje od **D-62**.

## Stan nocy 3 — 2026-11-03 (gałąź `claude/w-night3`, agent nocny 3)
Kolejka nocy 3 (każde: typecheck, testy, build, push; sim nietknięta, hasze kontraktów bez zmian):
1. **`npm run layout`** (`tools/layout-check.mjs`, D-62) — pomiar zamiast oceny: 14 ekranów (menu, ustawienia, HUD,
   Dlaczego stoi?, wóz, Buduj, list M7, list końcowy, zamek M5, Wolna dolina, targ, list otwierający, samouczek,
   awans) × 412×915, 915×412, 904×1000, 360×740, Flip 360×380 × pl/de/ru/ar/pseudo = 350 zadań, ~14 min (mapa Canvas2D; `--three` na mapie 3D, ~40 s/zadanie). Sprawdza: akcje w
   widoku, przecięcia HUD × arkusz × pinezki, cele ≥ 48 px, tekst poza ramką/ucięty, tekst/przycisk przykryty innym
   elementem, przewijanie w bok, błędy konsoli. Kontrola pozytywna 5/5 (wstrzyknięty zły CSS musi czerwienić).
   Raport `docs/layout/layout-report.json` (tylko pełny przebieg domyślny; `--three` na mapie 3D: hud, Dlaczego stoi?,
   wóz, dolina, zamek, list końcowy, samouczek × 3 widoki × pl/de/ar — też czysto). Naprawione dzięki niemu: pinezki pod HUD-em gasną, list zwija się przy
   arkuszu od dołu, kadr kamery liczy menu/żetony/tempo jako przeszkody, pasek Flip ukryty pod arkuszem, przyciski-
   linki ar ≥ 48 px, **wstęga listu przewozowego malowała się nad nagłówkiem listu końcowego** (warstwy UI izolowane),
   w poziomie komunikat pory roku zakrywał zwiniętą kartę „Wieści z doliny” (teraz pod nią), na Flipie komunikat na
   dymku (teraz na dole), na 904×1000 arkusz boczny zaczynał się na żetonach i tempie (teraz pod nimi).
   Na Flipie strzałka samouczka szła przez podpowiedź „Otwórz telefon…” (podpowiedź chowa się, notatka ją omija);
   notatka samouczka ma ≤ 3 wiersze od 360 px (sprawdzane), klucze ≤ 140 znaków we wszystkich językach.
   Dodatkowo: `tests/i18n-plural` (każdy blok plural w 17 słownikach), `{n} {cells}` → bloki plural, `tests/repo-size`.
2. **i18n**: `?lang=pseudo` (angielski z akcentami, +40 %, ⟦ ⟧; test), `hyphens:auto` + `overflow-wrap` na
   nagłówkach arkusza/listu/menu/wstęgi i wierszu stanu. Łączenia list (`Intl.ListFormat`) i liczby (fmt.ts) były już
   zrobione; zostaje `{n} {cells}` → blok plural (BACKLOG).
3. **Czcionki**: `tests/font-coverage` czyta cmap WOFF — Grenze Gotisch ma wszystkie litery 10 języków łacińskich,
   Ruslan + Alegreya całą cyrylicę; stosy ar/hi/ja/ko/zh dostały nazwy iOS (Geeza Pro, Kohinoor Devanagari, Hiragino,
   Apple SD Gothic Neo, PingFang SC).
4. **Bramki dokumentów**: `tests/docs-numbers` dla misji II–XII (start, termin, progi pieczęci, ilości) — złapał
   `docs/missions/m3.md` (12:00/08:00/10:00 zamiast 11:00/06:15/08:00, poprawione); `tests/i18n-hygiene` — 19
   martwych kluczy usuniętych ze wszystkich słowników, brak literałów w index.html i budowniczych UI.
Zrzuty `docs/shots/night3-*.jpg` (4); `npm run shots` (27 zrzutów) bez błędów konsoli. Następne decyzje od **D-63**.

## Stan nocy 4 — 2026-11-03 (gałąź `claude/w-night4`, agent nocny 4)
Kolejka nocy 4 (każde: typecheck, testy, build, `npm run layout -- --quick`, push; sim nietknięta, hasze bez zmian):
1. **Audio (D-63)**: szew pętli `ambient.evening` — przyczyna nie w przenikaniu, tylko w `loudnorm`, który przy
   przekroczeniu -6 dBTP po cichu przechodził w tryb dynamiczny (wzmocnienie dryfowało 26,6 → 23,9 dB w 30 s, więc
   koniec i początek pętli miały inne wzmocnienie). `tools/process_audio.py` daje wtedy stałe wzmocnienie + limiter;
   fragment nagrania przesunięty z 0 s na 198,5 s (ten sam wiatr CC0, równiejsza obwiednia). Szew 200 ms: 5,8 → 0,56 dB
   (mediana sąsiednich okien w pliku 0,76 dB). Przerenderowany tylko ten plik, `--check` zielony, provenance
   zaktualizowane. **Do odsłuchu na słuchawkach**: nowy fragment ma mniej dudnienia < 60 Hz (31 % zamiast 90 % energii).
   `AudioEngine`: po pierwszym geście ładuje wszystkie jednorazowe dźwięki (sfx + ui, ~300 kB; pętle dalej na
   żądanie), a `play()` w trakcie ładowania czeka w kolejce (jedno na id) zamiast przepadać po 850 ms; odrzuca dopiero
   po 4 s. Test `tests/audio-preload.test.ts`.
2. **Render P3 (D-64)**: dalekie wozy (LOD1) bez cienia na każdej jakości — `setShadows` było wołane, ale z
   `far = high`. Pomiar `tools/wagon-shadow-calls.mjs` (100 wozów, 72 daleko): 90 → 87 wywołań GL na klatkę,
   −14,9 tys. trójkątów w passie cienia; różnicy w obrazie nie widać (`docs/shots/night4-wagon-far-shadow-on-off.jpg`).
   Uwaga: licznik `drawCalls` w `?perf=1` nie liczy passu cienia (three r181 zeruje `info` po nim). Pierścień
   zaznaczenia na moście — już naprawiony w nocy 2 (`deckRing`), sprawdzone w kodzie.
3. **Drobne P3**: `load.stone` zaczynał się od 55 ms ciszy (uderzenie spóźnione względem animacji) — fragment
   przesunięty o 40 ms, przerenderowany tylko ten plik; pipeline przy ponownym renderze źródła Freesound nie kasuje
   już jego wpisu w provenance (URL, licencja, data). Usunięty zdublowany wpis BACKLOG o numeracji wozów (zrobiony, D-44).
4. **Zmiana jakości bez kompilacji w klatce (D-65)**: przełączenie wysoka ↔ niska linkowało 2–4 shadery w klatce
   (przycięcie). Teraz warianty (A2C liści, mieszanie kart drzew, teren low) kompilują się na klonach przed
   przełączeniem, a materiały wypiekania atlasu drzew zostają w pamięci: 0 linków w klatce w 4 przełączeniach.
   Jakość wchodzi ~kilkaset ms później (niewidoczne). Obraz po przełączeniu = obraz po świeżym starcie na tej jakości.
5. **BACKLOG porządki**: `stall.alert`/`ui.error` na głośniku telefonu — już zrobione wcześniej (pliki mają 99 % energii
   w 600–2500 Hz), `screenshots-plan.md` — już przepisany; wpisy zamknięte. Nowy wpis P3: pętla młyna gubi rytm na szwie
   (9,56 okresu na 5,5 s) — źródło Freesound niedostępne z kontenera (403), opis naprawy w BACKLOG. Następne decyzje od **D-66**.

## Decyzje właściciela 2026-11-03 rano (odpowiedzi na „Decyzje na rano” 1–12)
- 1 Kronika doliny → **w pliku zapisu gry** (envelope, bez zmiany sim; migracja z localStorage).
- 2 „Naprawa” dla OUTPUT_FULL / NO_DESTINATION → **tak** (Buduj → spichlerz; w misjach bez budowy tylko wskazówka).
- 3 Benchmark na Foldzie → właściciel uruchomi `?debug=1&bench=device` w APK i wklei JSON do docs/PERF.md.
- 4 Kolejni ludzie przy pracy → **po ocenie obecnych** przez właściciela (czekać na jego opinię o drwalu/młynarzu/piekarzu).
- 5 Atlas drzew → **mniejszy na high** (jak low ≈14 MB), pełny tylko na ultra.
- 6 Koniec kontraktu → **animacja odciśnięcia pieczęci + dźwięk dostawy** (motyw muzyczny Suno — właściciel).
- 7 Prędkość → **tylko podpowiedź** (toast przy rosnącym przestoju na ×4), bez auto-powrotu.
- 8 Strzecha → **złagodzić** witki na kalenicy (rzadsze, ciemniejsze, bez kratki).
- 9 Zwijanie listu przy arkuszu od dołu → **zostaje**. 10 Znikanie pinezek pod HUD → **zostaje**.
- 11 Listy kasztelana → **tłumaczenie w paczce GPT 11** (listy I–XII + nowe klucze z nocy, 15 języków).
- 12 CI → **`npm run layout -- --quick` przy każdym pushu**, pełny ręcznie przed APK.

## Plan dnia 2026-11-03 (jeden agent Opus ciągle + koordynator)
Kolejka: dokończ agenta 5 (`claude/w-night5`) → decyzje 5, 8, 2, 7, 1, 6, 12 (w tej kolejności) → paczka GPT 11 (decyzja 11)
→ dalej backlog jak w nocy. APK w dzień co ~3 h.
## Stan nocy 5 — 2026-11-03 (gałąź `claude/w-night5`, agent nocny 5)
Kolejka wg BACKLOG (każde: typecheck, testy, build, `npm run layout -- --quick`, push; sim nietknięta, hasze bez zmian):
1. `23b7ce1` **P1 provenance muzyki**: `tests/music-provenance.test.ts` — plik bez wpisu w
   `docs/legal/music_provenance.json` = czerwony test (SHA-256, id Suno w tagu COMMENT WebM, każdy utwór z `music.ts`
   istnieje, tabela w ASSETS.md); skaner `tools/music-provenance.mjs` (`--write` po przekodowaniu). ASSETS.md: Suno AI,
   plan płatny. Deklaracja treści AI w sklepach zostaje krokiem wydania.
2. `9d81f3f` **P2 `?diag=1`**: percentyle czasu klatki p50/p95/p99, klatki > 33 ms, p95 CPU sim/widoku w kubełkach
   tempa (pauza = odniesienie), „Kopiuj JSON” (`marchia.frame-diag.v1`); protokół na składaku i tabela w docs/PERF.md.
3. `2f4dd6a` **P2 test optymalności `findPath`** względem niezależnej Dijkstry O(V²) (deszcz, kolejki na mostach,
   żywy świat 50 wozów).
4. `5c6f5a7` **P2 raport pokrycia tłumaczeń**: `npm run i18n:coverage` (+ `--pack`), paczka
   `docs/i18n/pending-pack/` (177 kluczy) gotowa dla GPT.
5. `83e983c` **P3 „migawka diagnozy”**: pierwszy krytyczny przestój misji — pinezka trzy razy wypuszcza pierścień,
   karta „Najgorszy zastój” na 2 s mosiężna poświata, czytnik ekranu słyszy przyczynę; kamera stoi, bez nowych kluczy.
6. `f0f5c5e` + `0aaf913` **P4 zapowiedź deszczu** 30 s przed ulewą (`hud.rainSoon`); przy okazji na Flipie
   komunikat chowa się pod otwartym arkuszem (stara kolizja wyszła w `layout`); pełny `npm run layout` (350) złapał to
   samo na 915×412 / 904×1000 / 360×740 w karcie wozu → reguła rozszerzona na każdy układ (`body.has-sheet .notice-wrap`),
   scena `wagon` 25/25 i `--quick` 84/84 zielone (pełnego przebiegu nie powtórzono — ~25 min).
7. `326bacd` **P3 `npm run a11y`** (CDP, drzewo dostępności): złapał błąd — po zamknięciu arkusza w pionie fokus nie
   wracał do oka „Najgorszy zastój” (naprawione w `sheets.ts`).
BACKLOG: zamknięte jako już zrobione wcześniej (sprawdzone w kodzie): kod deweloperski w buildzie, klon w `saveGame`,
Intl w liczbach, właściwości logiczne RTL, klucze HUD w 17 językach, samouczek ≤ 140 znaków, ikona v3.
Nowe klucze (PENDING_KEYS): `diag.copy|copied|reset`, `hud.rainSoon`. Zrzuty `docs/shots/night5-*.jpg` (5).
Decyzje 13–15 dopisane wyżej. Następne decyzje od **D-66** (ta noc nie dodała wpisów D-NN).
- 13 Pieczęcie misji → **tak, najlepszy wynik i czas na misję w zapisie gry** (razem z kroniką, decyzja 1), widoczne w menu misji.
- 14 Łańcuch misji X do producenta → **po playteście**.
- 15 Stosy towaru na placach wg zapasu → **tak** (instancje ładunku, bez nowych wywołań rysowania).
- **CI (właściciel 2026-11-03): limit minut GitHub Actions — CI do minimum.** `ci.yml` tylko ręcznie i przy otwarciu PR
  (bez push, bez synchronize), workflowy propozycji misji tylko ręcznie. Nie dodawać kroków do CI; wszystkie
  sprawdzenia lokalnie przed pushem. Decyzja 12 (layout w CI) **anulowana**.

## Stan dnia 1 — 2026-11-03 (gałąź `claude/w-day1`, agent dzienny)
Każdy punkt: typecheck, `npm test` (408/0), build, `npm run layout -- --quick` (84/84) zielone; hasze złote bez zmian (sim nietknięta).
1. **Decyzja 5** — atlas drzew: high = 128 px (2 × 7 MB = 14,0 MB, było 42,8 MB), ultra 256 px (55,9 MB); `view.stats().treeAtlasMB`. D-58 poprawka.
2. **Decyzja 8** — kalenica strzechy: jeden pręt na ~0,9 m naprzemiennie (zygzak), cieńsze i ciemniejsze (`#4a3f2c`), bez kratki. D-61 poprawka; przed/po `day1-ridge-before-after.jpg` (widok `ridge` w model-preview).
3. **Decyzja 2** — „Naprawa” dla OUTPUT_FULL/NO_DESTINATION (korzeń łańcucha): „Postaw spichlerz −30” zamyka kartę, otwiera Buduj ze spichlerzem na najbliższym wolnym miejscu obok budynku; w misjach bez spichlerza na liście — sama wskazówka. Przycisk Buduj w szynie dostaje znacznik lekarstwa. D-66.
4. **Decyzja 7** — toast „Na ×4 przestój rośnie szybko: {budynek}. Zwolnij…” raz na przestój (krytyczny, ≥ 60 s gry), bez zmiany tempa. D-67.
5. **Decyzje 1 + 13** — kronika w kopercie zapisu księgi (`chronicle`, opcjonalne, czytane łagodnie; localStorage scalany raz i kasowany po zapisie; nowy wpis = autozapis); najlepsze pieczęcie + czas per kontrakt w nowym magazynie IDB `profile` (DB v3), zapis przy liście końcowym, w menu trzy małe pieczęcie i czas pod podtytułem. Testy: stara baza v2, stara koperta, uszkodzony profil, migracja localStorage. D-68.
6. **Decyzja 6** — pieczęć zamku odciskana 200 ms (bez sprężyny), trzymana do 1,2 s, tap/klawisz pomija, potem list; dźwięk dostawy przy każdym towarze kontraktu w zamku (`contract.delivery` = istniejący CC0 `unload-sack`, cicho, bez pozycji); `process_audio --check` PASS. D-69. Muzyka „hurry” — po playteście.
7. **Decyzja 12 (CI) — pominięta** na polecenie właściciela (limit minut CI; workflowy nietknięte, baza `cd5b8a3` wyłączyła CI na push).
8. **Priorytet właściciela (zrzut z telefonu)** — menu główne na zestawie UI: rama z liliami (`frame-sheet-dim`), tytuł na wstędze, mosiężne medaliony z numerem misji (wygrana = woskowa pieczęć), Kontynuuj = wiśniowy przycisk, Ustawienia = karta; przewijanie z wygaszeniem, 2 kolumny w krótkim poziomie/Flex, RTL. Layout 75 zadań menu/ustawienia/zapis/dolina we wszystkich widokach zielone. D-70; przed/po `day1-menu-*.jpg`.
9. **Decyzja 15** — stosy towaru przy podwórzach wg zapasu: do jednego ładunku (6, kamień 4) instancjami `cargo-*` wozów; stałe stosy wyrobu usunięte z 7 modeli. Wywołania: +1–4 tylko gdy żaden widoczny wóz nie wiezie tego towaru. D-71; `day1-yard-sawmill-off-on.jpg`.
Nowe klucze (PENDING_KEYS, PL+EN): `fix.granary`, `fix.granaryWhy`, `fix.granaryHint`, `hud.speedHint`, `menu.bestAria`. Następna decyzja: **D-72**.
Do oceny na telefonie: rozmiar pieczęci przy liście (sprite 84 px — większa byłaby miękka), numery rzymskie w medalionach przy arabskim, stosy na podwórzach (miejsca na 10 modelach).


## Stan dnia 2 — 2026-11-03 (gałąź `claude/w-day2`, agent dzienny 2)
Każdy punkt: typecheck, `npm test` (409→412/0), build, `npm run layout -- --quick` (84/84) zielone; złote hasze bez zmian (sim nietknięta; `forecast.ts` tylko czyta stan).
1. **Pieczęć przy liście (pytanie dnia 1)** — rysowana wektorowo (`public/assets/ui/kit/seal-press.svg`, ten sam wzór i kolory co `seal-full`), ostra przy 96 px na każdym dpr; małe pieczęcie zostają bitmapami w natywnych rozmiarach. D-72, `day2-seal-press.jpg` (lewa: nowa, prawa: stary sprite).
2. **Rzymskie numery w medalionach przy arabskim** — zostają celowo: wszystkie 17 tłumaczeń ma tytuły „I. …”, medalion powtarza numer z tytułu (dwa systemy liczb obok siebie byłyby gorsze). Komentarz przy `ROMAN_MISSION`. D-73.
3. **Stosy na podwórzach (10 modeli)** — geometryczny test (każdy trójkąt modelu co ~5 cm, pas drogi przy bramie 2,2 m, krawędź działki) znalazł 8 kolizji: worki młyna w drzwiach i na krawędzi, kosze piekarni w wylocie drogi, worki zboża przy progu, kosze rybaka na krawędzi, worki węgla w podstawie szałasu (szałas 0,4 m w tył), worki słodu przed drzwiami i w drewnie, beczki browaru w pasie drogi, lina żurawia „przez” bloki kamieniołomu. Wszystko przesunięte, test w `yard-piles.test.ts`; podglądy `yard-<rodzaj>` / `yardtop-<rodzaj>` w model-preview. D-74, `day2-yard-piles-before-after.jpg`.
4. **Ostatnie fazowane powierzchnie → zestaw UI**: ogniwa „Łańcucha przyczyn”, żetony Potrzebuje/Produkuje/Zamówienie, wiersze tempa, karty budowy, metki ducha i szkicu na mapie — karta `card-normal` (wciśnięta, aktywna dla samego budynku); przyczyna / pusty żeton / wąskie gardło / zła lokalizacja — `panel-alert` z winną krawędzią (lustro w RTL); zablokowane karty budowy — ta sama karta pod jasnym kreskowaniem (ciemny `card-disabled` zjadał nazwę i cenę). D-75, `day2-kit-cards.jpg`.
5. **Arkusz targu i rang** — pieczęci przy wymaganiach rangi (wciśnięta = spełnione), mosiężny rowek postępu i nasycenia, budynki na kartach zestawu. D-76, `day2-market-kit.jpg`.
6. **Pętla młyna (BACKLOG P3)** — 9 okresów łopat (5,22 s), szew między uderzeniami (0,58 s zamiast 0,28 s); przycięte z pliku w grze (Freesound niedostępny), przenikanie 0,25 s w tej samej fazie, `process_audio --check` PASS, hasze proweniencji zaktualizowane. D-77.
7. **Prognoza tempa dla listów z transzami (m5, m6; BACKLOG P3)** — bieżąca transza na liście przewozowym („Przy tym tempie: gotowe za M:SS / spóźnienie M:SS” + dostawca) i w karcie zamku (wiersze tempa, bez pieczęci i bez „na N pieczęci trzeba”), wobec terminu tej transzy; pokazywana, gdy okno 2 min leży w transzy — 0 fałszywych „spóźnień” na przebiegach bez akcji (było 18 / 14 próbek). Nowy klucz `why.pace.waitTranche` (PENDING_KEYS). D-78, `day2-tranche-pace.jpg`.
8. **Stosy przy spichlerzu i zamku (ciąg dalszy decyzji 15)** — spichlerz: dwa największe zapasy po bokach rampy (stałe beczki/skrzynie/worek usunięte); zamek z kontraktem: po stosie na każdy zamówiony towar w ogrodzonym placu, rośnie z dostarczonym udziałem (pełny stos = towar skompletowany). Stosy centrowane na rzeczywistym obrysie ładunku (beczki stały 0,5 m obok miejsca). D-79, `day2-castle-store-piles.jpg`.
BACKLOG: zamknięte P3 pętla młyna, P3 prognoza transz (zostaje strojenie okna po playteście), P1 „odmiana nazw towarów” (zrobione wcześniej: przypadek = nazwa klucza, testy `{param}` per język). Nowe klucze: `why.pace.waitTranche`. Następna decyzja: **D-80**.

## Decyzje dnia 2 (do właściciela)
1. **Księga przyczyn w grze?** `src/content/stallCodex.ts` ma gotowe PL/EN dla każdego statusu budynku i wozu (co znaczy, jak sprawdzić, 2–3 naprawy, przykład łańcucha), ale żaden ekran jej nie pokazuje. Propozycja: w arkuszu „Dlaczego stoi?” pod przyczyną zwinięte „Co to znaczy?” (jedno dotknięcie, treść dla statusu przyczyny); inne języki — EN do czasu paczki GPT. **Rekomendacja: tak, zwinięte domyślnie** (nie wydłuża arkusza; pomaga w diagnozie < 30 s przy pierwszym spotkaniu przyczyny).
2. **Rzymskie numery kontraktów także po arabsku/hindi/japońsku (D-73)** — zostawione celowo. **Rekomendacja: zostawić**; zmiana = tytuły i medalion razem w paczce tłumaczeń.
3. **Spichlerz bez stałych beczek i skrzyń (D-79)** — pusty spichlerz ma teraz pusty plac przed rampą (pełny pokazuje swoje dwa największe zapasy). Ocenić na telefonie. **Rekomendacja: zostawić** (stałe rekwizyty udawały zapas, którego nie było).
- **Decyzje dnia 2 (właściciel, 13:50):** Księga przestojów w „Dlaczego stoi?” — **tak, zwinięte „Co to znaczy?”**;
  cyfry rzymskie wszędzie — **zostają**; magazyn bez stałych rekwizytów — **zostaje**.

## Stan dnia 3 — 2026-11-03 (gałąź `claude/w-day3`, agent dzienny 3)
Każdy punkt: typecheck, `npm test` (412/0), build, `npm run layout -- --quick` (84/84) zielone; złote hasze bez zmian (sim nietknięta).
1. **Pętla `cart.cobble`** (resztka D-77) — przycięta z plików w grze do 3,514 s (11 uderzeń kół), przenikanie 0,1 s w sygnał sprzed cięcia; szew 0,32 s (OGG) / 0,35 s (M4A) zamiast 0,61 s przy uderzeniach co 0,23–0,38 s. Hasze proweniencji, `audio_sources.json`, ASSETS.md; `process_audio --check` PASS. D-80.
2. **Pauza w kontrakcie** pokazuje tytuł misji („I. Chleb i deski”) zamiast samego „Kontrakt”.
3. **Flex (Fold na pół otwarty, szeroki)** — otwarta karta zaczyna się pod żetonami czasu/srebra i tempem (wcześniej je przykrywała); strzałka samouczka nie idzie już przez wstęgę listu przewozowego (w Flex wybierała kierunek „w dół” przez tytuł; wstęga i rząd pieczęci są teraz przeszkodami — strzałka staje z boku). `day3-flex-arrow-sheet.jpg`.
4. **Pierścień samouczka** o 3 px szerszy — wewnętrzna linia z obwódką zasłaniała ostatnią cyfrę „0/20” przy krawędzi listu w poziomie.
5. **Wiersze „etykieta — wartość”** (karta wozu, list końcowy, karta zamku): etykiety wyrównane do środka wiersza, nie do linii bazowej — przy wartości z ikoną (ładunek, prędkość) albo 48-px linku (cel) etykieta spadała o pół wiersza. `day3-kv-align.jpg`.
6. **Błąd: listy z transzami (V, VI)** — pigułka mówiła „2:00 do śniegu”, licząc do terminu bieżącej dostawy (śnieg dopiero 11:00). Teraz „2:00 do dostawy 1” z klepsydrą; ostatnia transza (termin = śnieg) zostaje „do śniegu”. Nowy klucz `contract.toTranche` (PENDING_KEYS).
7. **Ostrzeżenia przed terminem transzy** — „Zostały 2 minuty — brakuje jeszcze N” liczyło cały kontrakt (48), nie bieżącą dostawę (12 z 18 chleba); teraz brak tej transzy, z klepsydrą, i cisza, gdy transza już skompletowana.
8. **Beczki piwa (błąd grafiki)** — losowy „obrót klepek” był odchyleniem całej beczki: na wozie wystawały do 1,11 m w bok (burty ±0,64), na placu browaru / spichlerza / zamku leżały krzywo. Teraz obrót wokół własnej osi; plac browaru 0,1 m w bok (test kolizji). D-81, `day3-beer-barrels.jpg`, widok `beercargo` w model-preview.
9. **Fold w pozycji książki (pionowy zawias)** — nic już nie leży na zgięciu: żetony i tempo ułożone w dwóch rzędach w prawym segmencie (w jednym rzędzie ≈ 460 px wchodziły w zawias), narzędzia szyny zwężają się w swoim segmencie tylko gdy trzeba (5 w kontrakcie: 76 px jak dotąd, 6 w dolinie: 64 px), karta „Najgorszy zastój” w drugim; komunikaty (toasty) w segmencie początkowym; notatka i strzałka samouczka omijają zgięcie (nowe zmienne `--book-start/--book-end`). RTL sprawdzony. `day3-book-crease.jpg` (czerwony pas = zawias).
BACKLOG: P3 `{n, plural}` zamknięte (sprawdzone — wszystkie liczniki z rzeczownikiem policzalnym już są blokami; „srebra” niepoliczalne); P2 misja X — po D-47 zostaje tylko pytanie po playteście (sonda: brak wozów czekających u drwala); Flex — częściowo (zostaje sprawdzenie na urządzeniu).
Nowe klucze: `contract.toTranche`. Następna decyzja: **D-82**.

## Stan dnia 4 — 2026-11-03 (gałąź `claude/w-day4`, agent dzienny 4)
Każdy punkt: typecheck, `npm test` (413/0, nowy `mud-pace`), build, zrzuty 412×915 / 915×412 / `?lang=ar`; złote hasze bez zmian (stan sim nietknięty; jedyna zmiana w `src/sim` to czysty odczyt `Slowdown.paved`).
1. **Pieczęć przy wygranym kontrakcie (D-82)** — pieczęć zamku wciskana teraz w **list przewozowy**, nie na środek ekranu: list podświetlony, mapa i reszta HUD przygasają, pieczęć schodzi 260 ms (skala 1,5 → 1 → 0,96, bez sprężynowania, cień z „uniesionego” na „przyciśnięty”), wosk rozlewa się raz, odcisk leży na towarach do listu (1,2 s). Złożony list → pieczęć na medalionie. Pieczęcie listu pokazują zdobyte (wcześniej trzy puste). `prefers-reduced-motion` → od razu list. Dźwięk: istniejący `contract.won` (`sfx/wax-seal`) gra w ticku wygranej z `bindings.ts` (zostawiony tam — test audio). Przegrana bez zmian. `day4-seal-*.jpg`.
2. **Błoto w karcie wozu (H4, D-83)** — „Błoto: 52% prędkości — na bruku 114%” / EN „Mud: 52% speed — on cobbles 114%” (roztopy: „Roztopy: …”); obie liczby wobec suchego tempa na tym odcinku (bruk szybszy także na sucho, więc >100%). Jedna linia, ikona obok, kolor atramentu, status zostaje „jedzie…”. Klucze `wagon.mudVsCobble`, `wagon.thawVsCobble`; `wagon.slowMud`/`slowThaw` martwe (do porządków słowników). `day4-mud-*.jpg`.
3. **Pełny magazyn (H5, D-84)** — w „Dlaczego stoi?” pod przyczyną ramka panel-alert: „8/8 drewna — brak miejsca na nowy towar” (albo „następna partia (2) się nie zmieści”), spichlerz „12/12 — brak miejsca na odbiór”; pod tym skutek i kto czeka („Na drewno czeka: Tartak”, linki 48 px). Budynek z pełnym magazynem u korzenia łańcucha — ten sam licznik z linkiem do niego. Żadnej nowej akcji: „Naprawa” jak dotąd (wóz / spichlerz tylko tam, gdzie misja pozwala budować). Klucze `why.full.*`; nowa funkcja `translated()` w i18n (fallback EN jako `lang=en dir=ltr`). `day4-full-*.jpg`.
Nowe klucze (PENDING_KEYS, paczka GPT): `wagon.mudVsCobble`, `wagon.thawVsCobble`, `why.full.out`, `why.full.outBatch`, `why.full.store`, `why.full.halted`, `why.full.refuses`, `why.full.waiting`, `why.full.blocked`. H4 i H5 w BACKLOG oznaczone `[~]` — zostają do potwierdzenia w playteście. Następna decyzja: **D-85**.
Do sprawdzenia przez koordynatora: pieczęć zasłania środek pasków towarów (w poziomie także ikonę drugiego towaru) — celowo „stempel na dokumencie”, ocenić na telefonie; zrzuty z SwiftShader (mało klatek), więc płynność 260 ms też do obejrzenia na urządzeniu.

## Stan dnia 5 — 2026-11-03 (gałąź `claude/w-day5`, agent dzienny 5)
Zadanie: naprawy z audytu diagnozy postojów (`docs/research/2026-11-03-diagnosis-audit.md`, rozdz. 5) w kolejności 1+2, 4, 3, 5, 6.
Każdy krok: typecheck, `npm test` (koniec: 423/0, nowy plik `diagnosis-audit-fixes`), osobny commit. **Złote hasze i `step()` bez zmian** —
wszystko w UI i w czytających funkcjach `src/sim/diagnose.ts` (`outputSurplus`, `heldWagon`, `isHeld`, `granaryRelief`, `busyOutOfReach`,
`contractFilled`); `tests/determinism-reads.test.ts` sprawdza, że odczyty między tickami nie zmieniają hasza (m1, m4, m6, m10, m12).
1. **Nadwyżka zamiast „brak wozu” + flota przy moście (D-85).** Pełny plac, na który nikt nie czeka (odbiorcy nie czekają na towar, zamek ma całe zamówienie, spichlerz nie prosi o kamień wg reguły dyspozytora) — postój spokojny: pinezka drugorzędna, bez wosku, karta „nadwyżka, nikt jej teraz nie potrzebuje”, w arkuszu zamiast „Kup wóz” linia „Nadwyżka: nikt teraz nie potrzebuje zboża, poczeka na placu. Nowy wóz tego nie przyspieszy.”. Dolina (rynek): wóz zostaje, ale bez wosku. Gdy ≥ 1/3 floty stoi przy moście / bez drogi, łańcuch „brak wozu” idzie do najbliższego takiego wozu → wskazówka lodu / zatoru, bez „Kup wóz”. Wskazówka zatoru także gdy zator jest w środku łańcucha.
2. **Kodeks (D-86).** „Co to znaczy?” objaśnia ostatnie ogniwo, które jest postojem (nie „Produkuje” ani „Jedzie po ładunek”); 67 % → 100 % trafnych.
3. **Pełny spichlerz (D-87).** Inny spichlerz bez drogi → łańcuch do niego i przycisk „Zbuduj drogę: 2 srebra” (m6/m12 przed lekcją: 76/85 % → 100 % próbek z przyciskiem); inny ma miejsce → spokojny, „Inny spichlerz ma jeszcze miejsce — nowy towar pojedzie tam:” z linkiem; żaden → „Postaw spichlerz” / wskazówka.
4. **`ALL_BUSY` bez dojazdu ze stajni (D-88).** Misja I przed mostem: zamiast „Kup wóz” przycisk mostu do gospodarstwa. `gapTarget` przeniesiony do `stalls.ts` (testowalny), re-eksport z `panels.ts`.
5. **Zamówienie wypełnione (D-89).** Węglarnia po dostarczeniu całego węgla: spokojna, „zamówienie wypełnione, reszta czeka”, bez wskazówki spichlerza (m10/nic: 86 % → 0 % wosku).
6. **Układ (D-90).** Linie spokojne stoją pod licznikiem pełnego magazynu, nad fałdą kodeksu (`.calm-hint`, atrament, link 48 px). Zrzuty `docs/shots/day5-*.jpg` (412×915, 915×412, `?lang=ar` — nowe klucze po arabsku z fallbackiem EN `dir=ltr`).
Wynik audytu po naprawach (tabela „Po naprawach” w raporcie): krytyczny najgorszy postój 282 → **189** z 635 próbek; m4 91 → 17 %, m6/lekcja 100 → 38 %, m10/nic 86 → 0 %, misje drogowe „nic” dalej 100 % (słusznie).
Nowe klucze (PENDING_KEYS): `fix.surplus`, `cause.surplus`, `fix.storeRoom`, `cause.storeRoom`, `fix.orderFilled`, `cause.orderFilled`. Następna decyzja: **D-91**.
**Do decyzji właściciela:**
- **m8** — kamieniołom dalej „pełno — brak wozu” z woskiem (70 %) i „Kup wóz” nie działa (0/14): spichlerz naprawdę prosi o kamień, ale wóz idzie najpierw do piekarni/tartaku. Rekomendacja: odczyt „W spichlerzu jest 12 kamienia — wystarczy na bruk” (UI, bez hasha), zmiana dyspozytora dopiero po playteście.
- **Dolina** — nadwyżka na rynek bez wosku (spadek 33 → 0 %). Rekomendacja: zostawić do playtestu.
- **Kodeks** przy nadwyżce dalej radzi „Kup wóz” (zwinięty, linia spokojna wyżej). Rekomendacja: osobne zdanie w kodeksie przy następnej redakcji treści.

## Stan dnia 6 — 2026-11-03 (gałąź `claude/w-day6`, agent dzienny 6)
Zadania: A — poprawki z badania „pierwsze 10 minut” (`docs/research/2026-11-03-first-10-minutes.md`), B — decyzja właściciela A
(niepełne ładunki tylko w dolinie), C — decyzja właściciela dla m8. Każdy krok: typecheck, `npm test` (koniec: **429/0**, nowe pliki
`tutorial-crossing`, `valley-top-up`, `m8-stone-stored`), zrzuty 412×915 / 915×412 / `?lang=ar`, osobny commit. **Złote hasze misji bez
zmian**; `npm run bot` (m1) identyczny przed i po (wygrana 8,85 min, 2 pieczęcie, 26 srebra).
1. **Krok 5 samouczka (most) — D-91, 58dc9b7.** Odtworzone prawdziwym dotykiem i myszą w Playwright (`tools/repro-step5.mjs`, zimny
   start). Werdykt: **stary tekst przy `current = 5` to artefakt skryptu** (krok zmienia się w obsłudze dotknięcia, notatka w następnej
   klatce; pod SwiftShader klatka trwa ~1 s, skrypt dotknął „Droga” drugi raz i wyłączył narzędzie → samouczek słusznie wrócił do
   kroku 4). **Nieudane przeciąganie to prawdziwy błąd:** duch był całą trasą tartak–zamek (62 pola, oba końce poza ekranem 412 px,
   początek pod notatką), a po karcie wozu kamera bywała daleko od rzeki. Teraz duch = tylko brakujące pola + po jednym polu drogi na
   końcach (17 pól), kamera raz pokazuje całą przeprawę, notatka jej nie zasłania; to samo przeciągnięcie buduje most i przechodzi do
   kroku 6 (pion: 3 przebiegi; poziom: sonda `?play=m1&tut=1` — most i krok 6). Przy okazji: notatka nie „jedzie” już przez listę
   przewozowy (bez przejścia `transform`), awaryjne miejsce notatki zasłania najmniej; w kroku 2–3 ogniwo łańcucha pod fałdą krótkiej
   karty jest przewijane do widoku.
2. **Karta „Najgorszy zastój” w notatkach 1–5 ukryta (D-92, 2692e51)** — pojawia się od notatki 6 albo po końcu/pominięciu samouczka,
   z jednorazowym błyskiem pierwszego postoju.
3. **„Następna misja” + menu (D-93, fab20b4)** — na liście wygranej (misje I–XI) główny przycisk z tytułem następnej misji; przy
   niedokończonym zapisie tej misji — przez arkusz pytania z menu. „Jeszcze raz” / „Do menu” zostają. Menu: „zacznij tutaj” przy misji I
   do pierwszej wygranej, „Ustawienia” w stopce ramki (412×915: y 839–887, bez przewijania), podtytuł misji I już nie powtarza tytułu.
4. **Dolina: dowóz od 4 sztuk (D-94, 753d21b)** — `topUpHold()` tylko w `sandbox`; brak nowego pola stanu → **bez podbicia wersji
   stanu (zostaje 8)**. Progi rang 3–4: 2500/6000 → **3000/7200** (+10 % lądowało na krawędzi okien: 40,5 / 71,4 min). Bot doliny
   (decent, 150 min): srebro 17 188 → **19 706**, rangi 10,1/26,6/45,9/77,9/122,8 → **10,4/22,3/42,8/76,3/108,7** min, przepływ 208 → 225;
   małe floty w 30 min ~8 % mniej (485 → 446, 474 → 438). Testy F1 i „audit fix 1” przestawione na scenariusz, w którym ich sytuacja
   nadal zachodzi (słodownia bez własnych pól; 7 wozów zamiast 30). Karta warsztatu: „Ma drewna na pracę; dowóz zamówi, gdy zmieści się
   4 — pełniejszy wóz, mniej kursów.” — status „Produkuje”, bez postoju.
5. **m8 (D-95, 8093591)** — kamieniołom czekający tylko na rezerwę kamienia spichlerza, gdy spichlerz ma już kamień: postój spokojny,
   „W spichlerzu jest 12 kamieni — wystarczy na bruk (12 pól). …”, bez „Kup wóz” (188/188 próbek w przebiegu bazowym). Dyspozytor bez zmian.
   Nadwyżka w dolinie zostaje jak jest (decyzja właściciela).
Zrzuty: `docs/shots/day6-*.jpg`. Narzędzia: `tools/repro-step5.mjs`, `tools/day6-shots.mjs`. Nowe klucze (PENDING_KEYS): `contract.next`,
`menu.startHere`, `menu.m1Sub`, `why.topUp`, `cause.stoneStored`, `fix.stoneStored`. Następna decyzja: **D-96**.
**Do decyzji właściciela:**
- **Progi rang doliny +20 % zamiast ~+10 %** (powód wyżej). Jeśli ma być bliżej +10 %, 2750/6600 przechodzi testy, ale z zapasem 0,5 / 1,4 min.
- **Samouczek ruszy kamerą raz** (krok 5), wbrew zasadzie m1.md „nie rusza kamery” — bez tego przeprawa bywała poza ekranem. Zaakceptować albo wskazać inną drogę (strzałka do krawędzi ekranu).
- **m8: kamieniołom spokojny** (bez wosku), nie tylko bez „Kup wóz” — spójne z D-85; jeśli ma zostać alarmem, to jedna linia w `calmStall`.
Do sprawdzenia na telefonie: notatka samouczka w poziomie w kroku 5 leży na pasku narzędzi (BACKLOG); pozostała część pomiaru pierwszych
10 minut (BACKLOG P2).

## Decyzje właściciela 2026-11-03 ~21:30
- Progi rang doliny 3/4 = **3000/7200** (+20 %, D-94) — zostają.
- Samouczek m1 krok 5: **jedno przesunięcie kamery nad przeprawę — akceptowane** (wyjątek od „nigdy nie rusza kamery”, D-91).
- m8: kamieniołom czekający na rezerwę kamienia — **spokojna pinezka** z linią „W spichlerzu jest N kamieni” (D-95) — zostaje.
- Od ~21:00 znów do 2 agentów Opus (deweloper + researcher).

## Stan dnia 7 — 2026-11-03 (gałąź `claude/w-day7`, agent dzienny 7; przerwane z powodu limitu użycia)
**Zrobione i zatwierdzone:** zadanie 1 — notatka samouczka w kroku 5 w poziomie nie leży już na „Droga” ani na
przycisku zamknięcia karty (D-96, 4ce0565). Sprawdzone przez `tools/repro-step5.mjs` (prawdziwe dotknięcia, zbudowana gra):
915×412 pl z kartą i bez, `?lang=ar`, 412×915; most nadal się buduje. Zrzuty `docs/shots/day7-tut-step5-*.jpg`.
Fold book/flex nie sprawdzone (narzędzie nie emuluje zawiasu, maszyna przeciążona). Typecheck OK, `npm test` **431/0**,
złote hasze bez zmian.
**Gotowe w drzewie roboczym, NIEZATWIERDZONE** (typecheck i 431/0 przeszły na tym drzewie; przed commitem dopisać
D-97…D-99 i zrobić zrzuty):
- Zadanie 2 — ranga 5 doliny 13 000 → **14 500** (`src/sim/defs.ts`; tabela rang w `docs/playtest/PROTOCOL.md` też
  poprawiona na 3000/7200/14 500). Bot DECENT: R5 108,7 → **119,7 min** (środek okna 105–135); próg 14 000 → 116,0,
  15 000 → 123,1. Ławka 180 min: „mixed” 106,5–108,7 → 117,7–119,7; z `--events` 87,5–90,0 → 95,3–96,9 (nadal poniżej okna,
  jak dotąd). Srebro, rangi 1–4 i pozostałe plany bez zmian. Rangi 3/4 zostają 3000/7200.
- Zadanie 3 — spokojny wariant kodeksu `OUTPUT_FULL.NO_WAGON` („Pełno — nic pilnego”, bez „Kup wóz”):
  `STALL_CODEX_CALM` w `src/content/stallCodex.ts`, sekcja „Wersje spokojne” w `docs/content/stall-codex.md`,
  `codexCalm()` w `src/ui/stalls.ts`, `codexHtml(…, calm)` w `codex.ts`/`panels.ts`, 2 nowe testy w `tests/stall-codex.test.ts`.
  m4: 898 spokojnych / 15 zwykłych próbek, m8: 340 / 139. Zrzut 412×915 obejrzany (`tools/day7-shots.mjs WHAT=codex`).
- Zadanie 4 — dwa podglądy prognozy na pieczęci w trybie zegarka, tylko z flagą `?sealpace=a|b` (`sealPaceHtml` w
  `src/ui/pace.ts`, `hud.ts`, CSS `.seal-pace*`, klucze `contract.sealPace.eta/.late` w PENDING_KEYS). A: „gotowe za 3:05”
  pod zegarem; B: trzy małe pieczęcie bez słów. Zrzuty 360×380 zrobione (`tools/day7-shots.mjs WHAT=flip`), jeszcze nie w
  `docs/shots/`. **Do decyzji właściciela: A czy B** (rekomendacja: A).
**Zostało:** zatwierdzić zadania 2–4 (każde osobno, z D-97/D-98/D-99), zrzuty `day7-codex-*`/`day7-flip-*` do
`docs/shots/`, BACKLOG (zamknąć P2 „notatka w poziomie” i P3 „kodeks Kup wóz”, przy P3 Flip dopisać warianty).

## Plan nocy 2026-11-03/04 (właściciel ~22:15)
- Przerwa do resetu limitu **01:50 Brussels**; budzik `send_later` 01:51 (`trig_01XbYzYTQ84hRVHD1m32jheV`); godzinny cykl
  `trig_01TCkYqpaE2pikhXkeMNAEq9` **wyłączony do resetu** — włączyć po wznowieniu, prompt: do 2 agentów Opus bez limitu godzin.
- Deweloper w nocy: **„wszystko po kolei”** — najpierw poprawki z `docs/research/2026-11-03-first-10-minutes-b.md`
  („Naprawa” zawsze widoczna w arkuszu, zwłaszcza w poziomie; krok 5 w poziomie — zamknąć kartę wozu, notatka omija
  `.rail-tools`; koniec samouczka wyłącza „Drogę”; przycisk naprawy nie znika przy odświeżaniu arkusza; sprawdzić,
  czy „oko → Naprawa” kończy misję I), potem reszta day7 (ranga 5 w dolinie, kodeks dla spokojnych przypadków, warianty
  Flip), potem backlog po kolei: czytelność → grafika/animacje (tartak, rolnik, rybak) → misja-lekcja kupna wozu → wydajność.
- Researcher w nocy: **balans misji I–XII** (boty na różnych strategiach, osiągalność 1/2/3 pieczęci po dzisiejszych zmianach),
  potem dokończyć pomiar „pierwszych 10 minut” (`node tools/first10-minutes.mjs 915x412`, potem `412x915`, osobno).
- W nocy bez APK (jedno rano), decyzje do „Decyzje na rano”.
- **Decyzje właściciela ~22:30:** Flip — **wariant A** (linia pod zegarem pieczęci, „gotowe za 3:05”) jako domyślny
  w trybie zegarka, wariant B usunąć; ranga 5 doliny **14 500** — zostaje.
- **Do zrobienia po wznowieniu (01:51):** `claude/w-day7` ma commit `87fdf14 WIP` (zadania 2–4 gotowe, testy 431/0) —
  rozdzielić na commity, dopisać D-97..D-99 w DECISIONS, zrzuty `day7-codex-*`/`day7-flip-*` do docs/shots,
  BACKLOG; włączyć wariant A domyślnie; scalić do bazy.
- **~22:40: dokończenie day7 + poprawki z first-10-b oddane innej sesji Claude Code** (prompt od właściciela; gałąź
  `claude/x-day7-finish` z `claude/w-day7`, PR do bazy). Po wznowieniu NIE robić tego samego: deweloper nocny bierze
  grafikę/animacje (tartak, rolnik, rybak) i misję-lekcję kupna wozu; scalić PR tej sesji, gdy przyjdzie.
- **~22:50 właściciel: także `main`.** Na zdalnym nie było `main` — utworzona z bazy. Po każdym zielonym scaleniu do bazy:
  `git push origin claude/eager-cori-08wt8e:main` (fast-forward). PR innych sesji kierować do bazy, scalać lokalnie lub przez
  GitHub, potem przesunąć `main`. Praca autonomiczna, ciągła, PR-y wolno otwierać.

## Stan day7-finish (inna sesja) — 2026-11-03 (gałąź `claude/x-day7-finish` z `claude/w-day7`, PR do bazy)
Sesja `session_01SPCeEK6Xe5W8fsR6UsUZeP`. Baza `claude/eager-cori-08wt8e` scalona do gałęzi (notatki właściciela ~22:30,
`docs/research/2026-11-03-first-10-minutes-b.md`; konflikt w HANDOVER — obie strony zachowane). `src/sim` zmienia tylko
próg rangi 5 doliny. Testy **432/0** (nowy `tests/m1-eye-fix.test.ts`), typecheck i build zielone, złote hasze bez zmian,
`npm run bot` (m1) identyczny: wygrana 8,85 min, 2 pieczęcie, 26 srebra. Smoke m1–m12 + dolina (`quality=low&dynres=0&speed=4`)
bez błędów konsoli; `npm run layout -- --quick` **84/84**.
**Zadanie A (day7, WIP 87fdf14 rozbity):**
- 8d22927 — ranga 5 doliny **14 500** (D-97): bot DECENT 108,7 → 119,7 min; przegląd 14 000 / 15 000 / 16 000 = 116,0 / 123,1 /
  129,1 min (rangi 1–4 i srebro bez zmian). Tabela w `docs/playtest/PROTOCOL.md`.
- 6bc9d09 — spokojny wpis kodeksu `OUTPUT_FULL.NO_WAGON` „Pełno — nic pilnego”, bez „Kup wóz” (D-98). Zrzuty `day7-codex-*`.
- b912dbe — tryb zegarka (Flip): „gotowe za 3:05” / „spóźni się 1:20” pod zegarem pieczęci **domyślnie**, bez flagi; wariant B
  i `?sealpace` usunięte (D-99). Zrzut `day7-flip-a-m3-360x380.jpg`. Linia tylko w trybie zegarka (`Hud.compact`), nie przy
  ręcznym zwinięciu listu na dużym ekranie.
- d65e529 — BACKLOG (zamknięte: notatka kroku 5 w poziomie, ranga 5, kodeks „Kup wóz”, Flip).
**Zadanie B (first-10-minutes-b; bez zmian w sim):**
1. **„Naprawa” przyklejona do dołu arkusza** (D-100, 66a2077) — wybrane zamiast przeniesienia nad łańcuch: przy ~136 px treści
   w 915×412 przeniesienie zasłoniłoby przyczynę; teraz nagłówek łańcucha i pierwsze ogniwo na górze, przycisk zawsze w widoku,
   reszta przewija się pod nim (miękkie wygaszenie, bez linii). Zmierzone `tools/fix-shots.mjs`: przycisk w widoku 915×412 pl/ar
   i 412×915. Zrzuty `day7-fix-before-915x412.jpg` i `day7-fix-dock-*.jpg`.
2. **Przycisk nie znika pod palcem** (05cbd71) — arkusz budynku i wozu w trzech częściach (`display: contents`), każda
   przerysowywana tylko przy zmianie własnego HTML; przy wciśniętym palcu odświeżenie czeka. `tools/fix-tap.mjs`: węzeł
   przycisku przeżywa odświeżanie przy ×1; dotknięcie buduje most (180 → 150), w m3 kupuje wóz (270 → 240, 4 → 5 wozów).
3. **Koniec samouczka i „Pomiń” wyłączają „Drogę”** (e6a93fd; `host.finish` w `src/ui/app.ts`). `repro-step5.mjs END=1/SKIP=1`:
   `tool: none` w 915×412 i 412×915.
4. **Krok 5: karta z kroku 3 zamyka się** (6522fd0; `tutorial.ts`). W poziomie notatka pod listem, pasek narzędzi wolny,
   most się buduje (pl i ar). Zrzuty `day7-tut-step5-915x412-nocard.jpg`, `…-ar-nocard.jpg`.
5. **„Oko → Naprawa” kończy misję I** — tak: `tests/m1-eye-fix.test.ts` (dotyk karty najgorszego zastoju + przycisk z arkusza)
   wygrywa przy reakcji co 10 s (10,6 min) i 30 s (9,7 min); co 60 s przegrywa (12:00). Przyczyna porażki w badaniu: przycisk
   pod fałdą i przerysowanie (dotknięcie nie trafiło, srebro zostało 150) — naprawione w 1–2. Pełnego pomiaru 10 minut w
   przeglądarce nie powtarzałem (SwiftShader, ~1 min na krok) — BACKLOG P2.
Nowe narzędzia: `tools/fix-shots.mjs`, `tools/fix-tap.mjs`, `tools/day7-shots.mjs`; `repro-step5.mjs` + `SKIP`/`END`.
Następna decyzja: **D-101**. Nowe klucze PENDING_KEYS: `contract.sealPace.eta`, `contract.sealPace.late`.
**Do decyzji właściciela:** w poziomie przyklejona „Naprawa” zasłania korzeń łańcucha (widać nagłówek i pierwsze ogniwo;
przyczynę podaje też karta „Najgorszy zastój”) — zostawić, czy w poziomie dodatkowo skracać łańcuch do korzenia?
Do sprawdzenia na telefonie: dok „Naprawy” przy prawdziwym przewijaniu palcem (Android WebView, `:has`), linia „gotowe za”
na okładce Flip.

## Decyzje na rano (noc 6, 2026-11-04) — z `docs/research/2026-11-04-mission-balance.md`
Misje I–XII nietknięte przez zmiany z 11-03 (45 strategii, te same hasze). Zmiany balansu do decyzji (zmieniają złote hasze):
1. **M1: 3★ nieosiągalne** (najlepszy plan 8,85 min przy progu 7:00). Propozycja P1: progi 3★/2★ → **9:15 / 10:45**. Rekomendacja: tak.
2. **M4: same wozy dają 3★** (5 wozów, 6,52 min). P3: srebro 180 → **140**, progi 7:30 / 10:00 → lekcja (lód/most) konieczna. Rekomendacja: tak.
3. **M2: lekcja zatoru na moście niewidoczna** — P4: karta „zatrzymane przęsło” z przyciskiem bruku (bez zmian haszy, robi deweloper) + próg 2★ → 10:00 (zmienia hasze). Rekomendacja: karta tak, próg po playteście.
4. **M8 za łatwa** (same wozy 3★ przy każdym srebrze ≥120, bruk skraca o 13 s) — P6: przeprojektować (kryterium: same wozy ≤2★, lekcja + 1 wóz 3★ z zapasem ≥20 s). Rekomendacja: tak, osobna paczka.
5. Liczba wozów działa chaotycznie (M4: 4 wozy 1★, 5 → 3★, 6 → 1★; M9: wozy z karty → porażka) — do zbadania przy P6.
Bez decyzji (robi deweloper, bez zmian haszy): P2 wyszukiwarka luk (węzeł po stronie dostawcy, bez ukośnych skrótów; M5/M6 rozsądny gracz → 3★), P5 karta „jeden producent dla dwóch odbiorców” (M9/M10), karta z P4.

## Stan nocy 6 — 2026-11-04 (gałąź `claude/w-night6`, deweloper nocny)
Testy na koniec nocy **444/0** (nowe: `workers`, `missions-13`, `gap-finder`, `shared-card`, `held-span-card`), następna decyzja **D-106**;, typecheck i build zielone, złote hasze misji I–XII
bez zmian (dopisane tylko `m13|buy0/buy2`), `npm run bot` (m1) bez zmian: wygrana 8,85 min, 2★, 26 srebra.
1. **Ludzie przy pracy: tartak, rolnik, rybak (D-101, c70ea83).** Dwóch pilarzy przy pile na wysokich kozłach — górny stoi na
   kłodzie, dolny pod nią, piła to czwarta, osobno instancjonowana część, którą poza unosi (`lift`), więc obaj mają jeden ruch.
   Kozły przeniesione spod dachu szopy na otwarte podwórze (kamera nie widziała starej piły pod gontem). Rolnik z motyką na
   najbliższym wolnym polu uprawnym (≤ 6 pól od gospodarstwa, bez drogi/budynku/wody; przestawiany, gdy zmieni się sieć dróg),
   twarzą wzdłuż bruzd. Rybak z podrywką na pomoście. Ruch tylko przy `WORKING`. Koszt: ≤ 1,25 tys. trójkątów na postać,
   m1 +10 wywołań rysowania (41 → 51), JS klatki w szumie SwiftShadera (`tools/frame-cost.mjs` m1 low, 2 przebiegi: render
   12,4/13,4 → 18,7/12,6 ms). Zrzuty `docs/shots/night6-workers-{sawmill,farm,fisher}-{412x915,915x412}.jpg` i
   `night6-workers-rigs.jpg` (podgląd `tools/model-preview.html?view=workers`); narzędzie `tools/night6-workers-shots.mjs`.
2. **Misja XIII „Pierwsze piętro łańcucha” (D-102, f5f8aef, 466da36).** Spichlerz ma całe drewno i zboże, tartak/młyn/piekarnia
   przy jednym trakcie, **1 wóz** i 150 srebra; 24 deski + 16 chleba do 10:00, 3★ ≤ 5:30, 2★ ≤ 8:00. Karta: „Piekarnia: wszystkie
   wozy zajęte”, arkusz „Brak wolnego wozu do przewozu mąki” + „Kup wóz −30”. Bot `npx tsx tools/bot-m13.ts`: nic = porażka (deski
   24/24, chleb 0/16), 1 wóz @0:20 = 7,61 (2★), 3 wozy @0:20 = 5,06 (3★), 1 wóz @1:30 = 8,77 (1★). Listy w 17 językach, tytuł
   i podtytuł menu pl/en (+PENDING_KEYS), strona `docs/missions/m13.md`, zrzuty `docs/shots/night6-m13-{play,why,menu}-*.jpg`
   (`tools/m13-shots.mjs`). Dopisana na końcu jako XIII.
3. **Kolejka koordynatora (raport `docs/research/2026-11-04-mission-balance.md`; baza scalona 8bc6946), bez zmian haszy:**
   - **P2 wyszukiwarka luk (D-103, 5a57f97)** — wersja „solidna”: szukanie od bramy odciętego budynku do sieci stajni,
     ranking: srebro → mniej ukośnych pól → czas dojazdu od budynku, który ma tam dojeżdżać (producent z `OUTPUT_FULL` dla
     spichlerza). V, VI, XII dostają autorską prostą drogę (37,38)–(37,39). Rozsądny gracz (oko 10/30/60 s): V 3/2/2★,
     XII 3/3/3★ (było 3/2/3), I 1/1/1★ (było 1/1/porażka). **VI zostaje 1★ (8,94)** — droga jest już lekcją (sama 8,31 = 3★),
     ale karta potem każe kupić wóz i postawić spichlerz (−38 s); szybka łatka z raportu dawała 3★ tylko przez inny węzeł
     (36,40) — chaos dyspozytora, nie wyszukiwarka.
   - **P5 karta „jeden producent dla dwóch warsztatów” (D-104, dc67ed5)** — „Węglarnia: Chata drwala to jedyny dostawca dla
     2 warsztatów”, w arkuszu „Postaw jeszcze: Chata drwala −20”. IX: 3/3/2★ (było 1/porażka/1), X: 1/2/2★ (było 1/P/P).
   - **P4 karta „zatrzymane przęsło” (D-105, dc67ed5)** — wóz ≥ 20 s przed drewnianym przęsłem (zator, kra): „Tartak: Wóz 2
     stoi przed mostem zamkniętym przez krę”, w arkuszu „Wyłóż most kamieniem −72”. II: 2/1/1★ (było 1/1/1), IV 30/60 s
     2/2★ (było 1/1). Próg 2★ M2 10:00 — nie ruszany (czeka na właściciela).
   P4 i P5 w jednym commicie (wspólny kod rankingu i arkusza). Testy **444/0**, złote hasze bez zmian. Zrzuty
   `docs/shots/night6-card-{p5-m9-shared,p4-m4-heldspan,p2-m6-link}-{412x915,915x412}.jpg`. `npm run layout -- --quick`
   w tym worktree: 84 zadania „failed” wyłącznie przez 403 z serwera Vite (symlink `node_modules` poza `fs.allow`),
   zero innych uwag — do powtórzenia w głównym checkoutcie.
### Decyzje na rano (noc 6) — deweloper
- **Kolejność misji XIII:** dopisana jako XIII (przeniesienie po I wymaga przenumerowania tytułów w 17 językach i marginesów
  zapisów). Zostawić na końcu czy przenieść po I (lekcja jest prostsza niż II–XII)?
- **XIII a XI** uczą tego samego lekarstwa (kup wóz); różnica: XI długa trasa (nic = 1★), XIII jeden wóz na trzy warsztaty
  (nic = porażka). Zostawić obie?
- **Listy XIII w 15 językach** napisał agent — do przeglądu przez native speakerów przed wydaniem.
- **Tartak:** piła przeniesiona z szopy na podwórze (widoczność) — akceptacja wyglądu na zrzutach `night6-workers-sawmill-*`.
- **M6 (VI)** po D-103 nadal 1★ dla rozsądnego gracza — winne są późniejsze porady karty („Kup wóz”, „Postaw spichlerz”),
  nie droga. Czy karta ma przestać proponować spichlerz w VI, gdy duży spichlerz już jest podłączony? (osobna zmiana UI)
- **Karta „jeden dostawca”** pojawia się w IX/X od pierwszej sekundy (krytyczna) — podaje lekcję od razu. Zostawić, czy
  dopiero po np. 30 s czekania?
- Próg 2★ M2 → 10:00 (raport P4) i P1/P3/P6 — zmieniają hasze, nie ruszane.


## Stan nocy 6b — 2026-11-04 (gałąź `claude/w-night6b`, deweloper nocny)
Testy **447/0** (nowe: `next-letter-surplus`, `site-hint` ×2), typecheck i build zielone, złote hasze misji I–XIII
bez zmian (zmiany tylko w pomocnikach UI, danych czytanych przez UI i w obrazie), `npm run bot` (m1) bez zmian:
wygrana 8,85 min, 2★, 26 srebra. Następna decyzja **D-108**. Nic nie wypchnięte.
1. **Misja VI: karta przestaje podsuwać wóz i spichlerz (D-106, 2b7f577).** Przyczyna: między listami zamek nie
   bierze jeszcze desek (`contractTarget`), a `outputSurplus` porównywał z całym zamówieniem — pełny plac tartaku
   (`OUTPUT_FULL.NO_WAGON`) wyglądał na „brak wozu”. Wóz kupiony o 3:00 (sama droga 8,31 → 8,50) zostawiał potem
   oba spichlerze pełne, stąd „Postaw spichlerz” o 5:30 (→ 8,94, 1★). Teraz liczy się list, który obowiązuje: karta
   mówi „Nadwyżka: nikt teraz nie potrzebuje desek … Nowy wóz tego nie przyspieszy”. Ogólne (misje z listami: V, VI,
   XII), bez wyjątków misji. Rozsądny gracz oko 10/30/60 s (`tools/balance-night6.ts`, teraz z XIII), przed → po:

   | misja | przed | po |
   |---|---|---|
   | I | 1/1/1★ (10,06/9,91/11,38) | bez zmian |
   | II | 2/1/1★ (9,24/9,82/10,81) | bez zmian |
   | III | 1/1/2★ (8,15/9,30/7,66) | bez zmian |
   | IV | 1/2/2★ (10,56/7,58/7,96) | bez zmian |
   | V | 3/2/2★ (8,28/8,39/9,20) | 3/2/2★ (8,22/8,59/8,76) — 30 s o 12 s wolniej, ale bez spóźnionego listu |
   | **VI** | **1/1/1★ (8,94)** | **3/3/3★ (8,31)** |
   | VII | 1/1/1★ (10,90) | bez zmian |
   | VIII | 3/3/3★ | bez zmian |
   | IX | 3/3/2★ (8,12/8,99/10,08) | bez zmian (patrz pkt 2) |
   | X | 1/2/2★ (10,58/9,87/10,21) | bez zmian (patrz pkt 2) |
   | XI | 2/2/1★ | bez zmian |
   | XII | 3/3/3★ (8,46/8,80/8,52) | 3/3/3★ (8,80/8,55/8,52), o 120 srebra mniej wydane przy 10 s |
   | XIII | 3/3/2★ (4,38/5,49/6,42) | bez zmian |
2. **Misja X: duch budowy na autorskim miejscu (D-107, e4489a1).** `MissionDef.siteHints` (VII rybak, IX/X drwal) —
   dane misji czytane tylko przez UI, nie wchodzą do stanu. `buildSite` (`src/ui/site.ts`, czyste) daje autorskie
   miejsce, gdy wolne, inaczej dawne szukanie pierścieniami. Duch bierze bramę z podpowiedzi, a gdy miejsce jest poza
   ekranem, kamera do niego dojeżdża (z karty tartaku w X ducha w ogóle nie było widać). Narzędzie bilansu stawia
   teraz „producenta” tam, gdzie startuje duch (wcześniej spirala od bramy — liczby X 1/2/2★ z nocy 6 nie były
   duchem). Duch bez → z podpowiedzią: **X 3/3/1★ (8,41/8,59/11,12) → 3/3/3★ (9,04/8,59/9,11)**, IX 3/3/1★
   (8,06/9,10/11,16) → 3/3/2★ (8,71/8,99/9,24); reszta bez zmian. Przy 10 s X i IX są wolniejsze (≈ 40 s), pieczęcie
   te same.
3. **Karta zamku w kroku 2 samouczka (9a7e432).** Podczas samouczka „Zamówienie zamku” i „Tempo dostaw” siedzą w
   jednej zwiniętej fałdzie 48 px („ZAMÓWIENIE ZAMKU · TEMPO DOSTAW”, istniejące klucze, bez nowych tłumaczeń);
   karta w kroku 2: 29 słów (było ~45). Stan rozwinięcia na sesję, tylko UI.
4. **Obrys „Droga” w kroku 4 (1680708).** Obrys przycięty do ekranu — wychodził 1 px w lewo, w pionie też poza dół.
5. **Rolnik chodzi wzdłuż bruzdy (6f4a757).** Po każdym uderzeniu (2,6 s) krok 0,45 m w tył, w ostatnich 14 %
   cyklu; rząd = wolne pola uprawne wzdłuż bruzdy, najwyżej dwa w każdą stronę; na końcu zawraca. Zegar kroku biegnie
   tylko przy `WORKING`. Te same siatki instancjonowane — zero nowych wywołań rysowania.

Zrzuty (`docs/shots/night6b-*.jpg`, 412×915 i 915×412, obejrzane): `m6-surplus`, `m10-ghost`, `tut-s2`, `tut-s4`,
`farm-walk-{a,b}`. Narzędzia: `tools/night6b-shots.mjs <przypadek>`, `tools/night6b-tut-shots.mjs`. Podgląd na
porcie 5211 (5194 był zajęty przez obcy proces z nocy 6 — nieruszany); Vite nie zwracał 403 przy tych skryptach.
`npm run layout` nie uruchamiany w tej nocy.
### Decyzje na rano (noc 6b)
- **D-106 tekst:** dla desek na następny list karta mówi ogólne „nikt teraz nie potrzebuje desek”. Czy dodać osobne
  zdanie „zamek weźmie je z następnym listem” (nowy klucz i18n w 17 językach)?
- **D-107 kamera:** „Postaw jeszcze: …” zamyka kartę i przesuwa kamerę do ducha, gdy ten jest poza ekranem. Zostawić?
  (Przy reakcji 10 s IX/X wygrywają ≈ 40 s później niż ze starym miejscem obok pierwszego drwala — te same pieczęcie.)
- **Fałda karty zamku** zostaje zwinięta przez cały samouczek (także w kroku 6). Rozwijać ją po kroku 3?
- **Rolnik** chodzi po rzędzie przy płocie podwórza (najbliższe pole) — akceptacja wyglądu na `night6b-farm-walk-*`.
- **Pionowy zrzut `m10-ghost`:** półka budowy wygląda na przygaszoną w chwili zrzutu (trwa przejazd kamery) —
  sprawdzić na telefonie.

## Decyzje właściciela 2026-11-04 rano (~08:10)
- **M1:** progi 3★/2★ → **9:15 / 10:45** (P1) — tak, zmienić (hasze M1).
- **M4:** srebro 180 → **140**, progi **7:30 / 10:00** (P3) — tak (hasze M4).
- **M2:** próg 2★ — **po playteście** (karta „zatrzymane przęsło” już jest).
- **M8:** **przeprojektować**, osobna paczka (kryterium: same wozy ≤2★, bruk + 1 wóz 3★ z zapasem ≥20 s).
- **XIII:** zostaje **na końcu** do playtestu.
- **Karta „jeden producent dla dwóch warsztatów” (IX/X):** pokazywać **po ~30 s czekania**, nie od razu.
- **Tartak:** piła na placu — **zostaje**.
- Otwarte z nocy 6b (do zadania w dzień): D-106 brzmienie „zamek weźmie je z następnym listem”, D-107 lot kamery do ducha, karta zamku zwinięta przez cały samouczek, rząd rolnika przy płocie.

## Stan dnia 8 — 2026-11-04 (gałąź `claude/w-day8`, deweloper dzienny)
Wykonane decyzje właściciela z rana (M1, M4, karta IX/X) i nowa tabela rozsądnego gracza I–XIII. Testy **448/0**
(nowy przypadek w `shared-card`), typecheck i build zielone. `npm run bot` (m1): wygrana 8,85 min, **3★** (było 2★),
26 srebra. Następna decyzja **D-111**. Nic nie wypchnięte; M8 nietknięta (przeprojektowuje ją inna sesja).
1. **M1: progi 3★ 9:15, 2★ 10:45 (D-108, 8b0a83f).** `src/sim/missions.ts` i `missions/m1.json`; DESIGN.md cytuje progi,
   `docs-numbers` je sprawdza. Hasze: tylko M1 — `V4_GOLDEN` ×3 (sprawdzone pełną tabelą, nie tylko pierwszą/ostatnią
   strategią) i `valley-events-live` m1 ×2. Rozsądny gracz oko 10/30/60 s: 1/1/1★ → **2/2/1★** (10,06/9,91/11,38).
2. **M4: 140 srebra, progi 7:30 / 10:00 (D-109, a1f29f9).** Nadpisanie w `src/sim/missions-s2.ts` (propozycja
   `proposals/m4.ts` zostaje przy 180). Hasze: tylko M4 — `V4_GOLDEN` ×4, `valley-events-live` m4 ×2. Same wozy 6,52 (3★)
   → **10,16 (1★)**; sama lekcja 7,01 (2★) → **3★ +30 s**; list + oko+ 30 s 3★ +21 s; rozsądny gracz bez zmian 1/2/2★.
   **Strata:** skan+ 30 s 3★ → 1★ (kupuje 3 wozy, brak srebra na most) — wpis w BACKLOG. `tools/balance.ts m4` 1/2/3★ jak było.
3. **Karta „jeden producent dla dwóch warsztatów” po 30 s (D-110, d7095a3).** Sim nie liczy czekania (`stalledTicks`
   zeruje się przy `WAITING_DELIVERY`), więc UI próbkuje je co tick (`sampleInputWaits` w `onTick`, jak tempo dostaw;
   `WeakMap` na świat, poza stanem). Karta, linia karty i lekarstwo `producer` dopiero po 30 s nieprzerwanego czekania;
   arkusz budynku zachowuje podpowiedź tekstową od początku. Narzędzie bilansu próbkuje tak samo, a gracz „oko+”
   stawia producenta w miejscu ducha (D-107). IX 3/3/2★ (8,50/8,63/9,24), X 3/3/3★ (9,05/9,13/9,11) — bez straty pieczęci;
   X przy 30 s o 32 s wolniej (zapas +10 s). Bez zrzutów (zmiana tylko czasu pojawienia się istniejącej karty).
4. **Tabela „Po decyzjach 11-04”** dopisana do `docs/research/2026-11-04-mission-balance.md` (2998d65, 3a21b2a).
   Rozsądny gracz oko 10/30/60 s: I 2/2/1, II 2/1/1, III 1/1/2, IV 1/2/2, V 3/2/2, VI 3/3/3, VII 1/1/1, VIII 3/3/3 (stara
   wersja), IX 3/3/2, X 3/3/3, XI 2/2/1, XII 3/3/3, XIII 3/3/2. Zmiana względem nocy 6b tylko w I.
### Decyzje do podjęcia (dzień 8)
- **M4 skan:** przy 140 srebrze gracz klikający kolejne pinezki kupuje wozy i nie stać go na most (1★). Zostawić
  (lekcja: najpierw most), czy karta „Kup wóz” ma w misjach z lodem ustępować ostrzeżeniu o przęśle przed 3:00?
- **M1 oko 60 s** zostaje 1★ (most w 1:00, wozy od 3:00) — akceptowalne w samouczku?
- **VII:** rozsądny gracz 1★ przy każdym tempie (rybak tylko z listu) — kolejna paczka UI (karta „brak ryb / rybak
  daleko od wody”)?
- Po scaleniu przeprojektowanej M8: zmierzyć wiersz VIII (`npx tsx tools/balance-night6.ts m8`).

## Decyzje właściciela 2026-11-04 ~13:30 (dolina)
- Renoma za zamówienia królewskie **2× → 0,5× srebra** (research valley-3h, propozycja 1) — tak.
- Zapchany spichlerz w dolinie: podpowiedź **„Kup wóz”** zamiast „Postaw spichlerz” (`docs/research/2026-11-04-valley-late-cure-proto.patch`) — tak.
- Późna gra doliny: **(a) karta „Wąskie gardło” + punkt handlowy za rzeką od rangi 4** (125 %, drewniany most zamarza zimą,
  ranga 5 → 17 000; zapis v9 z migracją, nowy budynek, ~12 kluczy) — spec `docs/research/2026-11-04-valley-late-game.md`.
## Stan dnia 8b — 2026-11-04 (gałąź `claude/w-day8b`, deweloper dzienny)
Dokończona przerwana praca (WIP „landscape chain shortening” zastąpiony czystym commitem) i cztery poprawki renderu
z raportu render-scale. Testy **450/0** (nowe: `heightfield-bounds`, przypadek w `wagon-spacing`), typecheck i build
zielone, hasze bez zmian (sim nietknięty). Następna decyzja **D-112**. Nic nie wypchnięte; M8 nietknięta.
1. **Krótki łańcuch w poziomie (D-111, 886368b).** Arkusz boczny ≤ 500 px wysokości (`body.is-short`, 915×412, połowa
   HUD w trybie Flex): łańcuch „Dlaczego stoi?” pokazuje budynek w jednej linii (z zegarem przestoju) i od razu korzeń;
   ogniwa pośrednie zwinięte w jedno „+N ogniw(a) pośrednich” (48 px), rozwijane w miejscu (stan trzymany do zamknięcia
   arkusza). Pion i Fold-książka bez zmian. Samouczek celuje w pierwsze *widoczne* ogniwo. Pomiar
   `tools/chain-shots.mjs`: przy 915×412 korzeń 184–232 px nad „Naprawą” (góra 234) w VI/IX/XIII; po rozwinięciu body
   się przewija. `?lang=ar` — lustrzane, „+N” po angielsku (klucz `why.more` tylko pl/en). Zrzuty
   `docs/shots/day8b-chain-*.jpg`.
2. **Render #1 — zakresy uploadu buforów instancji (20cb8e9):** upload do GPU 689 → **40 KB/klatkę** (−94 %).
3. **Render #3 — stałe wysokości komórek i mapy wielokrotnego użytku w `afterTick` (5540df8):** alloc 93 → **42** /
   72 → **23 KB/tick** (near/far, 200 wozów).
4. **Render #2 — teren tylko dla widocznych i poruszonych wozów (9f88a7c):** alloc `wagons.frame` 156 → **48** /
   157 → **58 KB/klatkę**. Culling bez marginesu „na oko”: analityczne granice wysokości mapy (`Heightfield.bounds()`),
   śledzony wóz zawsze dokładnie.
5. **Render #6 — pinezki piszą transform tylko przy zmianie (d776134):** alloc `markers.update` 36 → **27 KB**.
   Obraz: `tools/jam-diff.mjs` **0 różnych pikseli** (scena domyślna i 60 wozów stress). Liczby i szczegóły:
   sekcja „Po poprawkach” w `docs/research/2026-11-04-render-scale.md`.
### Nie zrobione / do decyzji (dzień 8b)
- **Render #4 (cienie wozów mid / dalekich ładunków) i #5 (osobne materiały instancji)** — nie wdrożone: #4 zmienia
  obraz (brak cienia kół/konia 45–110 m), #5 wymaga pilnowania kopii materiałów; oba ze zrzutami low/high/ultra.
  Wdrożyć #4 (decyzja wizualna właściciela)?
- **`why.more` w 17 pozostałych językach** — dziś angielski fallback (PENDING_KEYS), jak inne nowe klucze.
- Na telefonie sprawdzić, czy „+N” na łączniku jest dość czytelne jako przycisk (dziś podkreślony tekst + szewron).
## Stan dnia 8c — 2026-11-04 (gałąź `claude/w-day8c`, deweloper dzienny)
Trzy paczki UI z listy „dzień 8” (VII, III, IV) i nowa tabela rozsądnego gracza. Testy **457/0** (nowe:
`pace-card` ×5, `ice-ahead` ×2), typecheck i build zielone, hasze bez zmian (sim nietknięty; jedyna zmiana w `src/sim`
to eksport `cellSpeed` z `index.ts`). Następna wolna decyzja **D-118** (D-112/113 mogła zająć sesja punktu handlowego).
Nic nie wypchnięte; dolina/punkt handlowy i M8 nietknięte.
1. **Karta tempa — producent za wolny (D-115, 5a5c0d4).** Nowy moduł `src/ui/paceCard.ts` (tam też przeniesione
   `forecastFor`, żeby narzędzia bez DOM mogły go użyć; `pace.ts` re-eksportuje). Gdy prognoza kontraktu ma cel, a
   producenci towaru-wąskiego gardła nawet bez przerwy nie zdążą na następną pieczęć (a jeden więcej zdąży) i misja
   pozwala go budować, miejsce karty „Najgorszy zastój” — tylko gdy nie ma prawdziwego przestoju (brak albo spokojny) —
   zajmuje karta „Tempo zamówienia” na zwykłym pergaminie (bez wiśniowego paska): „Chata rybaka ×1: 5,3/min, na
   3 pieczęcie trzeba ≈8,8/min — postaw więcej”. Oko → arkusz rybaka → „Postaw jeszcze: Chata rybaka” (duch w miejscu
   autorskim, D-107). Samouczek (notatki 1–5) chowa ją razem z kartą przestoju. **VII: 1/1/1★ → 3/3/3★.**
2. **Błoto — spokojna linia, bruk przy zagrożeniu (D-116, c62b44b).** Ten sam slot, rodzaj `mud`: w deszczu (albo
   roztopach) dostawa brakującego towaru do zamku, która najwięcej traci na błocie, i jej najdłuższy odcinek gruntu
   (≥ 6 pól, ≥ 15 % zysku): „Tartak: błoto spowalnia dostawy — bruk na 49 polach przyspieszy je o 53 %”. Arkusz
   tartaku pokazuje odcinek duchem na mapie; przycisk „Wybrukuj odcinek: 49 pól −147” tylko gdy prognoza < 3★, inaczej
   uspokajające zdanie. **III: 1/1/2★ → 2/3/2★.** W VIII (stara) linia też się pojawia, przycisk mówi o braku kamienia;
   pieczęcie bez zmian.
3. **Kra przed wozem (D-117, ac4995f).** W `cureFor`: przy autorskiej krze przed nami (`state.ice`) lekarstwo „wóz”
   zmienia się w „pave” przęsła, przez które jeżdżą dostawy, gdy most stać teraz, a po kolejnym wozie już nie.
   Karta „Zamek: za 2:00 kra zamknie most — kamienny kosztuje 72 srebra, a wóz zostawi za mało”, przycisk „Wyłóż most
   kamieniem” (`paveSpanFor`: najpierw wóz stojący na przęśle, potem kra przed nami). **IV: oko 10 s 1★ → 3★, skan
   1★ → 3★, oko 30/60 s bez zmian 2/2★.**
4. **Tabela „Po dniu 8c”** w `docs/research/2026-11-04-mission-balance.md`. Rozsądny gracz oko 10/30/60 s: I 2/2/1,
   II 2/1/1, III **2/3/2**, IV **3/2/2**, V 3/2/2, VI 3/3/3, VII **3/3/3**, VIII 3/3/3 (stara), IX 3/3/2, X 3/3/3,
   XI 2/2/1, XII 3/3/3, XIII 3/3/2. Żadna misja nie traci pieczęci. `PACE=0 npx tsx tools/balance-night6.ts` mierzy bez
   karty tempa.
Zrzuty `docs/shots/day8c-*.jpg` (VII karta/arkusz/duch, III karta/arkusz w pionie i poziomie + `-ar`, IV karta/arkusz),
narzędzie `tools/day8c-shots.mjs` (podgląd `npx vite preview --port 5211`). `seasons-fuzz` raz przekroczył limit 25 s,
gdy obok renderował Chromium — sam przechodzi (18 s); to nie regresja.
### Decyzje do podjęcia (dzień 8c)
- **VII za łatwa?** Z kartą tempa i duchem w miejscu autorskim każdy gracz ma 3★. Zostawić (lekcja „rybak nad wodą”
  widoczna na mapie), czy duch ma startować tylko przy najbliższym brzegu, bez miejsca autorskiego?
- **Linia błota także bez zagrożenia** (III, VIII przez większość deszczu zajmuje miejsce spokojnych kart) — zostawić
  jako stałą lekcję czytelności, czy pokazywać kartę tylko przy zagrożonych pieczęciach?
- **IV oko 30/60 s** zostaje 2★ (most dopiero z karty przęsła w 4:00) — wystarczy?
- Tłumaczenia nowych kluczy (pl/en, reszta angielski fallback).

## Stan dnia 8d — 2026-11-04 (a11y, gałąź `claude/w-day8d`)

- **Zrobione:** (1) listy jako modale z `inert`, nazwą i fokusem; (2) arkusze gry bez `aria-modal` — D-118; (3) skróty nie kradną Spacji/Enter/liter z kontrolek, przełącznik „Skróty klawiszowe”, domyślnie włączone przy myszy (`any-pointer: fine`), wyłączone na samym dotyku — D-119; (4) `scroll-padding` pod dok „Naprawa”, `is-bigtext` przy 200 % — D-120; (5) pinezki: nazwa z wagą i czasem („Najgorszy zastój — …, stoi 1:30”), jasna obwódka, krytyczna jako rozeta lakowa `pin-alarm` — D-121; (6) kontrast menu/„brak N”/ETA/śnieg — D-122; (7) dwutonowa obwódka fokusu — D-123; (8) reduced motion w rendererze (kamera, menu, puls szkicu) — D-124.
- Decyzje właściciela 11-04: skróty jak wyżej, arkusz przy 200 % w poziomie zasłania pieczęci/tempo — akceptowane, rozeta — akceptowana.
- Zrzuty: `docs/shots/day8d/pins-*` (dzień, noc, zima wymuszona przez `view.winter`). `npm run a11y` A11Y failed=0.
- Otwarte: przycisk „Sprzedaj za N” wyszarzony (alpha .6) liczy się w audycie jako 2:1 (wyłączona kontrolka, WCAG zwalnia); przełącznik „Ogranicz ruch” — dopiero po sprawdzeniu WebView na urządzeniu.
