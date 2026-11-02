# 52 — Balans Wolnej doliny z porami roku (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)
Gałąź `gpt/52-sandbox-balance`. Pory roku (D-33, `src/sim/seasons.ts`) działają tylko w Wolnej dolinie.
1. Narzędzie `tools/balance-sandbox.ts` (nie zmieniaj `tools/balance.ts`): 4–6 strategii botów (np. drewno-only,
   chleb, piwo, kamień+bruk, „mieszana rozsądna”, „nic”), 3 seedy, przebieg 180 min gry; dla każdej: czas do rang 1–5,
   srebro/min w każdej porze roku, łączny czas przestojów wg przyczyny (`ledger.stallSeconds`), ile razy
   BRIDGE_CLOSED w zimie, zysk z jarmarku.
2. Raport `docs/balance/sandbox-seasons.md` — tabele + wnioski: czy któraś strategia dominuje; czy zima jest „łagodna”
   (cel: spadek srebra/min ≤ 35 % względem jesieni, brak spadku rangi); czy piwo nie jest zbyt opłacalne.
3. Propozycje strojenia jako TABELA zmian liczb (`defs.ts`/`seasons.ts`) z pomiarem po zmianie wykonanym lokalnie —
   ale w PR **nie zmieniaj istniejących plików sim**; dołącz patch jako blok diff w raporcie.
Uruchomienie narzędzia ≤ 3 min na laptopie; deterministyczne.
