# D-52 — Bilans Wolnej doliny z porami roku

## Zakres, środowisko, odtwarzanie

Pomiary wykonano **2 listopada 2026 r.** na rzeczywistym silniku TypeScript `src/sim`, bazującym na gałęzi `claude/eager-cori-08wt8e` (SHA `324c0ec0e139fe302107672e579b6237d375e81a`). Narzędzie: [`tools/balance-sandbox.ts`](../../tools/balance-sandbox.ts), niezależne od `tools/balance.ts`.

- **6 strategii × 3 seedy (`1301`, `1302`, `1303`) × 180 minut** = 18 przebiegów po 108 000 ticków, łącznie 1 944 000 ticków bazowych; następne 18 przebiegów po zmianie liczb wyłącznie w pamięci.
- Pory trwają po 15 min, powtarzają się trzy razy: wiosna (roztopy), lato (farma 120%), jesień (jarmark: piwo +25%), zima (farma 60%, rybak 50%, 2 zamknięcia drewnianych mostów po 2 min).
- **Pomiary czasu CI:** 47.8 s / 47.7 s (odpowiednio baseline / tuned), razem ok. 95.5 s symulacji na runnerze Ubuntu. Oba przebiegi pojedynczo poniżej 3 min. To nie jest pomiar na konkretnym laptopie; jego wydajności nie weryfikowano.
- **Wyniki:** 18/18 przebiegów bazowych bez błędów komend, konserwacji dóbr i rezerwacji; 18/18 po strojeniu.
- Uruchomienie: `npx tsx tools/balance-sandbox.ts` (baseline), `npx tsx tools/balance-sandbox.ts --tuned` (kontrafaktyczne ustawienia), `--json` (deterministyczne dane maszynowe na stdout).

**Polityki botów:** `nothing` nie wydaje żadnej komendy (ale **istniejące na mapie** drwal i tartak już produkują); `wood` inwestuje wyłącznie w drewno/deski i wozy; `bread` w farmy/młyny/piekarnie; `stone` rozwija chleb, ryby, kamieniołom, bruk oraz drewnianą przeprawę do farmy na południowym brzegu; `beer` realizuje wszystkie łańcuchy i dodatkowo wzmacnia piwowarstwo; `mixed` to istniejący `DECENT` z `tools/bot-sandbox.ts`. Wszystkie działania są zwykłymi `applyCommand()`, z czekaniem na dostępność srebra/kamienia.

## Rangi 1–5 i skumulowany dochód

Czas w **minutach symulacji**; „—” oznacza rangę nieosiągniętą przez 180 min. Skumulowany dochód to `ledger.silverEarned` (przychód ze sprzedaży, **nie** stan monet po wydatkach).

| Strategia | Seed | R1 (min) | R2 | R3 | R4 | R5 | Ranga końcowa | Srebro (łącznie) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| nothing | 1301 | — | — | — | — | — | 0 | 1,674 |
| nothing | 1302 | — | — | — | — | — | 0 | 1,981 |
| nothing | 1303 | — | — | — | — | — | 0 | 1,624 |
| wood | 1301 | 10.6 | — | — | — | — | 1 | 3,856 |
| wood | 1302 | 10.1 | — | — | — | — | 1 | 3,868 |
| wood | 1303 | 10.8 | — | — | — | — | 1 | 3,791 |
| bread | 1301 | 10.1 | 26.5 | — | — | — | 2 | 9,356 |
| bread | 1302 | 10.3 | 26.1 | — | — | — | 2 | 9,470 |
| bread | 1303 | 10.3 | 27.5 | — | — | — | 2 | 9,126 |
| stone | 1301 | 10.1 | 26.6 | 46.9 | 146.3 | — | 4 | 14,611 |
| stone | 1302 | 10.3 | 26.3 | 45.3 | — | — | 3 | 14,793 |
| stone | 1303 | 10.3 | 27.9 | 48.0 | 87.3 | — | 4 | 14,338 |
| beer | 1301 | 10.1 | 26.6 | 45.4 | 78.1 | 117.9 | 5 | 23,534 |
| beer | 1302 | 10.3 | 26.3 | 44.9 | 76.6 | 115.6 | 5 | 24,103 |
| beer | 1303 | 10.3 | 27.9 | 47.2 | 79.7 | 119.6 | 5 | 23,353 |
| mixed | 1301 | 10.1 | 26.6 | 45.4 | 78.1 | 123.4 | 5 | 21,715 |
| mixed | 1302 | 10.3 | 26.3 | 44.9 | 76.6 | 121.8 | 5 | 21,986 |
| mixed | 1303 | 10.3 | 27.9 | 47.2 | 79.7 | 123.9 | 5 | 21,627 |

