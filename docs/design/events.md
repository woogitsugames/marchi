# D-44 — Zdarzenia w Wolnej dolinie (projekt, bez integracji)

**Podstawa:** D-21 (rozgrywka bez kar, energii i FOMO); D-29 (docs/design/sandbox.md: 10 towarów, rangi, handel); D-33 (docs/design/seasons.md: działające pory roku). Niniejsze zlecenie dodaje tylko nowy moduł src/sim/proposals/events.ts, testy i treści. **Nie dodaje jeszcze zdarzeń do działającej gry, zapisu ani HUD.**

## Zasady wspólne

Zamówienia, jarmarki i kupiec są **dobrowolnymi okazjami logistycznymi**, nie zadaniami z porażką. Nie ma kar, wygaśnięcia zamówienia, powiadomień push, zegara rzeczywistego, zasobów odzyskiwanych offline ani konieczności powrotu w określonej porze. Zdarzenia są przewidziane wyłącznie dla misji sandbox, a nie dla kontraktowych poziomów.

Każde losowanie korzysta wyłącznie z czterowyrazowego RNG zapisanego w SimState.rng i zegara SimState.tick (10 ticków na sekundę). Generator zwraca nowy stan zdarzeń i nowy RNG. Dopóki nie ma integracji, nic nie mutuje świata, zapasów ani pieniędzy.

**Niezgodność starszej specyfikacji:** projekt sandbox.md podawał sześciominutowy sezon, ale działający system D-33 ma **15 minut na sezon = 9 000 ticków**. Nowy moduł przyjmuje tę rzeczywistą wartość. Aktualny silnik w seasons.ts i town.ts już nadaje jesienią **+25% ceny piwa**. Integracja D-44 ma **zastąpić** ten dotychczasowy bonus dynamicznym jarmarkiem; nie wolno naliczyć jednocześnie dwóch bonusów ani dublować jarmarków.

## Dostępność — dziesięć towarów i rangi 0–5

Towar kwalifikuje się wtedy i tylko wtedy, gdy ranga odblokowuje jego producenta **oraz wszystkie budynki całego łańcucha faktycznie istnieją w dolinie**. Sama ranga, zapasy z przeszłości i historyczne transakcje nie wystarczają. Budynki startowe są liczone. Brak drogi albo chwilowy przestój nie oznacza kary; nie zmieniamy istniejącej diagnostyki transportu.

| Minimalna ranga | Towar | Łańcuch wymaganych producentów |
| --- | --- | --- |
| 0 | drewno / wood | drwal (woodcutter) |
| 0 | deski / planks | drwal → tartak (sawmill) |
| 0 | ziarno / grain | farma (farm) |
| 1 | mąka / flour | farma → młyn (mill) |
| 1 | chleb / bread | farma → młyn → piekarnia (bakery) |
| 2 | ryby / fish | rybak (fisher) |
| 2 | kamień / stone | kamieniołom (quarry) |
| 3 | węgiel drzewny / charcoal | drwal → węglarnia (charcoalBurner) |
| 3 | słód / malt | farma → słodownia (malthouse) |
| 4 | piwo / beer | farma → słodownia → browar (brewery) |
| 5 | wszystkie dostępne rodzaje | nowe, trudniejsze królewskie zamówienia, bez nowego producenta |

Dostępność jest liczona czystą funkcją producibleGoods() i zawsze zwracana w kanonicznej kolejności GOODS. Dla rangi 0 nie wolno proponować piwa; dla rangi 4 bez słodowni nadal nie wolno.

## 1. Zamówienia królewskie

**Maksymalnie dwa aktywne**. Teksty obejmują 30 niezależnych wariantów (palisada, wesele, post, zjazd rycerstwa, budowa kościoła, pielgrzymki, oblężenie sąsiedniego grodu itp.), z rangą minimalną i 1–3 towarami. Wybór jednej oferty dokonywany jest z dostępnym RNG w oparciu o istniejącą produkcję; drugi slot nie jest zapełniany podczas tego samego wywołania.

**Częstotliwość:** pierwsza oferta, gdy istnieje kwalifikujący się towar; następne nie częściej niż co **3 600 ticków / 6 minut symulacji**. Gdy oba miejsca są zajęte, nie losujemy niepotrzebnie kolejnych ofert. Dwa aktywne zamówienia nigdy nie mają tego samego wariantu.

**Rozmiar i nagrody:** ilości całkowite dodatnie, skalowane przez rangę, liczbę towarów i ich cenę bazową. Wartość bazowa = suma (ilość × MARKET.base towaru). Nagroda w srebrze = **ceil(1,5 × wartość bazowa) + 8 + 5 × ranga**. Nagroda w renomie = **2 × nagroda w srebrze**. Oba wynagrodzenia ustala się w chwili wylosowania; nie zmieniają się wskutek nasycenia rynku ani zmian rangi.

