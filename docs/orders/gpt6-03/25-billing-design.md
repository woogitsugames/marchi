# 25 — Pełna wersja: projekt płatności (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Decyzja D-10: gra darmowa (misje I–III + mała dolina), pełna wersja jednorazowym zakupem; bez reklam, timerów, energii, pay-to-win.
Przygotuj `docs/BILLING.md`: Google Play Billing (produkt in-app „full_version”, non-consumable) i StoreKit 2 (iOS) przez Capacitor 8 —
porównanie gotowych pluginów (licencje, utrzymanie, wsparcie Capacitor 8) albo własnego pluginu; przywracanie zakupów; tryb offline;
weryfikacja (bez własnego serwera — co jest bezpieczne, a co nie); zgodność z deklaracją „brak zbierania danych” w `docs/store/*`;
testy (licencje testowe Google Play, Sandbox Apple). Szkic modułu w NOWYM pliku `src/platform/entitlements.ts` (interfejs `isFull(): Promise<boolean>`,
`purchase()`, `restore()`, implementacja-atrapa dla web/dev) + test. Bez instalacji pluginów natywnych w tym PR.
