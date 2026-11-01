# Raport siatkowego balansu misji MARCHIA

> Wygenerowano przez `npx tsx tools/balance-grid.ts` z rzeczywistego symulatora `src/sim`.
> To **rekomendacje**, nie zmiany danych w `src/sim`.
> **Zakres zweryfikowany:** raport zawiera ostatni zakończony przebieg, w tym 162 warianty fizyczne M1 (M2: 81, M3: 81). Nowsza wersja skryptu dodatkowo przeszukuje lżejsze kontrakty M1 (50% i 67%), lecz jej rozszerzony przebieg nie został jeszcze zweryfikowany; nie przypisujemy mu wyników.

## Metoda i kryteria

- Strategie: **nic**, **+2 wozy na starcie** (koszt 60 srebra), **właściwa naprawa**, **naprawa +2 wozy**. Interwencja M1: drewniany most `x=41,y=24..44` na starcie; M2: kamienna modernizacja mostu `x=51,y=30..42` po 45 s; M3: bruk `x=32..80,y=40` po 25 s.
- Cel: **nic = 0–1 pieczęć**, **częściowa strategia (same wozy albo sama naprawa) = 2**, **pełna interwencja (naprawa + wozy) = 3**, zwycięstwa w przedziale **5–12 min**.
- Wyniki czterech strategii na tym samym seedzie są porównywane bez zmian AI, tras, terenu ani zasad produkcji. Nieudane komendy i błędy inicjalizacji dyskwalifikują wariant.
- Siatka fizyczna: ilości desek/chleba × srebro × początkowe wozy (warianty 80%, 100%, 120% ilości; srebro −30/0/+30; wozy −1/0/+1, a dla M1 również +2/+3/+4). Termin kontraktu: **7–12 min co 0,5 min**; pieczęcie: próg 3 od 5 min co 0,25 min, próg 2 co 0,25 min z warunkiem `5 ≤ 3★ < 2★ < termin`.
- Dla każdej konfiguracji symulacja trwa maksymalnie 12 min (10 ticków/s). Terminy i progi pieczęci są przeszukiwane **analitycznie** z uzyskanych czasów zwycięstwa — nie zmieniają zachowania dyspozytora przed końcem kontraktu.
- Każda konfiguracja fizyczna jest sprawdzana na seedzie misji. **10** najlepszych kandydatów + ustawienia pierwotne są oceniane na sześciu seedach: bazowy oraz przesunięcia **+1, +7, +19, +41, +73**. Finalista wygrywa według liczby seedów spełniających wszystkie warunki, następnie sumy zgodnych kryteriów i odległości od danych obecnych.
- Reprodukowalność: zwycięski wariant jest uruchamiany jeszcze raz na bazowym seedzie dla każdej z czterech strategii, z porównaniem wyników i hasza stanu.

## Rekomendowane ustawienia (bez modyfikacji kodu misji)
| Misja | Kontrakt | Srebro | Wozy | 3★ | 2★ | Termin | Zgodne seedy / 6 | Deterministyczna |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | 30 desek / 16 chleba | 180 | 4 | 8.25 min | 11.50 min | 12.00 min | 3/6 | tak |
| M2 | 36 desek / 30 chleba | 160 | 7 | 8.75 min | 10.00 min | 12.00 min | 6/6 | tak |
| M3 | 24 desek / 16 chleba | 270 | 4 | 6.25 min | 8.00 min | 11.00 min | 6/6 | tak |

**Interpretacja:** 6/6 oznacza spełnienie wszystkich trzech poziomów pieczęci i czasu na sześciu seedach. Wynik mniejszy nie jest pełną walidacją balansu; wymaga poprawki projektu misji lub szerszego przeszukania.

## M1 — porównanie i uzasadnienie

**Dane obecne:** 30 desek / 20 chleba, 180 srebra, 2 wozów, 7 / 9 / 12 min (3★ / 2★ / koniec).
**Rekomendacja:** 30 desek / 16 chleba, 180 srebra, 4 wozów, progi 8.25 / 11.5 / 12 min. Trafność: **3/6** seedów.

**Stan obecny — bazowy seed 1301:**
| Nic | +2 wozy | Sama naprawa | Naprawa + wozy |
| --- | --- | --- | --- |
| porażka (0) | porażka (0) | porażka (0) | porażka (0) |