**Realizacja:** potrzebne towary powinny dotrzeć do zamku i być rzeczywiście dostępne. Pure helper deliverRoyalOrder() zwraca akceptowaną ilość, zaktualizowany postęp per towar i jednorazową nagrodę po całkowitym zakończeniu. Jeszcze nie księguje towarów ani srebra. Przyszła komenda musi atomowo: zweryfikować niezastrzeżony stan zamku, odjąć faktycznie przyjęte sztuki, zwiększyć ledger.consumed, zapisać postęp, przy pełnym wykonaniu wypłacić srebro i renomę, usunąć zamówienie. Dwukrotne zatwierdzenie tego samego zamówienia nie może wypłacić nagrody ponownie.

**Odrzucenie:** przycisk „Odłóż” usuwa zamówienie **bez straty srebra, renomy lub towarów**. Po odrzuceniu kolejna oferta jest możliwa dopiero po następnym przyroście licznika ledger.sold (realna dostawa na rynek); bez natychmiastowego losowania tego samego tekstu. Inne zamówienie zostaje aktywne. Brak terminu, listy porażek i czerwonego licznika.

## 2. Jarmarki sezonowe

**Co trzeci sezon** — indeksy 2, 5, 8, 11 itd. (pierwszy: jesień pierwszego roku, następnie lato, wiosna, zima). Przy sezonie 15-minutowym powtarzają się co **45 minut czasu symulacji**. Każdy jarmark premiuje dokładnie **jeden** wytwarzalny towar, przez dokładnie **jeden sezon**.

**Zapowiedź:** 1 200 ticków = **2 minuty symulacji** przed rozpoczęciem sezonu. Wtedy dobierany jest towar z RNG i utrwalany w propozycji; zapowiedź może być pokazana bez powiadomień i bez odliczania do końca. Okno [startTick, endTick) służy wyłącznie ustaleniu ceny, nie jest deadlinem gracza.

**Premia:** **+25% ceny jednostkowej po uwzględnieniu nasycenia rynku**, czyli 125% bieżącej wyceny. Rozliczaj centy i zaokrąglaj każdą sztukę jak istniejący system handlu. Inne towary zachowują własne ceny; jarmark nie zmienia ich nasycenia ani podstawowych cen. W przeciwnym razie bonus istnieje tylko jako informacja — jego niewykorzystanie nie jest stratą.

| Pora roku | Towary dopuszczane do losowania jarmarku |
| --- | --- |
| Wiosna | drewno, deski, ziarno, mąka |
| Lato | ziarno, mąka, chleb, ryby, słód |
| Jesień | deski, ziarno, chleb, słód, piwo |
| Zima | drewno, deski, ryby, kamień, węgiel drzewny |

Każdą pulę przecinamy z wynikiem producibleGoods(). Jeśli żaden towar nie pasuje, jarmark jest pomijany bez kary i bez niepotrzebnego RNG. W okresie zapowiedzi można jeszcze dobudować brakujący łańcuch. FairStage określa neutralne stany: brak, zapowiedź, trwa. Integracja nie może nakładać tego +25% na istniejący automatyczny jesienny bonus piwa.

## 3. Wędrowny kupiec

**Nie częściej niż jedna nowa oferta na dwa sezony** (okazja w sezonach 0, 2, 4...), tylko jeśli istnieje rzeczywista nadwyżka. Oferta nie wygasa; można ją zaakceptować lub odłożyć. Odrzucony kupiec nie wraca w tym samym oknie sezonowym. Jego przybycie niczego nie pobiera automatycznie.

**Definicja nadwyżki:** niezarezerwowane zapasy wyjściowe producenta danego towaru oraz wolny zapas w magazynach. Nie liczymy wejść do przetwórcy, towarów w zamku, ładunków na wozach ani sztuk zarezerwowanych do transportu. Dla każdego towaru pozostawiamy **6 sztuk** rezerwy roboczej; dla kamienia dodatkowo **18 sztuk** rezerwy budowlanej. Oferta pojawia się dopiero przy **co najmniej 4 sztukach ponad rezerwy**, obejmuje **maksymalnie 12 sztuk jednego towaru**.

**Cena:** gwarantowane **140% ceny bazowej** jednostki, wyrażone w centach (np. deski o bazowej cenie 3 srebra = 420 centów / szt.). Kupiec płaci lepiej niż niesycony rynek (100%) i jarmark (125%). Bonus kupca nie łączy się z premią jarmarku. Ustalona stawka nie zmienia się przez późniejsze nasycenie rynku.

