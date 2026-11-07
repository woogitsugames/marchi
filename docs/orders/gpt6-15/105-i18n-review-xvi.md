# 105 — Przegląd tłumaczeń XVI i samouczka (7 XI) — gałąź `gpt/105-i18n-review-xvi`

Uzupełnienie zlecenia 66 (paczka 12) o klucze dopisane przez agentów 7 XI. Wszystkie w `src/i18n/*.ts`; oryginał `pl.ts`, pomoc `en.ts`.
15 języków: de, es, fr, it, nl, pt_BR, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi. Kontekst: `docs/missions/m16.md`, D-306..D-318 w `docs/DECISIONS.md`.

**Klucze:**
- karta „przewóz” (D-307/D-309): `cause.paceHaul` („Tartak: robi 6 z 12 desek na minutę, wszystkie 4 wozy w trasie — kup wóz”), `fix.paceHaulWhy`;
- godzina na arkuszu (D-315): `fix.paceHaulAt` („Przy tym tempie całe zamówienie będzie gotowe ok. {time}.”);
- zamki (D-290..D-293, D-318): `castle.*`, `cause.paceCastleEven`, `cause.paceCastleAfter`, `fix.castleFirstWhy`, `fix.castleFirstLate`, `seal.tempo.castle`, `hud.castleFirst`, `hud.castleEven`, `contract.toCastle`, `menu.m16`, `menu.m16Sub`;
- samouczek (D-259): `tutorial.build.step5road`, `tutorial.build.step7`.

**Zwróć uwagę:** ru/uk — przypadek po „ради/заради {aim}” i liczebniki przy „wozy/deski”; tr/ko/ja — szyk zdania z placeholderami;
ar — liczba mnoga w `castle.rival`, kierunek tekstu z liczbami; de — długość (karta mieści ~3 zdania przy 915×412).
Zachowaj placeholdery i znaczniki bez zmian. Długość ±20 % względem en.

**Oddaj:** poprawione `src/i18n/*.ts` (tylko te klucze) i `docs/reviews/i18n-xvi.md` (tabela: język, klucz, było → jest, powód).
`npm test` i `npm run typecheck` zielone.