**Po rekomendacji — porównanie sześciu seedów:**
| Seed | Nic | +2 wozy | Sama naprawa | Naprawa + wozy | Częściowa (2★) | Kryteria |
| --- | --- | --- | --- | --- | --- | --- |
| 1301 | porażka (0) | porażka (0) | 11.30 min (2) | 8.08 min (3) | repair | **TAK** |
| 1302 | porażka (0) | porażka (0) | porażka (0) | porażka (0) | brak | NIE |
| 1308 | porażka (0) | porażka (0) | porażka (0) | porażka (0) | brak | NIE |
| 1320 | porażka (0) | porażka (0) | 10.83 min (2) | 7.72 min (3) | repair | **TAK** |
| 1342 | porażka (0) | porażka (0) | 10.20 min (2) | 7.76 min (3) | repair | **TAK** |
| 1374 | porażka (0) | porażka (0) | porażka (0) | porażka (0) | brak | NIE |

**Uzasadnienie:** Bez interwencji wyznaczamy punkt odniesienia; pozostałe strategie rozdzielają koszt przepustowości i floty. Test seeda uwzględnia również wykonalność komend i wpływ terenu. **Nie osiągnięto pełnej stabilności na sześciu seedach**: wartości są najlepszą znalezioną propozycją, nie potwierdzonym balansem. Dwa dodatkowe wozy kosztują 60 srebra.

**Najlepsze sprawdzone alternatywy:**
| Deski/chleb | Srebro | Wozy | 3★ / 2★ / termin | Seedy zgodne |
| --- | --- | --- | --- | --- |
| 30/16 | 180 | 4 | 8.25 / 11.5 / 12 | 3/6 |
| 24/16 | 180 | 4 | 7.75 / 11.5 / 12 | 3/6 |
| 30/16 | 150 | 4 | 8.25 / 11.5 / 12 | 3/6 |
| 30/16 | 210 | 4 | 8.25 / 11.5 / 12 | 3/6 |
| 24/16 | 150 | 4 | 7.75 / 11.5 / 12 | 3/6 |

## M2 — porównanie i uzasadnienie

**Dane obecne:** 36 desek / 30 chleba, 160 srebra, 7 wozów, 8.75 / 9.75 / 12 min (3★ / 2★ / koniec).
**Rekomendacja:** 36 desek / 30 chleba, 160 srebra, 7 wozów, progi 8.75 / 10 / 12 min. Trafność: **6/6** seedów.

**Stan obecny — bazowy seed 2402:**
| Nic | +2 wozy | Sama naprawa | Naprawa + wozy |
| --- | --- | --- | --- |
| 10.81 min (1) | 9.94 min (1) | 9.58 min (2) | 8.51 min (3) |

**Po rekomendacji — porównanie sześciu seedów:**
| Seed | Nic | +2 wozy | Sama naprawa | Naprawa + wozy | Częściowa (2★) | Kryteria |
| --- | --- | --- | --- | --- | --- | --- |
| 2402 | 10.81 min (1) | 9.94 min (2) | 9.58 min (2) | 8.51 min (3) | repair | **TAK** |
| 2403 | 10.61 min (1) | 9.66 min (2) | 9.60 min (2) | 8.54 min (3) | repair | **TAK** |
| 2409 | 10.46 min (1) | 9.56 min (2) | 8.93 min (2) | 8.57 min (3) | repair | **TAK** |
| 2421 | 10.14 min (1) | 9.81 min (2) | 8.65 min (3) | 7.97 min (3) | wagons | **TAK** |
| 2443 | 10.05 min (1) | 9.76 min (2) | 8.20 min (3) | 8.69 min (3) | wagons | **TAK** |
| 2475 | 10.33 min (1) | 10.83 min (1) | 8.94 min (2) | 8.13 min (3) | repair | **TAK** |

**Uzasadnienie:** Bez interwencji wyznaczamy punkt odniesienia; pozostałe strategie rozdzielają koszt przepustowości i floty. Test seeda uwzględnia również wykonalność komend i wpływ terenu. Wymagany podział pieczęci uzyskano na wszystkich sześciu seedach. Dwa dodatkowe wozy kosztują 60 srebra.

