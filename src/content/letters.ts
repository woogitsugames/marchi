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
    nl: {
      opening: "Aan de wegbeheerder: lever vóór de eerste sneeuw 30 planken en 20 broden aan het kasteel. De houthakker en zagerij liggen aan de overkant; er is nog geen verbinding. Bouw een oversteek en houd het vervoer van meel en brood op gang.\n— Wszebor, kastelein van Łozinny Bród",
      won: {
        1: "Brood en planken bereikten het kasteel. Eén zegel; Stuur de wagens volgende keer eerder weg.\n— Wszebor",
        2: "Brood en planken bereikten het kasteel. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "Brood en planken bereikten het kasteel. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "De sneeuw kwam eerder dan een deel van de vracht. Controleer de oversteek en of wagens goederen ophalen.\n— Wszebor",
    },
    es: {
      opening: "Al encargado de caminos: lleva 30 tablones y 20 hogazas al castillo antes de la primera nevada. El leñador y el aserradero están al otro lado del río, sin paso entre las orillas. Construye un cruce y mantén el transporte de harina y pan.\n— Wszebor, castellano de Łozinny Bród",
      won: {
        1: "El castillo recibió pan y tablones. Un sello; La próxima vez envía los carros antes.\n— Wszebor",
        2: "El castillo recibió pan y tablones. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "El castillo recibió pan y tablones. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "Llegó la nieve y parte de la carga quedó en el camino. Comprueba el cruce y la recogida de mercancías.\n— Wszebor",
    },
    it: {
      opening: "Al custode delle strade: porta al castello 30 assi e 20 pagnotte prima della prima neve. Taglialegna e segheria sono oltre il fiume, ma le rive non sono collegate. Costruisci un passaggio e mantieni il trasporto di farina e pane.\n— Wszebor, castellano di Łozinny Bród",
      won: {
        1: "Pane e assi sono arrivati al castello. Un sigillo; La prossima volta manda prima i carri.\n— Wszebor",
        2: "Pane e assi sono arrivati al castello. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "Pane e assi sono arrivati al castello. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "È arrivata la prima neve e parte delle merci è rimasta per strada. Controlla il passaggio e il ritiro dei carichi.\n— Wszebor",
    },
    "pt-BR": {
      opening: "Ao encarregado das estradas: entregue 30 tábuas e 20 pães ao castelo antes da primeira neve. O lenhador e a serraria ficam do outro lado do rio, sem ligação entre as margens. Construa uma travessia e mantenha o transporte de farinha e pão.\n— Wszebor, castelão de Łozinny Bród",
      won: {
        1: "Pães e tábuas chegaram ao castelo. Um selo; Na próxima vez, envie as carroças antes.\n— Wszebor",
        2: "Pães e tábuas chegaram ao castelo. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "Pães e tábuas chegaram ao castelo. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "A neve chegou e parte da carga ficou pelo caminho. Verifique a travessia e a coleta pelas carroças.\n— Wszebor",
    },
    sv: {
      opening: "Till vägförvaltaren: för 30 plankor och 20 bröd till borgen före första snön. Skogshuggaren och sågverket ligger bortom floden, men stränderna saknar förbindelse. Bygg en överfart och håll mjöl och bröd i rörelse.\n— Wszebor, kastellan av Łozinny Bród",
      won: {
        1: "Bröd och plankor nådde borgen. Ett sigill; Skicka iväg vagnarna tidigare nästa gång.\n— Wszebor",
        2: "Bröd och plankor nådde borgen. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Bröd och plankor nådde borgen. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Den första snön kom, men en del av lasten var kvar på vägen. Kontrollera överfarten och vagnarnas hämtning.\n— Wszebor",
    },
    tr: {
      opening: "Yol sorumlusuna: İlk kar düşmeden kaleye 30 kalas ve 20 somun ekmek ulaştır. Oduncu ile kereste atölyesi nehrin karşısında, fakat iki kıyı bağlı değil. Bir geçit yap; un ve ekmek taşıyan arabaların yolunu açık tut.\n— Wszebor, Łozinny Bród kale kâhyası",
      won: {
        1: "Ekmek ile kalas kaleye ulaştı. Bir mühür; Bir dahaki sefere arabaları daha erken gönder.\n— Wszebor",
        2: "Ekmek ile kalas kaleye ulaştı. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Ekmek ile kalas kaleye ulaştı. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "İlk kar geldi, ama yükün bir kısmı yolda kaldı. Geçidi ve arabaların yük alıp almadığını denetle.\n— Wszebor",
    },
    ru: {
      opening: "Смотрителю дорог: до первого снега доставь в замок 30 досок и 20 буханок хлеба. Лесоруб и лесопилка стоят за рекой, но берега не соединены. Построй переправу и наладь подвоз муки и хлеба.\n— Wszebor, каштелян Łozinny Bród",
      won: {
        1: "Доски и хлеб доставлены в замок. Одна печать; В другой раз отправляй повозки раньше.\n— Wszebor",
        2: "Доски и хлеб доставлены в замок. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Доски и хлеб доставлены в замок. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Первый снег пришёл, а часть груза осталась в дороге. Проверь переправу и сбор товаров повозками.\n— Wszebor",
    },
    uk: {
      opening: "Наглядачеві шляхів: до першого снігу доправ до замку 30 дощок і 20 хлібин. Лісоруб і лісопилка стоять за річкою, але береги не з'єднані. Збудуй переправу й забезпеч перевезення борошна та хліба.\n— Wszebor, каштелян Łozinny Bród",
      won: {
        1: "Дошки й хліб прибули до замку. Одна печатка; Наступного разу відправляй вози раніше.\n— Wszebor",
        2: "Дошки й хліб прибули до замку. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Дошки й хліб прибули до замку. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Перший сніг випав, а частина вантажу лишилася в дорозі. Перевір переправу й забір товарів возами.\n— Wszebor",
    },
    ja: {
      opening: "街道管理官へ。初雪までに板材30とパン20を城へ運べ。川向こうの木こり小屋と製材所は、まだこちら岸と道で結ばれていない。渡河路を築き、小麦粉とパンの輸送を絶やすな。\n— Wszebor、Łozinny Bród城代",
      won: {
        1: "パンと板材が城に届いた。印章は一つ。\n— Wszebor",
        2: "パンと板材が城に届いた。よく整えた運行に印章二つ。\n— Wszebor",
        3: "パンと板材が城に届いた。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "初雪が来たが荷の一部は道に残った。渡河路と荷車の積み込みを確かめよ。\n— Wszebor",
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
    nl: {
      opening: "Kasteelschrijver Mirogniew vraagt 36 planken en 30 broden. Wagens van beide oevers verdringen zich op de enige houten brug. Maak vóór de termijn ruimte: een tweede brug of een stenen oversteek verkort de wachtrij.\n— Wszebor",
      won: {
        1: "De bestelling kwam over de brug aan. Eén zegel; Verminder de wachtrij bij de brug.\n— Wszebor",
        2: "De bestelling kwam over de brug aan. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "De bestelling kwam over de brug aan. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "De termijn verstreek terwijl goederen bij de brug wachtten. Geef de wagens een tweede route.\n— Wszebor",
    },
    es: {
      opening: "El escribano Mirogniew exige 36 tablones y 30 hogazas. Los carros de ambas orillas se agolpan en el único puente de madera. Antes del plazo, construye otro puente o un paso de piedra para aliviar la cola.\n— Wszebor",
      won: {
        1: "El pedido cruzó el puente. Un sello; Reduce la espera en el puente.\n— Wszebor",
        2: "El pedido cruzó el puente. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "El pedido cruzó el puente. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "El plazo venció con carros atascados en el puente. Abre una segunda ruta.\n— Wszebor",
    },
    it: {
      opening: "Lo scrivano Mirogniew registra 36 assi e 30 pagnotte per il castello. I carri delle due rive affollano l'unico ponte di legno. Prima della scadenza alleggerisci il passaggio con un secondo ponte o uno in pietra.\n— Wszebor",
      won: {
        1: "La merce ha attraversato il ponte. Un sigillo; Riduci la coda al ponte.\n— Wszebor",
        2: "La merce ha attraversato il ponte. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "La merce ha attraversato il ponte. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "La scadenza è trascorsa con i carri in coda al ponte. Apri un secondo percorso.\n— Wszebor",
    },
    "pt-BR": {
      opening: "O escriba Mirogniew exige 36 tábuas e 30 pães para o castelo. Carroças das duas margens se amontoam na única ponte de madeira. Antes do prazo, construa outra ponte ou uma passagem de pedra para aliviar a fila.\n— Wszebor",
      won: {
        1: "A encomenda atravessou a ponte. Um selo; Reduza a fila na ponte.\n— Wszebor",
        2: "A encomenda atravessou a ponte. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "A encomenda atravessou a ponte. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "O prazo acabou com mercadorias presas na ponte. Abra uma segunda rota.\n— Wszebor",
    },
    sv: {
      opening: "Borgskrivaren Mirogniew begär 36 plankor och 30 bröd. Vagnar från båda stränderna trängs på den enda träbron. Lätta på kön före tidsfristen: en andra bro eller en stenbro hjälper.\n— Wszebor",
      won: {
        1: "Varorna tog sig över bron. Ett sigill; Minska kön vid brofästet.\n— Wszebor",
        2: "Varorna tog sig över bron. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Varorna tog sig över bron. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Tidsfristen gick ut medan vagnarna stod i brokön. Ge dem en andra väg.\n— Wszebor",
    },
    tr: {
      opening: "Kale kâtibi Mirogniew 36 kalas ve 30 somun ekmek istiyor. İki kıyıdan gelen arabalar tek ahşap köprüde sıkışıyor. Süre dolmadan ikinci bir köprü veya taş geçit yapıp kuyruğu azalt.\n— Wszebor",
      won: {
        1: "Sipariş köprüden geçirildi. Bir mühür; Köprü kuyruğunu azalt.\n— Wszebor",
        2: "Sipariş köprüden geçirildi. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Sipariş köprüden geçirildi. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "Süre bitti, arabalar köprüde bekliyordu. İkinci bir geçit aç.\n— Wszebor",
    },
    ru: {
      opening: "Замковый писарь Mirogniew требует 36 досок и 30 буханок хлеба. Повозки с обоих берегов толпятся на единственном деревянном мосту. До срока разгрузи переправу: второй мост или каменный переход сократит очередь.\n— Wszebor",
      won: {
        1: "Заказ переправлен через мост. Одна печать; Уменьши очередь у моста.\n— Wszebor",
        2: "Заказ переправлен через мост. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Заказ переправлен через мост. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Срок вышел, пока повозки стояли у моста. Дай им второй путь.\n— Wszebor",
    },
    uk: {
      opening: "Замковий писар Mirogniew вимагає 36 дощок і 30 хлібин. Вози з обох берегів тісняться на єдиному дерев'яному мосту. До строку розвантаж переправу: другий міст або кам'яний проїзд скоротить чергу.\n— Wszebor",
      won: {
        1: "Замовлення проїхало через міст. Одна печатка; Скороти чергу біля мосту.\n— Wszebor",
        2: "Замовлення проїхало через міст. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Замовлення проїхало через міст. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Строк минув, поки вози стояли в черзі на міст. Відкрий інший шлях.\n— Wszebor",
    },
    ja: {
      opening: "城の書記Mirogniewが板材36とパン30を求めている。両岸の荷車が唯一の木橋に殺到した。期限までにもう一本橋を架けるか石橋を造り、渋滞を解消せよ。\n— Wszebor",
      won: {
        1: "荷は橋を渡り城へ届いた。印章は一つ。\n— Wszebor",
        2: "荷は橋を渡り城へ届いた。よく整えた運行に印章二つ。\n— Wszebor",
        3: "荷は橋を渡り城へ届いた。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "期限は過ぎ、橋には荷車の列が残った。もう一つ道を開け。\n— Wszebor",
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
    nl: {
      opening: "Regen heeft de onverharde weg weggespoeld. Het kasteel heeft 24 planken en 16 broden nodig, maar de wielen zakken in de modder. Molenaar Borzym wacht op graan. Bestraat de drukste stukken weg.\n— Wszebor",
      won: {
        1: "De voorraden bereikten het kasteel ondanks de regen. Eén zegel; Bestrating bespaart tijd in de modder.\n— Wszebor",
        2: "De voorraden bereikten het kasteel ondanks de regen. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "De voorraden bereikten het kasteel ondanks de regen. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "De regen hield aan en de levering bleef achter. Bestraat de plekken waar wagens vertragen.\n— Wszebor",
    },
    es: {
      opening: "La lluvia ha destrozado el camino de tierra. El castillo necesita 24 tablones y 16 hogazas, pero las ruedas se hunden. El molinero Borzym espera grano. Empedra los tramos más transitados.\n— Wszebor",
      won: {
        1: "Los suministros llegaron pese a la lluvia. Un sello; Empedra las rutas donde se forma barro.\n— Wszebor",
        2: "Los suministros llegaron pese a la lluvia. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "Los suministros llegaron pese a la lluvia. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "La lluvia siguió y faltaron suministros. Empedra donde los carros avanzan más despacio.\n— Wszebor",
    },
    it: {
      opening: "La pioggia ha rovinato la strada sterrata. Servono 24 assi e 16 pagnotte al castello, ma le ruote sprofondano nel fango. Il mugnaio Borzym aspetta il grano. Lastrica i tratti percorsi da più carri.\n— Wszebor",
      won: {
        1: "Le scorte sono arrivate nonostante la pioggia. Un sigillo; Lastrica la strada dove il fango trattiene i carri.\n— Wszebor",
        2: "Le scorte sono arrivate nonostante la pioggia. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "Le scorte sono arrivate nonostante la pioggia. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "La pioggia non è cessata e le merci sono mancate. Lastrica dove i carri rallentano.\n— Wszebor",
    },
    "pt-BR": {
      opening: "A chuva destruiu a estrada de terra. O castelo precisa de 24 tábuas e 16 pães, mas as rodas atolam. O moleiro Borzym aguarda grãos. Calce os trechos por onde mais carroças passam.\n— Wszebor",
      won: {
        1: "Os suprimentos chegaram apesar da chuva. Um selo; Calce os trechos de lama.\n— Wszebor",
        2: "Os suprimentos chegaram apesar da chuva. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "Os suprimentos chegaram apesar da chuva. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "A chuva não parou e faltaram suprimentos. Calce os trechos que atrasam as carroças.\n— Wszebor",
    },
    sv: {
      opening: "Regnet har spolat bort grusvägen. Borgen behöver 24 plankor och 16 bröd, men hjulen fastnar i leran. Mjölnaren Borzym väntar på säd. Stenlägg de vägavsnitt där flest vagnar kör.\n— Wszebor",
      won: {
        1: "Förråden nådde fram trots regnet. Ett sigill; Stenlägg där leran sinkar vagnarna.\n— Wszebor",
        2: "Förråden nådde fram trots regnet. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Förråden nådde fram trots regnet. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Regnet fortsatte och leveranserna uteblev. Stenlägg där vagnarna kör långsamt.\n— Wszebor",
    },
    tr: {
      opening: "Yağmur toprak yolu bozdu. Kaleye 24 kalas ve 16 somun ekmek gerek, fakat tekerlekler çamura batıyor. Değirmenci Borzym tahıl bekliyor. Arabaların en çok geçtiği bölümleri taşla döşe.\n— Wszebor",
      won: {
        1: "Erzak yağmura rağmen kaleye vardı. Bir mühür; Çamurlu yerlere taş döşe.\n— Wszebor",
        2: "Erzak yağmura rağmen kaleye vardı. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Erzak yağmura rağmen kaleye vardı. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "Yağmur dinmedi ve erzak eksik kaldı. Arabaların yavaşladığı yerleri taşla döşe.\n— Wszebor",
    },
    ru: {
      opening: "Дождь размыл грунтовую дорогу. Замку нужны 24 доски и 16 буханок хлеба, но колёса вязнут в колее. Мельник Borzym ждёт зерна. Вымости самые оживлённые участки.\n— Wszebor",
      won: {
        1: "Припасы дошли, несмотря на дождь. Одна печать; Мости дорогу там, где повозки вязнут.\n— Wszebor",
        2: "Припасы дошли, несмотря на дождь. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Припасы дошли, несмотря на дождь. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Дождь не стих, и припасов не хватило. Вымости места, где повозки сбавляют ход.\n— Wszebor",
    },
    uk: {
      opening: "Дощ розмив ґрунтову дорогу. Замку потрібні 24 дошки й 16 хлібин, але колеса грузнуть у коліях. Мірошник Borzym чекає зерна. Вимости найжвавіші ділянки.\n— Wszebor",
      won: {
        1: "Припаси прибули попри дощ. Одна печатка; Вимощуй ділянки, де вози грузнуть.\n— Wszebor",
        2: "Припаси прибули попри дощ. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Припаси прибули попри дощ. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Дощ не вщух, припасів забракло. Вимости місця, де вози сповільнюються.\n— Wszebor",
    },
    ja: {
      opening: "雨で土の道が崩れた。城には板材24とパン16が必要だが、車輪は泥に沈む。粉屋のBorzymは穀物を待っている。荷車が最も通る区間を石畳にせよ。\n— Wszebor",
      won: {
        1: "雨の中でも物資は届いた。印章は一つ。\n— Wszebor",
        2: "雨の中でも物資は届いた。よく整えた運行に印章二つ。\n— Wszebor",
        3: "雨の中でも物資は届いた。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "雨が続き物資が足りぬ。荷車が遅くなる区間を石畳にせよ。\n— Wszebor",
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
    nl: {
      opening: "Drijfijs zal op het aangekondigde uur de houten brug afsluiten. Breng vooraf voorraden naar een graanschuur aan de kasteelkant of bouw een stenen brug. Goederen aan de overkant voeden niemand.\n— Wszebor",
      won: {
        1: "Ondanks het ijs kreeg het kasteel zijn goederen. Eén zegel; Sla goederen vooraf op bij het kasteel.\n— Wszebor",
        2: "Ondanks het ijs kreeg het kasteel zijn goederen. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "Ondanks het ijs kreeg het kasteel zijn goederen. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "De aangekondigde brugsluiting was niet voorbereid. Sla goederen op aan de kasteelkant of bouw een stenen brug.\n— Wszebor",
    },
    es: {
      opening: "El hielo a la deriva cerrará el puente de madera a la hora anunciada. Antes, lleva las provisiones al granero de la orilla del castillo o construye un puente de piedra. Lo que queda al otro lado no alimenta a nadie.\n— Wszebor",
      won: {
        1: "El castillo recibió la carga pese al hielo. Un sello; Guarda reservas en la orilla del castillo.\n— Wszebor",
        2: "El castillo recibió la carga pese al hielo. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "El castillo recibió la carga pese al hielo. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "Venció el plazo pese al aviso del hielo. Guarda provisiones junto al castillo o levanta un puente de piedra.\n— Wszebor",
    },
    it: {
      opening: "I ghiacci del fiume chiuderanno il ponte di legno all'ora stabilita. Prima porta le scorte in un granaio dalla parte del castello, oppure costruisci un ponte in pietra. Le merci oltre il fiume non sfameranno nessuno.\n— Wszebor",
      won: {
        1: "Il castello è stato rifornito nonostante il ghiaccio. Un sigillo; Prepara le scorte sulla riva del castello.\n— Wszebor",
        2: "Il castello è stato rifornito nonostante il ghiaccio. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "Il castello è stato rifornito nonostante il ghiaccio. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "La chiusura del ponte era annunciata. Accumula scorte presso il castello o costruisci il ponte in pietra.\n— Wszebor",
    },
    "pt-BR": {
      opening: "O gelo à deriva fechará a ponte de madeira na hora marcada. Antes disso, leve os suprimentos a um celeiro na margem do castelo ou construa uma ponte de pedra. Mercadorias do outro lado não alimentam ninguém.\n— Wszebor",
      won: {
        1: "O castelo recebeu os bens apesar do gelo. Um selo; Armazene bens na margem do castelo antes do gelo.\n— Wszebor",
        2: "O castelo recebeu os bens apesar do gelo. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "O castelo recebeu os bens apesar do gelo. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "A ponte fechou como previsto. Armazene provisões junto ao castelo ou construa uma ponte de pedra.\n— Wszebor",
    },
    sv: {
      opening: "Drivisen kommer att stänga träbron vid utsatt tid. Kör förråden till ett magasin på borgens sida i förväg, eller bygg en stenbro. Varor på andra stranden mättar ingen.\n— Wszebor",
      won: {
        1: "Borgen fick sina varor trots isen. Ett sigill; Lagra varor på borgens strand i förväg.\n— Wszebor",
        2: "Borgen fick sina varor trots isen. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Borgen fick sina varor trots isen. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Bron stängdes som förutspått. Lagra varor på borgens sida eller bygg en stenbro i förväg.\n— Wszebor",
    },
    tr: {
      opening: "Nehirdeki buz, ilan edilen saatte ahşap köprüyü kapatacak. Önceden erzakı kale kıyısındaki ambara taşı veya taş köprü kur. Karşı kıyıda kalan mal kimseyi doyurmaz.\n— Wszebor",
      won: {
        1: "Buz engeline rağmen kale erzak aldı. Bir mühür; Erzakı buz gelmeden kale kıyısında depola.\n— Wszebor",
        2: "Buz engeline rağmen kale erzak aldı. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Buz engeline rağmen kale erzak aldı. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "Köprünün kapanacağı belliydi. Kale kıyısına önceden erzak taşı veya taş köprü yap.\n— Wszebor",
    },
    ru: {
      opening: "Ледоход в назначенный час перекроет деревянный мост. Заранее перевези припасы в амбар на замковом берегу или построй каменный мост. Груз на другом берегу никого не накормит.\n— Wszebor",
      won: {
        1: "Замок получил груз, несмотря на лёд. Одна печать; Заранее складывай припасы на берегу замка.\n— Wszebor",
        2: "Замок получил груз, несмотря на лёд. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Замок получил груз, несмотря на лёд. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Срок вышел, хотя о закрытии моста знали. Запаси товар на берегу замка или построй каменный мост.\n— Wszebor",
    },
    uk: {
      opening: "Крига на річці в призначену годину закриє дерев'яний міст. Завчасно перевези припаси до комори на боці замку або збудуй кам'яний міст. Товар за річкою нікого не нагодує.\n— Wszebor",
      won: {
        1: "Замок отримав товар попри кригу. Одна печатка; Завчасно складай припаси на березі замку.\n— Wszebor",
        2: "Замок отримав товар попри кригу. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Замок отримав товар попри кригу. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Строк минув, хоча про закриття мосту було відомо. Створи запаси біля замку або збудуй кам'яний міст.\n— Wszebor",
    },
    ja: {
      opening: "流氷が指定の時刻に木橋を閉ざす。それまでに物資を城側の穀倉へ運ぶか、石橋を築け。対岸に残る荷物では誰も養えぬ。\n— Wszebor",
      won: {
        1: "氷に阻まれながら城に荷が届いた。印章は一つ。\n— Wszebor",
        2: "氷に阻まれながら城に荷が届いた。よく整えた運行に印章二つ。\n— Wszebor",
        3: "氷に阻まれながら城に荷が届いた。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "橋が閉じると知りながら備えなかった。城側に備蓄するか石橋を築け。\n— Wszebor",
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
    nl: {
      opening: "De kasteelmarkt vereist drie leveringen op verschillende tijden. Schrijver Mirogniew boekt elk deel apart: brood en planken moeten per termijn komen, niet allemaal in de laatste wagen. Leg voorraden aan en verdeel de ritten.\n— Wszebor",
      won: {
        1: "Alle drie de leveringen kwamen op tijd. Eén zegel; Verdeel de voorraad naar de termijnen.\n— Wszebor",
        2: "Alle drie de leveringen kwamen op tijd. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "Alle drie de leveringen kwamen op tijd. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "Minstens één deel kwam te laat. Plan op de afzonderlijke termijnen, niet enkel op het totaal.\n— Wszebor",
    },
    es: {
      opening: "La feria del castillo requiere tres entregas en momentos distintos. El escribano Mirogniew anotará cada una: pan y tablones deben llegar según su plazo, no todos en el último carro. Guarda reservas y ordena los viajes.\n— Wszebor",
      won: {
        1: "Las tres entregas llegaron a tiempo. Un sello; Separa las reservas por cada plazo.\n— Wszebor",
        2: "Las tres entregas llegaron a tiempo. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "Las tres entregas llegaron a tiempo. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "Al menos una entrega llegó tarde. Cuenta los plazos por separado, no solo el total.\n— Wszebor",
    },
    it: {
      opening: "La fiera del castello richiede tre consegne in orari diversi. Lo scrivano Mirogniew le registrerà una per una: pane e assi devono giungere a ciascuna scadenza, non tutti con l'ultimo carro. Prepara le scorte e organizza i viaggi.\n— Wszebor",
      won: {
        1: "Le tre consegne sono giunte in tempo. Un sigillo; Dividi le scorte secondo le scadenze.\n— Wszebor",
        2: "Le tre consegne sono giunte in tempo. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "Le tre consegne sono giunte in tempo. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "Almeno una consegna è giunta tardi. Prepara scorte per ogni termine, non solo per il totale.\n— Wszebor",
    },
    "pt-BR": {
      opening: "A feira do castelo exige três entregas em momentos diferentes. O escriba Mirogniew registrará cada uma: pão e tábuas devem chegar em seus prazos, não na última carroça. Prepare reservas e organize as viagens.\n— Wszebor",
      won: {
        1: "As três entregas chegaram no prazo. Um selo; Separe as reservas por prazo.\n— Wszebor",
        2: "As três entregas chegaram no prazo. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "As três entregas chegaram no prazo. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "Ao menos uma entrega chegou tarde. Divida as reservas por prazo, não apenas pela soma.\n— Wszebor",
    },
    sv: {
      opening: "Borgmarknaden kräver tre leveranser vid skilda tider. Skrivaren Mirogniew bokför varje del: bröd och plankor ska komma i tid, inte med sista vagnen. Bygg upp ett förråd och ordna körningarna.\n— Wszebor",
      won: {
        1: "Alla tre leveranser kom i tid. Ett sigill; Dela upp förråden efter tidsfristerna.\n— Wszebor",
        2: "Alla tre leveranser kom i tid. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Alla tre leveranser kom i tid. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Minst en delleverans kom för sent. Planera efter varje tidsfrist, inte bara totalsumman.\n— Wszebor",
    },
    tr: {
      opening: "Kale panayırı farklı saatlerde üç teslimat istiyor. Kâtip Mirogniew her birini ayrı kaydedecek: ekmek ve kalaslar son arabayla değil, kendi zamanında gelmeli. Stok yap ve seferleri düzenle.\n— Wszebor",
      won: {
        1: "Üç teslimat da zamanında ulaştı. Bir mühür; Stoğu üç ayrı teslimata ayır.\n— Wszebor",
        2: "Üç teslimat da zamanında ulaştı. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Üç teslimat da zamanında ulaştı. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "En az bir sevkiyat gecikti. Yalnız toplamı değil, her teslimatın saatini gözet.\n— Wszebor",
    },
    ru: {
      opening: "На замковой ярмарке нужны три поставки в разные сроки. Писарь Mirogniew запишет каждую отдельно: хлеб и доски должны приходить вовремя, а не последним обозом. Создай запас и упорядочь рейсы.\n— Wszebor",
      won: {
        1: "Все три поставки прибыли в срок. Одна печать; Разделяй запасы по срокам.\n— Wszebor",
        2: "Все три поставки прибыли в срок. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Все три поставки прибыли в срок. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Хотя бы одна партия опоздала. Считай каждую дату поставки отдельно, а не только итог.\n— Wszebor",
    },
    uk: {
      opening: "Замковий ярмарок вимагає трьох поставок у різні строки. Писар Mirogniew запише кожну окремо: хліб і дошки мають прибути вчасно, а не останнім возом. Зроби запаси й упорядкуй рейси.\n— Wszebor",
      won: {
        1: "Усі три поставки прибули вчасно. Одна печатка; Розділи запаси за трьома строками.\n— Wszebor",
        2: "Усі три поставки прибули вчасно. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Усі три поставки прибули вчасно. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Щонайменше одна партія спізнилася. Рахуй кожен строк окремо, а не тільки загальну кількість.\n— Wszebor",
    },
    ja: {
      opening: "城の市では時刻を違えて三度の納品を求める。書記Mirogniewは一回ごとに記録する。パンと板材を最後にまとめて運んではならぬ。備蓄を用意し、荷車の行程を整えよ。\n— Wszebor",
      won: {
        1: "三度の納品は期限に間に合った。印章は一つ。\n— Wszebor",
        2: "三度の納品は期限に間に合った。よく整えた運行に印章二つ。\n— Wszebor",
        3: "三度の納品は期限に間に合った。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "少なくとも一回の納品が遅れた。合計だけでなく各期限に備えよ。\n— Wszebor",
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
    nl: {
      opening: "De graanschuur is krap en het graan komt sneller binnen dan molenaar Borzym kan afvoeren. Bij een vol magazijn stopt de arbeid en mislukt de opdracht. Maak opslag vrij of stuur wagens via een andere route.\n— Wszebor",
      won: {
        1: "De voorraden bereikten het kasteel ondanks de volle schuur. Eén zegel; Houd ruimte vrij en de route naar de bakkerij open.\n— Wszebor",
        2: "De voorraden bereikten het kasteel ondanks de volle schuur. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "De voorraden bereikten het kasteel ondanks de volle schuur. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "De goederen hoopten zich op en de termijn verstreek. Controleer de volle schuur en de route van molen naar bakkerij.\n— Wszebor",
    },
    es: {
      opening: "El granero es pequeño y el grano llega más deprisa de lo que el molinero Borzym puede retirarlo. Si se llena, se parará la producción y fallará el contrato. Libera espacio o cambia el recorrido de los carros.\n— Wszebor",
      won: {
        1: "El contrato se cumplió pese al almacén lleno. Un sello; Deja espacio en el granero y paso a la panadería.\n— Wszebor",
        2: "El contrato se cumplió pese al almacén lleno. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "El contrato se cumplió pese al almacén lleno. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "Se amontonaron las mercancías y venció el plazo. Revisa el granero y la ruta del molino a la panadería.\n— Wszebor",
    },
    it: {
      opening: "Il granaio è stretto e il grano arriva più in fretta di quanto il mugnaio Borzym riesca a ritirarlo. Quando il deposito è pieno la produzione si ferma e il contratto fallisce. Libera spazio o cambia il percorso dei carri.\n— Wszebor",
      won: {
        1: "Le scorte sono arrivate nonostante il deposito pieno. Un sigillo; Libera il granaio e la strada verso il forno.\n— Wszebor",
        2: "Le scorte sono arrivate nonostante il deposito pieno. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "Le scorte sono arrivate nonostante il deposito pieno. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "Le merci si sono accumulate e il tempo è finito. Controlla il granaio pieno e la strada dal mulino al forno.\n— Wszebor",
    },
    "pt-BR": {
      opening: "O celeiro é apertado e os grãos chegam mais rápido do que o moleiro Borzym consegue retirá-los. Quando o depósito encher, o trabalho parará e o contrato sofrerá. Abra espaço ou mude a rota das carroças.\n— Wszebor",
      won: {
        1: "As provisões chegaram apesar do depósito cheio. Um selo; Mantenha espaço livre no celeiro e acesso à padaria.\n— Wszebor",
        2: "As provisões chegaram apesar do depósito cheio. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "As provisões chegaram apesar do depósito cheio. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "As mercadorias se acumularam e o prazo acabou. Verifique o celeiro cheio e a rota do moinho à padaria.\n— Wszebor",
    },
    sv: {
      opening: "Magasinet är trångt, och säden kommer fortare än mjölnaren Borzym kan hämta den. När lagret fylls stannar arbetet och borgens beställning hotas. Frigör plats eller led om vagnarna.\n— Wszebor",
      won: {
        1: "Varorna kom fram trots det fulla magasinet. Ett sigill; Håll plats fri i magasinet och vägen till bageriet öppen.\n— Wszebor",
        2: "Varorna kom fram trots det fulla magasinet. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Varorna kom fram trots det fulla magasinet. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Varorna hopades och tiden tog slut. Se över det fulla magasinet och vägen från kvarn till bageri.\n— Wszebor",
    },
    tr: {
      opening: "Ambar dar, tahıl değirmenci Borzym'in alabileceğinden hızlı geliyor. Depo dolarsa işler durur ve kale siparişi aksar. Erzağa yer aç ya da arabaları başka yoldan gönder.\n— Wszebor",
      won: {
        1: "Dolu ambara rağmen sipariş tamamlandı. Bir mühür; Ambarı ve fırına giden yolu boş tut.\n— Wszebor",
        2: "Dolu ambara rağmen sipariş tamamlandı. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Dolu ambara rağmen sipariş tamamlandı. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "Mallar birikti, süre doldu. Dolu ambarı ve değirmenden fırına giden yolu kontrol et.\n— Wszebor",
    },
    ru: {
      opening: "Амбар тесен, а зерно прибывает быстрее, чем мельник Borzym успевает его забирать. Если склад заполнится, работа встанет и замковый заказ сорвётся. Освободи место или направь повозки иной дорогой.\n— Wszebor",
      won: {
        1: "Заказ выполнен, несмотря на тесный склад. Одна печать; Оставляй место в амбаре и путь к пекарне.\n— Wszebor",
        2: "Заказ выполнен, несмотря на тесный склад. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Заказ выполнен, несмотря на тесный склад. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Груз накопился, срок вышел. Проверь переполненный амбар и дорогу от мельницы до пекарни.\n— Wszebor",
    },
    uk: {
      opening: "Комора тісна, а зерно прибуває швидше, ніж мірошник Borzym забирає його. Коли сховище заповниться, робота спиниться й замовлення замку зірветься. Звільни місце або спрямуй вози іншим шляхом.\n— Wszebor",
      won: {
        1: "Замовлення виконано попри тісну комору. Одна печатка; Залишай місце в коморі й вільний шлях до пекарні.\n— Wszebor",
        2: "Замовлення виконано попри тісну комору. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Замовлення виконано попри тісну комору. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Товари накопичилися, строк минув. Перевір повну комору й дорогу від млина до пекарні.\n— Wszebor",
    },
    ja: {
      opening: "穀倉は狭く、粉屋Borzymが引き取るより早く穀物が届く。倉が満ちれば作業が止まり、城への契約も滞る。保管場所を空けるか、荷車の道筋を変えよ。\n— Wszebor",
      won: {
        1: "倉が混んでも物資は届いた。印章は一つ。\n— Wszebor",
        2: "倉が混んでも物資は届いた。よく整えた運行に印章二つ。\n— Wszebor",
        3: "倉が混んでも物資は届いた。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "荷が積み上がり期限を逃した。満杯の穀倉と粉屋からパン屋への道を調べよ。\n— Wszebor",
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
    nl: {
      opening: "De vastentijd begint. De kasteelkeuken vraagt 54 vissen. Een vissershut staat al op de noordoever, maar levert mogelijk te traag. Bouw nog een hut aan het water: op het land wordt niets gevangen. Breng de vangst over de houten brug naar het zuiden.\n— Wszebor",
      won: {
        1: "De vis kwam bij de kasteelkeuken aan. Eén zegel; Een tweede hut aan de oever verkort het wachten.\n— Wszebor",
        2: "De vis kwam bij de kasteelkeuken aan. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "De vis kwam bij de kasteelkeuken aan. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "Er was te weinig vis. Plaats de hut aan het water en houd het vervoer over de brug op gang.\n— Wszebor",
    },
    es: {
      opening: "Llega el ayuno y las cocinas del castillo necesitan 54 peces. Ya hay una cabaña de pescador en la orilla norte, pero quizá no baste. Construye otra junto al agua, nunca tierra adentro, y lleva la pesca por el puente de madera a la orilla sur.\n— Wszebor",
      won: {
        1: "La pesca llegó a las cocinas. Un sello; Una segunda cabaña junto al agua habría ayudado.\n— Wszebor",
        2: "La pesca llegó a las cocinas. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "La pesca llegó a las cocinas. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "Faltaron peces al terminar el ayuno. Sitúa la cabaña junto al agua y mantén los carros cruzando el puente.\n— Wszebor",
    },
    it: {
      opening: "È tempo di digiuno e le cucine del castello chiedono 54 pesci. Una capanna da pesca sorge già sulla riva nord, ma potrebbe non bastare. Costruiscine un'altra vicino all'acqua, non nell'entroterra, e porta il pescato sul ponte di legno fino a sud.\n— Wszebor",
      won: {
        1: "Il pesce è arrivato alle cucine. Un sigillo; Una seconda capanna sull'acqua avrebbe aiutato.\n— Wszebor",
        2: "Il pesce è arrivato alle cucine. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "Il pesce è arrivato alle cucine. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "Il digiuno è finito senza abbastanza pesce. Metti la capanna sull'acqua e mantieni i carri in viaggio sul ponte.\n— Wszebor",
    },
    "pt-BR": {
      opening: "É tempo de jejum. As cozinhas do castelo precisam de 54 peixes. Já há uma cabana de pesca na margem norte, mas talvez não baste. Erga outra junto à água, nunca em terra firme, e leve a pesca pela ponte de madeira até a margem sul.\n— Wszebor",
      won: {
        1: "Os peixes chegaram às cozinhas. Um selo; Outra cabana junto à água teria ajudado.\n— Wszebor",
        2: "Os peixes chegaram às cozinhas. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "Os peixes chegaram às cozinhas. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "O jejum acabou sem peixes suficientes. Ponha a cabana junto à água e mantenha as carroças na ponte.\n— Wszebor",
    },
    sv: {
      opening: "Fastan börjar. Borgköket kräver 54 fiskar. En fiskarstuga står redan på norra stranden, men fångsten kan bli för sen. Bygg en stuga till vid vattnet, inte inne på land, och för fisken över träbron till södra stranden.\n— Wszebor",
      won: {
        1: "Fisken kom fram till köket. Ett sigill; Bygg en andra fiskarstuga vid vattnet.\n— Wszebor",
        2: "Fisken kom fram till köket. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Fisken kom fram till köket. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Fastan tog slut utan tillräckligt med fisk. Se till att stugan står vid vatten och att vagnarna korsar bron.\n— Wszebor",
    },
    tr: {
      opening: "Oruç günleri geldi. Kale mutfağı 54 balık istiyor. Kuzey kıyıda bir balıkçı kulübesi var, fakat avı yetersiz kalabilir. Suyun yanına ikinci kulübeyi yap; karada balık tutulmaz. Balığı ahşap köprüden güney kıyıya taşı.\n— Wszebor",
      won: {
        1: "Balık kale mutfağına ulaştı. Bir mühür; Su kenarına ikinci balıkçı kulübesi kur.\n— Wszebor",
        2: "Balık kale mutfağına ulaştı. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Balık kale mutfağına ulaştı. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "Oruç bitince balık eksik kaldı. Kulübeyi suya kur ve köprüdeki arabaları hızlandır.\n— Wszebor",
    },
    ru: {
      opening: "Настал пост. Замковой кухне нужны 54 рыбы. На северном берегу уже есть рыбацкая хижина, но улов может запоздать. Построй вторую у воды: на суше рыбы нет. Вези улов по деревянному мосту на южный берег.\n— Wszebor",
      won: {
        1: "Рыба доставлена на замковую кухню. Одна печать; Вторая хижина у воды ускорила бы улов.\n— Wszebor",
        2: "Рыба доставлена на замковую кухню. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Рыба доставлена на замковую кухню. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Пост прошёл, а рыбы не хватило. Ставь хижину у воды и обеспечь движение по мосту.\n— Wszebor",
    },
    uk: {
      opening: "Настав піст. Замковій кухні потрібно 54 рибини. На північному березі вже є хатина рибалки, проте улов може запізнитися. Збудуй ще одну біля води — на суші риби немає. Вези рибу дерев'яним мостом на південний берег.\n— Wszebor",
      won: {
        1: "Риба потрапила на замкову кухню. Одна печатка; Друга хатина біля води прискорить вилов.\n— Wszebor",
        2: "Риба потрапила на замкову кухню. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Риба потрапила на замкову кухню. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Піст минув, а риби не вистачило. Став хатину біля води та підтримуй рух мостом.\n— Wszebor",
    },
    ja: {
      opening: "断食の日が来た。城の厨房には魚54が要る。北岸には漁師小屋が一つあるが、漁獲が間に合わぬかもしれぬ。水辺にもう一軒建て、魚を木橋で南岸へ運べ。陸地では魚は獲れぬ。\n— Wszebor",
      won: {
        1: "魚は城の厨房に届いた。印章は一つ。\n— Wszebor",
        2: "魚は城の厨房に届いた。よく整えた運行に印章二つ。\n— Wszebor",
        3: "魚は城の厨房に届いた。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "断食が終わったが魚が足りなかった。小屋を水辺に置き、木橋で荷を運べ。\n— Wszebor",
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
    nl: {
      opening: "De storm komt eraan. Bezorg 24 planken en 20 broden vóór de modder het verkeer vertraagt. Steen uit de groeve kan pas bestraten na vervoer naar de schuur, vier eenheden per wagen. Laat daarom eerst de stenen komen en bestraat dan de zuidelijke weg.\n— Wszebor",
      won: {
        1: "De planken en broden kwamen door de storm heen. Eén zegel; Haal steen eerst uit de groeve en bestraat de weg.\n— Wszebor",
        2: "De planken en broden kwamen door de storm heen. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "De planken en broden kwamen door de storm heen. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "De wagens bleven in de modder steken. Breng steen naar de schuur en bestraat daarna de zuidelijke weg.\n— Wszebor",
    },
    es: {
      opening: "Se acerca la tormenta. Entrega 24 tablones y 20 hogazas antes de que el barro frene los carros. La piedra de la cantera no sirve para empedrar hasta que llegue al granero: cuatro unidades por carro. Llévala primero y luego mejora el camino del sur.\n— Wszebor",
      won: {
        1: "Los suministros superaron la tormenta. Un sello; Lleva primero la piedra al granero.\n— Wszebor",
        2: "Los suministros superaron la tormenta. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "Los suministros superaron la tormenta. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "La tormenta atrapó los carros en el barro. Lleva primero piedra al granero y luego empedra el camino sur.\n— Wszebor",
    },
    it: {
      opening: "Si avvicina la tempesta. Porta 24 assi e 20 pagnotte prima che il fango rallenti i carri. La pietra della cava non lastrica una strada da sola: trasportala al granaio, quattro unità per carro, poi sistema la strada meridionale.\n— Wszebor",
      won: {
        1: "Assi e pane sono arrivati durante la tempesta. Un sigillo; Porta la pietra al granaio prima di lastricare.\n— Wszebor",
        2: "Assi e pane sono arrivati durante la tempesta. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "Assi e pane sono arrivati durante la tempesta. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "La tempesta ha bloccato i carri nel fango. Porta prima la pietra al granaio e poi lastrica la strada a sud.\n— Wszebor",
    },
    "pt-BR": {
      opening: "Uma tempestade se aproxima. Entregue 24 tábuas e 20 pães antes que a lama atrase as carroças. A pedra da pedreira só serve para calçar a estrada após chegar ao celeiro, quatro unidades por carroça. Traga as pedras primeiro e calce a estrada sul.\n— Wszebor",
      won: {
        1: "Tábuas e pães venceram a tempestade. Um selo; Leve a pedra ao celeiro antes de calçar a estrada.\n— Wszebor",
        2: "Tábuas e pães venceram a tempestade. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "Tábuas e pães venceram a tempestade. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "A tempestade prendeu as carroças na lama. Traga pedra ao celeiro e só depois calce a estrada sul.\n— Wszebor",
    },
    sv: {
      opening: "Stormen närmar sig. Leverera 24 plankor och 20 bröd innan leran sinkar vagnarna. Stenen vid stenbrottet kan inte lägga väg: kör den först till magasinet, fyra enheter per vagn. Stenlägg sedan södra vägen.\n— Wszebor",
      won: {
        1: "Bröd och plankor tog sig fram genom stormen. Ett sigill; Kör stenen till magasinet innan du stenlägger.\n— Wszebor",
        2: "Bröd och plankor tog sig fram genom stormen. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Bröd och plankor tog sig fram genom stormen. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Stormen satte fast vagnarna i leran. Kör först stenen till magasinet och stenlägg södra vägen.\n— Wszebor",
    },
    tr: {
      opening: "Fırtına yaklaşıyor. Çamur yolları yavaşlatmadan kaleye 24 kalas ve 20 somun ekmek ulaştır. Taş ocağındaki taş yolu döşemez; önce arabalarla ambara taşı, araba başına dört birim. Sonra güney yolunu taşla kapla.\n— Wszebor",
      won: {
        1: "Ekmek ve kalas fırtınayı aştı. Bir mühür; Yol döşemeden önce taşı ambara getir.\n— Wszebor",
        2: "Ekmek ve kalas fırtınayı aştı. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Ekmek ve kalas fırtınayı aştı. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "Fırtına arabaları çamurda tuttu. Önce taşı ambara getir, sonra güney yolunu döşe.\n— Wszebor",
    },
    ru: {
      opening: "Надвигается буря. Доставь 24 доски и 20 буханок хлеба, пока грязь не замедлила повозки. Камень из карьера сам дорогу не вымостит: сперва отвези его в амбар, по четыре единицы на повозку, и лишь затем мощи южный тракт.\n— Wszebor",
      won: {
        1: "Хлеб и доски доставлены сквозь бурю. Одна печать; Сперва вези камень в амбар, потом мостить.\n— Wszebor",
        2: "Хлеб и доски доставлены сквозь бурю. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Хлеб и доски доставлены сквозь бурю. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Буря задержала повозки в грязи. Сначала доставь камень в амбар, потом вымости южную дорогу.\n— Wszebor",
    },
    uk: {
      opening: "Насувається буря. Достав 24 дошки й 20 хлібин, доки багнюка не затримала вози. Каміння в кар'єрі саме не вимостить шлях: спершу перевези його до комори, по чотири одиниці на віз, а потім вимости південну дорогу.\n— Wszebor",
      won: {
        1: "Хліб і дошки дісталися крізь бурю. Одна печатка; Спершу довези камінь до комори, потім мостити.\n— Wszebor",
        2: "Хліб і дошки дісталися крізь бурю. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Хліб і дошки дісталися крізь бурю. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Буря затримала вози в багнюці. Спершу довези камінь до комори, потім вимости південну дорогу.\n— Wszebor",
    },
    ja: {
      opening: "嵐が迫る。泥が道を塞ぐ前に板材24とパン20を届けよ。採石場の石は、そのままでは道を舗装できぬ。荷車一台に4単位ずつ積み、まず穀倉に運んでから南の道を石畳にせよ。\n— Wszebor",
      won: {
        1: "嵐の中、パンと板材が届いた。印章は一つ。\n— Wszebor",
        2: "嵐の中、パンと板材が届いた。よく整えた運行に印章二つ。\n— Wszebor",
        3: "嵐の中、パンと板材が届いた。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "嵐で荷車が泥にはまった。先に石を穀倉へ運び、南の道を舗装せよ。\n— Wszebor",
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
    nl: {
      opening: "De bruiloft nadert. Nodig zijn 36 planken, 8 houtskool en 26 bier. Breng graan naar de mouterij en mout naar de brouwerij. Zagerij en houtskoolbrander delen één houthakker; de ander valt stil zodra één het hout krijgt. Vergroot de houtaanvoer en zet genoeg wagens in.\n— Wszebor",
      won: {
        1: "De bruiloft kreeg planken, houtskool en bier. Eén zegel; Zorg voor hout voor beide werkplaatsen.\n— Wszebor",
        2: "De bruiloft kreeg planken, houtskool en bier. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "De bruiloft kreeg planken, houtskool en bier. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "De bruiloft begon vóór alle goederen er waren. Geef zagerij en houtskoolbrander elk genoeg hout.\n— Wszebor",
    },
    es: {
      opening: "Se acerca la boda: hacen falta 36 tablones, 8 de carbón vegetal y 26 de cerveza. Lleva el grano a la maltería y la malta a la cervecería. Aserradero y carbonera comparten un leñador; cuando uno toma la madera, el otro se para. Aumenta la tala y los carros.\n— Wszebor",
      won: {
        1: "La boda recibió madera, carbón y cerveza. Un sello; Alimenta los dos talleres con suficiente madera.\n— Wszebor",
        2: "La boda recibió madera, carbón y cerveza. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "La boda recibió madera, carbón y cerveza. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "La boda llegó antes que las mercancías. Proporciona madera a los dos talleres con otro leñador.\n— Wszebor",
    },
    it: {
      opening: "Le nozze si avvicinano. Occorrono 36 assi, 8 di carbone di legna e 26 di birra. Il grano deve arrivare alla malteria e il malto al birrificio. Segheria e carbonaia condividono un solo taglialegna; quando una prende il legno l'altra si ferma. Aumenta legna e carri.\n— Wszebor",
      won: {
        1: "Le nozze hanno ricevuto assi, carbone e birra. Un sigillo; Dai abbastanza legna a entrambi i laboratori.\n— Wszebor",
        2: "Le nozze hanno ricevuto assi, carbone e birra. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "Le nozze hanno ricevuto assi, carbone e birra. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "Le nozze sono arrivate prima della merce. Aumenta la fonte di legna per le due botteghe.\n— Wszebor",
    },
    "pt-BR": {
      opening: "O casamento se aproxima. São necessárias 36 tábuas, 8 de carvão vegetal e 26 de cerveja. Leve grãos à maltaria e malte à cervejaria. Serraria e carvoaria dependem de um só lenhador; quando uma recebe madeira, a outra para. Aumente a produção e as carroças.\n— Wszebor",
      won: {
        1: "O casamento recebeu tábuas, carvão e cerveja. Um selo; Garanta madeira para as duas oficinas.\n— Wszebor",
        2: "O casamento recebeu tábuas, carvão e cerveja. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "O casamento recebeu tábuas, carvão e cerveja. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "O casamento começou antes das entregas. Dê às duas oficinas fontes suficientes de madeira.\n— Wszebor",
    },
    sv: {
      opening: "Bröllopet närmar sig. Det behövs 36 plankor, 8 träkol och 26 öl. Säd ska till mälteriet och malt till bryggeriet. Sågverket och kolmilan delar en skogshuggare; när en tar virket stannar den andra. Öka tillgången på trä och vagnar.\n— Wszebor",
      won: {
        1: "Bröllopet fick plankor, kol och öl. Ett sigill; Ge båda verkstäderna tillräckligt med trä.\n— Wszebor",
        2: "Bröllopet fick plankor, kol och öl. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Bröllopet fick plankor, kol och öl. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Bröllopet kom före varorna. Ge sågverket och kolmilan var sin pålitlig träkälla.\n— Wszebor",
    },
    tr: {
      opening: "Düğün yaklaşıyor. 36 kalas, 8 odun kömürü ve 26 bira gerekli. Tahıl malt evine, malt bira imalathanesine gitmeli. Kereste atölyesi ile kömürcü tek oduncuyu paylaşıyor; biri odunu alınca diğeri duruyor. Odun kaynağını ve arabaları artır.\n— Wszebor",
      won: {
        1: "Düğüne kalas, kömür ve bira yetişti. Bir mühür; İki atölyeye de yeterli odun sağla.\n— Wszebor",
        2: "Düğüne kalas, kömür ve bira yetişti. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Düğüne kalas, kömür ve bira yetişti. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "Düğün, mallar gelmeden başladı. İki atölyeye yetecek ikinci odun kaynağını kur.\n— Wszebor",
    },
    ru: {
      opening: "Скоро свадьба. Нужны 36 досок, 8 древесного угля и 26 пива. Зерно надо доставить в солодовню, солод — в пивоварню. Лесопилка и углежог делят одного лесоруба: когда один забирает дрова, другой стоит. Увеличь запас древесины и число повозок.\n— Wszebor",
      won: {
        1: "К свадьбе привезли доски, уголь и пиво. Одна печать; Дай древесину обеим мастерским.\n— Wszebor",
        2: "К свадьбе привезли доски, уголь и пиво. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "К свадьбе привезли доски, уголь и пиво. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Свадьба началась до поставки. Убедись, что обе мастерские получают достаточно древесины.\n— Wszebor",
    },
    uk: {
      opening: "Наближається весілля. Потрібні 36 дощок, 8 деревного вугілля й 26 пива. Зерно слід довезти до солодовні, солод — до броварні. Лісопилка й вугляр ділять одного лісоруба: коли один бере деревину, інший стоїть. Додай лісоруба й возів.\n— Wszebor",
      won: {
        1: "На весілля довезли дошки, вугілля й пиво. Одна печатка; Дай деревину обом майстерням.\n— Wszebor",
        2: "На весілля довезли дошки, вугілля й пиво. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "На весілля довезли дошки, вугілля й пиво. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Весілля настало раніше за товари. Забезпеч деревиною обидві майстерні.\n— Wszebor",
    },
    ja: {
      opening: "婚礼が近い。板材36、木炭8、ビール26が必要だ。穀物を製麦所へ、麦芽を醸造所へ運べ。製材所と炭焼き場は一人の木こりを取り合っている。一方に木材が渡れば他方は止まる。木材の供給と荷車を増やせ。\n— Wszebor",
      won: {
        1: "婚礼に板材、木炭、ビールが届いた。印章は一つ。\n— Wszebor",
        2: "婚礼に板材、木炭、ビールが届いた。よく整えた運行に印章二つ。\n— Wszebor",
        3: "婚礼に板材、木炭、ビールが届いた。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "荷より先に婚礼が始まった。二つの工房を養う木材の供給源を増やせ。\n— Wszebor",
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
    nl: {
      opening: "De smid vraagt houtskool, de timmerlieden planken: 48 planken en 8 houtskool. Zagerij en houtskoolbrander delen één houthakker, die beide niet kan bevoorraden. Bouw een tweede houthakker; extra wagens leveren geen extra hout.\n— Wszebor",
      won: {
        1: "De ambachtslieden ontvingen planken en houtskool. Eén zegel; Een tweede houthakker voorkomt een houttekort.\n— Wszebor",
        2: "De ambachtslieden ontvingen planken en houtskool. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "De ambachtslieden ontvingen planken en houtskool. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "De houtskoolbrander verbruikte het hout voor de planken. Bouw een tweede houthakker in plaats van extra wagens.\n— Wszebor",
    },
    es: {
      opening: "El herrero necesita carbón vegetal y los carpinteros tablones: 48 tablones y 8 de carbón. Aserradero y carbonera dependen de un solo leñador, incapaz de abastecer ambos. Construye un segundo puesto de leñador; más carros no producen madera.\n— Wszebor",
      won: {
        1: "Tablones y carbón llegaron a los talleres. Un sello; Construye otro leñador, no más carros.\n— Wszebor",
        2: "Tablones y carbón llegaron a los talleres. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "Tablones y carbón llegaron a los talleres. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "El carbón consumió la madera del aserradero. Construye otro leñador: los carros no talan árboles.\n— Wszebor",
    },
    it: {
      opening: "Il fabbro attende carbone e i carpentieri assi: 48 assi e 8 di carbone di legna. Segheria e carbonaia dipendono da un solo taglialegna, insufficiente per entrambe. Costruisci un secondo taglialegna: più carri non producono legna.\n— Wszebor",
      won: {
        1: "I laboratori hanno ricevuto assi e carbone. Un sigillo; Aggiungi un taglialegna, non solo carri.\n— Wszebor",
        2: "I laboratori hanno ricevuto assi e carbone. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "I laboratori hanno ricevuto assi e carbone. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "La carbonaia ha usato la legna della segheria. Costruisci un secondo taglialegna; i carri non tagliano alberi.\n— Wszebor",
    },
    "pt-BR": {
      opening: "O ferreiro precisa de carvão vegetal e os carpinteiros de tábuas: 48 tábuas e 8 de carvão. Serraria e carvoaria dependem do mesmo lenhador, incapaz de atender às duas. Construa outra cabana de lenhador; carroças extras não criam madeira.\n— Wszebor",
      won: {
        1: "Tábuas e carvão chegaram às oficinas. Um selo; Construa outro lenhador, não apenas carroças.\n— Wszebor",
        2: "Tábuas e carvão chegaram às oficinas. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "Tábuas e carvão chegaram às oficinas. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "A carvoaria consumiu a madeira da serraria. Construa outro lenhador; mais carroças não cortam árvores.\n— Wszebor",
    },
    sv: {
      opening: "Smeden väntar på träkol, timmermännen på plankor: 48 plankor och 8 träkol. Sågverket och kolmilan får sitt trä från en enda skogshuggare som inte räcker till. Bygg en till; fler vagnar fäller inga träd.\n— Wszebor",
      won: {
        1: "Verkstäderna fick plankor och träkol. Ett sigill; Bygg en andra skogshuggare i stället för fler vagnar.\n— Wszebor",
        2: "Verkstäderna fick plankor och träkol. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Verkstäderna fick plankor och träkol. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Kolmilan förbrukade sågverkets trä. Bygg en skogshuggare till; fler vagnar ger inte mer trä.\n— Wszebor",
    },
    tr: {
      opening: "Demirci kömür, marangozlar kalas bekliyor: 48 kalas ve 8 odun kömürü gerekli. Kereste atölyesi ile kömürcü aynı tek oduncuya bağlı; ikisine yetmiyor. İkinci oduncuyu kur; daha çok araba ağaç kesmez.\n— Wszebor",
      won: {
        1: "Atölyelere kalas ve kömür ulaştı. Bir mühür; Araba yerine ikinci bir oduncu kur.\n— Wszebor",
        2: "Atölyelere kalas ve kömür ulaştı. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Atölyelere kalas ve kömür ulaştı. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "Kömürcü, kereste atölyesinin odununu tüketti. İkinci oduncuyu kur; arabalar odun üretmez.\n— Wszebor",
    },
    ru: {
      opening: "Кузнец ждёт угля, плотники — досок: нужны 48 досок и 8 древесного угля. Лесопилка и углежог зависят от одного лесоруба, который не успевает снабжать обоих. Построй второго лесоруба; новые повозки не рубят деревья.\n— Wszebor",
      won: {
        1: "Мастерские получили доски и уголь. Одна печать; Нужен второй лесоруб, не лишние повозки.\n— Wszebor",
        2: "Мастерские получили доски и уголь. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Мастерские получили доски и уголь. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Углежог израсходовал дрова лесопилки. Построй второго лесоруба: повозки древесины не создают.\n— Wszebor",
    },
    uk: {
      opening: "Коваль чекає вугілля, теслярі — дощок: потрібно 48 дощок і 8 деревного вугілля. Лісопилка й вугляр користуються одним лісорубом, якого не вистачає обом. Збудуй другого лісоруба; додаткові вози не рубають дерев.\n— Wszebor",
      won: {
        1: "Майстерні отримали дошки й вугілля. Одна печатка; Додай лісоруба, а не лише вози.\n— Wszebor",
        2: "Майстерні отримали дошки й вугілля. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Майстерні отримали дошки й вугілля. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Вугляр витратив деревину лісопилки. Збудуй другого лісоруба — вози не створюють деревини.\n— Wszebor",
    },
    ja: {
      opening: "鍛冶屋には木炭、職人には板材が要る。板材48と木炭8だ。製材所と炭焼き場の木こりが一人では足りぬ。二人目を雇え。荷車を増やしても木は伐れぬ。\n— Wszebor",
      won: {
        1: "工房へ板材と木炭が届いた。印章は一つ。\n— Wszebor",
        2: "工房へ板材と木炭が届いた。よく整えた運行に印章二つ。\n— Wszebor",
        3: "工房へ板材と木炭が届いた。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "炭焼き場が製材所の木を使い切った。荷車より二人目の木こりが必要だ。\n— Wszebor",
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
    nl: {
      opening: "Voor de winter heeft het kasteel 22 bier nodig. Het graan groeit westelijk, de mouterij ligt ver oostelijk. Drie wagens bedienen boerderij, mouterij, brouwerij en kasteel. Zijn alle wagens bezet terwijl graan wacht, koop wagens bij de stal om meer ritten tegelijk te doen.\n— Wszebor",
      won: {
        1: "Het bier bereikte het kasteel. Eén zegel; Meer wagens helpen op de lange route.\n— Wszebor",
        2: "Het bier bereikte het kasteel. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "Het bier bereikte het kasteel. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "De winter kwam vóór het laatste vat. Koop wagens als het graan wacht en alle wagens bezet zijn.\n— Wszebor",
    },
    es: {
      opening: "Para el invierno, el castillo pide 22 de cerveza. El grano crece al oeste, pero la maltería está lejos, al este. Tres carros deben servir granja, maltería, cervecería y castillo. Si todos están ocupados mientras el grano espera, compra más carros en el establo.\n— Wszebor",
      won: {
        1: "La cerveza llegó al castillo. Un sello; Compra carros para los largos trayectos.\n— Wszebor",
        2: "La cerveza llegó al castillo. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "La cerveza llegó al castillo. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "Llegó el invierno antes del último barril. Compra carros si todos trabajan y el grano sigue esperando.\n— Wszebor",
    },
    it: {
      opening: "Per l'inverno il castello vuole 22 di birra. Il grano cresce a ovest, la malteria è lontana a est. Tre carri servono fattoria, malteria, birrificio e castello. Se tutti i carri sono occupati mentre il grano aspetta, comprane altri alla stalla.\n— Wszebor",
      won: {
        1: "La birra è arrivata al castello. Un sigillo; Compra altri carri per i lunghi viaggi.\n— Wszebor",
        2: "La birra è arrivata al castello. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "La birra è arrivata al castello. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "L'inverno è giunto prima dell'ultima botte. Compra carri se il grano aspetta e tutti i mezzi sono impegnati.\n— Wszebor",
    },
    "pt-BR": {
      opening: "No inverno o castelo precisa de 22 de cerveja. Os grãos crescem no oeste, mas a maltaria fica longe, no leste. Três carroças atendem fazenda, maltaria, cervejaria e castelo. Se todas estiverem ocupadas enquanto os grãos esperam, compre mais carroças no estábulo.\n— Wszebor",
      won: {
        1: "A cerveja chegou ao castelo. Um selo; Compre carroças para a rota longa.\n— Wszebor",
        2: "A cerveja chegou ao castelo. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "A cerveja chegou ao castelo. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "O inverno chegou antes do último barril. Compre carroças se todas estiverem ocupadas e os grãos parados.\n— Wszebor",
    },
    sv: {
      opening: "Inför vintern behöver borgen 22 öl. Säden växer i väster, mälteriet ligger långt österut. Tre vagnar ska betjäna gård, mälteri, bryggeri och borg. Om alla vagnar är upptagna medan säden väntar, köp fler i stallet.\n— Wszebor",
      won: {
        1: "Ölet nådde borgen. Ett sigill; Köp fler vagnar för långa turer.\n— Wszebor",
        2: "Ölet nådde borgen. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Ölet nådde borgen. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Vintern kom före sista tunnan. Köp fler vagnar om säden väntar och alla vagnar kör.\n— Wszebor",
    },
    tr: {
      opening: "Kış için kaleye 22 birim bira gerek. Tahıl batıda yetişiyor, malt evi doğuda uzakta. Üç araba çiftlik, malt evi, bira imalathanesi ve kaleye yetişmeli. Tahıl beklerken bütün arabalar meşgulse ahırdan yeni araba satın al.\n— Wszebor",
      won: {
        1: "Bira kaleye ulaştı. Bir mühür; Uzun yol için daha fazla araba al.\n— Wszebor",
        2: "Bira kaleye ulaştı. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Bira kaleye ulaştı. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "Son fıçı gelmeden kış bastırdı. Tahıl bekleyip arabalar doluysa yenilerini satın al.\n— Wszebor",
    },
    ru: {
      opening: "К зиме замку нужны 22 единицы пива. Зерно растёт на западе, солодовня далеко на востоке. Три повозки обслуживают ферму, солодовню, пивоварню и замок. Если все повозки заняты, а зерно ждёт в поле, купи ещё повозки в конюшне.\n— Wszebor",
      won: {
        1: "Пиво доставлено в замок. Одна печать; На дальнем пути поможет больше повозок.\n— Wszebor",
        2: "Пиво доставлено в замок. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Пиво доставлено в замок. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Зима пришла до последней бочки. Купи повозки, если зерно ждёт, а весь обоз занят.\n— Wszebor",
    },
    uk: {
      opening: "До зими замку потрібно 22 одиниці пива. Зерно росте на заході, солодовня далеко на сході. Три вози обслуговують господарство, солодовню, броварню й замок. Якщо всі зайняті, а зерно лежить у полі, купи ще возів у стайні.\n— Wszebor",
      won: {
        1: "Пиво прибуло до замку. Одна печатка; Купи ще возів для довгих рейсів.\n— Wszebor",
        2: "Пиво прибуло до замку. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Пиво прибуло до замку. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Зима прийшла раніше за останню діжку. Купи вози, якщо зерно чекає, а всі вози зайняті.\n— Wszebor",
    },
    ja: {
      opening: "冬に備えて城にはビール22が必要だ。穀物は西の畑に、製麦所は遠い東にある。三台の荷車で農場、製麦所、醸造所、城を回らねばならぬ。穀物が畑で待ち、荷車が全て出払っているなら厩舎で荷車を買い足せ。\n— Wszebor",
      won: {
        1: "ビールは城に届いた。印章は一つ。\n— Wszebor",
        2: "ビールは城に届いた。よく整えた運行に印章二つ。\n— Wszebor",
        3: "ビールは城に届いた。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "最後の樽より先に冬が来た。穀物が待ち、荷車が出払っているなら買い足せ。\n— Wszebor",
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
    nl: {
      opening: "Voor het grote brouwen zijn 40 broden en 48 bier in drie leveringen nodig: 32 broden vóór 6:00, 8 broden en 12 bier vóór 9:00, daarna 36 bier vóór 12:00. Het kasteel neemt slechts de lopende levering. De kleine schuur zit vol graan; verbind de grote, twee vakken van de weg, om bier op te slaan.\n— Wszebor",
      won: {
        1: "Alle drie de leveringen kwamen aan. Eén zegel; Verbind de grote graanschuur voordat de brouwerij volloopt.\n— Wszebor",
        2: "Alle drie de leveringen kwamen aan. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "Alle drie de leveringen kwamen aan. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "De laatste levering bleef onvolledig: de volle schuur blokkeerde de brouwerij. Verbind de grote graanschuur eerder.\n— Wszebor",
    },
    es: {
      opening: "La gran elaboración exige 40 hogazas y 48 de cerveza en tres entregas: 32 hogazas antes de las 6:00; 8 hogazas y 12 de cerveza antes de las 9:00; 36 de cerveza antes de las 12:00. El castillo solo acepta la entrega actual. Une el granero grande, a dos casillas del camino, para guardar la cerveza.\n— Wszebor",
      won: {
        1: "Se completaron las tres entregas. Un sello; Conecta el granero grande antes de que se llene la cervecería.\n— Wszebor",
        2: "Se completaron las tres entregas. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "Se completaron las tres entregas. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "Venció el último plazo; el almacén lleno paralizó la cervecería. Conecta antes el granero grande.\n— Wszebor",
    },
    it: {
      opening: "La grande produzione richiede 40 pagnotte e 48 di birra in tre consegne: 32 pagnotte entro le 6:00; 8 pagnotte e 12 birra entro le 9:00; infine 36 birra entro le 12:00. Il castello accetta solo la consegna attuale. Collega subito il grande granaio, a due caselle dalla strada, per custodire la birra.\n— Wszebor",
      won: {
        1: "Le tre consegne sono state completate. Un sigillo; Collega il grande granaio prima che il birrificio si riempia.\n— Wszebor",
        2: "Le tre consegne sono state completate. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "Le tre consegne sono state completate. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "L'ultimo termine è passato. Il deposito pieno ha fermato il birrificio: collega prima il granaio grande.\n— Wszebor",
    },
    "pt-BR": {
      opening: "A grande produção exige 40 pães e 48 de cerveja em três entregas: 32 pães até 6:00; 8 pães e 12 de cerveja até 9:00; 36 de cerveja até 12:00. O castelo aceita apenas a entrega atual. O celeiro pequeno está cheio; ligue o grande, a duas casas da estrada, para guardar cerveja.\n— Wszebor",
      won: {
        1: "As três entregas foram concluídas. Um selo; Ligue o celeiro grande antes que a cervejaria fique cheia.\n— Wszebor",
        2: "As três entregas foram concluídas. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "As três entregas foram concluídas. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "O último prazo acabou sem tudo. O celeiro cheio travou a cervejaria. Ligue o celeiro grande mais cedo.\n— Wszebor",
    },
    sv: {
      opening: "Till storbrygden behövs 40 bröd och 48 öl i tre leveranser: 32 bröd före 6:00, 8 bröd och 12 öl före 9:00, sedan 36 öl före 12:00. Borgen tar bara emot aktuell leverans. Lilla magasinet är fyllt; anslut det stora, två rutor från vägen, för att lagra öl.\n— Wszebor",
      won: {
        1: "Alla tre leveranser fullbordades. Ett sigill; Anslut det stora magasinet innan bryggeriet fylls.\n— Wszebor",
        2: "Alla tre leveranser fullbordades. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Alla tre leveranser fullbordades. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Sista tidsfristen passerade, och det fulla magasinet stoppade bryggeriet. Anslut det stora magasinet tidigare.\n— Wszebor",
    },
    tr: {
      opening: "Büyük üretim için üç teslimatta 40 somun ekmek ve 48 bira lazım: 6:00'ya kadar 32 ekmek; 9:00'a kadar 8 ekmek ve 12 bira; 12:00'ye kadar 36 bira. Kale yalnız o anki teslimatı alır. Küçük ambar tahılla dolu; bira saklamak için yoldan iki kare uzaktaki büyük ambarı bağla.\n— Wszebor",
      won: {
        1: "Üç teslimat da tamamlandı. Bir mühür; İmalathane dolmadan büyük ambarı yola bağla.\n— Wszebor",
        2: "Üç teslimat da tamamlandı. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Üç teslimat da tamamlandı. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "Son süre doldu; dolu ambar bira üretimini durdurdu. Büyük ambarı daha erken bağla.\n— Wszebor",
    },
    ru: {
      opening: "Для большого пивоварения нужны 40 буханок и 48 пива в три срока: 32 буханки до 6:00, 8 буханок и 12 пива до 9:00, затем 36 пива до 12:00. Замок принимает лишь текущую поставку. Малый амбар полон зерна; соедини большой, в двух клетках от дороги, чтобы хранить пиво.\n— Wszebor",
      won: {
        1: "Все три поставки выполнены. Одна печать; Подключи большой амбар до заполнения пивоварни.\n— Wszebor",
        2: "Все три поставки выполнены. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Все три поставки выполнены. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Последний срок прошёл, но склад был полон и пивоварня встала. Подключи большой амбар раньше.\n— Wszebor",
    },
    uk: {
      opening: "Для великого варіння потрібно 40 хлібин і 48 пива в три строки: 32 хлібини до 6:00, 8 хлібин і 12 пива до 9:00, далі 36 пива до 12:00. Замок бере лише поточну поставку. Мала комора повна зерна; приєднай велику за дві клітинки від дороги, щоб зберігати пиво.\n— Wszebor",
      won: {
        1: "Усі три поставки виконано. Одна печатка; Приєднай велику комору до заповнення броварні.\n— Wszebor",
        2: "Усі три поставки виконано. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Усі три поставки виконано. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Останній строк минув, але повна комора зупинила броварню. Раніше приєднай велике сховище.\n— Wszebor",
    },
    ja: {
      opening: "大仕込みには三度の納品でパン40とビール48が要る。6:00までにパン32、9:00までにパン8とビール12、12:00までにビール36だ。城はその時の納品しか受け取らぬ。小穀倉は穀物で満杯だ。道から2マス離れた大穀倉をつなぎ、ビールを蓄えよ。\n— Wszebor",
      won: {
        1: "三度の納品を果たした。印章は一つ。\n— Wszebor",
        2: "三度の納品を果たした。よく整えた運行に印章二つ。\n— Wszebor",
        3: "三度の納品を果たした。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "最終期限を逃した。満杯の倉が醸造を止めた。大穀倉を早く道につなげ。\n— Wszebor",
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
