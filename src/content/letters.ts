// Authored contract letters for missions I-XII (VII-IX: docs/content/letters-7-9.md, X-XII:
// docs/content/letters-10-12.md); all
// player-facing copy is localized.
// The letter counts are intentionally separate from simulation and UI logic.
import { getLang, type Lang } from '../i18n/index';

export type ContractMissionId = 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6' | 'm7' | 'm8' | 'm9' | 'm10' | 'm11' | 'm12';
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
      opening: "Do zarządcy traktów: przed pierwszym śniegiem dostarcz do grodu 30 desek i 20 bochenków. Drwal i tartak pracują za rzeką, lecz brzegi nie są połączone. Wytycz przeprawę, a potem dopilnuj dowozu mąki i chleba.\n— Wszebor, kasztelan Łozinnego Brodu",
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
    de: {
      opening: "An den Wegewart: Bringt vor dem ersten Schnee 30 Bretter und 20 Brote zur Burg. Holzfäller und Sägewerk liegen jenseits des Flusses, doch die Ufer sind nicht verbunden. Baut eine Überfahrt und sorgt dafür, dass Mehl und Brot weiterfahren.\n— Wszebor, Burggraf von Łozinny Bród",
      won: {
        1: "Die Waren kamen vor dem Schnee, doch die Fuhrleute waren spät. Ein Siegel; schickt sie künftig früher los.\n— Wszebor",
        2: "Der gut angelegte Weg brachte die Waren mit Zeitreserve. Zwei Siegel für die tüchtigen Fuhrleute.\n— Wszebor",
        3: "Bretter und Brot lagen bereit, noch ehe die Pferde froren. Drei Siegel für gute Herbstvorsorge.\n— Wszebor",
      },
      lost: "Der erste Schnee kam, doch ein Teil der Ladung blieb unterwegs. Prüft die Überfahrt und die Abholung durch die Wagen.\n— Wszebor",
    },
    fr: {
      opening: "Au prévôt des routes : faites livrer au château 30 planches et 20 pains avant les premières neiges. Bûcheron et scierie sont au-delà de la rivière, sans liaison entre les rives. Tracez un passage, puis veillez au transport de farine et de pain.\n— Wszebor, châtelain de Łozinny Bród",
      won: {
        1: "Les denrées sont arrivées avant la neige, mais trop tardivement. Un sceau ; envoyez les chariots plus tôt.\n— Wszebor",
        2: "Une route bien tracée a permis de livrer largement avant l'échéance. Deux sceaux pour les charretiers.\n— Wszebor",
        3: "La porte s'est ouverte avant que les chevaux ne prennent froid. Pains et planches sont rangés sans retard. Trois sceaux.\n— Wszebor",
      },
      lost: "La première neige est tombée, une partie de la cargaison est restée en route. Vérifiez le passage et les chariots.\n— Wszebor",
    },
  },
  m2: {
    pl: {
      opening: "Pisarz grodzki Mirogniew wpisał 36 desek i 30 bochenków dla grodu. Wozy z obu brzegów tłoczą się na jedynym drewnianym moście. Nim termin minie, odciąż przeprawę: drugi most lub kamienna przeprawa skrócą kolejkę.\n— Wszebor",
      won: {
        1: "Kontrakt wykonano, choć wóz za wozem czekał przy przyczółku. Pieczęć za dochowanie terminu.\n— Wszebor",
        2: "Przeprawa szła sprawniej, niż zapowiadali woźnice. Zapisuję dwie pieczęcie za dobrą organizację kursów.\n— Wszebor",
        3: "Po obu brzegach ruch trwał bez zbędnej zwłoki. Trzy pieczęcie; tak należy gospodarować wąską przeprawą.\n— Wszebor",
      },
      lost: "W księdze brak części dostaw. Obejrzyj kolejkę przy przyczółku i zapewnij wozom drugą drogę.\n— Wszebor",
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
    de: {
      opening: "Schreiber Mirogniew fordert 36 Bretter und 30 Brote für die Burg. Wagen von beiden Ufern drängen sich auf einer Holzbrücke. Entlastet den Engpass rechtzeitig: Eine zweite Brücke oder ein steinerner Übergang verkürzt die Schlange.\n— Wszebor",
      won: {
        1: "Der Auftrag ist erfüllt, wenn auch die Wagen am Brückenkopf standen. Ein Siegel für die eingehaltene Frist.\n— Wszebor",
        2: "Die Überfahrt gelang besser als die Fuhrleute erwartet hatten. Zwei Siegel für die gut geordneten Fahrten.\n— Wszebor",
        3: "Beide Ufer wurden ohne unnötigen Verzug versorgt. Drei Siegel für die kluge Führung des Brückenverkehrs.\n— Wszebor",
      },
      lost: "In der Burg fehlen Waren. Prüft den Stau am Brückenkopf und eröffnet den Wagen einen zweiten Weg.\n— Wszebor",
    },
    fr: {
      opening: "Le scribe Mirogniew réclame 36 planches et 30 pains pour le château. Les chariots des deux rives encombrent l'unique pont de bois. Avant l'échéance, soulagez le passage : un second pont ou un ouvrage de pierre réduira l'attente.\n— Wszebor",
      won: {
        1: "La commande est livrée malgré la file au pont. Un sceau pour avoir tenu l'échéance.\n— Wszebor",
        2: "Le passage a mieux fonctionné que ne le disaient les charretiers. Deux sceaux pour les trajets bien réglés.\n— Wszebor",
        3: "Les marchandises ont circulé entre les deux rives sans retard inutile. Trois sceaux pour cette bonne ordonnance.\n— Wszebor",
      },
      lost: "Il manque des denrées au registre. Examinez la file au pont et ouvrez une autre voie aux chariots.\n— Wszebor",
    },
  },
  m3: {
    pl: {
      opening: "Deszcz rozmył gruntowy trakt. Do zamku trzeba dowieźć 24 deski i 16 bochenków, ale koła grzęzną w koleinach. Młynarz Borzym czeka na dostawę zboża. Wybrukuj odcinki, po których jeździ najwięcej wozów.\n— Wszebor",
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
    de: {
      opening: "Regen hat den Erdweg ausgewaschen. Die Burg braucht 24 Bretter und 16 Brote, doch die Räder versinken im Schlamm. Müller Borzym wartet auf Getreide. Pflastert die Abschnitte, die die Wagen am häufigsten befahren.\n— Wszebor",
      won: {
        1: "Trotz Regen trafen die Vorräte ein, doch der Schlamm kostete viel Zeit. Ein Siegel.\n— Wszebor",
        2: "Der Weg hielt dem Herbstregen stand. Zwei Siegel für stetige Lieferungen.\n— Wszebor",
        3: "Nicht einmal der Wolkenbruch hielt euch auf. Drei Siegel: Gutes Pflaster hilft mehr als eilige Fuhrleute.\n— Wszebor",
      },
      lost: "Der Regen hielt an, und die Vorräte reichten nicht. Pflastert dort, wo die Wagen am stärksten gebremst werden.\n— Wszebor",
    },
    fr: {
      opening: "La pluie a raviné la route de terre. Le château attend 24 planches et 16 pains, mais les roues s'enlisent dans les ornières. Borzym, le meunier, attend son grain. Pavez les tronçons les plus fréquentés.\n— Wszebor",
      won: {
        1: "Le château a été servi malgré l'averse, mais la boue a coûté du temps. Un sceau.\n— Wszebor",
        2: "La chaussée a résisté aux pluies d'automne. Deux sceaux pour une livraison régulière.\n— Wszebor",
        3: "Même l'averse ne vous a pas arrêtés. Trois sceaux : un bon pavage vaut mieux que la hâte d'un charretier.\n— Wszebor",
      },
      lost: "La pluie a duré et les livraisons ont manqué. Repérez où les chariots ralentissent et posez-y des pavés.\n— Wszebor",
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
    de: {
      opening: "Treibeis nähert sich. Zur festgesetzten Stunde sperrt es die Holzbrücke. Bringt die Vorräte vorher in einen Speicher am Burgufer oder errichtet eine Steinbrücke. Was am anderen Ufer bleibt, ernährt niemanden.\n— Wszebor",
      won: {
        1: "Das Eis störte die Fahrten, doch die Burg erhielt die Ware. Ein Siegel für die gewahrte Frist.\n— Wszebor",
        2: "Als das Eis die Holzbrücke sperrte, stockte der Nachschub nur kurz. Zwei Siegel für die Vorsorge.\n— Wszebor",
        3: "Auch eine gesperrte Brücke hält gut geplante Lieferungen nicht auf. Drei Siegel für Lager und Überfahrt.\n— Wszebor",
      },
      lost: "Die Frist verstrich trotz angekündigter Sperre. Legt Vorräte am Burgufer an oder baut eine Steinbrücke.\n— Wszebor",
    },
    fr: {
      opening: "Les glaces descendent la rivière et fermeront le pont de bois à l'heure dite. Avant cela, entreposez les vivres sur la rive du château ou bâtissez un pont de pierre. Les provisions laissées de l'autre côté ne nourriront personne.\n— Wszebor",
      won: {
        1: "La glace a gêné les chariots, mais le château a été servi. Un sceau pour le délai tenu.\n— Wszebor",
        2: "Quand la glace a fermé le pont de bois, les livraisons n'ont guère cessé. Deux sceaux pour la prévoyance.\n— Wszebor",
        3: "Un pont peut fermer ; un ravitaillement bien ordonné dure. Trois sceaux pour les réserves et le passage.\n— Wszebor",
      },
      lost: "L'échéance est passée malgré l'annonce de la fermeture. Stockez plus tôt sur la rive du château ou bâtissez en pierre.\n— Wszebor",
    },
  },
  m5: {
    pl: {
      opening: "Na jarmark grodzki wyznaczono trzy dostawy w różnych porach. Pisarz Mirogniew wpisze każdą osobno: chleb i deski mają przybywać wedle kolejnych terminów, nie jednym wozem na koniec. Przygotuj zapas i pilnuj porządku kursów.\n— Wszebor",
      won: {
        1: "Trzy dostawy zapisano w porę, choć na placu panował zamęt. Jedna pieczęć.\n— Wszebor",
        2: "Na jarmark dotarło wszystko o właściwej porze. Dwie pieczęcie za porządek w dostawach.\n— Wszebor",
        3: "Nie trzeba było wołać woźniców po raz drugi. Wszystkie dostawy dotarły bez gonitwy przed terminem. Trzy pieczęcie.\n— Wszebor",
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
    de: {
      opening: "Zum Burgmarkt sind drei Lieferungen zu verschiedenen Zeiten fällig. Schreiber Mirogniew verzeichnet jede einzeln: Brot und Bretter müssen termingerecht eintreffen, nicht erst mit dem letzten Wagen. Legt Vorräte an und ordnet die Fahrten.\n— Wszebor",
      won: {
        1: "Alle drei Lieferungen trafen rechtzeitig ein, doch auf dem Hof herrschte Unordnung. Ein Siegel.\n— Wszebor",
        2: "Der Markt erhielt jede Lieferung zur rechten Stunde. Zwei Siegel für gute Ordnung.\n— Wszebor",
        3: "Kein Fuhrmann musste zweimal gerufen werden. Alle drei Lieferungen kamen ohne letzte Hetze. Drei Siegel.\n— Wszebor",
      },
      lost: "Mindestens eine Lieferung kam zu spät. Teilt die Vorräte nach den drei Fristen auf; die Gesamtsumme genügt nicht.\n— Wszebor",
    },
    fr: {
      opening: "La foire du château exige trois livraisons à des heures distinctes. Le scribe Mirogniew inscrira chacune au registre : pains et planches doivent arriver à chaque échéance, non par le dernier chariot. Préparez des réserves et ordonnez les voyages.\n— Wszebor",
      won: {
        1: "Les trois livraisons sont arrivées à temps malgré le désordre de la cour. Un sceau.\n— Wszebor",
        2: "La foire a reçu chaque cargaison à l'heure voulue. Deux sceaux pour l'ordre des livraisons.\n— Wszebor",
        3: "Nul charretier n'a dû être rappelé. Chaque envoi est arrivé sans course de dernière heure. Trois sceaux.\n— Wszebor",
      },
      lost: "Au moins un envoi est arrivé en retard. Répartissez le stock par échéance au lieu de compter seulement le total.\n— Wszebor",
    },
  },
  m6: {
    pl: {
      opening: "Spichlerz jest ciasny, a zboże przybywa szybciej, niż młynarz Borzym może je odebrać. Gdy magazyn się zapełni, stanie praca i ucierpi kontrakt grodu. Znajdź miejsce dla zapasów albo skieruj wozy innym szlakiem.\n— Wszebor",
      won: {
        1: "Dostawy dotarły, choć spichlerz pękał w szwach. Jedna pieczęć; trzeba pilniej patrzeć na stan zapasów.\n— Wszebor",
        2: "Wozy rozwiozły nadmiar towarów, zanim zatrzymał pracę warsztatów. Dwie pieczęcie za rozsądną gospodarkę.\n— Wszebor",
        3: "Dobrze rozłożony zapas nie zatrzymał młyna ani piekarni na długo. Trzy pieczęcie za sprawny obieg towarów.\n— Wszebor",
      },
      lost: "Towar utknął w spichlerzu i nie dotarł na czas. Sprawdź pełny spichlerz oraz drogę od młyna do piekarni.\n— Wszebor",
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
    de: {
      opening: "Der Kornspeicher ist eng, und das Getreide kommt schneller an, als Müller Borzym es abholen kann. Ist das Lager voll, steht die Arbeit und der Burgauftrag leidet. Schafft Platz oder leitet die Wagen anders.\n— Wszebor",
      won: {
        1: "Die Lieferung gelang, doch der Speicher war zum Bersten voll. Ein Siegel; behaltet die Lager im Blick.\n— Wszebor",
        2: "Die Wagen brachten den Überschuss weg, ehe die Werkstätten stillstanden. Zwei Siegel für kluge Lagerhaltung.\n— Wszebor",
        3: "Gut verteilte Vorräte hielten Mühle und Bäckerei in Gang. Drei Siegel für einen freien Warenfluss.\n— Wszebor",
      },
      lost: "Die Waren türmten sich, und die Frist verstrich. Prüft den vollen Speicher und den Weg von Mühle zu Bäckerei.\n— Wszebor",
    },
    fr: {
      opening: "Le grenier est étroit ; le grain arrive plus vite que Borzym, le meunier, ne peut l'enlever. Un entrepôt plein arrêtera les ateliers et nuira à la commande du château. Trouvez de la place ou détournez les chariots.\n— Wszebor",
      won: {
        1: "La commande est livrée, mais le grenier débordait. Un sceau ; surveillez les réserves.\n— Wszebor",
        2: "Les chariots ont dégagé le surplus avant l'arrêt des ateliers. Deux sceaux pour la bonne gestion.\n— Wszebor",
        3: "Les réserves bien distribuées ont maintenu moulin et boulangerie en marche. Trois sceaux.\n— Wszebor",
      },
      lost: "Les marchandises se sont accumulées, et le délai a expiré. Vérifiez le grenier et la route du moulin au fournil.\n— Wszebor",
    },
  },
  m7: {
    pl: {
      opening: "Przed nami dni postu. Do zamkowej kuchni mają dotrzeć 54 ryby przed terminem. Na północnym brzegu stoi już jedna chata, lecz jej połowy mogą nie zdążyć. Nową chatę postaw tylko przy wodzie — na suchym polu nie złowisz niczego. Sprawdź, czy wozy przewiozą ryby przez drewniany most na południowy brzeg.\n— Wszebor",
      won: {
        1: "Ryby dotarły na czas, choć stół długo czekał. Jedna pieczęć; druga chata przy wodzie skróciłaby czekanie kucharzy.\n— Wszebor",
        2: "Kuchnia dostała połów bez większej zwłoki. Dwie pieczęcie; następnym razem postaw chatę wcześniej.\n— Wszebor",
        3: "Rybacy łowili, wozy dowoziły. Trzy pieczęcie za dobrze wybrane miejsce.\n— Wszebor",
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
    de: {
      opening: "Die Fastenzeit ist da. Die Burgküche verlangt 54 Fische. Am Nordufer steht schon eine Fischerhütte, doch ihr Fang könnte zu spät eintreffen. Errichtet eine zweite Hütte direkt am Wasser; landeinwärts gibt es keine Fische. Bringt den Fang über die Holzbrücke ans Südufer.\n— Wszebor",
      won: {
        1: "Die Fische kamen rechtzeitig, doch die Tafel wartete. Ein Siegel; eine zweite Fischerhütte hätte geholfen.\n— Wszebor",
        2: "Die Küche erhielt den Fang ohne große Verzögerung. Zwei Siegel; baut künftig die Hütte früher.\n— Wszebor",
        3: "Netze am Ufer und Wagen auf der Brücke arbeiteten gut zusammen. Drei Siegel für den klugen Standort.\n— Wszebor",
      },
      lost: "Die Fastenzeit ging vorüber, ohne dass genug Fisch eintraf. Prüft den Platz der Hütte und die Wagen an der Brücke.\n— Wszebor",
    },
    fr: {
      opening: "Le jeûne approche. Les cuisines du château exigent 54 poissons. Une cabane se trouve déjà sur la rive nord, mais la pêche risque d'arriver trop tard. Bâtissez une autre cabane près de l'eau : la terre ferme ne donne pas de poissons. Faites franchir le pont de bois aux chariots vers la rive sud.\n— Wszebor",
      won: {
        1: "Le poisson est arrivé à temps, mais la table a attendu. Un sceau ; une seconde cabane aurait aidé.\n— Wszebor",
        2: "Les cuisines ont reçu la pêche sans grand retard. Deux sceaux ; bâtissez la cabane plus tôt.\n— Wszebor",
        3: "Filets sur la rive et chariots sur le pont ont œuvré de concert. Trois sceaux pour l'emplacement choisi.\n— Wszebor",
      },
      lost: "Le jeûne est passé, et le poisson a manqué. Vérifiez la cabane près de l'eau et la cadence des chariots sur le pont.\n— Wszebor",
    },
  },
  m8: {
    pl: {
      opening: "Nad doliną zbierają się chmury. Zanim deszcz zamieni trakty w błoto, chcę dostać 24 deski i 20 bochenków. Kamieniołom pracuje na skalnym wzgórzu, lecz kamień leżący w jego składzie nie wybrukuje drogi. Niech wozy przewiozą go do spichlerza, po cztery sztuki na wóz. Dopiero wtedy napraw południowy odcinek traktu.\n— Wszebor",
      won: {
        1: "Dostawy przebiły się przez błoto. Jedna pieczęć; kamień leżał w kamieniołomie, a trakt tonął w błocie.\n— Wszebor",
        2: "Dodatkowe wozy częściowo nadrobiły opóźnienie przez błoto. Dwie pieczęcie; bruk oszczędziłby jeszcze więcej czasu.\n— Wszebor",
        3: "Kamień dotarł do spichlerza przed ulewą, a bruk utrzymał wozy na drodze. Trzy pieczęcie za przezorność.\n— Wszebor",
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
    de: {
      opening: "Ein Sturm zieht auf. Bringt 24 Bretter und 20 Brote zur Burg, ehe der Schlamm den Verkehr lähmt. Der Steinbruch liegt auf festem Fels; doch Stein im Bruch pflastert keinen Weg. Holt ihn mit Wagen zum Speicher, je vier Einheiten pro Wagen, und pflastert erst dann den Südweg.\n— Wszebor",
      won: {
        1: "Die Waren kämpften sich durch den Schlamm. Ein Siegel; der Stein lag noch im Bruch statt auf dem Weg.\n— Wszebor",
        2: "Mehr Wagen glichen manchen Zeitverlust aus. Zwei Siegel; Pflaster wäre noch besser gewesen.\n— Wszebor",
        3: "Der Stein erreichte vor dem Regen den Speicher, und das Pflaster hielt die Wagen in Fahrt. Drei Siegel.\n— Wszebor",
      },
      lost: "Der Sturm hielt die Wagen im Schlamm fest. Holt zuerst Stein zum Speicher, dann pflastert den Südweg.\n— Wszebor",
    },
    fr: {
      opening: "L'orage menace la vallée. Je demande 24 planches et 20 pains avant que la boue ne ralentisse les livraisons. La carrière est sur la roche, mais ses pierres ne pavent pas la route d'elles-mêmes. Transportez-les au grenier, quatre unités par chariot, puis pavez la route du sud.\n— Wszebor",
      won: {
        1: "Les denrées ont traversé la boue. Un sceau ; la pierre aurait dû quitter la carrière plus tôt.\n— Wszebor",
        2: "Davantage de chariots ont compensé une part du retard. Deux sceaux ; les pavés auraient mieux fait.\n— Wszebor",
        3: "La pierre est arrivée au grenier avant la pluie ; les pavés ont permis aux chariots de rouler. Trois sceaux.\n— Wszebor",
      },
      lost: "L'orage a retenu les chariots dans la boue. Portez d'abord la pierre au grenier, puis pavez la route du sud.\n— Wszebor",
    },
  },
  m9: {
    pl: {
      opening: "Wesele zbliża się nieubłaganie. Potrzeba 36 desek, 8 miar węgla drzewnego i 26 miar piwa. Zboże musi trafić do słodowni, a słód do browaru. Tartak i węglarz pobierają drewno od tego samego drwala: gdy dostawa pójdzie do jednego, drugi stanie. Zwiększ podaż drewna i zadbaj o wozy.\n— Wszebor",
      won: {
        1: "Goście nie cierpieli pragnienia, choć tartak i węglarz kłócili się o każde polano. Jedna pieczęć.\n— Wszebor",
        2: "Drugi drwal uspokoił spór o drewno. Dwie pieczęcie; więcej wozów przyspieszyłoby resztę.\n— Wszebor",
        3: "Drewna starczyło dla obu warsztatów, a piwo popłynęło na czas. Trzy pieczęcie za mądry podział drewna.\n— Wszebor",
      },
      lost: "Wesele nadeszło przed dostawami. Sprawdź, kto zabiera drewno drwala, i postaw drugą chatę drwala.\n— Wszebor",
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
    de: {
      opening: "Die Hochzeit naht. Benötigt werden 36 Bretter, 8 Holzkohle und 26 Bier. Getreide muss zur Mälzerei, Malz zur Brauerei. Sägewerk und Köhlerei teilen einen Holzfäller; nimmt einer das Holz, steht der andere still. Erhöht die Holzmenge und stellt genügend Wagen bereit.\n— Wszebor",
      won: {
        1: "Die Gäste litten keinen Durst, doch Sägewerk und Köhlerei stritten um jeden Stamm. Ein Siegel.\n— Wszebor",
        2: "Ein zweiter Holzfäller beendete den Streit. Zwei Siegel; mehr Wagen hätten den Rest beschleunigt.\n— Wszebor",
        3: "Beide Werkstätten hatten Holz, und das Bier kam pünktlich. Drei Siegel für einen gut geteilten Wald.\n— Wszebor",
      },
      lost: "Die Hochzeit begann vor dem Eintreffen der Ware. Prüft den Holzverbrauch und baut eine zweite Holzquelle.\n— Wszebor",
    },
    fr: {
      opening: "Le mariage approche. Il faut 36 planches, 8 mesures de charbon de bois et 26 de bière. Le grain doit gagner la malterie, puis le malt la brasserie. Scierie et charbonnière dépendent du même bûcheron : si l'une prend le bois, l'autre s'arrête. Augmentez la coupe et les chariots.\n— Wszebor",
      won: {
        1: "Les invités n'ont pas eu soif, mais scierie et charbonnière se disputaient chaque bûche. Un sceau.\n— Wszebor",
        2: "Un second bûcheron a réglé la querelle. Deux sceaux ; d'autres chariots auraient hâté le reste.\n— Wszebor",
        3: "Les deux ateliers ont eu leur bois et la bière a coulé à temps. Trois sceaux pour la juste répartition.\n— Wszebor",
      },
      lost: "Le mariage est venu avant les denrées. Voyez qui prend le bois du bûcheron et créez une seconde source.\n— Wszebor",
    },
  },
  m10: {
    pl: {
      opening: "Kowal czeka na węgiel drzewny, a cieśle na deski: potrzeba 48 desek i 8 miar węgla. Tartak i węglarz biorą drewno od jednego drwala, a on nie nadąży za oboma. Gdy przy tartaku widać, że drewno trafia do węglarza, nie obwiniaj wozów — drewna jest za mało. Postaw drugiego drwala; więcej wozów nie zetnie ani jednego drzewa.\n— Wszebor",
      won: {
        1: "Deski i węgiel dotarły, choć tartak długo czekał na każde polano. Jedna pieczęć; drugi drwal skróciłby tę kolejkę.\n— Wszebor",
        2: "Drugi drwal uspokoił spór o drewno, lecz zjawił się późno. Dwie pieczęcie; następnym razem zwiększ podaż od razu.\n— Wszebor",
        3: "Drewna starczyło dla węglarza i tartaku. Trzy pieczęcie za naprawę u źródła, a nie na drodze.\n— Wszebor",
      },
      lost: "Termin minął, a desek zabrakło: węglarz spalał drewno, którego potrzebował tartak. Postaw drugiego drwala; dodatkowe wozy nie dadzą więcej drewna.\n— Wszebor",
    },
    en: {
      opening: "The smith waits for charcoal and the carpenters for planks: we need 48 planks and 8 charcoal. The sawmill and the charcoal burner draw on one woodcutter, and he cannot keep up with both. When the sawmill reports its wood going to the burner, do not blame the wagons — there is too little wood. Build a second woodcutter; more wagons will not fell a single tree.\n— Wszebor",
      won: {
        1: "The planks and charcoal arrived, though the sawmill waited long for every log. One seal; a second woodcutter would have shortened the wait.\n— Wszebor",
        2: "A second woodcutter settled the quarrel over timber, but he came late. Two seals; next time, raise the supply at once.\n— Wszebor",
        3: "There was wood for the forge and for the sawmill. Three seals for mending the source rather than the road.\n— Wszebor",
      },
      lost: "The deadline passed and planks fell short: the burner turned to charcoal the wood the sawmill needed. Build a second woodcutter; extra wagons bring no extra wood.\n— Wszebor",
    },
    de: {
      opening: "Der Schmied verlangt Holzkohle, die Zimmerleute Bretter: 48 Bretter und 8 Holzkohle. Sägewerk und Köhlerei hängen an einem Holzfäller. Meldet das Sägewerk Holz beim Köhler, fehlen nicht Wagen, sondern Stämme. Baut einen zweiten Holzfäller; zusätzliche Wagen fällen keine Bäume.\n— Wszebor",
      won: {
        1: "Bretter und Kohle kamen an, doch das Sägewerk wartete oft auf Holz. Ein Siegel; ein zweiter Holzfäller hätte geholfen.\n— Wszebor",
        2: "Ein zweiter Holzfäller beendete den Streit, kam aber spät. Zwei Siegel; vergrößert den Nachschub früher.\n— Wszebor",
        3: "Für Schmiede und Sägewerk war genug Holz da. Drei Siegel für die Lösung am Ursprung statt am Weg.\n— Wszebor",
      },
      lost: "Die Frist verstrich, und Bretter fehlten: Der Köhler verbrauchte das Holz des Sägewerks. Baut einen zweiten Holzfäller.\n— Wszebor",
    },
    fr: {
      opening: "Le forgeron attend du charbon et les charpentiers des planches : il faut 48 planches et 8 mesures de charbon de bois. Scierie et charbonnière se partagent un seul bûcheron. Si la scierie manque de bois, ce ne sont pas les chariots qui font défaut. Bâtissez une seconde cabane de bûcheron.\n— Wszebor",
      won: {
        1: "Planches et charbon sont arrivés, mais la scierie a longtemps attendu les bûches. Un sceau.\n— Wszebor",
        2: "Un second bûcheron a mis fin à la querelle, trop tard pourtant. Deux sceaux ; augmentez la coupe sans attendre.\n— Wszebor",
        3: "Le bois a suffi à la forge et à la scierie. Trois sceaux pour avoir réparé la source, non la route.\n— Wszebor",
      },
      lost: "Le délai a expiré ; la charbonnière a pris le bois nécessaire aux planches. Ajoutez un bûcheron, non des chariots.\n— Wszebor",
    },
  },
  m11: {
    pl: {
      opening: "Na zimę zamek potrzebuje 22 miar piwa. Zboże rośnie na zachodnich polach, a słodownia stoi daleko na wschodzie. Trzy wozy mają obsłużyć gospodarstwo, słodownię, browar i zamek. Gdy browar pisze, że wszystkie wozy są zajęte, a zboże czeka na polu, kup wozy w stajni: trasa się nie skróci, ale więcej kursów pójdzie naraz.\n— Wszebor",
      won: {
        1: "Piwo dotarło, ale wozy spędziły zbyt wiele czasu w drodze. Jedna pieczęć; długi szlak wymaga więcej wozów.\n— Wszebor",
        2: "Dodatkowy wóz pomógł słodowni, choć część kursów wciąż czekała. Dwie pieczęcie; na tak długim szlaku przydałyby się kolejne wozy.\n— Wszebor",
        3: "Słód docierał do browaru, a piwo do zamku bez zwłoki. Trzy pieczęcie: nie brakowało zboża, tylko wozów na długie kursy.\n— Wszebor",
      },
      lost: "Zima przyszła przed ostatnią beczką. Sprawdź, czy wszystkie wozy są zajęte, a zboże czeka na polu. Dokup wozy, nim długa trasa pochłonie cały czas.\n— Wszebor",
    },
    en: {
      opening: "For the winter the castle needs 22 beer. Grain grows in the western fields, but the malthouse stands far to the east. Three wagons must serve the farm, the malthouse, the brewery and the castle. When the brewery reports every wagon busy while grain waits in the field, buy wagons at the stable: the road stays long, but more journeys run at once.\n— Wszebor",
      won: {
        1: "The beer arrived, but the wagons spent too long on the road. One seal; a long route needs a larger fleet.\n— Wszebor",
        2: "An extra wagon helped the malthouse, though some journeys still waited. Two seals; so long a road wanted more horses.\n— Wszebor",
        3: "Malt reached the brewery and beer the castle without delay. Three seals: grain was never short, only wagons for the long journeys.\n— Wszebor",
      },
      lost: "Winter came before the last barrel. Check whether every wagon is busy while grain waits in the field. Buy wagons before the long road eats all the time.\n— Wszebor",
    },
    de: {
      opening: "Zum Winter braucht die Burg 22 Bier. Getreide wächst im Westen, die Mälzerei steht weit im Osten. Drei Wagen versorgen Hof, Mälzerei, Brauerei und Burg. Sind alle Wagen beschäftigt und liegt Getreide auf dem Feld, kauft weitere Wagen im Stall: Der Weg bleibt lang, aber mehr Fahrten laufen zugleich.\n— Wszebor",
      won: {
        1: "Das Bier kam an, doch die Wagen waren zu lange unterwegs. Ein Siegel; lange Wege brauchen mehr Wagen.\n— Wszebor",
        2: "Ein zusätzlicher Wagen half der Mälzerei, doch manche Fahrt wartete noch. Zwei Siegel.\n— Wszebor",
        3: "Malz gelangte zur Brauerei, Bier zur Burg, ohne Verzug. Drei Siegel: Nicht Getreide, sondern Wagen fehlten.\n— Wszebor",
      },
      lost: "Der Winter kam vor dem letzten Fass. Prüft die beschäftigten Wagen und das Getreide auf dem Feld; kauft weitere Wagen.\n— Wszebor",
    },
    fr: {
      opening: "Pour l'hiver, le château attend 22 mesures de bière. Le grain pousse à l'ouest ; la malterie se trouve loin à l'est. Trois chariots desservent ferme, malterie, brasserie et château. Si tous roulent alors que le grain attend au champ, achetez des chariots à l'écurie : plusieurs voyages pourront partir ensemble.\n— Wszebor",
      won: {
        1: "La bière est arrivée, mais les chariots ont trop tardé. Un sceau ; une longue route exige davantage de véhicules.\n— Wszebor",
        2: "Un chariot de plus a aidé la malterie, mais d'autres courses attendaient. Deux sceaux.\n— Wszebor",
        3: "Malt et bière ont atteint leur destination sans retard. Trois sceaux : il manquait des chariots, non du grain.\n— Wszebor",
      },
      lost: "L'hiver est arrivé avant le dernier tonneau. Si le grain attend et que tous les chariots roulent, achetez-en d'autres.\n— Wszebor",
    },
  },
  m12: {
    pl: {
      opening: "Na wielkie warzenie potrzeba 40 bochenków i 48 miar piwa w trzech dostawach: 32 bochenki do 6:00, potem 8 bochenków i 12 miar piwa do 9:00, na koniec 36 miar piwa do 12:00. Zamek przyjmuje tylko bieżącą dostawę, więc browar szybko zapełni półki. Mały spichlerz jest pełen zboża, a duży stoi dwa pola od traktu. Połącz go od razu — przechowa piwo na kolejne dostawy.\n— Wszebor",
      won: {
        1: "Ostatnie beczki dotarły, ale browar długo stał z pełnymi półkami. Jedna pieczęć; wolny spichlerz pozwoliłby warzyć na zapas.\n— Wszebor",
        2: "Duży spichlerz przyjął część piwa, choć połączyłeś go późno. Dwie pieczęcie; im wcześniej go połączysz, tym większy zapas.\n— Wszebor",
        3: "Wszystkie dostawy dotarły w porę. Spichlerz przechował piwo, aż zamek mógł je przyjąć. Trzy pieczęcie.\n— Wszebor",
      },
      lost: "Ostatni termin minął bez całego zamówienia. Browar stał, bo pełny spichlerz nie przyjmował nadwyżek. Połącz duży spichlerz, zanim półki się zapełnią.\n— Wszebor",
    },
    en: {
      opening: "The great brewing needs 40 loaves and 48 beer in three letters: 32 loaves by 6:00, then 8 loaves and 12 beer by 9:00, and last 36 beer by 12:00. The castle takes only the current letter, so the brewery will soon fill its shelves. The small granary is full of grain, and the large one stands two cells from the road. Connect it at once — it will keep the beer for the later letters.\n— Wszebor",
      won: {
        1: "The last barrels arrived, but the brewery stood long with full shelves. One seal; a free granary would have let it brew ahead.\n— Wszebor",
        2: "The large granary took some of the beer, though you connected it late. Two seals; the sooner the store, the larger the reserve.\n— Wszebor",
        3: "Every letter was filled on time. The granary took the beer while the castle did not want it and gave it back when the time came. Three seals.\n— Wszebor",
      },
      lost: "The last deadline passed without the whole order. The brewery stood idle because the full granary took no surplus. Connect the large granary before the shelves fill.\n— Wszebor",
    },
    de: {
      opening: "Zum großen Brauen braucht die Burg 40 Brote und 48 Bier in drei Lieferungen: 32 Brote bis 6:00, 8 Brote und 12 Bier bis 9:00, zuletzt 36 Bier bis 12:00. Die Burg nimmt nur die laufende Lieferung an; die Brauerei füllt sich rasch. Der kleine Speicher ist voller Getreide, der große steht zwei Felder vom Weg. Schließt ihn sofort an, um Bier zu lagern.\n— Wszebor",
      won: {
        1: "Die letzten Fässer kamen, doch die Brauerei stand lange voll. Ein Siegel; ein freier Speicher hätte geholfen.\n— Wszebor",
        2: "Der große Speicher nahm Bier auf, wurde jedoch spät angeschlossen. Zwei Siegel; früheres Anschließen schafft Vorrat.\n— Wszebor",
        3: "Alle drei Lieferungen trafen rechtzeitig ein. Der Speicher bewahrte das Bier, bis die Burg es annahm. Drei Siegel.\n— Wszebor",
      },
      lost: "Die letzte Frist verstrich, und Ware fehlte. Der volle Speicher nahm keinen Überschuss auf. Schließt den großen Speicher rechtzeitig an.\n— Wszebor",
    },
    fr: {
      opening: "Pour le grand brassage : 40 pains et 48 mesures de bière en trois envois. Avant 6:00, 32 pains ; avant 9:00, 8 pains et 12 bières ; avant 12:00, 36 bières. Le château n'accepte que l'envoi courant. Le petit grenier est plein de grain ; le grand, à deux cases de la route. Reliez-le vite pour stocker la bière.\n— Wszebor",
      won: {
        1: "Les derniers tonneaux sont arrivés, mais la brasserie est longtemps restée pleine. Un sceau ; un grenier libre aurait aidé.\n— Wszebor",
        2: "Le grand grenier a reçu la bière, mais trop tard. Deux sceaux ; le relier plus tôt permet de stocker davantage.\n— Wszebor",
        3: "Tous les envois sont arrivés à l'heure. Le grenier a gardé la bière jusqu'à ce que le château l'accepte. Trois sceaux.\n— Wszebor",
      },
      lost: "La dernière échéance a passé. La brasserie était bloquée par le grenier plein. Reliez le grand grenier avant saturation.\n— Wszebor",
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