## Srebro/min, zamknięcia mostów i zysk z jarmarku

Wiosna/lato/jesień/zima to suma wpływów z danej pory przez trzy lata / **45 min**, jednostka sr/min. Kolumny „Δ zima/jesień” porównują **każdą zimę z jesienią bezpośrednio przed nią**; dodatni procent oznacza spadek. Gdy zimą przychód wzrasta, procent jest ujemny. Premia jarmarku to **dokładna różnica naliczonych centów** za faktycznie sprzedane piwo względem normalnych kwot, przy identycznym nasyceniu rynku (wykorzystane `quoteCents`); nie jest to alternatywne przeliczenie zachowania botów.

| Strategia | Seed | Wiosna | Lato | Jesień | Zima | Δ zima/jesień: rok 1 | Rok 2 | Rok 3 | BRIDGE_CLOSED (epizody) | Zysk jarmarku (sr) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| nothing | 1301 | 8.7 | 9.1 | 9.5 | 9.9 | +11.8% | 0.0% | -24.8% | 0 | 0.00 |
| nothing | 1302 | 9.8 | 11.0 | 11.0 | 12.2 | -42.5% | 0.0% | 0.0% | 0 | 0.00 |
| nothing | 1303 | 8.0 | 9.1 | 9.5 | 9.5 | -0.8% | 0.0% | 0.0% | 0 | 0.00 |
| wood | 1301 | 19.7 | 22.9 | 21.1 | 22.0 | -5.4% | +2.9% | -12.1% | 0 | 0.00 |
| wood | 1302 | 20.4 | 21.2 | 21.6 | 22.7 | -6.1% | -3.3% | -6.4% | 0 | 0.00 |
| wood | 1303 | 20.2 | 21.7 | 20.9 | 21.5 | -4.8% | -17.3% | +10.7% | 0 | 0.00 |
| bread | 1301 | 43.9 | 55.5 | 55.1 | 53.4 | +2.1% | +2.9% | +3.9% | 0 | 0.00 |
| bread | 1302 | 41.8 | 58.1 | 55.0 | 55.5 | -6.1% | +3.3% | 0.0% | 0 | 0.00 |
| bread | 1303 | 44.0 | 54.7 | 51.7 | 52.3 | +0.8% | -12.7% | +7.9% | 0 | 0.00 |
| stone | 1301 | 70.2 | 84.0 | 91.8 | 78.7 | +5.6% | +14.1% | +21.3% | 27 | 0.00 |
| stone | 1302 | 68.1 | 87.1 | 91.7 | 81.9 | +1.9% | +15.3% | +13.5% | 36 | 0.00 |
| stone | 1303 | 67.4 | 84.7 | 87.0 | 79.5 | -4.3% | +13.1% | +14.3% | 41 | 0.00 |
| beer | 1301 | 96.7 | 129.7 | 152.6 | 144.0 | -21.1% | +10.5% | +13.1% | 0 | 479.93 |
| beer | 1302 | 100.7 | 131.7 | 157.1 | 146.1 | -23.7% | +12.2% | +15.3% | 0 | 493.28 |
| beer | 1303 | 96.6 | 128.3 | 148.9 | 145.2 | -24.9% | +14.1% | +1.8% | 0 | 472.25 |
| mixed | 1301 | 92.8 | 123.0 | 137.2 | 129.6 | -21.1% | +13.2% | +11.6% | 0 | 278.55 |
| mixed | 1302 | 96.1 | 125.0 | 136.3 | 131.3 | -23.7% | +8.9% | +12.7% | 0 | 280.30 |
| mixed | 1303 | 93.9 | 121.7 | 135.8 | 129.2 | -24.9% | +11.8% | +11.8% | 0 | 284.99 |

## Przestoje — pełny podział `ledger.stallSeconds`

Wartości to **sekundy przypisane do odrębnych przyczyn źródłowych** (łączne sekundy root-cause, nie czas przestoju jednej maszyny). Przyczyny jednoczesne się sumują — „Razem” może przekroczyć 10 800 sekund (180 minut) dla jednej symulacji. `WAITING_PICKUP` jest naliczane przez aktualny mechanizm `accountStalls()`; nie utożsamiamy go automatycznie z błędem sieci. Epizody BRIDGE_CLOSED w poprzedniej tabeli liczymy **przy każdorazowym wejściu w status** nowego wozu, nigdy co tick; sekundy w `ledger` to inna miara.

