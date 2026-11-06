# Przegląd prywatności — stan częściowy

Baza b020c577. **Nie publikować jako ukończonej aktualizacji wszystkich języków.**
Zweryfikowano kod źródłowy, nie końcowy APK/AAB/IPA ani faktyczny ruch sieciowy.

| Dowód | Wniosek |
| --- | --- |
| `src/platform/save.ts`, `src/ui/prefs.ts`, `src/i18n/index.ts` | Zapisy w IndexedDB, ustawienia w localStorage; nie tylko IndexedDB. |
| `src/ui/playtestSheet.ts`, `src/game/playtest.ts` | Ukryty tryb testowy przyjmuje kod uczestnika i opis urządzenia, zachowuje ustawienia lokalnie; kopiuje wyniki CSV do schowka. |
| `src/ui/diagPanel.ts` | Narzędzie diagnostyczne pozwala skopiować JSON do schowka. |
| `android/app/src/main/AndroidManifest.xml`, reguły kopii | `allowBackup=true`; system może tworzyć kopie/przenosić dane, zależnie od konfiguracji. |
| `terrainTextures.ts`, `audio.ts`, `assetPackConfig.ts` | Istnieją wywołania fetch dla zasobów oraz konfiguracja opcjonalnego pakietu 4K; sam fakt fetch nie dowodzi połączenia zewnętrznego w wydaniu. Sprawdzić konfigurację i pakiet końcowy. |
| polityki `privacy-*.md` | 17 wersji twierdzi bezwzględnie, że dane nie opuszczają urządzenia; ręcznie skopiowane dane i kopie systemowe przeczą takiemu ujęciu. |

Poprawiono roboczo PL i EN oraz częściowo `data-safety.md`. Pozostałe 15 polityk
wymagają równoważnej lokalizacji i kontroli — nie są gotowe do publikacji.
Konieczna weryfikacja rzeczywistego administratora i kontaktu, polityk sklepów,
końcowych pakietów i zachowania sieci; nie zakładać, że automatyczne „No data
collected” jest już zatwierdzoną odpowiedzią sklepu.