**Realizacja:** dobrowolna sprzedaż musi ponownie potwierdzić zapas, rezerwacje i połączenie logistyki; dopiero potem atomowo odjąć rzeczywisty towar z określonych budynków, odnotować go w ledger.consumed i ledger.sold, wypłacić srebro z resztą centów przez market.cents, zaktualizować renomę i zamknąć ofertę. Helper acceptMerchant() zwraca **wyłącznie czystą wycenę i zamknięcie oferty w propozycji**, nie mutuje świata; bez adaptera nie jest to faktyczna sprzedaż. Jeśli nadwyżka zniknęła, pokaż neutralny komunikat.

## 4. Model zapisu i deterministyczny replay

Proponowane nowe pole przyszłego SimState: valleyEvents: ValleyEventState. Stan zawiera orders, nextOrderTick, nextOrderAfterSoldUnits, lastRejectedTemplate, sequence, fair, lastFairSeasonIndex, merchant i lastMerchantSeasonIndex. Wszystkie pola są danymi JSON (bez Set, Date, timerów). RNG **pozostaje w istniejącym SimState.rng**, nie należy go duplikować w tym polu.

proposeValleyEvents(snapshot, previousEvents) zwraca { events, rng }. Wejście nie jest mutowane; lokalna implementacja następnego kroku sfc32 zachowuje algorytm z rng.ts. Kolejność losowań jest stała: **jarmark, zamówienie, kupiec**. Nie losować z renderowania lub z asynchronicznych callbacków; wywoływać raz na krok w stabilnym punkcie i **zapisywać events i rng jednocześnie**. Kolejny przebieg po save/load musi dać identyczny wynik. Dla misji innych niż sandbox brak ofert i brak dodatkowego zużycia RNG.

Wdrożenie w osobnym PR musi obejmować: migrację wersji zapisu i neutralną inicjalizację pola; deterministyczne wywołanie generatora z tym samym tickiem co market i ledger; cztery komendy dla zamówienia i kupca; atomowe ledger/stock/silver/renown; zastąpienie bonusu piwa w seasons.ts/town.ts; dodanie kluczy i18n; testy fizycznej konserwacji towarów, powtórzenia replay, cold/warm save i zbiegu transakcji z rezerwacją do wozu. **Nie ma żadnej zmiany plików istniejącej symulacji w D-44.**

## 5. Nowy HUD: karta pod panelem kontraktu

Nowa karta **„Wieści z doliny”** znajduje się bezpośrednio **pod panelem kontraktu**, tylko w Wolnej dolinie. Na telefonie jest zwijalna, dostępna także z klawiatury i czytnika ekranu. Kolory/ikony nie są jedynymi nośnikami informacji; zachowujemy wysokie kontrasty, czytelne nazwy i cel dotykowy co najmniej 48 dp.

1. **Zamówienia królewskie (0–2):** krótki tytuł i historyczny kontekst z docs/content/events.md, postęp np. „6/12 desek”, nagroda „+N srebra i +M renomy”, przycisk „Odłóż”. Ani terminu, ani paska grożącej porażki.
2. **Jarmark (0–1):** lokalizowana pora roku, ikona konkretnego towaru, napis „Cena +25%”; przed początkiem „W następnym sezonie”, w sezonie „Jarmark trwa”. Bez odliczania, alarmu, negatywnych komunikatów czy FOMO.
3. **Wędrowny kupiec (0–1):** towar, maksymalny wolumen, cena za sztukę, „Sprzedaj nadwyżkę” i „Odłóż”; jeśli zapas zniknął, wyjaśnienie bez kar i bez automatycznej sprzedaży.

Karta nie przykrywa panelu „Dlaczego stoi?”, nie uruchamia RNG przez samo otwarcie i nie blokuje budowy. Nie ma reklam ani konfetti. Wszystkie tytuły i komunikaty PL/EN znajdują się w docs/content/events.md; i18n runtime jest osobnym etapem.

## 6. Weryfikacja i ograniczenia

Nowy tests/valley-events.test.ts kontroluje powtarzalność tego samego seed i reload JSON, limity 2 zamówień, 1 kupca, jeden towar jarmarkowy, listę 10 towarów, rangi 0–5 i rzeczywiście istniejące łańcuchy, odmowę bez kar, jednorazowe rozliczenie nagród, nadwyżki i rezerwy oraz zgodność 30 wariantów PL/EN. W pełnym repozytorium uruchom: **npm test -- valley-events** i **npm run typecheck**.

**Granica zakresu:** przygotowane moduły nie modyfikują stanu istniejącej gry i nie oznaczają, że zdarzenia są już widoczne w HUD. Włączenie gospodarki i UI wymaga osobnego, przetestowanego etapu.