**Najlepsze sprawdzone alternatywy:**
| Deski/chleb | Srebro | Wozy | 3★ / 2★ / termin | Seedy zgodne |
| --- | --- | --- | --- | --- |
| 36/30 | 160 | 7 | 8.75 / 10 / 12 | 6/6 |
| 36/30 | 190 | 7 | 8.75 / 10 / 12 | 6/6 |
| 28/30 | 160 | 7 | 9 / 9.75 / 12 | 6/6 |
| 36/30 | 160 | 8 | 8.75 / 9.75 / 12 | 5/6 |
| 36/30 | 190 | 8 | 8.75 / 9.75 / 12 | 5/6 |

## M3 — porównanie i uzasadnienie

**Dane obecne:** 24 desek / 16 chleba, 270 srebra, 4 wozów, 6.25 / 8 / 11 min (3★ / 2★ / koniec).
**Rekomendacja:** 24 desek / 16 chleba, 270 srebra, 4 wozów, progi 6.25 / 8 / 11 min. Trafność: **6/6** seedów.

**Stan obecny — bazowy seed 3303:**
| Nic | +2 wozy | Sama naprawa | Naprawa + wozy |
| --- | --- | --- | --- |
| 8.57 min (1) | 7.41 min (2) | 7.05 min (2) | 5.44 min (3) |

**Po rekomendacji — porównanie sześciu seedów:**
| Seed | Nic | +2 wozy | Sama naprawa | Naprawa + wozy | Częściowa (2★) | Kryteria |
| --- | --- | --- | --- | --- | --- | --- |
| 3303 | 8.57 min (1) | 7.41 min (2) | 7.05 min (2) | 5.44 min (3) | repair | **TAK** |
| 3304 | 8.57 min (1) | 7.38 min (2) | 6.51 min (2) | 5.62 min (3) | repair | **TAK** |
| 3310 | 8.69 min (1) | 7.47 min (2) | 5.40 min (3) | 5.58 min (3) | wagons | **TAK** |
| 3322 | 9.56 min (1) | 7.42 min (2) | 5.41 min (3) | 5.66 min (3) | wagons | **TAK** |
| 3344 | 9.62 min (1) | 7.41 min (2) | 6.55 min (2) | 5.65 min (3) | repair | **TAK** |
| 3376 | 8.87 min (1) | 7.57 min (2) | 7.20 min (2) | 5.55 min (3) | repair | **TAK** |

**Uzasadnienie:** Bez interwencji wyznaczamy punkt odniesienia; pozostałe strategie rozdzielają koszt przepustowości i floty. Test seeda uwzględnia również wykonalność komend i wpływ terenu. Wymagany podział pieczęci uzyskano na wszystkich sześciu seedach. Dwa dodatkowe wozy kosztują 60 srebra.

**Najlepsze sprawdzone alternatywy:**
| Deski/chleb | Srebro | Wozy | 3★ / 2★ / termin | Seedy zgodne |
| --- | --- | --- | --- | --- |
| 24/16 | 270 | 4 | 6.25 / 8 / 11 | 6/6 |
| 24/16 | 240 | 4 | 6.25 / 8 / 11 | 6/6 |
| 24/16 | 300 | 4 | 6.25 / 8 / 11 | 6/6 |
| 20/16 | 270 | 4 | 6.25 / 8 / 11 | 6/6 |
| 24/20 | 270 | 4 | 6.25 / 8 / 11 | 6/6 |

## Ograniczenia / dalsza weryfikacja

- To przeszukiwanie **siatki dyskretnej**, nie dowód globalnej optymalności. Zakres: m1 = 162 konfiguracji; m2 = 81 konfiguracji; m3 = 81 konfiguracji; dodatkowe seedy badano dla finalistów, a nie dla całej siatki.
- „Częściowa” to **sama naprawa albo +2 wozy**, nie ukryta zmiana mechaniki.
- Zmiana seeda regeneruje teren; niemożliwe komendy dyskwalifikują wynik.
- W M3 magazyn pośredni nie należy do czterech strategii: obecny dispatcher nie gwarantuje jego wpływu na czas.
- Liczby pieczęci wyznaczono z rzeczywistego czasu dostaw i istniejącej reguły gry; pliki `src/sim` pozostały nienaruszone.
- Wyniki bota należy potwierdzić playtestem ludzi.

**Nieanalizowane:** m4, m5, m6 — brak aktywnej definicji kontraktu lub strategii naprawy.
