# MARCHIA — pełna wersja, zakupy i uprawnienia (D-10)

**Status: projekt / etap 1 (2026-11-01).** Ten PR dodaje wyłącznie dokumentację,
`src/platform/entitlements.ts` i testy jednostkowe. **Nie instaluje SDK zakupów, nie
konfiguruje produktów w sklepach, nie tworzy paywalla ani nie odblokowuje płatnych
misji.** Domyślny adapter web/dev zwraca `false` / `unavailable` (fail closed).

## 1. Model produktu i zakres

- **D-10:** darmowe misje I–III i mała dolina. Reszta kampanii i większa dolina
  odblokowywane jednorazowo, bez reklam, abonamentu, energii, timerów sztucznego
  oczekiwania i płatnych przewag. Terminy *misji-kontraktów* 5–12 min to mechanika
  gry, nie mechanizm monetyzacji.
- **SKU na obu platformach:** `full_version`; Android: **one-time in-app product,
  INAPP, non-consumable** (nigdy `consume`); iOS: **Non-Consumable In-App Purchase**.
  Produkt nie jest subskrypcją. Po zakupie należy umożliwić przywracanie na innych
  urządzeniach **tej samej platformy i tego samego konta sklepu**. Zakup z Google
  Play nie przenosi się automatycznie na Apple i odwrotnie (brak konta MARCHIA).
- Interfejs cenowy pobiera **lokalną cenę i walutę z metadanych sklepu**. Nie
  wpisywać ceny na stałe ani nie sprzedawać cyfrowego odblokowania przez własny
  checkout w aplikacji.
- Zapisy gry pozostają lokalnie w IndexedDB (`src/platform/save.ts`) i nie są
  powiązane z transakcją; reinstalacja/przywrócenie zakupu **nie przywraca zapisów**.
- Aktualne teksty w `docs/store/play-*.md` i `appstore-*.md` już opisują darmowe
  misje i zakup. **Nie publikować tych obietnic, dopóki natywne płatności, bramka
  dostępu i przywracanie nie przejdą testów sklepowych.**

## 2. Capacitor 8 — ocena dostępnych rozwiązań

Repo używa `@capacitor/{core,android,ios}` 8.6 i na iOS szablonu Swift Package
Manager (SPM); wymagane są więc nie tylko metody zakupów, ale także poprawna
integracja z **Capacitor 8, SPM i aktualnym Google Play Billing**.

| Wariant | Licencja / koszt | Utrzymanie / Capacitor 8 | Zalety | Koszty / zagrożenia |
| --- | --- | --- | --- | --- |
| **`@capgo/native-purchases` v8** | **MPL-2.0**, publiczny kod pluginu (usługa Capgo Live Updates jest osobnym produktem) | Aktywna gałąź v8 dla Capacitor 8; iOS SPM; StoreKit 2 i Google Play Billing | Zakup, pobranie produktów, `getPurchases`, `restorePurchases`, acknowledge; bez obowiązkowego serwera dostawcy | Utrzymanie zależy od Capgo; wymagany przegląd rzeczywistego kodu weryfikacji, obsługi `PENDING`, zwrotów i web-mocka; MPL przy zmianach kodu pluginu |
| **`@capawesome-team/capacitor-purchases` 0.4.x** | **Komercyjny dostęp Capawesome Insiders**; warunki licencji z dostawcą | Aktywnie obsługuje Capacitor 8 (seria 0.4.x); integracja StoreKit 2 i Play Billing; dokumentacja wymaga odpowiedniej wersji Xcode | Spójny interfejs transakcji, `getCurrentTransactions`, synchronizacja i kończenie transakcji | Koszt licencji, zależność od prywatnego rejestru i klucza w CI, przejrzenie wymagań Xcode |
| **`@revenuecat/purchases-capacitor`** | **MIT** dla SDK; osobny cennik/usługa RevenueCat | Aktywnie utrzymywany; wersje 11+ mają wsparcie Capacitor 8 (sprawdzić konkretny major przy instalacji) | Gotowy backend walidacji, obsługa zwrotów, cache i przywracanie bez własnego serwera | Zewnętrzna usługa otrzymuje dane zakupów/identyfikatory; konieczny audyt i prawdopodobna zmiana deklaracji `No data collected`; nie jest to „tylko lokalny” wariant |
| **Własny plugin Capacitor 8** | Kod i licencja projektu; bez abonamentu dostawcy | Pełna kontrola, ale trzeba stale aktualizować StoreKit 2, Play Billing, SPM, Gradle i testować natywnie | Wąski interfejs tylko dla `full_version`, bez telemetrii / zewnętrznego SDK | Najwyższy nakład testowy i utrzymaniowy; również nie zastępuje bezpiecznej weryfikacji Android po stronie serwera |

