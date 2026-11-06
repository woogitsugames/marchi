# Samouczek budowania w Wolnej dolinie / Free Valley building tutorial

**Propozycja UX, nie implementacja.** Drugi, opcjonalny samouczek rozpoczyna się
w nowej Wolnej dolinie i uczy połączenia nowego budynku z istniejącą siecią oraz
sprawdzenia skutku. Bez sztywnej ceny, współrzędnych i obietnicy konkretnego statusu:
mapa, dostępność gruntu i stan dostaw mogą się zmieniać. Cel: pierwsze pięć minut,
nie limit ani obowiązek.

Wzór: `src/ui/tutorial.ts` i `docs/tutorial/m1.md`. Jedna notatka naraz, gracz
zachowuje kontrolę, „Pomiń” jest stale dostępne, brak pełnoekranowej zasłony.
Wyróżnienie aktualnego celu nie przechwytuje dotknięć. Warunki wykrywa UI na
podstawie rzeczywistego świata, nigdy z arbitralnych ID. Nie wydawać poleceń za gracza.

| Krok | Notatka PL | Note EN | Co pokazać | Przejście |
| --- | --- | --- | --- | --- |
| 1 | Otwórz budowanie i wybierz drwalnię. Sprawdź jej koszt. | Open the build menu and select a woodcutter. Check its cost. | Obrys menu budowy, następnie wybór drwalni i koszt. | Aktywne narzędzie budowy drwalni; jeżeli już wybrane, przejdź dalej. |
| 2 | Wybierz miejsce przy lesie. Podgląd pokaże, czy można tam budować. | Choose a place by the forest. The preview shows whether you can build there. | Podgląd położenia i standardowy powód odmowy. | Symulacja zaakceptowała budowę nowej drwalni; odrzucona próba nie zalicza kroku. |
| 3 | Wybierz trakt. Połącz drogę przy drwalni z istniejącą siecią. | Select Track. Join the woodcutter's road to the existing network. | Obrys narzędzia i bramy nowej drwalni; aktualne drogi pozostają widoczne. | Istnieje przejezdna ścieżka od drwalni do połączonej części sieci; wcześniej zbudowana także się liczy. |
| 4 | Otwórz drwalnię i sprawdź, co robi. | Open the woodcutter and see what it is doing. | Obrys nowej drwalni; karta wyświetla bieżący stan. | Gracz otworzył kartę tej drwalni po jej zbudowaniu. |
| 5 | Jeśli praca stoi, wybierz „Dlaczego stoi?” i sprawdź przyczynę. | If work has stalled, choose “Why is it stalled?” and check the cause. | Obrys dostępnego odnośnika; nie wymuszać konkretnej przyczyny. | Gracz otworzył diagnozę; jeżeli brak odnośnika lub budynek pracuje, pomiń krok. |
| 6 | Droga i praca są widoczne w kartach. Wróć do doliny i rozwijaj ją po swojemu. | Roads and work can be inspected in their cards. Return to the valley and grow it your way. | Przycisk zamknięcia karty; nie obiecywać sprzedaży. | Gracz zamknął kartę lub czas wskazówki minął. |

## Warunki brzegowe i odbiór

- Uruchamiać jedynie w nowej dolinie, po zgodzie gracza; wczytany zapis nie
  rozpoczyna go automatycznie. „Pomiń” kończy samouczek bez zmian świata.
- Jeśli brak środków lub legalnego miejsca, nie blokować gry: wyświetlić zwykły
  komunikat i umożliwić pominięcie; nie tworzyć automatycznie zasobów.
- Przedwczesną poprawną czynność rozpoznać po stanie; usunięty budynek wymaga
  ponownego wyboru celu albo zakończenia samouczka, a nie martwego kroku.
- Obrót, Fold, pauza, menu i tło nie resetują postępu; po zmianie układu ponownie
  obliczyć pozycję obrysu. Sterowanie i standardowe komunikaty pozostają dostępne.
- Próby: poprawna i odrzucona budowa, połączenie alternatywną trasą, budowa przed
  wskazówką, praca bez przestoju, brak srebra, obrót i pominięcie.
