# MARCHIA — formularze prywatności sklepów (PL/EN)

**Stan założeń: 1 listopada 2026 r.** Propozycje do wprowadzenia w konsolach sklepów. Dotyczą wyłącznie wersji gry opisanej w zleceniu: lokalne zapisy IndexedDB, brak kont, serwera rozgrywki, reklam, analityki i śledzenia. **Nie są wynikiem audytu końcowych pakietów APK/AAB/IPA.**

## Google Play Console — Data safety

| Pytanie / obszar | Odpowiedź do formularza | Uzasadnienie |
| --- | --- | --- |
| Czy aplikacja zbiera dane użytkownika? / Data collected | **Nie / No** | Stan gry jest przetwarzany i zapisany tylko na urządzeniu. |
| Czy aplikacja udostępnia dane użytkownika innym podmiotom? / Data shared | **Nie / No** | Gra nie przesyła danych z rozgrywki ani identyfikatorów do odbiorców zewnętrznych. |
| Jakie typy danych są zbierane? / Data types | **Żadne / None** | Nie zaznaczaj kategorii, o ile stan końcowej aplikacji odpowiada powyższym założeniom. |
| Jakie typy danych są udostępniane? / Shared data types | **Żadne / None** | Brak transferu danych z gry. |
| Cele, dane obowiązkowe lub opcjonalne, szyfrowanie w transmisji | **Nie dotyczy / Not applicable** | Brak danych zbieranych z urządzenia przez grę. |
| Konto i żądanie usunięcia konta | **Brak kont** | Dane rozgrywki są lokalne; można je usunąć przez wyczyszczenie danych aplikacji lub jej usunięcie. |
| Privacy Policy URL | **Wymagany publiczny adres HTTPS** | Opublikuj treść privacy-pl.md / privacy-en.md jako strony internetowe i dodaj odnośnik również w aplikacji. |

**Tekst do kontroli spójności:** „Nie zbieramy ani nie udostępniamy danych użytkownika. Postępy gry pozostają lokalnie na urządzeniu.” / “No user data collected or shared. Game progress stays on the device.”

## Apple App Store Connect — App Privacy

| Pytanie / obszar | Odpowiedź do formularza |
| --- | --- |
| Do you or your third-party partners collect data from this app? | **No, we do not collect data from this app.** |
| Privacy Nutrition Label | **Data Not Collected** |
| Data Used to Track You | **None** |
| Data Linked to You | **None** |
| Data Not Linked to You | **None** |
| Data types and purposes | **None / not applicable** |
| Privacy Policy URL | **Publiczny adres strony z privacy-en.md (w razie potrzeby również PL).** |

Lokalne dane gry przetwarzane wyłącznie na urządzeniu nie są traktowane przez Apple jako dane „collected”. Dobrowolny kontakt e-mail poza aplikacją nie oznacza automatycznie zbierania danych **z aplikacji**; zasady obsługi wiadomości opisują obie polityki prywatności.

## Zakupy i granice deklaracji „brak zbierania danych”

- **Płatność przez sklep ≠ automatycznie dane zbierane przez grę.** Google Play i Apple mogą niezależnie przetwarzać dane kont i transakcji; gra nie pobiera danych kart płatniczych.
- **Przed publikacją skontroluj implementację zakupów.** Jeżeli integracja Play Billing / StoreKit lub zewnętrzny dostawca zakupów zacznie przesyłać identyfikatory transakcji, potwierdzenia zakupów, dane diagnostyczne albo informacje o urządzeniu poza urządzenie, deklaracja „No data collected” może wymagać zmiany. Nie zakładaj jej prawdziwości na podstawie samego opisu modelu biznesowego.
- **Sprawdź biblioteki i pakiety końcowe.** Upewnij się, że nowe SDK (płatności, awarie, analityka, reklamy), uprawnienia i połączenia sieciowe nie wprowadzają zbierania danych. Formularz Google obejmuje także transmisje realizowane przez SDK.
- **Nie publikuj obietnicy dostępu do misji 1–3 i jednorazowego odblokowania**, dopóki funkcje nie są rzeczywiście zaimplementowane i zweryfikowane. Zgodnie z docs/DECISIONS.md (D-10) integrację sklepową odłożono na później.
- **Publikacja polityk:** zamień {{CONTACT_EMAIL}} na rzeczywisty adres; opublikuj dostępne publicznie strony HTML pod stałymi adresami HTTPS, ustaw URL w obu sklepach i zapewnij dostęp z samej gry.
- **Wersje i zmiany:** zaktualizuj deklaracje wraz z każdą zmianą zbierania danych, SDK, sposobu płatności lub synchronizacji zapisów.

## Oficjalne wytyczne

- Google Play — [Provide information for your app's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-GB) (lokalne przetwarzanie bez wysyłki nie jest „collection”; odpowiedzialność za SDK).
- Google Play — [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en) (publiczna polityka prywatności w sklepie i w aplikacji).
- Apple — [App privacy details](https://developer.apple.com/app-store/app-privacy-details/) (dane na urządzeniu nie są „collected”; uwzględnij partnerów i SDK).
- Apple — [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/) („No, we do not collect data from this app”).