**Rekomendacja na etap natywny:** rozpocząć od pilota
`@capgo/native-purchases` **v8**. Jest zgodny ze stosem, nie wymaga serwera
pośrednika i nie wprowadza z założenia zewnętrznej analityki zakupowej.
**To wybór warunkowy**, nie akceptacja bezpieczeństwa w ciemno: przed instalacją
przejrzeć aktualny kod Android/iOS i zbudować AAB/IPA w CI. Jeżeli audyt ujawni
brak poprawnej walidacji lub synchronizacji, wybrać Capawesome albo napisać
minimalny własny bridge. Nie korzystać z web-mocka bibliotek jako podstawy
płatnego odblokowania.

Dodatkowa możliwość: `capacitor-plugin-cdv-purchase` (MIT, rozwijany wrapper
projektu `cordova-plugin-purchase`) obsługuje StoreKit 2 i Billing; przed wyborem
wymaga niezależnego testu integracji SPM/Capacitor 8 i kontroli danych wysyłanych
do ewentualnego walidatora (może dołączać informacje o urządzeniu).

**Źródła pluginów (sprawdzone 2026-11-01):**
- [Capgo: repo, kompatybilność v8, MPL-2.0](https://github.com/Cap-go/capacitor-native-purchases), [dokumentacja](https://capgo.app/docs/plugins/native-purchases/).
- [Capawesome Purchases: zgodność i licencja Insiders](https://capawesome.io/docs/sdks/capacitor/purchases/).
- [RevenueCat Capacitor SDK](https://github.com/RevenueCat/purchases-capacitor), [zgodność wersji](https://github.com/RevenueCat/purchases-capacitor/blob/main/VERSIONS.md).
- [capacitor-plugin-cdv-purchase](https://www.npmjs.com/package/capacitor-plugin-cdv-purchase).

## 3. Kontrakt TypeScript i punkt integracji

`src/platform/entitlements.ts` eksportuje:

```ts
interface Entitlements {
  isFull(): Promise<boolean>;
  purchase(): Promise<'purchased' | 'cancelled' | 'pending' | 'unverified' | 'unavailable'>;
  restore(): Promise<'restored' | 'not-owned' | 'unavailable'>;
}
```

`FULL_VERSION_PRODUCT_ID = 'full_version'` jest jedynym identyfikatorem.
`createWebEntitlements()` i eksportowany na tym etapie `entitlements` **zawsze
zwracają brak pełnej wersji**. Nie ma fałszywego `localStorage.full=true`, flagi
`?premium`, dev bypassu ani dołączonego SDK. `createEntitlements(store)` to fabryka
z wstrzykiwanym `StoreEntitlementAdapter` do użycia w **osobnym PR**.

Wymagany kontrakt przyszłego adaptera:

1. `hasFullVersion('full_version')`: **prawda tylko** przy poprawnym, aktualnym
   uprawnieniu **tego** produktu / aplikacji / właściwego sklepu. `PENDING`,
   `CANCELLED`, `REFUNDED`, `REVOKED` oraz nieweryfikowalne transakcje ⇒ brak
   nowego odblokowania. Przy awarii sieci/konsoli nie deklarować automatycznie
   `false` (= „sklep potwierdził brak zakupu”); rozróżnić stan nieustalony
   (odrzucić Promise) od braku zakupu. Podtrzymać wyłącznie wcześniej
   zaufany stan offline zgodnie z sekcją 5.
2. `buyFullVersion('full_version')`: inicjuje **wyłącznie świadomy wybór gracza**.
   Zwraca `completed`, `pending`, `cancelled`; nie przyznaje uprawnień na
   podstawie samego zamknięcia okna zakupu. Fasada po `completed` **ponownie
   sprawdza** `hasFullVersion`; bez potwierdzenia zwraca `unverified`.
3. `syncPurchases()`: wywoływane wprost po kliknięciu „Przywróć zakup”.
   Po synchronizacji fasada sprawdza posiadanie produktu, zwracając `restored`
   albo `not-owned`. Błąd połączenia lub weryfikacji ma pozostać błędem,
   nie „not-owned”.

**Przykład przyszłego spięcia (pseudokod, nie uruchamiać w tym PR):**

```ts
// The native adapter is implemented and audited in a separate PR.
// const billing = createEntitlements(nativeStoreAdapter);
// if (await billing.isFull()) showAllMissions();
// const result = await billing.purchase();
// if (result === 'purchased') showAllMissions();
// The UI must also listen for later verified entitlement changes.
```

Brak importów z `@capacitor/*` w szkicu jest **celowy**: testy headless
nie uruchamiają natywnego mostu, a symulacja `src/sim/` nie zależy od płatności.
Przyszły gate ma być **w menu/wyborze zawartości** (poza deterministyczną
symulacją), a nie w stanie zapisu gry. Przesunięcie odblokowania wymaga zmian w
`src/ui/`/`src/main.ts` dopiero po zgodzie na kolejny etap.

## 4. Procedury sklepu i kończenie transakcji

### Android — Google Play Billing

1. Play Console: utworzyć aktywny produkt jednorazowy **`full_version`** typu
   `INAPP` (non-consumable), ustawić cenę, kraje i wymagane metadane.
2. UI: połączyć się z Play Billing, pobrać lokalny `ProductDetails`/ofertę,
   wyświetlić cenę ze sklepu; przycisk zakupu aktywny dopiero po pobraniu
   poprawnego produktu. Obsłużyć brak Play Store, brak konta, niedostępność i
   anulowanie bez blokowania darmowej gry.
3. Po zdarzeniu zakupu oraz po `onResume`/powrocie aplikacji wywołać
   `queryPurchasesAsync(INAPP)` i filtrować **dokładnie** `full_version` w stanie
   **`PURCHASED`**. `PENDING` nie odblokowuje gry i nie wolno go potwierdzić.
4. Po przyznaniu należnej zawartości **`acknowledgePurchase`**, jeżeli jeszcze
   niepotwierdzony. **Nie `consume`** (to umożliwiłoby ponowny zakup tego samego
   produktu). Google wymaga potwierdzenia w ciągu **3 dni** od stanu PURCHASED;
   w testach z licencją termin zwrotu przy braku acknowledge może wynosić
   **3 minuty**. Błędy acknowledge trzeba ponawiać idempotentnie.
5. Przywrócenie: ponowna kwerenda posiadanych `INAPP` pod tym samym kontem
   Google Play; brak potrzeby „ponownej płatności”. Obsłużyć zakup wykonany na
   innym urządzeniu i transakcję zakończoną, gdy aplikacja była zamknięta.

### iOS — StoreKit 2

1. App Store Connect: Non-Consumable IAP **`full_version`**, ceny/lokalizacje,
   lokalizacje metadanych, wymagane zgody i recenzja produktu. W Xcode włączyć
   capability **In-App Purchase**.
2. Pobierać `Product.products(for: ["full_version"])`; po zakupie akceptować
   **tylko** `VerificationResult.verified` dla właściwego `productID` i aktywnej
   transakcji. Nie odblokowywać na `unverified`, `pending`, anulowaniu.
3. Przy uruchomieniu i zmianie stanu subskrybować `Transaction.updates` oraz
   przeliczać `Transaction.currentEntitlements`; Apple wyklucza z tej kolekcji
   zwrócone/cofnięte non-consumable. Po dostarczeniu prawa użyć
   `transaction.finish()` (również dla wznawianych transakcji).
4. Przycisk „Przywróć zakup” wywołuje `AppStore.sync()` / odpowiednik pluginu;
   to może otworzyć systemową prośbę o uwierzytelnienie — **nie wywoływać
   automatycznie na każdym uruchomieniu**. Następnie ponownie sprawdzić
   `currentEntitlements`. Wyjaśnić, że potrzebne jest właściwe Apple Account.

**Źródła sklepów:**
[Google: integracja, PENDING i acknowledge](https://developer.android.com/google/play/billing/integrate),
[Google: lifecycle one-time products](https://developer.android.com/google/play/billing/lifecycle/one-time),
[Apple: currentEntitlements](https://developer.apple.com/documentation/storekit/transaction/currententitlements),
[Apple: typy IAP](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases).

## 5. Offline, anulowania, zwroty — jawna polityka

**Gra działa offline bez opłat i logowania do gry.** Wyjątek: pierwsze kupno,
ponowne pobranie uprawnienia po reinstalacji i większość operacji przywracania
wymagają kontaktu ze sklepem. Po zakupie użytkownik powinien móc grać offline.

- **iOS:** preferować natywną, zweryfikowaną historię
  `Transaction.currentEntitlements` dostępną urządzeniu (StoreKit 2 może
  udostępniać lokalnie zweryfikowane transakcje). Nie zamieniać jej na
  `localStorage`/IndexedDB z gołym booleanem. Po połączeniu ponownie sprawdzić
  ewentualne zwroty i revocation.
- **Android:** zapamiętać w **natywnym** module ostatni wiarygodny stan zakupu
  (i jego źródło), aby nie cofać płatnego dostępu wskutek chwilowego braku
  połączenia. Sam zaszyfrowany pref `owned=true` **nie jest dowodem zakupu**;
  Keystore utrudnia manipulację, ale nie zapobiega patchowaniu aplikacji. Bez
  sieci Play Billing nie gwarantuje bieżącej weryfikacji/zwrotów. Przy powrocie
  sieci sprawdzić `queryPurchasesAsync` i odebrać prawo po potwierdzonym
  anulowaniu/zwrocie. Dla użytkownika offline priorytetem jest uczciwe
  utrzymanie już nabytego dostępu, ze świadomą akceptacją luki antyfraudowej.
- **Nowe urządzenie / czyszczenie danych:** jeżeli nie ma lokalnego
  wiarygodnego dowodu, a sklep jest niedostępny, nie zgadywać „purchased”.
  Udostępnić darmowe misje i komunikat, że przywrócenie wymaga połączenia.
- **Awaria / pending:** nie nadpisywać dotychczasowego zaufanego prawa
  chwilowym błędem transportowym. `PENDING` nie blokuje darmowych misji i nie
  oznacza zakończenia płatności. Poinformować o możliwości ponowienia.
- **Zmiana konta sklepu / refund:** na połączeniu z siecią na nowo potwierdzić
  nabyte uprawnienia. Brak własnego konta oznacza brak cross-store restore.

## 6. Bezpieczeństwo bez własnego backendu — granice

| Kontrola | Co daje | Czego **nie** daje |
| --- | --- | --- |
| **iOS StoreKit 2**: `VerificationResult.verified`, `currentEntitlements`, `revocationDate`/status | Lokalna weryfikacja podpisu transakcji przez StoreKit i jej przynależności do produktu | Nie chroni w pełni przed zmodyfikowanym klientem lub wstrzyknięciem kodu |
| **Android Play Billing**: oficjalne `queryPurchasesAsync`, stan `PURCHASED`, `acknowledge`, kontrola SKU / package | Wiarygodniejsze niż flaga JS, działa dla zwykłego użytkownika sklepu | **Nie jest pełną serwerową walidacją** tokenu, historii użycia, zwrotów; klient może być zmanipulowany |
| Android lokalna kontrola podpisu / obfuskacja / Keystore (opcjonalnie) | Podnosi koszt oszustwa i umożliwia częściowy cache offline | Nie zastępuje Play Developer API, nie dowodzi braku późniejszego zwrotu |
| **Backend własny lub dostawcy** + Play Developer API / Apple App Store Server API, powiadomienia RTDN/ASSN | Silniejsza walidacja, status zwrotu, brak ponownego użycia tokenu, spójniejsze egzekwowanie prawa | Wymaga infrastruktury/usługi, decyzji dot. retencji danych i ponownego audytu prywatności |

**Decyzja dla D-10:** jeśli akceptujemy ograniczone ryzyko piractwa gry
single-player, można dostarczyć klient-only IAP z lokalnym StoreKit 2 oraz
Play Billing i jasno opisać ograniczenia. **Nie przedstawiać tego jako
„weryfikacji serwerowej” ani „odporności na oszustwa”.** Jeżeli pełna walidacja
jest wymagana, potrzebny jest backend (własny lub zewnętrzny) i aktualizacja
polityki prywatności.

**Nigdy nie osadzać w aplikacji** klucza konta usługi Google Play Developer API,
sekretów Apple App Store Server API ani danych administratora. Sam token zakupu
Android nie jest podpisanym dowodem uprawnień nadającym się do niezależnej
weryfikacji w TypeScript.

Oficjalne odniesienie:
[Google Play — Fight fraud and abuse](https://developer.android.com/google/play/billing/security).

## 7. Prywatność i deklaracja „brak zbierania danych”

Punktem odniesienia są **`docs/store/data-safety.md`, `privacy-pl.md` i
`privacy-en.md`**: brak analityki, serwera, konta MARCHIA, reklam, przekazywania
stanu gry i danych urządzenia. Integracja ze sklepem **nie oznacza automatycznie,
że wydawca zbiera dane gracza**, ale też nie zwalnia z audytu telemetrii SDK.

Zalecenia dla klient-only:

1. Transakcja odbywa się **wyłącznie przez Google Play / App Store**; gra nie
   odczytuje kart płatniczych. Nie wysyłać purchase tokenów, JWS, identyfikatorów
   konta, historii zakupów, telemetrii ani informacji o urządzeniu do własnego
   endpointu ani do Capgo / Firebase / RevenueCat bez odrębnej decyzji.
2. Tokeny / dowody zakupów i minimalny cache pozostają lokalnie w natywnym
   module; zapis IndexedDB z grą nie jest źródłem autoryzacji i nie zawiera
   danych płatności. Wyłączyć logowanie pełnych tokenów, receiptów i adresów
   konta w produkcji.
3. Sprawdzić **ruch sieciowy finalnych AAB/IPA**, zależności natywne,
   autostart, logi, żądania diagnostyczne oraz dokumentację prywatności pluginu.
   Rozdzielić operacje sklepu wykonywane przez platformę od transmisji przez
   własny kod / SDK. Szczególnie sprawdzić, czy opcjonalne API walidatora nie
   wysyła danych urządzenia.
4. Przy integracji RevenueCat lub innego zewnętrznego backendu dotychczasowe
   `No data collected` / `Data Not Collected` **nie może zostać bezrefleksyjnie
   zachowane**: przeprowadzić ponowną ocenę typów danych, celów, odbiorców,
   polityki i formularzy przed wydaniem. Dokumentować przetwarzanie operatorów
   sklepów według aktualnych reguł Apple/Google, nie przyjmować z góry, że
   każde przetwarzanie sklepu jest danymi zbieranymi przez aplikację.
5. `{{CONTACT_EMAIL}}` w politykach musi zostać zastąpiony przed publikacją.

W tym PR **nie dochodzi żadna nowa transmisja ani SDK**; obecne deklaracje
pozostają tylko projektem, a nie wynikiem badania binarek produkcyjnych.

Źródła: [Google Play — Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-GB),
[Apple — App privacy details](https://developer.apple.com/app-store/app-privacy-details/).

## 8. Testy i checklista wydania

### Testy automatyczne (ten PR)

`tests/entitlements.test.ts` w istniejącym headless harnessie sprawdza:

- fail-closed web/dev i brak fikcyjnego kupna / przywrócenia;
- weryfikację `full_version` przez adapter i stan już kupiony;
- `completed` bez dowodu własności ⇒ **`unverified`**, nie pełna wersja;
- `pending` / `cancelled` ⇒ nigdy bezpośredniego odblokowania;
- `restore` ⇒ najpierw sync, potem check i wynik `restored`/`not-owned`;
- niedostępność sklepu ⇒ błąd przekazany dalej, nie ukryty `false`.

Uruchomienie: `npm test -- entitlements`, `npm run typecheck`, następnie
`npm test` i `npm run build`. Na etap natywny potrzebne są też testy binarek.

### Google Play — wymagane przy PR z pluginem

- [ ] W Play Console skonfigurowano `full_version` i **license testers**.
- [ ] APK/AAB z prawidłowym `applicationId` zainstalowano z odpowiedniego toru
      testowego Google Play; tester używa właściwego konta sklepu.
- [ ] Sukces płatności testowej ⇒ produkt należy do konta; uruchomienie app po
      zamknięciu nadal odblokowuje; potwierdzenie zakupu kończy się poprawnie.
- [ ] Test card **always declines**, cancel, brak sieci, Play Store unavailable ⇒
      bez odblokowania, darmowa część nadal działa.
- [ ] **Slow test card** (pending → approved/declined), restart i `onResume` ⇒
      brak odblokowania do `PURCHASED`; brak `acknowledge` na `PENDING`.
- [ ] Purchase już owned ⇒ brak podwójnej opłaty; restore/reinstall pod tym
      samym kontem ⇒ `full_version` wraca po połączeniu z siecią.
- [ ] Test bez `acknowledge` w osobnej sesji kontrolnej wykrywa ryzyko zwrotu;
      poprawna implementacja potwierdza zakup w wymaganym czasie. Dla license
      tester zwrot testowy może nastąpić **po 3 minutach**.
- [ ] Zwrot i odebranie prawa w konsoli sklepu ⇒ po synchronizacji gra
      odświeża dostęp; brak sieci nie niszczy wcześniej prawidłowego cache.

Oficjalny przewodnik:
[Google Play — Test your Billing Library integration](https://developer.android.com/google/play/billing/test).

### Apple — wymagane przy PR z pluginem

- [ ] Produkt `full_version` istnieje w App Store Connect; testy w Xcode ze
      **StoreKit Configuration** oraz na realnym urządzeniu w **Sandbox**
      (konto Sandbox Apple Account) / TestFlight.
- [ ] Zakup, cancel, błąd, transakcja `unverified`, oczekująca zgoda i
      `Transaction.updates` po wznowieniu aplikacji mają prawidłowe wyniki.
- [ ] `finish()` jest wołane po przyznaniu prawa; przerwanie procesu, ponowne
      uruchomienie i transakcje niedokończone nie gubią zakupu.
- [ ] `AppStore.sync()` wyłącznie po kliknięciu przywrócenia, a nie na starcie;
      poprawne działanie przy wymianie urządzenia i reinstalacji.
- [ ] Refundy/revocation w środowisku testowym ⇒ brak pełnej wersji po
      aktualizacji `currentEntitlements`.

Oficjalny przewodnik:
[Apple — Testing In-App Purchases with Sandbox](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox).

### Wspólne kryteria release (następny etap)

- [ ] Gate blokuje tylko płatne misje/dolinę; misje I–III i mała dolina nadal
      darmowe; zapis gry nie decyduje o zakupie.
- [ ] Zakup i przywrócenie są jawne w UI (PL/EN przez `src/i18n/`), cena jest
      sklepowa, a anulowanie nie wyświetla błędnego „kupiono”.
- [ ] Offline po wcześniej potwierdzonym zakupie działa; pierwsze przywrócenie
      offline prezentuje poprawny stan nieustalony.
- [ ] Audyt AAB/IPA (w tym telemetry, dependencies) i deklaracji
      `docs/store/*` wykonany po zainstalowaniu pluginu.
- [ ] Żaden sekret/API key do serwerowej walidacji nie trafił do aplikacji.
- [ ] Przed wydaniem zweryfikowano zgodność bieżącej wersji Google Play Billing
      z wymogami terminów Google Play i środowisko Xcode/SPM wymagane przez SDK.

**Zakres wyłączony:** instalacja bibliotek natywnych, konfiguracja produktów w
konsolach, weryfikacja na prawdziwym urządzeniu, backend, paywall i zmiany
`src/sim/`, `src/ui/`, `src/main.ts` i plików `docs/store/*`.