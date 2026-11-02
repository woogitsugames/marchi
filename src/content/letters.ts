// Authored contract letters for missions I-IX (VII-IX openings: docs/content/letters-7-9.md); all
// player-facing copy is localized.
// The letter counts are intentionally separate from simulation and UI logic.
import { getLang, type Lang } from '../i18n/index';

export type ContractMissionId = 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6' | 'm7' | 'm8' | 'm9';
export type LetterPhase = 'opening' | 'won' | 'lost';
export type SealCount = 1 | 2 | 3;

export interface ContractLetterSet {
  readonly opening: string;
  readonly won: Readonly<Record<SealCount, string>>;
  readonly lost: string;
}

/** Localized story content; signatures count toward the character limits. */
export const CONTRACT_LETTERS = {
  m1: {
    pl: {
      opening: "Do zarządcy traktów: przed pierwszym śniegiem dostarcz do grodu 30 desek i 20 bochenków. Drwal i tartak pracują za rzeką, lecz brzegi nie są połączone. Wytycz przeprawę, a potem dopilnuj drogi mąki i chleba.\n— Wszebor, kasztelan Łozinnego Brodu",
      won: {
        1: "Dostawy dotarły przed śniegiem. Cieśle mają deski, kuchnia chleb. Następnym razem puść wozy w drogę wcześniej.\n— Wszebor",
        2: "Dobrze wytyczony trakt przyniósł dostawy ze sporym zapasem czasu. Dwie pieczęcie za sprawną pracę wozów.\n— Wszebor",
        3: "Bramę otwarto, nim zziębły konie. Deski i chleb złożono bez zwłoki; tak prowadzi się gród przez jesień.\n— Wszebor",
      },
      lost: "Przyszedł pierwszy śnieg, a część dostaw została na szlaku. Sprawdź, czy oba brzegi mają drogę i czy wozy odbierają towar.\n— Wszebor",
    },
    en: {
      opening: "To the road steward: deliver 30 planks and 20 loaves to the castle before the first snow. The woodcutter and sawmill stand across the river, but the banks are not joined. Build a crossing, then see that flour and bread keep moving.\n— Wszebor, Castellan of Łozinny Bród",
      won: {
        1: "The goods arrived before the snow. The carpenters have planks and the kitchen has bread. Next time, send the wagons out sooner.\n— Wszebor",
        2: "A well-laid road brought the goods with time to spare. Two seals for sound wagon work.\n— Wszebor",
        3: "The gate opened before the horses grew cold. Bread and planks were stored without delay. This is how a march survives autumn.\n— Wszebor",
      },
      lost: "The first snow has come, and part of the order remains on the road. Check the crossing and make sure the wagons can collect their loads.\n— Wszebor",
    },
  },
  m2: {
    pl: {
      opening: "Pisarz grodzki Mirogniew liczy 36 desek i 30 bochenków potrzebnych w grodzie. Wozy z obu brzegów tłoczą się na jedynym drewnianym moście. Nim termin minie, odciąż przeprawę: drugi most albo kamień mogą skrócić kolejkę.\n— Wszebor",
      won: {
        1: "Kontrakt wykonano, choć wóz za wozem czekał przy przyczółku. Pieczęć za dochowanie terminu.\n— Wszebor",
        2: "Przeprawa szła sprawniej, niż zapowiadali woźnice. Zapisuję dwie pieczęcie za dobrą organizację kursów.\n— Wszebor",
        3: "Po obu brzegach ruch trwał bez zbędnej zwłoki. Trzy pieczęcie; tak należy gospodarować wąską przeprawą.\n— Wszebor",
      },
      lost: "W księdze brakuje towarów dostarczonych w terminie. Obejrzyj kolejkę przy przyczółku i zapewnij wozom drugą drogę.\n— Wszebor",
    },
    en: {
      opening: "Castle scribe Mirogniew has counted 36 planks and 30 loaves needed at the keep. Wagons from both banks crowd onto the only wooden bridge. Before the deadline, ease the crossing: a second bridge or a stone span may shorten the queue.\n— Wszebor",
      won: {
        1: "The order is filled, though wagons queued at the bridgehead. One seal for keeping the deadline.\n— Wszebor",
        2: "The crossing worked better than the carters foretold. I mark two seals for well-managed journeys.\n— Wszebor",
        3: "Goods moved across both banks without needless delay. Three seals; that is how one manages a narrow crossing.\n— Wszebor",
      },
      lost: "The ledger lacks some goods due by the deadline. Inspect the queue at the bridgehead and give the wagons another route.\n— Wszebor",
    },
  },
  m3: {
    pl: {
      opening: "Deszcz rozmył gruntowy trakt. Do zamku potrzeba 24 desek i 16 bochenków, ale koła grzęzną w koleinach. Młynarz Borzym czeka na przewóz ziarna. Wybrukuj odcinki, po których idzie najwięcej wozów.\n— Wszebor",
      won: {
        1: "Gród otrzymał zapasy mimo ulewy. Termin ocalony, ale błoto kosztowało nas wiele czasu.\n— Wszebor",
        2: "Droga wytrzymała jesienną słotę. Dwie pieczęcie za sprawny przewóz.\n— Wszebor",
        3: "Nie zatrzymała was nawet ulewa. Trzy pieczęcie, bo dobry trakt jest wart więcej niż pośpiech woźnicy.\n— Wszebor",
      },
      lost: "Ulewa nie ustała, a dostaw zabrakło. Przed kolejną próbą zobacz, gdzie wozy zwalniają, i tam ułóż bruk.\n— Wszebor",
    },
    en: {
      opening: "Rain has washed out the dirt road. The castle needs 24 planks and 16 loaves, but wheels sink into the ruts. Borzym the miller waits for grain to be hauled. Lay cobbles where the wagons travel most.\n— Wszebor",
      won: {
        1: "The castle received its supplies despite the downpour. The deadline was kept, though mud cost us precious time.\n— Wszebor",
        2: "The road held against the autumn rain. Two seals for a steady delivery.\n— Wszebor",
        3: "Even the downpour did not stop you. Three seals: a good road is worth more than a hurried carter.\n— Wszebor",
      },
      lost: "The rain did not let up, and the supplies fell short. Next time, find where the wagons slow down and lay cobbles there.\n— Wszebor",
    },
  },
  m4: {
    pl: {
      opening: "Na rzece ruszyła kra. O wyznaczonej porze zamknie drewnianą przeprawę. Nim nadejdzie przerwa, przewieź potrzebne zapasy do spichlerza po stronie grodu albo zbuduj kamienny most. Towar pozostawiony za rzeką nie nakarmi nikogo.\n— Wszebor",
      won: {
        1: "Kra utrudniła przewóz, lecz gród dostał swoje. Jedna pieczęć za dochowanie terminu.\n— Wszebor",
        2: "Kiedy lód odciął drewniany most, dostawy nie ustały na długo. Dwie pieczęcie za przezorność.\n— Wszebor",
        3: "Most bywa zamknięty, lecz dobrze obmyślony przewóz trwa dalej. Trzy pieczęcie za planowanie zapasów i przeprawy.\n— Wszebor",
      },
      lost: "Termin minął, choć pora zamknięcia mostu była znana. Przygotuj wcześniej zapas po stronie grodu albo kamienną przeprawę.\n— Wszebor",
    },
    en: {
      opening: "River ice is on the move. At the appointed hour it will close the wooden crossing. Before that happens, bring the needed supplies to a granary on the castle bank, or build a stone bridge. Goods left across the river will feed no one.\n— Wszebor",
      won: {
        1: "The ice hindered the carts, but the castle received its goods. One seal for meeting the deadline.\n— Wszebor",
        2: "When ice shut the wooden bridge, deliveries did not stop for long. Two seals for forethought.\n— Wszebor",
        3: "A bridge may close, yet a well-planned supply line endures. Three seals for planning the stores and crossing.\n— Wszebor",
      },
      lost: "The deadline passed, though the bridge closure was foretold. Stock the castle bank sooner, or prepare a stone crossing.\n— Wszebor",
    },
  },
  m5: {
    pl: {
      opening: "Na jarmark grodzki wyznaczono trzy dostawy w różnych porach. Pisarz Mirogniew wpisze każdą osobno: chleb i deski mają przybywać wedle kolejnych terminów, nie jednym wozem na koniec. Przygotuj zapas i pilnuj porządku kursów.\n— Wszebor",
      won: {
        1: "Trzy wpisy zamknięto przed terminami, choć nie bez zamieszania na placu. Jedna pieczęć.\n— Wszebor",
        2: "Jarmark miał to, czego potrzebował, we właściwej porze. Dwie pieczęcie za porządek w dostawach.\n— Wszebor",
        3: "Nie trzeba było wołać woźniców po raz drugi. Wszystkie transze dotarły bez pośpiechu ostatniej chwili. Trzy pieczęcie.\n— Wszebor",
      },
      lost: "Co najmniej jedna transza nie dotarła na czas. Następnym razem rozdziel zapas na kolejne terminy, zamiast liczyć tylko sumę.\n— Wszebor",
    },
    en: {
      opening: "The castle fair requires three deliveries at separate times. Scribe Mirogniew will enter each one in the ledger: bread and planks must arrive by their appointed deadlines, not in one last wagonload. Prepare a reserve and order the journeys well.\n— Wszebor",
      won: {
        1: "All three entries were closed on time, though the yard was in some disorder. One seal.\n— Wszebor",
        2: "The fair received what it needed at the proper hours. Two seals for keeping the deliveries in order.\n— Wszebor",
        3: "No carter needed to be called twice. Every instalment arrived without a last-minute rush. Three seals.\n— Wszebor",
      },
      lost: "At least one instalment missed its appointed time. Next time, divide the stores by deadline rather than counting only the total.\n— Wszebor",
    },
  },
  m6: {
    pl: {
      opening: "Spichlerz jest ciasny, a ziarno przybywa szybciej, niż młynarz Borzym może je odebrać. Gdy magazyn się zapełni, stanie praca i ucierpi kontrakt grodu. Znajdź miejsce dla zapasów albo skieruj wozy innym szlakiem.\n— Wszebor",
      won: {
        1: "Kontrakt dowieziony, choć spichlerz pękał w szwach. Jedna pieczęć; trzeba pilniej patrzeć na stan zapasów.\n— Wszebor",
        2: "Wozy rozniosły nadmiar towarów, zanim zatkał warsztaty. Dwie pieczęcie za rozsądną gospodarkę.\n— Wszebor",
        3: "Dobrze rozłożony zapas nie zatrzymał młyna ani piekarni na długo. Trzy pieczęcie za sprawny obieg towarów.\n— Wszebor",
      },
      lost: "Zapas utknął i zabrakło przewozu przed terminem. Sprawdź pełny spichlerz oraz drogę od młyna do piekarni.\n— Wszebor",
    },
    en: {
      opening: "The granary is cramped, and grain arrives faster than Borzym the miller can collect it. Once the stores fill, work will halt and the castle order will suffer. Make room for supplies or send the wagons by another route.\n— Wszebor",
      won: {
        1: "The order arrived, though the granary was bursting at the seams. One seal; mind the stores more closely next time.\n— Wszebor",
        2: "The wagons moved surplus goods before they clogged the workshops. Two seals for prudent keeping of stores.\n— Wszebor",
        3: "Well-placed stocks kept the mill and bakery from waiting long. Three seals for goods kept moving.\n— Wszebor",
      },
      lost: "Goods piled up, and the deliveries fell short of the deadline. Check the full granary and the route from mill to bakery.\n— Wszebor",
    },
  },
  m7: {
    pl: {
      opening: "Przed nami dni postu. Do zamkowej kuchni ma dotrzeć 54 ryb przed terminem. Na północnym brzegu stoi już jedna chata, lecz jej połowy mogą nie zdążyć. Nową chatę postaw tylko przy wodzie — na suchym polu nie złowisz niczego. Sprawdź, czy wozy przewiozą ryby przez drewniany most na południowy brzeg.\n— Wszebor",
      won: {
        1: "Ryby dotarły na czas, choć stół długo czekał. Jedna pieczęć; druga chata przy wodzie skróciłaby post kuchni.\n— Wszebor",
        2: "Kuchnia dostała połów bez większej zwłoki. Dwie pieczęcie; następnym razem postaw chatę wcześniej.\n— Wszebor",
        3: "Sieci przy brzegu i wozy na moście pracowały jak jeden szlak. Trzy pieczęcie za dobrze wybrane miejsce.\n— Wszebor",
      },
      lost: "Post się skończył, a ryb zabrakło. Sprawdź, czy chata stoi nad wodą i czy wozy nadążają przez most.\n— Wszebor",
    },
    en: {
      opening: "The fasting days are upon us. The castle kitchens require 54 fish by the deadline. One hut already stands on the north bank, but its catch may arrive too slowly. Place another hut by the water; an inland field yields no fish. Make sure the wagons bring the catch across the wooden bridge to the south bank.\n— Wszebor",
      won: {
        1: "The fish arrived in time, though the table waited long. One seal; a second hut by the water would have shortened the wait.\n— Wszebor",
        2: "The kitchens received the catch without much delay. Two seals; next time, build the hut sooner.\n— Wszebor",
        3: "Nets on the shore and wagons on the bridge worked as one road. Three seals for a well-chosen site.\n— Wszebor",
      },
      lost: "The fast is over and the fish fell short. Check that the hut stands by the water and that the wagons keep pace across the bridge.\n— Wszebor",
    },
  },
  m8: {
    pl: {
      opening: "Nad doliną zbierają się chmury. Zanim deszcz zamieni trakty w błoto, chcę dostać 24 deski i 20 chlebów. Kamieniołom pracuje na skalnym wzgórzu, lecz kamień leżący w jego składzie nie wybrukuje drogi. Niech wozy przewiozą go do spichlerza, po cztery sztuki na wóz. Dopiero wtedy napraw południowy odcinek traktu.\n— Wszebor",
      won: {
        1: "Dostawy przebiły się przez błoto. Jedna pieczęć; kamień leżał w kamieniołomie, a mógł leżeć na trakcie.\n— Wszebor",
        2: "Więcej wozów nadrobiło część błota. Dwie pieczęcie; bruk oszczędziłby jeszcze więcej czasu.\n— Wszebor",
        3: "Kamień przyjechał do spichlerza, nim lunęło, a bruk utrzymał wozy na drodze. Trzy pieczęcie za przezorność.\n— Wszebor",
      },
      lost: "Burza zatrzymała wozy w błocie. Najpierw przewieź kamień do spichlerza, potem wybrukuj południowy trakt.\n— Wszebor",
    },
    en: {
      opening: "Storm clouds are gathering over the valley. I require 24 planks and 20 loaves before muddy tracks delay our deliveries. The quarry stands on sound rock, but stone sitting at the quarry cannot pave a road. Send wagons to bring it to the granary, four units to a wagon. Only then improve the southern road.\n— Wszebor",
      won: {
        1: "The goods fought through the mud. One seal; the stone lay at the quarry when it could have lain on the road.\n— Wszebor",
        2: "More wagons made up for some of the mud. Two seals; cobbles would have saved more time still.\n— Wszebor",
        3: "The stone reached the granary before the rain, and the cobbles kept the wagons moving. Three seals for forethought.\n— Wszebor",
      },
      lost: "The storm held the wagons in the mud. Haul the stone to the granary first, then pave the southern road.\n— Wszebor",
    },
  },
  m9: {
    pl: {
      opening: "Wesele zbliża się nieubłaganie. Potrzeba 36 desek, 8 sztuk węgla drzewnego i 26 piw. Zboże musi trafić do słodowni, a słód do browaru. Tartak i węglarz pobierają drewno od tego samego drwala: gdy dostawa pójdzie do jednego, drugi stanie. Zwiększ podaż drewna i zadbaj o wozy.\n— Wszebor",
      won: {
        1: "Goście nie wyschli z pragnienia, choć tartak i węglarz kłócili się o każde polano. Jedna pieczęć.\n— Wszebor",
        2: "Drugi drwal uspokoił spór o drewno. Dwie pieczęcie; więcej wozów przyspieszyłoby resztę.\n— Wszebor",
        3: "Drewna starczyło dla obu warsztatów, a piwo popłynęło na czas. Trzy pieczęcie za dobrze rozdzielony las.\n— Wszebor",
      },
      lost: "Wesele nadeszło przed dostawami. Sprawdź, kto zabiera drewno drwala, i dodaj drugie źródło.\n— Wszebor",
    },
    en: {
      opening: "The wedding draws near. We need 36 planks, 8 charcoal and 26 beer. Grain must reach the malthouse, and malt the brewery. The sawmill and the charcoal burner both draw on a single woodcutter: when one claims the delivery, the other stops. Increase the wood supply and give the wagons enough capacity.\n— Wszebor",
      won: {
        1: "The guests did not go thirsty, though sawmill and burner quarrelled over every log. One seal.\n— Wszebor",
        2: "A second woodcutter settled the quarrel over timber. Two seals; more wagons would have hurried the rest.\n— Wszebor",
        3: "There was wood for both workshops, and the ale flowed on time. Three seals for a forest well shared.\n— Wszebor",
      },
      lost: "The wedding came before the deliveries. Check who takes the woodcutter's logs, and add a second source.\n— Wszebor",
    },
  },
} as const satisfies Record<ContractMissionId, Record<'pl' | 'en', ContractLetterSet> & Partial<Record<Lang, ContractLetterSet>>>;

/** Get all variants for a known contract; no letters exist for sandbox. */
export function getContractLetters(missionId: string, lang: Lang = getLang()): ContractLetterSet | null {
  if (!Object.prototype.hasOwnProperty.call(CONTRACT_LETTERS, missionId)) return null;
  // Languages without authored letters fall back to English (D-18).
  const byLang: Partial<Record<Lang, ContractLetterSet>> = CONTRACT_LETTERS[missionId as ContractMissionId];
  return byLang[lang] ?? byLang.en ?? null;
}

/** Resolve a start, loss, or seal-specific victory letter. Invalid selections return null. */
export function getContractLetter(
  missionId: string,
  phase: LetterPhase,
  seals: number = 0,
  lang: Lang = getLang(),
): string | null {
  const letters = getContractLetters(missionId, lang);
  if (!letters) return null;
  if (phase === 'opening') return letters.opening;
  if (phase === 'lost') return letters.lost;
  if (phase === 'won' && (seals === 1 || seals === 2 || seals === 3)) {
    return letters.won[seals];
  }
  return null;
}