| Strategia | Seed | `BRIDGE_CLOSED` | `BRIDGE_JAM` | `NO_INPUT.CONTESTED` | `NO_WAGON.ALL_BUSY` | `OUTPUT_FULL.NO_WAGON` | `STORAGE_FULL` | `WAITING_PICKUP` | Razem root-sekundy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| nothing | 1301 | 0 | 0 | 0 | 0 | 858 | 8,733 | 9,229 | 18,820 |
| nothing | 1302 | 0 | 0 | 0 | 0 | 940 | 8,415 | 8,349 | 17,704 |
| nothing | 1303 | 0 | 0 | 0 | 0 | 895 | 8,937 | 9,156 | 18,988 |
| wood | 1301 | 0 | 0 | 0 | 0 | 6,357 | 0 | 14,133 | 20,490 |
| wood | 1302 | 0 | 0 | 0 | 0 | 6,711 | 0 | 13,552 | 20,263 |
| wood | 1303 | 0 | 0 | 0 | 0 | 6,912 | 0 | 14,576 | 21,488 |
| bread | 1301 | 0 | 0 | 0 | 35 | 6,601 | 0 | 15,937 | 22,573 |
| bread | 1302 | 0 | 0 | 0 | 13 | 6,835 | 0 | 15,073 | 21,921 |
| bread | 1303 | 0 | 0 | 0 | 29 | 7,405 | 0 | 15,907 | 23,341 |
| stone | 1301 | 955 | 44 | 0 | 7 | 13,963 | 0 | 23,291 | 38,260 |
| stone | 1302 | 846 | 92 | 0 | 6 | 14,385 | 0 | 21,642 | 36,971 |
| stone | 1303 | 955 | 80 | 0 | 9 | 17,131 | 0 | 22,407 | 40,582 |
| beer | 1301 | 0 | 0 | 106 | 28 | 17,378 | 0 | 24,623 | 42,135 |
| beer | 1302 | 0 | 0 | 219 | 24 | 16,393 | 0 | 23,265 | 39,901 |
| beer | 1303 | 0 | 0 | 155 | 43 | 17,094 | 0 | 25,326 | 42,618 |
| mixed | 1301 | 0 | 0 | 116 | 21 | 10,786 | 0 | 22,829 | 33,752 |
| mixed | 1302 | 0 | 0 | 411 | 14 | 10,633 | 0 | 22,257 | 33,315 |
| mixed | 1303 | 0 | 0 | 337 | 12 | 10,737 | 0 | 23,954 | 35,040 |

## Wnioski

1. **Zima spełnia cel „łagodna”.** Największy zmierzony spadek zimy wobec bezpośrednio poprzedzającej jesieni wynosi **21.3%**, poniżej limitu **35%** (0/54 przekroczeń). W **0/18** przebiegach spadła ranga: jest ona z definicji zatrzaskowa w `town.ts`, więc sam brak degradacji nie jest niezależnym dowodem dobrego balansu.
2. **Strategia piwna ma przewagę nad mieszaną:** średnio **23,663** wobec **21,776** sr w 180 min (**+8.7%**). Osiąga R5 szybciej we wszystkich trzech seedach, ale płaci za to większą liczbą budynków/wozów oraz wyraźnie większym `OUTPUT_FULL.NO_WAGON`. To przewaga w dochodzie i czasie rozwoju, nie w niezawodności logistyki; nie jest bezkosztową strategią wygrywającą.
3. **Sam jarmark nie tworzy skokowej przewagi.** Bezpośrednia premia wynosi średnio **481.82 sr** dla `beer` i **281.28 sr** dla `mixed` w całych 180 minutach; strategie bez piwa otrzymują 0. Dominację napędza przede wszystkim rozbudowany łańcuch i wysoka cena bazowa piwa, nie sam bonus sezonowy.
4. **Most został faktycznie wykorzystany.** Strategia `stone` zaliczyła **27 / 36 / 41** wejść w `BRIDGE_CLOSED` (seedy 1301–1303), przy **955 / 846 / 955** root-sekundach `BRIDGE_CLOSED`. Pozostałe strategie nie zbudowały transportu przez drewniany most i poprawnie raportują zero takich epizodów. Mosty nie są niszczone; lód mija automatycznie.
5. **Progresja zachęca do dywersyfikacji:** `nothing` kończy na R0, `wood` na R1, `bread` na R2; `stone` dociera do R3/R4, natomiast `beer` i `mixed` do R5. Zauważalna zmienność między seedami oznacza, że wyniki nie są gwarancją dla każdej losowej mapy.

### Ograniczenie interpretacji

Gospodarka w trakcie 180 min rośnie; porównanie jesień → zima obejmuje **jednocześnie pogodę, sprzedaż jarmarczną i inwestycje bota**, nie jest izolowanym testem przyczynowym produkcji zimowej. Raport mierzy realną sesję gracza, nie „stan stały”. Powtórzone niezależnie na runnerze CI **15/15 niezmienionych scenariuszy** dało bajtowo identyczne dane JSON (bez pól czasowych); trzy seedy nie stanowią natomiast próby reprezentatywnej dla wszystkich możliwych map.

