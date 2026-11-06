// Authored contract letters for missions I-XIII (VII-IX: docs/content/letters-7-9.md, X-XII:
// docs/content/letters-10-12.md; XIII: docs/missions/m13.md, night 6); all
// player-facing copy is localized.
// The letter counts are intentionally separate from simulation and UI logic.
import { getLang, type Lang } from '../i18n/index';

export type ContractMissionId = 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6' | 'm7' | 'm8' | 'm9' | 'm10' | 'm11' | 'm12' | 'm13';
export type LetterPhase = 'opening' | 'won' | 'lost';
export type SealCount = 1 | 2 | 3;

export interface ContractLetterSet {
  readonly opening: string;
  readonly won: Readonly<Record<SealCount, string>>;
  readonly lost: string;
}

/** Localized story content. Limits: opening 400, victory/defeat 200 UTF-16 characters, including the signature and newline. */
export const CONTRACT_LETTERS = {
  m1: {
    pl: {
      opening: "Do zarządcy traktów: przed pierwszym śniegiem dostarcz do grodu 30 desek i 20 bochenków. Drwal i tartak pracują za rzeką, lecz brzegi nie są połączone. Wytycz przeprawę, a potem dopilnuj dowozu mąki i chleba.\n— Wszebor, kasztelan Łozinnego Brodu",
      won: {
        1: "Dostawy dotarły przed śniegiem. Cieśle mają deski, kuchnia chleb. Następnym razem puść wozy w drogę wcześniej.\n— Wszebor",
        2: "Dobrze wytyczony trakt przyniósł dostawy ze sporym zapasem czasu. Dwie pieczęcie za sprawną pracę wozów.\n— Wszebor",
        3: "Bramę otwarto, nim zziębły konie. Deski i chleb złożono bez zwłoki; tak prowadzi się gród przez jesień.\n— Wszebor",
      },
      lost: "Przyszedł pierwszy śnieg, a część dostaw została na szlaku. Spójrz niżej, co stało najdłużej, i od tego zacznij następnym razem.\n— Wszebor",
    },
    en: {
      opening: "To the road steward: deliver 30 planks and 20 loaves to the castle before the first snow. The woodcutter and sawmill stand across the river, but the banks are not joined. Build a crossing, then see that flour and bread keep moving.\n— Wszebor, Castellan of Łozinny Bród",
      won: {
        1: "The goods arrived before the snow. The carpenters have planks and the kitchen has bread. Next time, send the wagons out sooner.\n— Wszebor",
        2: "A well-laid road brought the goods with time to spare. Two seals for sound wagon work.\n— Wszebor",
        3: "The gate opened before the horses grew cold. Bread and planks were stored without delay. This is how a march survives autumn.\n— Wszebor",
      },
      lost: "The first snow has come, and part of the order remains on the road. See below what stood longest, and start there next time.\n— Wszebor",
    },
    de: {
      opening: "An den Wegewart: Bringt vor dem ersten Schnee 30 Bretter und 20 Brote zur Burg. Holzfäller und Sägewerk liegen jenseits des Flusses, doch die Ufer sind nicht verbunden. Baut eine Überfahrt und sorgt dafür, dass Mehl und Brot weiterfahren.\n— Wszebor, Burggraf von Łozinny Bród",
      won: {
        1: "Die Waren kamen vor dem Schnee, doch die Fuhrleute waren spät. Ein Siegel; schickt sie künftig früher los.\n— Wszebor",
        2: "Der gut angelegte Weg brachte die Waren mit Zeitreserve. Zwei Siegel für die tüchtigen Fuhrleute.\n— Wszebor",
        3: "Bretter und Brot lagen bereit, noch ehe die Pferde froren. Drei Siegel für gute Herbstvorsorge.\n— Wszebor",
      },
      lost: "Der erste Schnee kam, und ein Teil des Auftrags blieb unterwegs. Seht unten, was am längsten stand, und beginnt nächstes Mal dort.\n— Wszebor",
    },
    fr: {
      opening: "Au prévôt des routes : faites livrer au château 30 planches et 20 pains avant les premières neiges. Bûcheron et scierie sont au-delà de la rivière, sans liaison entre les rives. Tracez un passage, puis veillez au transport de farine et de pain.\n— Wszebor, châtelain de Łozinny Bród",
      won: {
        1: "Les denrées sont arrivées avant la neige, mais trop tardivement. Un sceau ; envoyez les chariots plus tôt.\n— Wszebor",
        2: "Une route bien tracée a permis de livrer largement avant l'échéance. Deux sceaux pour les charretiers.\n— Wszebor",
        3: "La porte s'est ouverte avant que les chevaux ne prennent froid. Pains et planches sont rangés sans retard. Trois sceaux.\n— Wszebor",
      },
      lost: "La première neige est tombée, et une partie de la commande est restée en route. Voyez ci-dessous ce qui a le plus attendu, et commencez par là.\n— Wszebor",
    },
    nl: {
      opening: "Aan de wegbeheerder: lever vóór de eerste sneeuw 30 planken en 20 broden aan het kasteel. De houthakker en zagerij liggen aan de overkant; er is nog geen verbinding. Bouw een oversteek en houd het vervoer van meel en brood op gang.\n— Wszebor, kastelein van Łozinny Bród",
      won: {
        1: "Brood en planken bereikten het kasteel. Eén zegel; Stuur de wagens volgende keer eerder weg.\n— Wszebor",
        2: "Brood en planken bereikten het kasteel. Twee zegels voor goed georganiseerde ritten.\n— Wszebor",
        3: "Brood en planken bereikten het kasteel. Drie zegels voor uitstekend vooruitzien.\n— Wszebor",
      },
      lost: "De eerste sneeuw is gevallen en een deel van de bestelling bleef onderweg. Kijk hieronder wat het langst stilstond en begin daar de volgende keer.\n— Wszebor",
    },
    es: {
      opening: "Al encargado de caminos: lleva 30 tablones y 20 hogazas al castillo antes de la primera nevada. El leñador y el aserradero están al otro lado del río, sin paso entre las orillas. Construye un cruce y mantén el transporte de harina y pan.\n— Wszebor, castellano de Łozinny Bród",
      won: {
        1: "El castillo recibió pan y tablones. Un sello; La próxima vez envía los carros antes.\n— Wszebor",
        2: "El castillo recibió pan y tablones. Dos sellos por los viajes bien organizados.\n— Wszebor",
        3: "El castillo recibió pan y tablones. Tres sellos por tan buena previsión.\n— Wszebor",
      },
      lost: "Llegó la primera nevada y parte del pedido quedó en el camino. Mira abajo qué estuvo parado más tiempo y empieza por ahí la próxima vez.\n— Wszebor",
    },
    it: {
      opening: "Al custode delle strade: porta al castello 30 assi e 20 pagnotte prima della prima neve. Taglialegna e segheria sono oltre il fiume, ma le rive non sono collegate. Costruisci un passaggio e mantieni il trasporto di farina e pane.\n— Wszebor, castellano di Łozinny Bród",
      won: {
        1: "Pane e assi sono arrivati al castello. Un sigillo; La prossima volta manda prima i carri.\n— Wszebor",
        2: "Pane e assi sono arrivati al castello. Due sigilli per i viaggi ben ordinati.\n— Wszebor",
        3: "Pane e assi sono arrivati al castello. Tre sigilli per un'ottima previdenza.\n— Wszebor",
      },
      lost: "È arrivata la prima neve e parte dell'ordine è rimasta per strada. Guarda sotto cosa è rimasto fermo più a lungo e comincia da lì la prossima volta.\n— Wszebor",
    },
    "pt-BR": {
      opening: "Ao encarregado das estradas: entregue 30 tábuas e 20 pães ao castelo antes da primeira neve. O lenhador e a serraria ficam do outro lado do rio, sem ligação entre as margens. Construa uma travessia e mantenha o transporte de farinha e pão.\n— Wszebor, castelão de Łozinny Bród",
      won: {
        1: "Pães e tábuas chegaram ao castelo. Um selo; Na próxima vez, envie as carroças antes.\n— Wszebor",
        2: "Pães e tábuas chegaram ao castelo. Dois selos pelas viagens bem organizadas.\n— Wszebor",
        3: "Pães e tábuas chegaram ao castelo. Três selos pelo excelente planejamento.\n— Wszebor",
      },
      lost: "Chegou a primeira neve e parte do pedido ficou na estrada. Veja abaixo o que ficou parado por mais tempo e comece por aí na próxima vez.\n— Wszebor",
    },
    sv: {
      opening: "Till vägförvaltaren: för 30 plankor och 20 bröd till borgen före första snön. Skogshuggaren och sågverket ligger bortom floden, men stränderna saknar förbindelse. Bygg en överfart och håll mjöl och bröd i rörelse.\n— Wszebor, kastellan av Łozinny Bród",
      won: {
        1: "Bröd och plankor nådde borgen. Ett sigill; Skicka iväg vagnarna tidigare nästa gång.\n— Wszebor",
        2: "Bröd och plankor nådde borgen. Två sigill för välordnade körningar.\n— Wszebor",
        3: "Bröd och plankor nådde borgen. Tre sigill för utmärkt framförhållning.\n— Wszebor",
      },
      lost: "Första snön har kommit och en del av beställningen blev kvar på vägen. Se nedan vad som stod längst, och börja där nästa gång.\n— Wszebor",
    },
    tr: {
      opening: "Yol sorumlusuna: İlk kar düşmeden kaleye 30 kalas ve 20 somun ekmek ulaştır. Oduncu ile kereste atölyesi nehrin karşısında, fakat iki kıyı bağlı değil. Bir geçit yap; un ve ekmek taşıyan arabaların yolunu açık tut.\n— Wszebor, Łozinny Bród kale kâhyası",
      won: {
        1: "Ekmek ile kalas kaleye ulaştı. Bir mühür; Bir dahaki sefere arabaları daha erken gönder.\n— Wszebor",
        2: "Ekmek ile kalas kaleye ulaştı. Düzenli seferler için iki mühür.\n— Wszebor",
        3: "Ekmek ile kalas kaleye ulaştı. İyi hazırlık için üç mühür.\n— Wszebor",
      },
      lost: "İlk kar geldi ve siparişin bir kısmı yolda kaldı. Aşağıda en uzun neyin durduğuna bak ve bir dahaki sefere oradan başla.\n— Wszebor",
    },
    ru: {
      opening: "Смотрителю дорог: до первого снега доставь в замок 30 досок и 20 буханок хлеба. Лесоруб и лесопилка стоят за рекой, но берега не соединены. Построй переправу и наладь подвоз муки и хлеба.\n— Wszebor, каштелян Łozinny Bród",
      won: {
        1: "Доски и хлеб доставлены в замок. Одна печать; В другой раз отправляй повозки раньше.\n— Wszebor",
        2: "Доски и хлеб доставлены в замок. Две печати за хорошо устроенные рейсы.\n— Wszebor",
        3: "Доски и хлеб доставлены в замок. Три печати за отличную предусмотрительность.\n— Wszebor",
      },
      lost: "Пришёл первый снег, а часть заказа осталась в пути. Посмотри ниже, что стояло дольше всего, и в следующий раз начни с этого.\n— Wszebor",
    },
    uk: {
      opening: "Наглядачеві шляхів: до першого снігу доправ до замку 30 дощок і 20 хлібин. Лісоруб і лісопилка стоять за річкою, але береги не з'єднані. Збудуй переправу й забезпеч перевезення борошна та хліба.\n— Wszebor, каштелян Łozinny Bród",
      won: {
        1: "Дошки й хліб прибули до замку. Одна печатка; Наступного разу відправляй вози раніше.\n— Wszebor",
        2: "Дошки й хліб прибули до замку. Дві печатки за належно впорядковані рейси.\n— Wszebor",
        3: "Дошки й хліб прибули до замку. Три печатки за чудову завбачливість.\n— Wszebor",
      },
      lost: "Випав перший сніг, а частина замовлення лишилася в дорозі. Подивися нижче, що стояло найдовше, і наступного разу почни з цього.\n— Wszebor",
    },
    ja: {
      opening: "街道管理官へ。初雪までに板材30とパン20を城へ運べ。川向こうの木こり小屋と製材所は、まだこちら岸と道で結ばれていない。渡河路を築き、小麦粉とパンの輸送を絶やすな。\n— Wszebor、Łozinny Bród城代",
      won: {
        1: "パンと板材が城に届いた。印章は一つ。\n— Wszebor",
        2: "パンと板材が城に届いた。よく整えた運行に印章二つ。\n— Wszebor",
        3: "パンと板材が城に届いた。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "初雪が来て、注文の一部は道に残った。下で最も長く止まっていたものを確かめ、次はそこから始めよ。\n— Wszebor",
    },
    ko: {
      opening: "도로 관리인에게. 첫눈이 오기 전에 성으로 판자 30개와 빵 20개를 보내라. 벌목꾼과 제재소는 강 건너편에 있으나 양쪽 둑은 이어져 있지 않다. 건널목을 만들고 밀가루와 빵의 운송을 이어 가라.\n— Wszebor, Łozinny Bród 성의 성주",
      won: {
        1: "빵과 판자가 성에 도착했다.인장 하나다.\n— Wszebor",
        2: "빵과 판자가 성에 도착했다.잘 정돈한 운송에 인장 둘을 준다.\n— Wszebor",
        3: "빵과 판자가 성에 도착했다.훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "첫눈이 내렸고 주문의 일부는 길에 남았다. 아래에서 가장 오래 멈춘 것을 보고 다음에는 거기서 시작하라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "致道路总管：务必在初雪前将30份木板和20条面包送进城堡。伐木场与锯木厂在河对岸，两岸尚未连通。先建渡口，再确保面粉和面包持续运来。\n— Wszebor，Łozinny Bród城堡总管",
      won: {
        1: "面包和木板已运抵城堡。授予一枚印章。\n— Wszebor",
        2: "面包和木板已运抵城堡。运输安排妥当，授予两枚印章。\n— Wszebor",
        3: "面包和木板已运抵城堡。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "初雪已至，部分订单仍在途中。看看下方哪里停得最久，下次就从那里着手。\n— Wszebor",
    },
    ar: {
      opening: "إلى ناظر الطرق: أوصل 30 لوحًا و20 رغيفًا إلى القلعة قبل أول ثلج. الحطاب والمنشرة وراء النهر، لكن الضفتين غير موصولتين. أنشئ معبرًا واحرص على استمرار نقل الدقيق والخبز.\n— Wszebor، حاكم قلعة Łozinny Bród",
      won: {
        1: "وصل الخبز والألواح إلى القلعة. ختم واحد؛ أرسل العربات أبكر في المرة القادمة.\n— Wszebor",
        2: "وصل الخبز والألواح إلى القلعة. ختمان لتنظيم الرحلات بإحكام.\n— Wszebor",
        3: "وصل الخبز والألواح إلى القلعة. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "حلّ أول ثلج وبقي جزء من الطلب في الطريق. انظر أدناه ما توقف أطول مدة، وابدأ منه في المرة القادمة.\n— Wszebor",
    },
    hi: {
      opening: "मार्ग निरीक्षक के नाम: पहली बर्फ़ से पहले किले में 30 तख्ते और 20 रोटियाँ पहुँचाओ। लकड़हारा और आरा-मिल नदी के उस पार हैं, पर दोनों किनारे जुड़े नहीं हैं। पार जाने का रास्ता बनाओ और आटे व रोटी की ढुलाई चालू रखो।\n— Wszebor, Łozinny Bród का किलेदार",
      won: {
        1: "रोटी और तख्ते किले में पहुँच गए। एक मुहर; अगली बार गाड़ियाँ जल्दी रवाना करो।\n— Wszebor",
        2: "रोटी और तख्ते किले में पहुँच गए। सुव्यवस्थित फेरों के लिए दो मुहरें।\n— Wszebor",
        3: "रोटी और तख्ते किले में पहुँच गए। उत्तम तैयारी के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "पहली बर्फ़ आ गई, और ऑर्डर का कुछ हिस्सा राह में रह गया। नीचे देखो कि सबसे देर तक क्या रुका रहा, और अगली बार वहीं से शुरू करो।\n— Wszebor",
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
    ko: {
      opening: "성의 서기 Mirogniew가 판자 36개와 빵 30개를 요구했다. 양쪽 강둑의 수레가 유일한 나무다리에 몰린다. 기한 전에 다리를 하나 더 놓거나 돌다리를 세워 정체를 줄여라.\n— Wszebor",
      won: {
        1: "화물이 다리를 건넜다.인장 하나다.\n— Wszebor",
        2: "화물이 다리를 건넜다.잘 정돈한 운송에 인장 둘을 준다.\n— Wszebor",
        3: "화물이 다리를 건넜다.훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "기한이 지났는데 수레가 다리 앞에 줄을 섰다. 다른 통로를 열어라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "城堡书记Mirogniew登记了36份木板和30条面包的需求。两岸马车都挤在唯一的木桥上。期限前另建一座桥或石桥，疏通车队。\n— Wszebor",
      won: {
        1: "货物顺利通过桥梁。授予一枚印章。\n— Wszebor",
        2: "货物顺利通过桥梁。运输安排妥当，授予两枚印章。\n— Wszebor",
        3: "货物顺利通过桥梁。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "期限已过，马车仍在桥头排队。另开一条路。\n— Wszebor",
    },
    ar: {
      opening: "دوّن كاتب القلعة Mirogniew الحاجة إلى 36 لوحًا و30 رغيفًا. تتزاحم العربات من الضفتين على الجسر الخشبي الوحيد. خفف الازدحام قبل الموعد ببناء جسر ثانٍ أو معبر حجري.\n— Wszebor",
      won: {
        1: "عبرت البضائع الجسر. ختم واحد؛ خفف طابور العربات عند الجسر.\n— Wszebor",
        2: "عبرت البضائع الجسر. ختمان لتنظيم الرحلات بإحكام.\n— Wszebor",
        3: "عبرت البضائع الجسر. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "انتهى الموعد والعربات عالقة عند الجسر. افتح لها طريقًا ثانيًا.\n— Wszebor",
    },
    hi: {
      opening: "किले के मुंशी Mirogniew ने 36 तख्ते और 30 रोटियाँ माँगी हैं। दोनों किनारों की गाड़ियाँ एक ही लकड़ी के पुल पर अटक रही हैं। समय रहते दूसरा पुल या पत्थर का रास्ता बनाकर कतार घटाओ।\n— Wszebor",
      won: {
        1: "सामान पुल पार पहुँच गया। एक मुहर; पुल पर गाड़ियों की कतार घटाओ।\n— Wszebor",
        2: "सामान पुल पार पहुँच गया। सुव्यवस्थित फेरों के लिए दो मुहरें।\n— Wszebor",
        3: "सामान पुल पार पहुँच गया। उत्तम तैयारी के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "समय बीत गया और गाड़ियाँ पुल पर खड़ी रह गईं। दूसरा मार्ग खोलो।\n— Wszebor",
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
    ko: {
      opening: "비가 흙길을 씻어 냈다. 성에는 판자 24개와 빵 16개가 필요하지만 바퀴가 진창에 빠진다. 방앗간 주인 Borzym이 곡물을 기다린다. 수레가 자주 다니는 구간을 돌로 포장하라.\n— Wszebor",
      won: {
        1: "비를 뚫고 물자가 도착했다.인장 하나다.\n— Wszebor",
        2: "비를 뚫고 물자가 도착했다.잘 정돈한 운송에 인장 둘을 준다.\n— Wszebor",
        3: "비를 뚫고 물자가 도착했다.훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "비가 그치지 않아 물자가 부족했다. 수레가 느려지는 곳을 포장하라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "大雨冲毁了土路。城堡急需24份木板和16条面包，但车轮陷入泥坑。磨坊主Borzym等着谷物。把马车最常走的路段铺上石块。\n— Wszebor",
      won: {
        1: "物资顶着雨水送到了。授予一枚印章。\n— Wszebor",
        2: "物资顶着雨水送到了。运输安排妥当，授予两枚印章。\n— Wszebor",
        3: "物资顶着雨水送到了。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "雨未停，货物没送齐。把马车最慢的路段铺上石块。\n— Wszebor",
    },
    ar: {
      opening: "جرفت الأمطار الطريق الترابي. تحتاج القلعة 24 لوحًا و16 رغيفًا، لكن العجلات تغوص في الوحل. ينتظر الطحان Borzym الحبوب. ارصف أكثر المقاطع ازدحامًا بالحجارة.\n— Wszebor",
      won: {
        1: "وصلت المؤن رغم المطر. ختم واحد؛ ارصف المواضع التي تعيقها الأوحال.\n— Wszebor",
        2: "وصلت المؤن رغم المطر. ختمان لتنظيم الرحلات بإحكام.\n— Wszebor",
        3: "وصلت المؤن رغم المطر. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "استمر المطر ونقصت المؤن. ارصف المقاطع التي تتباطأ فيها العربات.\n— Wszebor",
    },
    hi: {
      opening: "वर्षा ने कच्ची सड़क बिगाड़ दी है। किले को 24 तख्ते और 16 रोटियाँ चाहिए, लेकिन पहिए कीचड़ में धँसते हैं। चक्कीवाला Borzym अनाज की राह देख रहा है। सबसे व्यस्त हिस्सों में पत्थर बिछाओ।\n— Wszebor",
      won: {
        1: "बारिश के बावजूद रसद पहुँच गई। एक मुहर; कीचड़ वाले हिस्सों में पत्थर बिछाओ।\n— Wszebor",
        2: "बारिश के बावजूद रसद पहुँच गई। सुव्यवस्थित फेरों के लिए दो मुहरें।\n— Wszebor",
        3: "बारिश के बावजूद रसद पहुँच गई। उत्तम तैयारी के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "बारिश नहीं थमी और रसद कम पड़ी। जहाँ गाड़ियाँ धीमी हों वहाँ पत्थर बिछाओ।\n— Wszebor",
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
        1: "The ice hindered the wagons, but the castle got its goods. One seal for meeting the deadline.\n— Wszebor",
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
    ko: {
      opening: "떠내려오는 얼음이 정해진 시각에 나무다리를 막을 것이다. 미리 성 쪽 강둑의 곡물 창고에 물자를 쌓거나 돌다리를 지어라. 강 건너에 남은 짐은 누구도 먹여 살리지 못한다.\n— Wszebor",
      won: {
        1: "얼음의 방해에도 성에 물자가 도착했다.인장 하나다.\n— Wszebor",
        2: "얼음의 방해에도 성에 물자가 도착했다.잘 정돈한 운송에 인장 둘을 준다.\n— Wszebor",
        3: "얼음의 방해에도 성에 물자가 도착했다.훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "다리가 닫힐 것을 알고도 대비하지 못했다. 성 쪽에 비축하거나 돌다리를 지어라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "流冰将在指定时刻封闭木桥。务必提前把粮食运到城堡一侧的粮仓，或者修建石桥。留在对岸的货物无法填饱任何人的肚子。\n— Wszebor",
      won: {
        1: "尽管河面结冰，城堡仍收到了货物。授予一枚印章。\n— Wszebor",
        2: "尽管河面结冰，城堡仍收到了货物。运输安排妥当，授予两枚印章。\n— Wszebor",
        3: "尽管河面结冰，城堡仍收到了货物。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "明知木桥将封却准备不足。提早在城堡侧备货或修建石桥。\n— Wszebor",
    },
    ar: {
      opening: "سيغلق الجليد العائم الجسر الخشبي في الساعة المعلنة. انقل المؤن مسبقًا إلى مخزن على ضفة القلعة أو ابنِ جسرًا حجريًا. البضائع التي تبقى خلف النهر لن تطعم أحدًا.\n— Wszebor",
      won: {
        1: "وصلت مؤن القلعة رغم الجليد. ختم واحد؛ خزّن المؤن على ضفة القلعة قبل الجليد.\n— Wszebor",
        2: "وصلت مؤن القلعة رغم الجليد. ختمان لتنظيم الرحلات بإحكام.\n— Wszebor",
        3: "وصلت مؤن القلعة رغم الجليد. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "انتهى الموعد رغم التحذير من إغلاق الجسر. خزّن على ضفة القلعة أو ابنِ جسرًا حجريًا.\n— Wszebor",
    },
    hi: {
      opening: "बहती बर्फ़ तय समय पर लकड़ी का पुल बंद कर देगी। उससे पहले रसद किले वाले किनारे के अनाज-भंडार तक ले जाओ या पत्थर का पुल बनाओ। दूसरी ओर बचा सामान किसी का पेट नहीं भरेगा।\n— Wszebor",
      won: {
        1: "बर्फ़ के बावजूद किले में सामान पहुँचा। एक मुहर; बर्फ़ आने से पहले किले वाले किनारे रसद रखो।\n— Wszebor",
        2: "बर्फ़ के बावजूद किले में सामान पहुँचा। सुव्यवस्थित फेरों के लिए दो मुहरें।\n— Wszebor",
        3: "बर्फ़ के बावजूद किले में सामान पहुँचा। उत्तम तैयारी के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "पुल बंद होने की सूचना थी, फिर भी तैयारी नहीं हुई। किले वाले किनारे सामान रखो या पत्थर का पुल बनाओ।\n— Wszebor",
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
    ko: {
      opening: "성의 장터에는 서로 다른 시각에 세 차례 납품해야 한다. 서기 Mirogniew는 매번 따로 기록한다. 빵과 판자를 마지막 수레에 몰아서는 안 된다. 재고를 마련하고 운행을 나누어라.\n— Wszebor",
      won: {
        1: "세 번의 납품을 제때 마쳤다.인장 하나다.\n— Wszebor",
        2: "세 번의 납품을 제때 마쳤다.잘 정돈한 운송에 인장 둘을 준다.\n— Wszebor",
        3: "세 번의 납품을 제때 마쳤다.훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "한 차례 이상 납품이 늦었다. 총량만 보지 말고 각 기한을 지켜라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "城堡集市要求在三个不同时刻分别交货。书记Mirogniew会逐次记账。面包和木板必须按期送达，不能最后一车一起送。备好库存，安排车次。\n— Wszebor",
      won: {
        1: "三批货物都按时送达。授予一枚印章。\n— Wszebor",
        2: "三批货物都按时送达。运输安排妥当，授予两枚印章。\n— Wszebor",
        3: "三批货物都按时送达。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "至少一批货物误期。按每个时限备货，不要只核对总量。\n— Wszebor",
    },
    ar: {
      opening: "يحتاج سوق القلعة إلى ثلاث دفعات في أوقات مختلفة. سيسجل الكاتب Mirogniew كل دفعة وحدها: يجب وصول الخبز والألواح قبل كل موعد، لا في العربة الأخيرة كلها. جهز الاحتياطي ونظم الرحلات.\n— Wszebor",
      won: {
        1: "وصلت الدفعات الثلاث في مواعيدها. ختم واحد؛ قسّم الاحتياطي حسب المواعيد الثلاثة.\n— Wszebor",
        2: "وصلت الدفعات الثلاث في مواعيدها. ختمان لتنظيم الرحلات بإحكام.\n— Wszebor",
        3: "وصلت الدفعات الثلاث في مواعيدها. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "تأخرت دفعة واحدة على الأقل. راعِ موعد كل دفعة، لا المجموع فقط.\n— Wszebor",
    },
    hi: {
      opening: "किले के मेले में तीन अलग समय पर आपूर्ति चाहिए। मुंशी Mirogniew हर खेप अलग दर्ज करेगा: रोटी और तख्ते हर समय-सीमा से पहले पहुँचें, अंतिम गाड़ी में सब एक साथ नहीं। भंडार बनाओ और फेरों की योजना रखो।\n— Wszebor",
      won: {
        1: "तीनों खेप समय से पहुँच गईं। एक मुहर; हर समय-सीमा के लिए अलग भंडार रखो।\n— Wszebor",
        2: "तीनों खेप समय से पहुँच गईं। सुव्यवस्थित फेरों के लिए दो मुहरें।\n— Wszebor",
        3: "तीनों खेप समय से पहुँच गईं। उत्तम तैयारी के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "कम से कम एक खेप देर से पहुँची। कुल मात्रा ही नहीं, तीनों समय-सीमाएँ अलग देखो।\n— Wszebor",
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
    ko: {
      opening: "곡물 창고는 좁고, 방앗간 주인 Borzym이 가져가는 속도보다 곡물이 더 빨리 들어온다. 창고가 차면 작업이 멈춰 성의 계약도 위태롭다. 공간을 비우거나 수레를 다른 길로 보내라.\n— Wszebor",
      won: {
        1: "창고가 붐볐지만 물자를 보냈다.인장 하나다.\n— Wszebor",
        2: "창고가 붐볐지만 물자를 보냈다.잘 정돈한 운송에 인장 둘을 준다.\n— Wszebor",
        3: "창고가 붐볐지만 물자를 보냈다.훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "물자가 쌓여 기한을 놓쳤다. 가득 찬 창고와 방앗간에서 제빵소까지의 길을 살펴라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "粮仓狭小，谷物送来的速度超过磨坊主Borzym取货的速度。一旦仓库堆满，生产便会停滞，城堡的订单也会误期。腾出库位或改走别的路。\n— Wszebor",
      won: {
        1: "虽有仓储阻塞，订单仍已完成。授予一枚印章。\n— Wszebor",
        2: "虽有仓储阻塞，订单仍已完成。运输安排妥当，授予两枚印章。\n— Wszebor",
        3: "虽有仓储阻塞，订单仍已完成。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "货物堆积，期限已过。查看满仓及磨坊通往面包房的道路。\n— Wszebor",
    },
    ar: {
      opening: "المخزن ضيق والحبوب تصل أسرع مما يستطيع الطحان Borzym سحبها. إذا امتلأ المخزن توقفت الورش وتعطل طلب القلعة. أفسح مكانًا للمؤن أو وجّه العربات إلى طريق آخر.\n— Wszebor",
      won: {
        1: "اكتمل الطلب رغم ضيق المخزن. ختم واحد؛ اترك فراغًا بالمخزن وطريقًا مفتوحًا للمخبز.\n— Wszebor",
        2: "اكتمل الطلب رغم ضيق المخزن. ختمان لتنظيم الرحلات بإحكام.\n— Wszebor",
        3: "اكتمل الطلب رغم ضيق المخزن. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "تراكمت البضائع وانتهى الموعد. افحص المخزن الممتلئ والطريق من الطاحونة إلى المخبز.\n— Wszebor",
    },
    hi: {
      opening: "अनाज-भंडार छोटा है और अनाज चक्कीवाले Borzym के उठाने से तेज़ आ रहा है। भंडार भरने पर काम रुक जाएगा और किले का आदेश अधूरा रहेगा। जगह खाली करो या गाड़ियाँ दूसरे रास्ते भेजो।\n— Wszebor",
      won: {
        1: "भरा भंडार होने पर भी आदेश पूरा हुआ। एक मुहर; भंडार खाली रखो और बेकरी तक रास्ता खुला रखो।\n— Wszebor",
        2: "भरा भंडार होने पर भी आदेश पूरा हुआ। सुव्यवस्थित फेरों के लिए दो मुहरें।\n— Wszebor",
        3: "भरा भंडार होने पर भी आदेश पूरा हुआ। उत्तम तैयारी के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "माल जमा हो गया और समय निकल गया। भरा भंडार और चक्की से बेकरी का रास्ता जाँचो।\n— Wszebor",
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
        3: "Nets on the shore and wagons on the bridge worked together. Three seals for a well-chosen site.\n— Wszebor",
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
    ko: {
      opening: "금식 기간이 왔다. 성의 부엌에는 물고기 54마리가 필요하다. 북쪽 강둑에 어부 오두막이 하나 있지만 어획이 늦을 수 있다. 물가에 오두막을 더 세우고 물고기를 나무다리로 남쪽 둑에 보내라. 뭍에서는 잡히지 않는다.\n— Wszebor",
      won: {
        1: "물고기가 성의 부엌에 도착했다.인장 하나다.\n— Wszebor",
        2: "물고기가 성의 부엌에 도착했다.잘 정돈한 운송에 인장 둘을 준다.\n— Wszebor",
        3: "물고기가 성의 부엌에 도착했다.훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "금식이 끝났는데 물고기가 모자랐다. 오두막을 물가에 놓고 다리의 수레를 움직여라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "斋戒日到了。城堡厨房需要54条鱼。北岸已有一间渔屋，但渔获恐怕来不及。请在水边再建一间，不要建在陆地深处，并用马车把鱼经木桥送往南岸。\n— Wszebor",
      won: {
        1: "鲜鱼送进了城堡厨房。授予一枚印章。\n— Wszebor",
        2: "鲜鱼送进了城堡厨房。运输安排妥当，授予两枚印章。\n— Wszebor",
        3: "鲜鱼送进了城堡厨房。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "斋戒已结束，鱼却不足。把渔屋建在水边，保持木桥畅通。\n— Wszebor",
    },
    ar: {
      opening: "حلّ الصوم وتحتاج مطابخ القلعة إلى 54 سمكة. يوجد كوخ صيد على الضفة الشمالية، لكن صيده قد يتأخر. ابنِ كوخًا آخر عند الماء، لا في اليابسة، وانقل السمك بالعربات فوق الجسر الخشبي إلى الضفة الجنوبية.\n— Wszebor",
      won: {
        1: "وصل السمك إلى مطابخ القلعة. ختم واحد؛ ابنِ كوخ صيد ثانٍ عند الماء.\n— Wszebor",
        2: "وصل السمك إلى مطابخ القلعة. ختمان لتنظيم الرحلات بإحكام.\n— Wszebor",
        3: "وصل السمك إلى مطابخ القلعة. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "انتهى الصوم ولم يكفِ السمك. ضع الكوخ عند الماء وأبقِ العربات تتحرك فوق الجسر.\n— Wszebor",
    },
    hi: {
      opening: "उपवास का समय आ गया। किले की रसोई को 54 मछलियाँ चाहिए। उत्तरी किनारे पर एक मछुआरे की झोंपड़ी है, पर शिकार कम पड़ सकता है। पानी के पास दूसरी झोंपड़ी बनाओ; सूखी ज़मीन पर मछली नहीं मिलती। मछली लकड़ी के पुल से दक्षिण ले जाओ।\n— Wszebor",
      won: {
        1: "मछली किले की रसोई में पहुँच गई। एक मुहर; पानी के पास मछुआरे की दूसरी झोंपड़ी बनाओ।\n— Wszebor",
        2: "मछली किले की रसोई में पहुँच गई। सुव्यवस्थित फेरों के लिए दो मुहरें।\n— Wszebor",
        3: "मछली किले की रसोई में पहुँच गई। उत्तम तैयारी के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "उपवास बीता, पर मछलियाँ कम पड़ीं। झोंपड़ी पानी के पास रखो और पुल पर गाड़ियाँ चलाओ।\n— Wszebor",
    },
  },
  m8: {
    pl: {
      opening: "Nad doliną zbierają się chmury. Chcę 40 desek i 40 bochenków. Każdy worek i każda deska jadą tym samym traktem między przysiółkiem a grodem, a ulewa zamieni go w błoto. Dodatkowe wozy niewiele tam pomogą. Wybrukuj trakt: potrzeba 23 kamieni w spichlerzach. 16 już tam leży, resztę wozy muszą przywieźć z kamieniołomu, po cztery na wóz.\n— Wszebor",
      won: {
        1: "Deski i chleb przebiły się przez błoto, ale późno. Jedna pieczęć; błotnisty trakt spowalniał każdy kurs.\n— Wszebor",
        2: "Dostawy zdążyły, choć trakt tonął w błocie. Dwie pieczęcie; bruk skróciłby każdy przejazd o połowę.\n— Wszebor",
        3: "Kamień dotarł do spichlerzy, trakt wybrukowano, a żaden wóz nie ugrzązł. Trzy pieczęcie za przezorność.\n— Wszebor",
      },
      lost: "Ulewa zatrzymała wozy na trakcie. Przywieź kamień do spichlerzy i wybrukuj trakt, nim rozpada się na dobre.\n— Wszebor",
    },
    en: {
      opening: "Storm clouds gather over the valley. I require 40 planks and 40 loaves. Every sack and every plank travels the one lane between the hamlet and the castle, and the rain will turn it to mud. More wagons will not help much there. Pave the lane: it takes 23 stone in the granaries. 16 lie there already; wagons must bring the rest from the quarry, four to a wagon.\n— Wszebor",
      won: {
        1: "Planks and bread came through the mud, but late. One seal; the muddy lane slowed every trip.\n— Wszebor",
        2: "The order arrived in time, though the lane was deep in mud. Two seals; cobbles would have halved every crossing.\n— Wszebor",
        3: "The stone reached the granaries, the lane was paved, and no wagon sank. Three seals for forethought.\n— Wszebor",
      },
      lost: "The rain held the wagons on the lane. Bring stone to the granaries and pave the lane before the storm sets in.\n— Wszebor",
    },
    de: {
      opening: "Über dem Tal ziehen Wolken auf. Ich verlange 40 Bretter und 40 Brote. Jeder Sack und jedes Brett fährt über denselben Weg zwischen Weiler und Burg, und der Regen macht ihn zu Schlamm. Mehr Wagen helfen dort wenig. Pflastert den Weg: Dafür braucht es 23 Steine in den Speichern. 16 liegen schon dort; den Rest holen Wagen aus dem Steinbruch, vier je Wagen.\n— Wszebor",
      won: {
        1: "Bretter und Brot kamen durch den Schlamm, doch spät. Ein Siegel; der schlammige Weg bremste jede Fahrt.\n— Wszebor",
        2: "Die Lieferung kam rechtzeitig, obwohl der Weg im Schlamm versank. Zwei Siegel; Pflaster hätte jede Fahrt halbiert.\n— Wszebor",
        3: "Der Stein erreichte die Speicher, der Weg wurde gepflastert, kein Wagen blieb stecken. Drei Siegel für Weitsicht.\n— Wszebor",
      },
      lost: "Der Regen hielt die Wagen auf dem Weg fest. Bringt Stein in die Speicher und pflastert den Weg vor dem Sturm.\n— Wszebor",
    },
    fr: {
      opening: "Des nuages s'amassent sur la vallée. Je demande 40 planches et 40 pains. Chaque sac et chaque planche passent par le même chemin entre le hameau et le château, et la pluie le changera en boue. Plus de chariots n'y aideront guère. Pavez le chemin : il faut 23 pierres dans les greniers. 16 y sont déjà ; les chariots apportent le reste de la carrière, quatre par chariot.\n— Wszebor",
      won: {
        1: "Planches et pain ont traversé la boue, mais tard. Un sceau ; le chemin boueux a ralenti chaque trajet.\n— Wszebor",
        2: "La commande est arrivée à temps, malgré la boue. Deux sceaux ; des pavés auraient réduit chaque passage de moitié.\n— Wszebor",
        3: "La pierre a gagné les greniers, le chemin a été pavé, aucun chariot ne s'est enlisé. Trois sceaux pour la prévoyance.\n— Wszebor",
      },
      lost: "La pluie a retenu les chariots sur le chemin. Portez la pierre aux greniers et pavez le chemin avant l'orage.\n— Wszebor",
    },
    nl: {
      opening: "Boven het dal pakken wolken samen. Ik wil 40 planken en 40 broden. Elke zak en elke plank gaat over dezelfde weg tussen het gehucht en het kasteel, en de regen maakt er modder van. Meer wagens helpen daar weinig. Bestraat de weg: daarvoor zijn 23 stenen in de schuren nodig. 16 liggen er al; de rest halen wagens uit de groeve, vier per wagen.\n— Wszebor",
      won: {
        1: "Planken en brood kwamen door de modder, maar laat. Eén zegel; de modderige weg vertraagde elke rit.\n— Wszebor",
        2: "De bestelling kwam op tijd, al stond de weg vol modder. Twee zegels; straatstenen hadden elke rit gehalveerd.\n— Wszebor",
        3: "De steen bereikte de schuren, de weg werd bestraat en geen wagen zakte weg. Drie zegels voor vooruitzien.\n— Wszebor",
      },
      lost: "De regen hield de wagens op de weg vast. Breng steen naar de schuren en bestraat de weg vóór de storm.\n— Wszebor",
    },
    es: {
      opening: "Se juntan nubes sobre el valle. Quiero 40 tablones y 40 hogazas. Cada saco y cada tablón recorren el mismo camino entre la aldea y el castillo, y la lluvia lo convertirá en barro. Más carros apenas ayudarán allí. Empiedra el camino: hacen falta 23 piedras en los graneros. Ya hay 16; los carros traerán el resto de la cantera, cuatro por carro.\n— Wszebor",
      won: {
        1: "Tablones y pan cruzaron el barro, pero tarde. Un sello; el camino embarrado frenó cada viaje.\n— Wszebor",
        2: "El pedido llegó a tiempo, aunque el camino era un lodazal. Dos sellos; el empedrado habría acortado cada viaje a la mitad.\n— Wszebor",
        3: "La piedra llegó a los graneros, el camino quedó empedrado y ningún carro se atascó. Tres sellos por tu previsión.\n— Wszebor",
      },
      lost: "La lluvia retuvo los carros en el camino. Lleva piedra a los graneros y empiedra el camino antes de la tormenta.\n— Wszebor",
    },
    it: {
      opening: "Sulla valle si addensano nubi. Voglio 40 assi e 40 pagnotte. Ogni sacco e ogni asse percorrono la stessa strada tra il borgo e il castello, e la pioggia la renderà fango. Altri carri serviranno a poco. Lastrica la strada: servono 23 pietre nei granai. 16 ci sono già; il resto lo porteranno i carri dalla cava, quattro per carro.\n— Wszebor",
      won: {
        1: "Assi e pane hanno attraversato il fango, ma tardi. Un sigillo; la strada fangosa ha rallentato ogni viaggio.\n— Wszebor",
        2: "L'ordine è arrivato in tempo, benché la strada fosse un pantano. Due sigilli; il lastricato avrebbe dimezzato ogni viaggio.\n— Wszebor",
        3: "La pietra è giunta ai granai, la strada è lastricata e nessun carro si è impantanato. Tre sigilli per la previdenza.\n— Wszebor",
      },
      lost: "La pioggia ha bloccato i carri sulla strada. Porta pietra ai granai e lastrica la strada prima della tempesta.\n— Wszebor",
    },
    "pt-BR": {
      opening: "Nuvens se juntam sobre o vale. Quero 40 tábuas e 40 pães. Cada saco e cada tábua passam pela mesma estrada entre o povoado e o castelo, e a chuva vai transformá-la em lama. Mais carroças pouco ajudarão ali. Calce a estrada: são precisas 23 pedras nos celeiros. 16 já estão lá; as carroças trazem o resto da pedreira, quatro por carroça.\n— Wszebor",
      won: {
        1: "Tábuas e pão atravessaram a lama, mas tarde. Um selo; a estrada enlameada atrasou cada viagem.\n— Wszebor",
        2: "A encomenda chegou a tempo, embora a estrada fosse um lamaçal. Dois selos; o calçamento teria cortado cada viagem pela metade.\n— Wszebor",
        3: "A pedra chegou aos celeiros, a estrada foi calçada e nenhuma carroça atolou. Três selos pela previdência.\n— Wszebor",
      },
      lost: "A chuva prendeu as carroças na estrada. Leve pedra aos celeiros e calce a estrada antes da tempestade.\n— Wszebor",
    },
    sv: {
      opening: "Moln hopar sig över dalen. Jag vill ha 40 plankor och 40 bröd. Varje säck och varje planka går samma väg mellan byn och borgen, och regnet gör den till lera. Fler vagnar hjälper föga där. Stenlägg vägen: det krävs 23 stenar i magasinen. 16 ligger redan där; resten kör vagnarna från stenbrottet, fyra per vagn.\n— Wszebor",
      won: {
        1: "Plankor och bröd tog sig genom leran, men sent. Ett sigill; den leriga vägen bromsade varje tur.\n— Wszebor",
        2: "Beställningen kom i tid, fast vägen var full av lera. Två sigill; stenläggning hade halverat varje tur.\n— Wszebor",
        3: "Stenen nådde magasinen, vägen stenlades och ingen vagn fastnade. Tre sigill för framsynthet.\n— Wszebor",
      },
      lost: "Regnet höll kvar vagnarna på vägen. Kör sten till magasinen och stenlägg vägen före stormen.\n— Wszebor",
    },
    tr: {
      opening: "Vadinin üstünde bulutlar toplanıyor. 40 kalas ve 40 somun ekmek istiyorum. Her çuval ve her kalas köy ile kale arasındaki aynı yoldan geçer; yağmur onu çamura çevirecek. Fazla araba orada pek işe yaramaz. Yolu taşla döşe: ambarlarda 23 taş gerekir. 16'sı zaten orada; kalanını arabalar taş ocağından getirir, araba başına dört.\n— Wszebor",
      won: {
        1: "Kalas ve ekmek çamuru aştı ama geç kaldı. Bir mühür; çamurlu yol her seferi yavaşlattı.\n— Wszebor",
        2: "Sipariş zamanında geldi, ama yol çamura gömülmüştü. İki mühür; taş döşeme her geçişi yarıya indirirdi.\n— Wszebor",
        3: "Taş ambarlara ulaştı, yol döşendi ve hiçbir araba saplanmadı. İleri görüşlülük için üç mühür.\n— Wszebor",
      },
      lost: "Yağmur arabaları yolda tuttu. Ambarlara taş getir ve fırtınadan önce yolu taşla döşe.\n— Wszebor",
    },
    ru: {
      opening: "Над долиной сгущаются тучи. Мне нужны 40 досок и 40 буханок хлеба. Каждый мешок и каждая доска едут по одной дороге между деревней и замком, а дождь превратит её в грязь. Лишние повозки там мало помогут. Вымости дорогу: нужно 23 камня в амбарах. 16 уже там; остальное повозки привезут из карьера, по четыре на повозку.\n— Wszebor",
      won: {
        1: "Доски и хлеб пробились сквозь грязь, но поздно. Одна печать; грязная дорога тормозила каждый рейс.\n— Wszebor",
        2: "Заказ пришёл вовремя, хотя дорога утопала в грязи. Две печати; мостовая вдвое сократила бы каждый рейс.\n— Wszebor",
        3: "Камень дошёл до амбаров, дорогу вымостили, и ни одна повозка не увязла. Три печати за предусмотрительность.\n— Wszebor",
      },
      lost: "Дождь задержал повозки на дороге. Привези камень в амбары и вымости дорогу до бури.\n— Wszebor",
    },
    uk: {
      opening: "Над долиною збираються хмари. Мені потрібні 40 дощок і 40 хлібин. Кожен мішок і кожна дошка їдуть тією самою дорогою між хутором і замком, а злива оберне її на багнюку. Зайві вози там мало допоможуть. Вимости дорогу: треба 23 камені в коморах. 16 вже там; решту вози привезуть з кар'єру, по чотири на віз.\n— Wszebor",
      won: {
        1: "Дошки й хліб пробилися крізь багнюку, але пізно. Одна печатка; багниста дорога гальмувала кожен рейс.\n— Wszebor",
        2: "Замовлення прибуло вчасно, хоч дорога тонула в багнюці. Дві печатки; бруківка вдвічі скоротила б кожен рейс.\n— Wszebor",
        3: "Камінь дійшов до комор, дорогу вимостили, і жоден віз не загруз. Три печатки за завбачливість.\n— Wszebor",
      },
      lost: "Злива затримала вози на дорозі. Привези камінь до комор і вимости дорогу до бурі.\n— Wszebor",
    },
    ja: {
      opening: "谷に雲が集まっている。板材40とパン40を届けよ。袋も板も、すべて村と城を結ぶ同じ一本道を通る。雨が降ればその道は泥になる。荷車を増やしても大して役に立たぬ。道を石畳にせよ。穀倉に石が23必要だ。16はすでにある。残りは荷車で採石場から運べ。一台に4つずつだ。\n— Wszebor",
      won: {
        1: "板材とパンは泥を越えて届いたが、遅かった。印章は一つ。泥の道がすべての運行を遅らせた。\n— Wszebor",
        2: "道は泥に沈んだが、注文は間に合った。印章二つ。石畳なら一往復ごとに半分の時間で済んだ。\n— Wszebor",
        3: "石は穀倉に届き、道は石畳になり、どの荷車も沈まなかった。見事な備えに印章三つ。\n— Wszebor",
      },
      lost: "雨が荷車を道に足止めした。穀倉に石を運び、嵐の前に道を石畳にせよ。\n— Wszebor",
    },
    ko: {
      opening: "골짜기 위로 구름이 모인다. 판자 40개와 빵 40개를 보내라. 모든 자루와 판자는 마을과 성 사이의 같은 길 하나를 지난다. 비가 오면 그 길은 진창이 된다. 수레를 늘려도 별 도움이 안 된다. 길을 돌로 포장하라. 창고에 돌 23개가 필요하다. 16개는 이미 있고, 나머지는 수레가 채석장에서 한 대에 네 개씩 실어 와야 한다.\n— Wszebor",
      won: {
        1: "판자와 빵이 진창을 지나 도착했지만 늦었다. 인장 하나다. 진흙길이 모든 운행을 늦췄다.\n— Wszebor",
        2: "길이 진창이었지만 주문은 제때 왔다. 인장 둘이다. 돌길이었다면 매번 절반의 시간으로 건넜을 것이다.\n— Wszebor",
        3: "돌이 창고에 닿았고, 길은 포장되었으며, 수레 하나 빠지지 않았다. 훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "비가 수레를 길 위에 묶어 두었다. 창고에 돌을 들이고 폭풍 전에 길을 포장하라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "山谷上空乌云聚集。我要40份木板和40条面包。每一袋粮、每一块木板，都走村庄与城堡之间的同一条路，而大雨会把它变成泥路。多派马车在那里帮不上多少忙。把这条路铺上石头：粮仓里需要23块石头。已有16块，其余由马车从采石场运来，每车4块。\n— Wszebor",
      won: {
        1: "木板和面包穿过泥路送到了，但晚了。授予一枚印章；泥路拖慢了每一趟。\n— Wszebor",
        2: "虽然道路陷在泥里，订单仍按时送达。授予两枚印章；石路能让每趟少花一半时间。\n— Wszebor",
        3: "石头运进了粮仓，道路铺好了，没有一辆马车陷进泥里。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "大雨把马车困在路上。先把石头运进粮仓，在暴雨前铺好这条路。\n— Wszebor",
    },
    ar: {
      opening: "تتجمع الغيوم فوق الوادي. أريد 40 لوحًا و40 رغيفًا. كل كيس وكل لوح يمر بالطريق نفسه بين القرية والقلعة، وسيحوّله المطر وحلًا. العربات الإضافية لن تنفع هناك كثيرًا. ارصف الطريق: يلزم 23 حجرًا في المخازن. فيها 16 الآن، والباقي تجلبه العربات من المحجر، أربعة في كل عربة.\n— Wszebor",
      won: {
        1: "عبرت الألواح والخبز الوحل، لكن متأخرة. ختم واحد؛ فالطريق الموحل أبطأ كل رحلة.\n— Wszebor",
        2: "وصل الطلب في وقته رغم أن الطريق غرق في الوحل. ختمان؛ كان الرصف سيختصر كل رحلة إلى النصف.\n— Wszebor",
        3: "وصل الحجر إلى المخازن، ورُصف الطريق، ولم تغرز أي عربة. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "حبس المطر العربات على الطريق. انقل الحجر إلى المخازن وارصف الطريق قبل العاصفة.\n— Wszebor",
    },
    hi: {
      opening: "घाटी पर बादल घिर रहे हैं। मुझे 40 तख्ते और 40 रोटियाँ चाहिए। हर बोरी और हर तख्ता गाँव और क़िले के बीच एक ही रास्ते से जाता है, और बारिश उसे कीचड़ बना देगी। वहाँ ज़्यादा गाड़ियाँ कम ही काम आएँगी। रास्ता पक्का करो: भंडारों में 23 पत्थर चाहिए। 16 पहले से हैं; बाक़ी गाड़ियाँ खदान से लाएँगी, हर गाड़ी में चार।\n— Wszebor",
      won: {
        1: "तख्ते और रोटी कीचड़ पार करके पहुँचे, पर देर से। एक मुहर; कीचड़ भरे रास्ते ने हर फेरा धीमा किया।\n— Wszebor",
        2: "रास्ता कीचड़ में डूबा था, फिर भी माल समय पर आया। दो मुहरें; पक्का रास्ता हर फेरा आधा कर देता।\n— Wszebor",
        3: "पत्थर भंडारों तक पहुँचा, रास्ता पक्का हुआ और कोई गाड़ी नहीं धँसी। दूरदर्शिता के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "बारिश ने गाड़ियों को रास्ते पर रोक लिया। भंडारों में पत्थर लाओ और तूफ़ान से पहले रास्ता पक्का करो।\n— Wszebor",
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
    ko: {
      opening: "혼례가 다가온다. 판자 36개, 숯 8개, 맥주 26개가 필요하다. 곡물은 제맥소로, 맥아는 양조장으로 옮겨라. 제재소와 숯가마가 벌목꾼 한 명을 함께 쓴다. 한쪽이 목재를 가져가면 다른 쪽이 멈춘다. 벌목과 수레를 늘려라.\n— Wszebor",
      won: {
        1: "혼례에 판자와 숯과 맥주가 도착했다.인장 하나다.\n— Wszebor",
        2: "혼례에 판자와 숯과 맥주가 도착했다.잘 정돈한 운송에 인장 둘을 준다.\n— Wszebor",
        3: "혼례에 판자와 숯과 맥주가 도착했다.훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "물자가 오기 전에 혼례가 시작됐다. 두 작업장에 충분한 목재를 공급하라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "婚礼将近，需要36份木板、8份木炭和26份啤酒。谷物要送往制麦坊，麦芽再送酒坊。锯木厂与炭窑共用一名伐木工，木材给了一方，另一方就停工。增加木材供应和运力。\n— Wszebor",
      won: {
        1: "婚礼收到了木板、木炭和啤酒。授予一枚印章。\n— Wszebor",
        2: "婚礼收到了木板、木炭和啤酒。运输安排妥当，授予两枚印章。\n— Wszebor",
        3: "婚礼收到了木板、木炭和啤酒。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "婚礼开始了，物资还未送齐。增加木材来源，供应两个工坊。\n— Wszebor",
    },
    ar: {
      opening: "اقترب العرس. نحتاج 36 لوحًا و8 وحدات فحم نباتي و26 جعة. انقل الحبوب إلى دار التمليت والمالت إلى دار الجعة. المنشرة والمفحمة تتقاسمان حطابًا واحدًا، فإذا أخذت إحداهما الخشب توقفت الأخرى. زد الخشب والعربات.\n— Wszebor",
      won: {
        1: "وصلت الألواح والفحم والجعة إلى العرس. ختم واحد؛ وفّر الخشب للورشتين معًا.\n— Wszebor",
        2: "وصلت الألواح والفحم والجعة إلى العرس. ختمان لتنظيم الرحلات بإحكام.\n— Wszebor",
        3: "وصلت الألواح والفحم والجعة إلى العرس. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "بدأ العرس قبل وصول البضائع. زد مصدر الخشب لتخدم المنشرة والمفحمة معًا.\n— Wszebor",
    },
    hi: {
      opening: "शादी निकट है। 36 तख्ते, 8 लकड़ी का कोयला और 26 बियर चाहिए। अनाज माल्ट-घर और माल्ट शराब-भट्टी तक पहुँचे। आरा-मिल और कोयला-भट्टी एक ही लकड़हारे पर निर्भर हैं; एक लकड़ी ले तो दूसरा रुकता है। लकड़ी और गाड़ियों की आपूर्ति बढ़ाओ।\n— Wszebor",
      won: {
        1: "शादी के लिए तख्ते, कोयला और बियर पहुँचे। एक मुहर; दोनों कार्यशालाओं को पर्याप्त लकड़ी दो।\n— Wszebor",
        2: "शादी के लिए तख्ते, कोयला और बियर पहुँचे। सुव्यवस्थित फेरों के लिए दो मुहरें।\n— Wszebor",
        3: "शादी के लिए तख्ते, कोयला और बियर पहुँचे। उत्तम तैयारी के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "शादी से पहले पूरा माल नहीं पहुँचा। दोनों कार्यशालाओं के लिए लकड़ी का दूसरा स्रोत बनाओ।\n— Wszebor",
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
    ko: {
      opening: "대장장이에게 숯이, 목수들에게 판자가 필요하다. 판자 48개와 숯 8개를 보내라. 제재소와 숯가마에 벌목꾼이 한 명뿐이라 모두에게 부족하다. 벌목꾼을 한 명 더 두어라. 수레를 늘려도 나무는 더 생기지 않는다.\n— Wszebor",
      won: {
        1: "작업장에 판자와 숯이 도착했다.인장 하나다.\n— Wszebor",
        2: "작업장에 판자와 숯이 도착했다.잘 정돈한 운송에 인장 둘을 준다.\n— Wszebor",
        3: "작업장에 판자와 숯이 도착했다.훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "숯가마가 제재소의 나무를 써 버렸다. 수레 대신 벌목꾼을 한 명 더 두어라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "铁匠等木炭，木匠等木板：需要48份木板和8份木炭。锯木厂与炭窑只有一名伐木工，无法兼顾。再建一间伐木屋；增加马车并不能砍出更多木头。\n— Wszebor",
      won: {
        1: "工坊收到了木板与木炭。授予一枚印章。\n— Wszebor",
        2: "工坊收到了木板与木炭。运输安排妥当，授予两枚印章。\n— Wszebor",
        3: "工坊收到了木板与木炭。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "炭窑耗尽了锯木厂要用的木材。应增加伐木工，而不是更多马车。\n— Wszebor",
    },
    ar: {
      opening: "ينتظر الحداد الفحم والنجارون الألواح: نحتاج 48 لوحًا و8 وحدات فحم نباتي. المنشرة والمفحمة تعتمدان على حطاب واحد لا يكفيهما. ابنِ كوخ حطاب ثانٍ؛ زيادة العربات لا تقطع الأشجار.\n— Wszebor",
      won: {
        1: "وصلت الألواح والفحم إلى الورش. ختم واحد؛ أضف حطابًا ثانيًا، لا عربات فقط.\n— Wszebor",
        2: "وصلت الألواح والفحم إلى الورش. ختمان لتنظيم الرحلات بإحكام.\n— Wszebor",
        3: "وصلت الألواح والفحم إلى الورش. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "استهلكت المفحمة خشب المنشرة. ابنِ حطابًا ثانيًا؛ العربات الإضافية لا تنتج خشبًا.\n— Wszebor",
    },
    hi: {
      opening: "लोहार को कोयला, बढ़इयों को तख्ते चाहिए: 48 तख्ते और 8 लकड़ी का कोयला। आरा-मिल और कोयला-भट्टी एक ही लकड़हारे पर चलते हैं, जो दोनों के लिए पर्याप्त नहीं। दूसरा लकड़हारा बनाओ; अधिक गाड़ियाँ पेड़ नहीं काटतीं।\n— Wszebor",
      won: {
        1: "कारीगरों तक तख्ते और कोयला पहुँचे। एक मुहर; गाड़ियाँ नहीं, एक और लकड़हारा बढ़ाओ।\n— Wszebor",
        2: "कारीगरों तक तख्ते और कोयला पहुँचे। सुव्यवस्थित फेरों के लिए दो मुहरें।\n— Wszebor",
        3: "कारीगरों तक तख्ते और कोयला पहुँचे। उत्तम तैयारी के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "कोयला-भट्टी ने आरा-मिल की लकड़ी खर्च कर दी। दूसरी लकड़हारा झोंपड़ी बनाओ, सिर्फ़ गाड़ियाँ नहीं।\n— Wszebor",
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
        2: "An extra wagon helped the malthouse, though some journeys still waited. Two seals; a long road needs more wagons.\n— Wszebor",
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
    ko: {
      opening: "겨울을 나려면 성에 맥주 22단위가 필요하다. 곡물은 서쪽 밭에 나고 제맥소는 먼 동쪽에 있다. 수레 세 대가 농장, 제맥소, 양조장, 성을 맡는다. 곡물이 기다리는데 모든 수레가 바쁘다면 마구간에서 수레를 더 사라.\n— Wszebor",
      won: {
        1: "맥주가 성에 도착했다.인장 하나다.\n— Wszebor",
        2: "맥주가 성에 도착했다.잘 정돈한 운송에 인장 둘을 준다.\n— Wszebor",
        3: "맥주가 성에 도착했다.훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "마지막 통이 오기 전에 겨울이 왔다. 곡물이 기다리고 수레가 바쁘다면 수레를 더 사라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "城堡过冬需22份啤酒。谷物种在西边，制麦坊却远在东边。三辆马车要同时服务农场、制麦坊、酒坊与城堡。若谷物仍堆在田里，车却全忙，就去马厩增购马车。\n— Wszebor",
      won: {
        1: "啤酒送达城堡。授予一枚印章。\n— Wszebor",
        2: "啤酒送达城堡。运输安排妥当，授予两枚印章。\n— Wszebor",
        3: "啤酒送达城堡。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "冬天到了，最后一桶酒仍在路上。谷物等待时若马车全忙，就添置马车。\n— Wszebor",
    },
    ar: {
      opening: "تحتاج القلعة للشتاء إلى 22 وحدة جعة. تنمو الحبوب في الغرب ودار التمليت بعيدة في الشرق. ثلاث عربات تخدم المزرعة والتمليت والمخمرة والقلعة. إذا انشغلت العربات كلها وبقيت الحبوب في الحقل، فاشترِ عربات من الإسطبل.\n— Wszebor",
      won: {
        1: "وصلت الجعة إلى القلعة. ختم واحد؛ اشترِ عربات إضافية للطريق الطويل.\n— Wszebor",
        2: "وصلت الجعة إلى القلعة. ختمان لتنظيم الرحلات بإحكام.\n— Wszebor",
        3: "وصلت الجعة إلى القلعة. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "حلّ الشتاء قبل آخر برميل. إذا انتظرت الحبوب وانشغلت كل العربات، فاشترِ غيرها.\n— Wszebor",
    },
    hi: {
      opening: "सर्दियों के लिए किले को 22 इकाई बियर चाहिए। अनाज पश्चिम में उगता है, माल्ट-घर दूर पूर्व में है। तीन गाड़ियाँ खेत, माल्ट-घर, शराब-भट्टी और किले के बीच चलती हैं। अनाज खेत में रुका हो और सारी गाड़ियाँ व्यस्त हों तो अस्तबल से और गाड़ियाँ खरीदो।\n— Wszebor",
      won: {
        1: "बियर किले तक पहुँच गई। एक मुहर; लंबी यात्रा के लिए और गाड़ियाँ खरीदो।\n— Wszebor",
        2: "बियर किले तक पहुँच गई। सुव्यवस्थित फेरों के लिए दो मुहरें।\n— Wszebor",
        3: "बियर किले तक पहुँच गई। उत्तम तैयारी के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "आख़िरी पीपा आने से पहले सर्दी आ गई। अनाज रुका हो और गाड़ियाँ व्यस्त हों तो और खरीदो।\n— Wszebor",
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
    ko: {
      opening: "대규모 양조에는 빵 40개와 맥주 48단위를 세 번에 나눠 보내야 한다. 6:00까지 빵 32개, 9:00까지 빵 8개와 맥주 12, 12:00까지 맥주 36이다. 성은 현재 납품분만 받는다. 작은 창고가 곡물로 가득하니 길에서 두 칸 떨어진 큰 창고를 연결해 맥주를 보관하라.\n— Wszebor",
      won: {
        1: "세 차례 납품을 모두 마쳤다.인장 하나다.\n— Wszebor",
        2: "세 차례 납품을 모두 마쳤다.잘 정돈한 운송에 인장 둘을 준다.\n— Wszebor",
        3: "세 차례 납품을 모두 마쳤다.훌륭한 대비에 인장 셋을 준다.\n— Wszebor",
      },
      lost: "마지막 기한이 지났다. 창고가 가득 차 양조장이 멈췄다. 큰 창고를 더 일찍 연결하라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "大规模酿造需要分三批送40条面包和48份啤酒：6:00前送32条面包；9:00前送8条面包及12份啤酒；12:00前送36份啤酒。城堡一次只收当前批次。小粮仓已满，尽快接通离道路两格的大粮仓来存酒。\n— Wszebor",
      won: {
        1: "三批货物已全部交付。授予一枚印章。\n— Wszebor",
        2: "三批货物已全部交付。运输安排妥当，授予两枚印章。\n— Wszebor",
        3: "三批货物已全部交付。筹划周详，授予三枚印章。\n— Wszebor",
      },
      lost: "最终期限已过。仓库满载令酒坊停产。应更早接通大粮仓。\n— Wszebor",
    },
    ar: {
      opening: "للتخمير الكبير نحتاج 40 رغيفًا و48 وحدة جعة في ثلاث دفعات: 32 رغيفًا حتى 6:00؛ ثم 8 أرغفة و12 جعة حتى 9:00؛ ثم 36 جعة حتى 12:00. القلعة تقبل الدفعة الحالية فقط. المخزن الصغير ممتلئ؛ أوصل المخزن الكبير، على بعد خانتين من الطريق، لحفظ الجعة.\n— Wszebor",
      won: {
        1: "اكتملت الدفعات الثلاث. ختم واحد؛ أوصل المخزن الكبير قبل امتلاء المخمرة.\n— Wszebor",
        2: "اكتملت الدفعات الثلاث. ختمان لتنظيم الرحلات بإحكام.\n— Wszebor",
        3: "اكتملت الدفعات الثلاث. ثلاثة أختام لحسن التدبير.\n— Wszebor",
      },
      lost: "انتهى الموعد الأخير، وتوقفت المخمرة لامتلاء المخزن. أوصل المخزن الكبير في وقت أبكر.\n— Wszebor",
    },
    hi: {
      opening: "बड़े मद्य-निर्माण के लिए तीन खेप में 40 रोटियाँ और 48 बियर चाहिए: 6:00 तक 32 रोटियाँ, 9:00 तक 8 रोटियाँ और 12 बियर, फिर 12:00 तक 36 बियर। किला सिर्फ़ मौजूदा खेप लेता है। छोटा भंडार अनाज से भरा है; रास्ते से दो खाने दूर बड़े भंडार को जोड़कर बियर रखो।\n— Wszebor",
      won: {
        1: "तीनों आपूर्तियाँ पूरी हो गईं। एक मुहर; भट्टी भरने से पहले बड़े भंडार को जोड़ो।\n— Wszebor",
        2: "तीनों आपूर्तियाँ पूरी हो गईं। सुव्यवस्थित फेरों के लिए दो मुहरें।\n— Wszebor",
        3: "तीनों आपूर्तियाँ पूरी हो गईं। उत्तम तैयारी के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "अंतिम समय बीत गया। भरे भंडार ने भट्टी रोक दी। बड़े भंडार को पहले ही सड़क से जोड़ो।\n— Wszebor",
    },
  },
  m13: {
    pl: {
      opening: "Zamek prosi o 24 deski i 16 bochenków przed 10:00. Spichlerz jest pełen drewna i zboża, tartak, młyn i piekarnia czekają przy trakcie — ale na całą marchię jest jeden wóz. Gdy warsztaty stoją, a „Dlaczego stoi?” mówi, że wszystkie wozy są zajęte, kup wozy w stajni.\n— Wszebor",
      won: {
        1: "Deski i chleb dotarły, choć warsztaty długo czekały na jeden wóz. Jedna pieczęć; kup wozy, gdy tylko wszystkie są zajęte.\n— Wszebor",
        2: "Zamówienie dotarło przed terminem. Dwie pieczęcie; przy trzech warsztatach jeden dodatkowy wóz to wciąż za mało.\n— Wszebor",
        3: "Wozy kursowały bez przestoju, a warsztaty pracowały ze spichlerza. Trzy pieczęcie za szybkie odczytanie przyczyny.\n— Wszebor",
      },
      lost: "Termin minął, a zapas wciąż leżał w spichlerzu. Jeden wóz nie obsłuży trzech warsztatów — kup wozy w stajni.\n— Wszebor",
    },
    en: {
      opening: "The castle asks for 24 planks and 16 loaves before 10:00. The granary is full of wood and grain, the sawmill, mill and bakery wait by the road — but the whole march has one wagon. When the workshops stand and \"Why is it stalled?\" says every wagon is busy, buy wagons at the stable.\n— Wszebor",
      won: {
        1: "Planks and bread arrived, though the workshops waited long for the one wagon. One seal; buy wagons as soon as all are busy.\n— Wszebor",
        2: "The order arrived before the deadline. Two seals; for three workshops one extra wagon is still too few.\n— Wszebor",
        3: "The wagons never stopped and the workshops worked from the granary. Three seals for reading the cause quickly.\n— Wszebor",
      },
      lost: "The deadline passed with the stock still in the granary. One wagon cannot serve three workshops — buy wagons at the stable.\n— Wszebor",
    },
    de: {
      opening: "Die Burg verlangt 24 Bretter und 16 Brote bis 10:00. Der Speicher ist voll Holz und Getreide, Sägewerk, Mühle und Bäckerei warten am Weg — doch die ganze Mark hat nur einen Wagen. Stehen die Werkstätten und sagt „Warum?“, dass alle Wagen unterwegs sind, kauft Wagen im Stall.\n— Wszebor",
      won: {
        1: "Bretter und Brot kamen an, doch die Werkstätten warteten lange auf den einen Wagen. Ein Siegel; kauft Wagen, sobald alle unterwegs sind.\n— Wszebor",
        2: "Die Lieferung kam vor der Frist. Zwei Siegel; für drei Werkstätten ist ein zusätzlicher Wagen zu wenig.\n— Wszebor",
        3: "Die Wagen standen nie still, die Werkstätten arbeiteten aus dem Speicher. Drei Siegel für den schnellen Blick.\n— Wszebor",
      },
      lost: "Die Frist verstrich, der Vorrat lag noch im Speicher. Ein Wagen bedient keine drei Werkstätten — kauft Wagen im Stall.\n— Wszebor",
    },
    fr: {
      opening: "Le château demande 24 planches et 16 pains avant 10:00. Le grenier est plein de bois et de grain ; scierie, moulin et boulangerie attendent au bord de la route — mais toute la marche n'a qu'un chariot. Quand les ateliers s'arrêtent et que « Pourquoi ? » dit que tous les chariots sont pris, achetez-en à l'écurie.\n— Wszebor",
      won: {
        1: "Planches et pains sont arrivés, mais les ateliers ont longtemps attendu l'unique chariot. Un sceau ; achetez des chariots dès qu'ils sont tous pris.\n— Wszebor",
        2: "La commande est arrivée avant l'échéance. Deux sceaux ; pour trois ateliers, un chariot de plus ne suffit pas.\n— Wszebor",
        3: "Les chariots n'ont jamais chômé et les ateliers ont puisé dans le grenier. Trois sceaux pour avoir vu la cause si vite.\n— Wszebor",
      },
      lost: "L'échéance est passée, le stock dort encore au grenier. Un chariot ne sert pas trois ateliers : achetez-en à l'écurie.\n— Wszebor",
    },
    es: {
      opening: "El castillo pide 24 tablones y 16 hogazas antes de las 10:00. El granero está lleno de madera y grano; aserradero, molino y panadería esperan junto al camino, pero toda la marca tiene un solo carro. Si los talleres se paran y «¿Por qué?» dice que todos los carros están ocupados, compra carros en el establo.\n— Wszebor",
      won: {
        1: "Llegaron tablones y pan, aunque los talleres esperaron mucho al único carro. Un sello; compra carros en cuanto todos estén ocupados.\n— Wszebor",
        2: "El pedido llegó antes del plazo. Dos sellos; para tres talleres un carro más aún es poco.\n— Wszebor",
        3: "Los carros no pararon y los talleres trabajaron desde el granero. Tres sellos por leer tan pronto la causa.\n— Wszebor",
      },
      lost: "Venció el plazo con las existencias aún en el granero. Un carro no basta para tres talleres: compra carros en el establo.\n— Wszebor",
    },
    it: {
      opening: "Il castello chiede 24 assi e 16 pagnotte entro le 10:00. Il granaio è pieno di legna e grano; segheria, mulino e forno aspettano lungo la strada, ma l'intera marca ha un solo carro. Se le botteghe si fermano e «Perché?» dice che tutti i carri sono occupati, compra carri alla stalla.\n— Wszebor",
      won: {
        1: "Assi e pane sono arrivati, ma le botteghe hanno atteso a lungo l'unico carro. Un sigillo; compra carri appena sono tutti occupati.\n— Wszebor",
        2: "L'ordine è arrivato prima della scadenza. Due sigilli; per tre botteghe un carro in più è ancora poco.\n— Wszebor",
        3: "I carri non si sono mai fermati e le botteghe hanno attinto al granaio. Tre sigilli per aver letto subito la causa.\n— Wszebor",
      },
      lost: "La scadenza è passata con la scorta ancora nel granaio. Un carro non serve tre botteghe: compra carri alla stalla.\n— Wszebor",
    },
    "pt-BR": {
      opening: "O castelo pede 24 tábuas e 16 pães até 10:00. O celeiro está cheio de madeira e grãos; serraria, moinho e padaria esperam junto à estrada, mas a marca inteira tem uma só carroça. Se as oficinas pararem e \"Por quê?\" disser que todas as carroças estão ocupadas, compre carroças no estábulo.\n— Wszebor",
      won: {
        1: "Tábuas e pão chegaram, mas as oficinas esperaram muito pela única carroça. Um selo; compre carroças assim que todas estiverem ocupadas.\n— Wszebor",
        2: "O pedido chegou antes do prazo. Dois selos; para três oficinas, uma carroça a mais ainda é pouco.\n— Wszebor",
        3: "As carroças nunca pararam e as oficinas trabalharam com o celeiro. Três selos por ler a causa tão rápido.\n— Wszebor",
      },
      lost: "O prazo acabou com o estoque ainda no celeiro. Uma carroça não atende três oficinas: compre carroças no estábulo.\n— Wszebor",
    },
    nl: {
      opening: "Het kasteel vraagt 24 planken en 16 broden vóór 10:00. De schuur zit vol hout en graan; zagerij, molen en bakkerij wachten langs de weg, maar de hele mark heeft één wagen. Staan de werkplaatsen stil en zegt \"Waarom?\" dat alle wagens bezet zijn, koop dan wagens bij de stal.\n— Wszebor",
      won: {
        1: "Planken en brood kwamen aan, al wachtten de werkplaatsen lang op die ene wagen. Eén zegel; koop wagens zodra ze allemaal bezet zijn.\n— Wszebor",
        2: "De bestelling kwam vóór de termijn. Twee zegels; voor drie werkplaatsen is één extra wagen nog te weinig.\n— Wszebor",
        3: "De wagens stonden nooit stil en de werkplaatsen werkten uit de schuur. Drie zegels voor het snel lezen van de oorzaak.\n— Wszebor",
      },
      lost: "De termijn verstreek terwijl de voorraad nog in de schuur lag. Eén wagen bedient geen drie werkplaatsen: koop wagens bij de stal.\n— Wszebor",
    },
    sv: {
      opening: "Borgen begär 24 plankor och 16 bröd före 10:00. Magasinet är fullt av ved och säd; sågverk, kvarn och bageri väntar vid vägen, men hela marken har en enda vagn. När verkstäderna står och \"Varför?\" säger att alla vagnar är upptagna, köp vagnar i stallet.\n— Wszebor",
      won: {
        1: "Plankor och bröd kom fram, men verkstäderna väntade länge på den enda vagnen. Ett sigill; köp vagnar så snart alla är upptagna.\n— Wszebor",
        2: "Beställningen kom före fristen. Två sigill; för tre verkstäder räcker inte en vagn till.\n— Wszebor",
        3: "Vagnarna stod aldrig still och verkstäderna arbetade ur magasinet. Tre sigill för att du såg orsaken så snabbt.\n— Wszebor",
      },
      lost: "Fristen gick ut medan förrådet låg kvar i magasinet. En vagn räcker inte för tre verkstäder – köp vagnar i stallet.\n— Wszebor",
    },
    tr: {
      opening: "Kale 10:00'dan önce 24 kalas ve 16 somun istiyor. Ambar odun ve tahılla dolu; hızar, değirmen ve fırın yol kenarında bekliyor, ama bütün uç beyliğinde tek bir araba var. Atölyeler durur ve \"Neden?\" bütün arabaların meşgul olduğunu söylerse ahırdan araba satın al.\n— Wszebor",
      won: {
        1: "Kalaslar ve ekmek geldi, ama atölyeler tek arabayı uzun süre bekledi. Bir mühür; hepsi meşgul olunca hemen araba al.\n— Wszebor",
        2: "Sipariş süreden önce geldi. İki mühür; üç atölye için bir araba daha hâlâ az.\n— Wszebor",
        3: "Arabalar hiç durmadı, atölyeler ambardan çalıştı. Nedeni çabuk okuduğun için üç mühür.\n— Wszebor",
      },
      lost: "Süre doldu, stok hâlâ ambarda. Tek araba üç atölyeye yetmez; ahırdan araba satın al.\n— Wszebor",
    },
    ru: {
      opening: "Замок просит 24 доски и 16 караваев до 10:00. Амбар полон дров и зерна, лесопилка, мельница и пекарня ждут у дороги — но на всю марку одна телега. Если мастерские стоят, а «Почему?» говорит, что все телеги заняты, купи телеги в конюшне.\n— Wszebor",
      won: {
        1: "Доски и хлеб доставлены, но мастерские долго ждали единственную телегу. Одна печать; покупай телеги, как только все заняты.\n— Wszebor",
        2: "Заказ прибыл до срока. Две печати; для трёх мастерских одной лишней телеги мало.\n— Wszebor",
        3: "Телеги не простаивали, мастерские работали из амбара. Три печати за то, что быстро увидел причину.\n— Wszebor",
      },
      lost: "Срок прошёл, а запас так и лежит в амбаре. Одна телега не обслужит три мастерские — купи телеги в конюшне.\n— Wszebor",
    },
    uk: {
      opening: "Замок просить 24 дошки й 16 хлібин до 10:00. Комора повна дров і зерна, тартак, млин і пекарня чекають біля шляху — але на всю марку один віз. Коли майстерні стоять, а «Чому?» каже, що всі вози зайняті, купи вози в стайні.\n— Wszebor",
      won: {
        1: "Дошки й хліб прибули, та майстерні довго чекали на єдиний віз. Одна печатка; купуй вози, щойно всі зайняті.\n— Wszebor",
        2: "Замовлення прибуло до строку. Дві печатки; для трьох майстерень одного зайвого воза замало.\n— Wszebor",
        3: "Вози не стояли, майстерні працювали з комори. Три печатки за те, що швидко побачив причину.\n— Wszebor",
      },
      lost: "Строк минув, а запас досі в коморі. Один віз не обслужить три майстерні — купи вози в стайні.\n— Wszebor",
    },
    ja: {
      opening: "城は10:00までに板24枚とパン16個を求めている。倉には木材と穀物が満ち、製材所・粉ひき所・パン屋は街道沿いで待っている。だが辺境全体に荷車は一台きりだ。工房が止まり「なぜ？」が荷車はすべて出払っていると告げたら、厩舎で荷車を買え。\n— Wszebor",
      won: {
        1: "板とパンは届いたが、工房は一台の荷車を長く待った。印章一つ。荷車がすべて出払ったらすぐ買え。\n— Wszebor",
        2: "注文は期限前に届いた。印章二つ。三つの工房には荷車一台の追加ではまだ足りない。\n— Wszebor",
        3: "荷車は止まらず、工房は倉から働き続けた。原因を素早く読んだ褒美に印章三つ。\n— Wszebor",
      },
      lost: "期限が過ぎ、蓄えは倉に残ったままだ。荷車一台で三つの工房はまかなえない。厩舎で荷車を買え。\n— Wszebor",
    },
    ko: {
      opening: "성은 10:00까지 판자 24개와 빵 16개를 원한다. 곡간에는 나무와 곡식이 가득하고 제재소, 방앗간, 빵집은 길가에서 기다린다. 그러나 변경 전체에 수레는 한 대뿐이다. 작업장이 멈추고 \"왜?\"가 모든 수레가 바쁘다고 하면 마구간에서 수레를 사라.\n— Wszebor",
      won: {
        1: "판자와 빵이 도착했지만 작업장들은 한 대뿐인 수레를 오래 기다렸다. 인장 하나. 수레가 모두 바쁘면 바로 사라.\n— Wszebor",
        2: "주문이 기한 전에 도착했다. 인장 둘. 작업장 셋에는 수레 한 대 추가로는 아직 부족하다.\n— Wszebor",
        3: "수레는 쉬지 않았고 작업장은 곡간에서 일했다. 원인을 빨리 읽은 공으로 인장 셋.\n— Wszebor",
      },
      lost: "기한이 지났는데 비축은 아직 곡간에 있다. 수레 한 대로는 작업장 셋을 감당할 수 없다. 마구간에서 수레를 사라.\n— Wszebor",
    },
    "zh-Hans": {
      opening: "城堡要求在10:00前送来24块木板和16个面包。粮仓里堆满木材和谷物，锯木坊、磨坊和面包坊都在路边等候——但整个边区只有一辆马车。工坊停工、“为什么？”显示所有马车都在忙时，就去马厩买马车。\n— Wszebor",
      won: {
        1: "木板和面包送到了，但工坊久等那唯一的马车。一枚印章；马车全忙时就该立刻添置。\n— Wszebor",
        2: "订单在期限前送达。两枚印章；三个工坊只多一辆马车仍嫌不够。\n— Wszebor",
        3: "马车从未停歇，工坊靠粮仓不断开工。迅速看清原因，授予三枚印章。\n— Wszebor",
      },
      lost: "期限已过，存货仍躺在粮仓里。一辆马车顾不上三个工坊——去马厩买马车。\n— Wszebor",
    },
    ar: {
      opening: "تطلب القلعة 24 لوحًا و16 رغيفًا قبل 10:00. المخزن ممتلئ بالخشب والحبوب، والمنشرة والمطحنة والمخبز تنتظر عند الطريق، لكن للمقاطعة كلها عربة واحدة. إذا توقفت الورش وقال «لماذا؟» إن كل العربات مشغولة، فاشترِ عربات من الإسطبل.\n— Wszebor",
      won: {
        1: "وصلت الألواح والخبز، لكن الورش انتظرت العربة الوحيدة طويلًا. ختم واحد؛ اشترِ عربات حين تنشغل كلها.\n— Wszebor",
        2: "وصل الطلب قبل الموعد. ختمان؛ عربة إضافية واحدة لا تكفي ثلاث ورش.\n— Wszebor",
        3: "لم تتوقف العربات، وعملت الورش من المخزن. ثلاثة أختام لقراءة السبب بسرعة.\n— Wszebor",
      },
      lost: "مضى الموعد والمخزون ما زال في المخزن. عربة واحدة لا تخدم ثلاث ورش؛ اشترِ عربات من الإسطبل.\n— Wszebor",
    },
    hi: {
      opening: "किला 10:00 से पहले 24 तख़्ते और 16 रोटियाँ माँगता है। भंडार लकड़ी और अनाज से भरा है; आरा-मिल, चक्की और बेकरी सड़क किनारे इंतज़ार में हैं — पर पूरे सीमांत में एक ही गाड़ी है। कारख़ाने रुकें और \"क्यों?\" बताए कि सारी गाड़ियाँ व्यस्त हैं, तो अस्तबल से गाड़ियाँ खरीदो।\n— Wszebor",
      won: {
        1: "तख़्ते और रोटी पहुँच गए, पर कारख़ाने एक गाड़ी की लंबी राह देखते रहे। एक मुहर; सब व्यस्त हों तो तुरंत गाड़ियाँ खरीदो।\n— Wszebor",
        2: "माल समय से पहले पहुँचा। दो मुहरें; तीन कारख़ानों के लिए एक और गाड़ी अब भी कम है।\n— Wszebor",
        3: "गाड़ियाँ कभी नहीं रुकीं, कारख़ाने भंडार से चलते रहे। कारण जल्दी पढ़ने के लिए तीन मुहरें।\n— Wszebor",
      },
      lost: "समय बीत गया और माल अब भी भंडार में है। एक गाड़ी तीन कारख़ाने नहीं चला सकती — अस्तबल से गाड़ियाँ खरीदो।\n— Wszebor",
    },
  },
} as const satisfies Record<ContractMissionId, Record<Lang, ContractLetterSet>>;

/** Get all variants for a known contract; no letters exist for sandbox. */
export function getContractLetters(missionId: string, lang: Lang = getLang()): ContractLetterSet | null {
  if (!Object.prototype.hasOwnProperty.call(CONTRACT_LETTERS, missionId)) return null;
  // All supported languages have authored letters; never fall back to English.
  return CONTRACT_LETTERS[missionId as ContractMissionId][lang];
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
