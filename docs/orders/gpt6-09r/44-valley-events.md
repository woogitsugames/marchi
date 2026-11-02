# 44 — Zdarzenia w Wolnej dolinie — gałąź `gpt/44-valley-events` (ponownie)

Miękkie cele bez kar i timerów (D-21, D-29, `docs/design/sandbox.md` — zamówienia i jarmarki; pory roku D-33,
`docs/design/seasons.md`): **zamówienia królewskie** (maks. 2 naraz, odrzucalne, nagroda srebro + renoma),
**jarmarki sezonowe** (zapowiedziane z wyprzedzeniem, +25 % ceny jednego towaru, powiązane z porą roku),
**wędrowny kupiec** (kupuje nadwyżkę jednego towaru po lepszej cenie). Uwzględnij 10 towarów i rangi 0–5 (zdarzenia
dobrane do rangi i budynków, które gracz ma).
Dostarcz:
- czyste funkcje generujące zdarzenia deterministycznie z RNG zapisanego w stanie — NOWY plik
  `src/sim/proposals/events.ts` (typy danych do przyszłego dodania do stanu opisane w komentarzu, **bez** edycji
  istniejących plików sim; tylko `import type` z istniejących modułów),
- testy `tests/valley-events.test.ts` (determinizm: ten sam seed → te same zdarzenia; limity; brak zdarzeń z
  towarami, których gracz nie może wytworzyć na danej randze),
- `docs/design/events.md` (zasady, częstotliwości, nagrody, jak gracz je widzi — w nowym HUD jako karta pod
  panelem kontraktu),
- teksty PL + EN w `docs/content/events.md`: ≥ 20 wariantów zamówień z realiami ok. 1300–1400 (wesele, post, zjazd
  rycerstwa, budowa kościoła, pielgrzymka, oblężenie sąsiedniego grodu…), teksty jarmarków i kupca.