## Proponowane strojenie (kontrafaktyczne, **nie włączone do gry**)

Proponujemy **łagodny, łączny** nerf browaru, bez zmieniania parametrów `seasons.ts`: zima już spełnia cel, zaś piwo dominuje w porównaniu z `mixed` na dwóch głównych metrykach. Nie ma uzasadnienia, aby agresywnie przycinać zimę.

| Plik / parametr | Bazowo | Proponowane | Przyczyna |
|---|---:|---:|---|
| `defs.ts → MARKET.base.beer` | 9 sr | **8 sr** | Mniejsza premia za jednostkę drogiego towaru |
| `defs.ts → BUILDINGS.brewery.recipe.ticks` | 16 s | **18 s** | Nieco wolniejszy przerób słodu na dwa piwa |
| `seasons.ts → winter farmYieldPercent` | 60% | **bez zmian** | 21.3% maks. spadku — cel 35% zachowany |
| `seasons.ts → AUTUMN_FAIR_GOOD bonus` | +25% | **bez zmian** | Wpływ premii jarmarcznej umiarkowany |

**Pomiar po obu zmianach jednocześnie:** `runBalanceSuite(true)` zmieniło liczby **w pamięci procesu**, wykonało pełne kolejne 18 scenariuszy na tym samym silniku i seedach, po czym przywróciło wartości. Poniższe różnice nie są oddzielnymi efektami każdego parametru.

| Strategia | Srebro bazowe (średnia) | Po strojeniu | Zmiana | Premia jarmarku bazowa → nowa (sr) | R5 bazowa → nowa (min) |
|---|---:|---:|---:|---:|---:|
| nothing | 1,760 | 1,760 | 0.0% | 0.00 → 0.00 | — → — |
| wood | 3,838 | 3,838 | 0.0% | 0.00 → 0.00 | — → — |
| bread | 9,317 | 9,317 | 0.0% | 0.00 → 0.00 | — → — |
| stone | 14,581 | 14,581 | 0.0% | 0.00 → 0.00 | — → — |
| beer | 23,663 | 22,695 | -4.1% | 481.82 → 409.24 | 117.7 → 121.0 |
| mixed | 21,776 | 21,271 | -2.3% | 281.28 → 258.08 | 123.0 → 123.9 |

Przewaga `beer` nad `mixed` w srebrze maleje z **+8.7% do +6.7%**. Zimowy spadek w wariancie strojeniowym maksymalnie **21.3%**, nadal <35%. R5 pozostaje dostępna w 3/3 seedów `beer` i 3/3 `mixed`. **Rekomendacja:** patch traktować jako propozycję do kolejnego playtestu, nie automatyczną zmianę sim; bez badań odczuć graczy nie można przesądzić, że łączny nerf jest niezbędny.

### Patch do ewentualnego zastosowania w osobnym PR

```diff
diff --git a/src/sim/defs.ts b/src/sim/defs.ts
--- a/src/sim/defs.ts
+++ b/src/sim/defs.ts
@@ -137,1 +137,1 @@
-  brewery: { type: 'brewery', w: 3, h: 2, recipe: { inputs: { malt: 1 }, outputs: { beer: 2 }, ticks: 16 * s }, inCap: 8, outCap: 12, storeCap: 0, price: 60 },
+  brewery: { type: 'brewery', w: 3, h: 2, recipe: { inputs: { malt: 1 }, outputs: { beer: 2 }, ticks: 18 * s }, inCap: 8, outCap: 12, storeCap: 0, price: 60 },
@@ -183,1 +183,1 @@
-  base: goodsOf({ wood: 1, planks: 3, grain: 1, flour: 3, bread: 4, fish: 3, stone: 2, charcoal: 4, malt: 4, beer: 9 }),
+  base: goodsOf({ wood: 1, planks: 3, grain: 1, flour: 3, bread: 4, fish: 3, stone: 2, charcoal: 4, malt: 4, beer: 8 }),
```

**Brak zmian w obecnych plikach `src/sim` tego PR.** Źródło danych i kontrola CI: [GitHub Actions — D-52 baseline i tuned](https://github.com/woogitsugames/marchi/actions/runs/41432555084). W CI uruchomiono pełny `npm test`, `npm run typecheck`, `npm run build`, `npm run bot` i `npm run perf:sim`; tymczasowy test zbierający dane pomiarowe usunięto z docelowej gałęzi, pozostawiając samodzielny `tools/balance-sandbox.ts`.
