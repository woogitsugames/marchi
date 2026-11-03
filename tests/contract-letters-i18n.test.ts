import { LANGS, type Lang } from '../src/i18n/index';
import { CONTRACT_LETTERS, getContractLetter, getContractLetters, type ContractMissionId } from '../src/content/letters';
import { assert, test } from './harness';

const MISSIONS = [
  'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12',
] as const satisfies readonly ContractMissionId[];

/** Check the displayed string, not just the body: the signature counts toward the budget. */
function validate(phase: string, value: string, max: number, mission: string, lang: Lang): void {
  assert(typeof value === 'string' && value.trim().length > 0, `missing ${mission}/${lang}/${phase}`);
  assert(value.length <= max, `over budget ${mission}/${lang}/${phase}: ${value.length} > ${max}`);
  assert(value.includes('\n— Wszebor'), `missing signed newline ${mission}/${lang}/${phase}`);
  if (lang === 'ar') {
    assert(!/[\u202a-\u202e\u2066-\u2069]/.test(value), `direction control in ${mission}/${lang}/${phase}`);
  }
}

test('all twelve contract missions have five signed letters in every supported language', () => {
  for (const mission of MISSIONS) {
    for (const lang of LANGS) {
      const letters = CONTRACT_LETTERS[mission][lang];
      assert(letters !== undefined, `missing mission ${mission} in ${lang}`);
      validate('opening', letters.opening, 400, mission, lang);
      for (const seals of [1, 2, 3] as const) {
        validate(`won.${seals}`, letters.won[seals], 200, mission, lang);
        assert(getContractLetter(mission, 'won', seals, lang) === letters.won[seals],
          `won resolver mismatch ${mission}/${lang}/${seals}`);
      }
      validate('lost', letters.lost, 200, mission, lang);
      assert(getContractLetters(mission, lang) === letters, `resolver mismatch ${mission}/${lang}`);
      assert(getContractLetter(mission, 'opening', 0, lang) === letters.opening,
        `opening resolver mismatch ${mission}/${lang}`);
      assert(getContractLetter(mission, 'lost', 0, lang) === letters.lost,
        `lost resolver mismatch ${mission}/${lang}`);
      if (mission === 'm1') {
        assert(letters.opening.includes('Łozinny Bród'), `place name changed: ${lang}`);
        assert(letters.opening.includes('30') && letters.opening.includes('20'), `numbers changed: ${lang}`);
      }
      if (mission === 'm12') {
        for (const number of ['40', '48', '32', '6:00', '8', '12', '9:00', '36', '12:00']) {
          assert(letters.opening.includes(number), `number ${number} missing in m12/${lang}`);
        }
      }
    }
  }
});

test('contract letters reject unknown missions and invalid seal counts', () => {
  assert(getContractLetters('sandbox', 'pl') === null, 'sandbox has no castellan letters');
  assert(getContractLetters('missing', 'en') === null, 'unknown mission has no letters');
  for (const seals of [0, -1, 4, 1.5]) {
    assert(getContractLetter('m1', 'won', seals, 'en') === null, `invalid seals: ${seals}`);
  }
});
