// ─── GROUP STAGE MATCH INSIGHTS ──────────────────────────────────────────────
// Pre-written insights for all 72 group stage matches
// Key format: "Home||Away"

const GROUP_INSIGHTS = {

  // ── GROUP A ──────────────────────────────────────────────────────────────────
  "Mexico||South Africa": {
    h: 2, a: 0,
    insight: "Mexico enter as clear favourites on home soil with the backing of a passionate Azteca crowd. They've qualified for every World Cup since 1950 and their CONCACAF form has been dominant. South Africa, making only their second ever World Cup appearance, will rely on physicality and set pieces but lack the technical quality to trouble a Mexican side buoyed by home advantage.",
    key: "Mexico's home crowd creates an intense atmosphere South Africa won't be used to.",
    confidence: "High"
  },
  "South Korea||Czechia": {
    h: 1, a: 1,
    insight: "A fascinating tactical battle between South Korea's relentless pressing and Czechia's disciplined European structure. South Korea's K-League core is now supplemented by several Bundesliga players, giving them real quality. Czechia have been quietly impressive in qualification with Patrik Schick leading the line. Expect a tight, competitive match.",
    key: "Schick's finishing vs South Korea's high press — whoever controls the midfield wins.",
    confidence: "Medium"
  },
  "Czechia||South Africa": {
    h: 2, a: 0,
    insight: "Czechia's technical quality and European top-flight experience should prove too much for South Africa in this must-see clash. South Africa will be organised defensively but Czechia's combination play through midfield should eventually find gaps. A comfortable Czech victory looks likely as South Africa struggle to create chances.",
    key: "Czechia's midfield depth — Soucek and Kuchta should dominate possession.",
    confidence: "High"
  },
  "Mexico||South Korea": {
    h: 2, a: 1,
    insight: "Both sides need points in this pivotal match. Mexico's forward line is potent at home but South Korea's press can unsettle even top sides, as they showed against Germany in 2018. Expect Mexico to edge it with home advantage, though South Korea's pace on the counter will create danger.",
    key: "Son Heung-min's impact on transition — Mexico must contain their wings.",
    confidence: "Medium"
  },
  "Czechia||Mexico": {
    h: 0, a: 2,
    insight: "With qualification likely decided by this point, Mexico have the edge in quality and motivation. Czechia may have one eye on rest if they've already qualified. Mexico's attacking depth means they should control this match and secure top spot in the group.",
    key: "Mexico's depth — they can rotate and still have enough quality to win.",
    confidence: "Medium"
  },
  "South Africa||South Korea": {
    h: 0, a: 2,
    insight: "South Korea need points to advance and South Africa have struggled to create throughout the tournament. Son Heung-min and the Korean attack should prove too much for a South African side lacking confidence after earlier results. Korea's fitness levels and pressing intensity typically excel in final group games.",
    key: "South Korea's superior fitness and desire for qualification drives this result.",
    confidence: "High"
  },

  // ── GROUP B ──────────────────────────────────────────────────────────────────
  "Canada||Bosnia-Herzegovina": {
    h: 2, a: 1,
    insight: "Canada's first World Cup since 1986 is a massive occasion, and they've shown tremendous growth with Alphonso Davies and Jonathan David leading the attack. Bosnia-Herzegovina are technically gifted but their defensive record in qualification was inconsistent. Canada's home-nation enthusiasm and pace should edge this.",
    key: "Alphonso Davies's pace vs Bosnia's ageing defence — a key matchup.",
    confidence: "Medium"
  },
  "Qatar||Switzerland": {
    h: 0, a: 3,
    insight: "Qatar's 2022 home World Cup exposed significant limitations against top European opposition. Switzerland are one of the most consistent teams in Europe — unbeaten in their last 12 qualifying matches. Granit Xhaka's experience and Embolo's finishing should make this comfortable for the Swiss.",
    key: "Switzerland's tactical organisation vs Qatar's lack of top-level experience.",
    confidence: "High"
  },
  "Switzerland||Bosnia-Herzegovina": {
    h: 2, a: 0,
    insight: "Two technically solid European sides but Switzerland's consistency at major tournaments gives them the edge. They've never lost a group game at the World Cup since 2010. Bosnia struggle against organised defences and Switzerland will happily sit deep and counter effectively.",
    key: "Switzerland's defensive solidity — they rarely concede in the first half of tournaments.",
    confidence: "High"
  },
  "Canada||Qatar": {
    h: 3, a: 0,
    insight: "Canada should cruise this match. Qatar's squad is built for desert conditions and their experience in international football is limited. Canada's energy and pace will overwhelm a Qatari side whose confidence is already dented. Jonathan David in particular is clinical against lower-ranked opposition.",
    key: "Jonathan David's finishing — he's lethal in front of goal and Qatar can't contain him.",
    confidence: "High"
  },
  "Switzerland||Canada": {
    h: 1, a: 1,
    insight: "Two of the group's strongest sides meeting in a potential group decider. Switzerland's experience at major tournaments is unmatched in this group but Canada's hunger and pace make them dangerous. Expect a tight, tactical game where both sides are cautious of losing to the other.",
    key: "A cautious tactical battle — neither side wants to give too much away.",
    confidence: "Medium"
  },
  "Bosnia-Herzegovina||Qatar": {
    h: 2, a: 0,
    insight: "Bosnia need a win to have any hope of advancing and Qatar have shown they struggle against physical European sides. Edin Dzeko's experience and Bosnia's attacking talent should be enough to secure three points, even if the performance isn't convincing.",
    key: "Bosnia's desperation for points should overcome Qatar's defensive caution.",
    confidence: "High"
  },

  // ── GROUP C ──────────────────────────────────────────────────────────────────
  "Brazil||Morocco": {
    h: 2, a: 0,
    insight: "Brazil are always tournament favourites and this squad has extraordinary depth. Morocco are genuinely dangerous — their 2022 semi-final run proved that — but Brazil's individual quality is simply superior. Vinicius Jr., Rodrygo, and Raphinha give Brazil width that Morocco will struggle to contain.",
    key: "Brazil's right side — Morocco's left flank will be tested throughout.",
    confidence: "High"
  },
  "Haiti||Scotland": {
    h: 0, a: 2,
    insight: "Scotland's dramatic qualification campaign saw them peak at just the right time. Haiti, despite surprising results in CONCACAF qualifying, lack the quality to compete with a physically strong Scottish side. Scotland's set piece prowess should be the difference in this relatively comfortable victory.",
    key: "Scotland's aerial threat from set pieces — Haiti struggled defending these in qualifying.",
    confidence: "High"
  },
  "Scotland||Morocco": {
    h: 1, a: 2,
    insight: "Morocco's fluid attacking football will pose problems for Scotland's direct style. Achraf Hakimi overlapping from right back creates overloads Scotland's left side can't handle. Scotland will be competitive and make Morocco work, but Morocco's quality in the final third should tell.",
    key: "Morocco's width through Hakimi and Mazraoui vs Scotland's defensive shape.",
    confidence: "Medium"
  },
  "Brazil||Haiti": {
    h: 4, a: 0,
    insight: "An opportunity for Brazil to rest key players and still win comfortably. Haiti have no answer to Brazil's attacking talent at any level. Expect Vinicius Jr. to terrorise the Haiti defence and Brazil to score freely while barely breaking a sweat.",
    key: "Brazil's rotation — even their depth is too much for Haiti's limited squad.",
    confidence: "High"
  },
  "Scotland||Brazil": {
    h: 0, a: 3,
    insight: "Scotland will make this difficult for a while but Brazil's quality eventually shines through. Scotland's compact defensive shape delays but doesn't prevent. Once Brazil find their rhythm, their movement and technical superiority creates chances at will. Scotland's counter-attack threat keeps them in it briefly but Brazil pull away.",
    key: "Brazil's patience — they're happy to probe until the defence opens up.",
    confidence: "High"
  },
  "Morocco||Haiti": {
    h: 3, a: 0,
    insight: "Morocco's quality is simply in a different league to Haiti. Sofiane Boufal's creativity and Youssef En-Nesyri's finishing should open Haiti up with relative ease. Morocco will want to finish the group in style and this is the perfect opportunity.",
    key: "Morocco's attacking creativity vs Haiti's organised but limited defence.",
    confidence: "High"
  },

  // ── GROUP D ──────────────────────────────────────────────────────────────────
  "USA||Paraguay": {
    h: 2, a: 1,
    insight: "The USA on home soil with Pulisic, Reyna, and Weah is a genuinely dangerous proposition. Paraguay are physical and well-organised but their quality doesn't match the American firepower. The electric atmosphere at a packed US stadium will lift the home side from the first whistle.",
    key: "Christian Pulisic's influence — he elevates the USA to another level when fit.",
    confidence: "High"
  },
  "Australia||Turkey": {
    h: 1, a: 1,
    insight: "Two sides with genuine quality and something to prove. Australia's 2022 World Cup run built confidence and Turkey's technical players can hurt any side. Arda Güler's creativity against Australia's pressing game makes this a fascinating tactical battle. Neither side can afford to lose.",
    key: "Arda Güler's creativity — Turkey's young superstar can unlock any defence.",
    confidence: "Medium"
  },
  "USA||Australia": {
    h: 2, a: 1,
    insight: "USA's home advantage is significant here — Australian sides traditionally struggle in North American atmospheres. Both teams are motivated and technically improving, but USA's MLS experience at this tournament and the passionate support should be decisive.",
    key: "USA's pace on the counter — Australia's defence is vulnerable in transition.",
    confidence: "Medium"
  },
  "Turkey||Paraguay": {
    h: 2, a: 1,
    insight: "Turkey need points to progress and Paraguay's defensive record in qualification suggests they're vulnerable. Güler and the Turkish midfield should control possession while Paraguay struggle to create clear chances. Turkey's European quality at club level should tell over the course of 90 minutes.",
    key: "Turkey's midfield control — they dominate possession and make Paraguay chase.",
    confidence: "Medium"
  },
  "Turkey||USA": {
    h: 1, a: 2,
    insight: "A massive game with qualification potentially on the line. USA's home support is an enormous factor but Turkey are capable of the upset. Expect a tight, tense match where small margins decide the outcome. USA's physicality and energy in front of their crowd likely edges it.",
    key: "The US crowd — 80,000 fans creates an atmosphere Turkey will find hostile.",
    confidence: "Low"
  },
  "Paraguay||Australia": {
    h: 1, a: 1,
    insight: "Both sides likely needing a result to have any chance of advancing as a best third-placed team. Paraguay's South American resilience and Australia's technical improvements make this an even contest. Expect both teams to be cautious given what's at stake.",
    key: "Desperation on both sides — neither can afford to concede in this must-result match.",
    confidence: "Low"
  },

  // ── GROUP E ──────────────────────────────────────────────────────────────────
  "Germany||Curacao": {
    h: 5, a: 0,
    insight: "Germany's return to the World Cup after a disappointing 2022 group-stage exit has produced a revitalised squad under new management. Curacao, making a historic first World Cup appearance, are overmatched in every department. Germany will use this to blood new players and restore confidence after 2022.",
    key: "Germany's depth — they can field entirely different XIs and still dominate.",
    confidence: "High"
  },
  "Ivory Coast||Ecuador": {
    h: 1, a: 1,
    insight: "Ivory Coast's golden generation has faded but they still have quality. Ecuador's young squad, featuring Kendry Paez, are exciting and technically accomplished. This is one of the group's most evenly matched games — both sides will fancy their chances and neither will want to lose early.",
    key: "Kendry Paez's creativity — Ecuador's teenage star can unlock Ivory Coast's defence.",
    confidence: "Low"
  },
  "Germany||Ivory Coast": {
    h: 3, a: 1,
    insight: "Germany's quality is superior but Ivory Coast proved at AFCON they can compete with strong sides. Expect Germany to control possession but Ivory Coast's pace on the counter to create problems. Germany's set piece threat and clinical finishing should secure the win.",
    key: "Germany's pressing — they suffocate opponents and force errors in dangerous areas.",
    confidence: "High"
  },
  "Ecuador||Curacao": {
    h: 4, a: 0,
    insight: "Ecuador need goals to improve their goal difference and Curacao provide the perfect opportunity. Enner Valencia's experience and leadership should guide Ecuador to a comfortable win, with younger players given freedom to attack.",
    key: "Ecuador's firepower — Enner Valencia's experience and Paez's creativity overwhelm Curacao.",
    confidence: "High"
  },
  "Curacao||Ivory Coast": {
    h: 0, a: 3,
    insight: "Curacao, despite their historic participation, lack the quality to compete with even Ivory Coast. The Ivorians need points to advance and have enough individual quality to win comfortably. This should be a routine victory for Ivory Coast.",
    key: "Ivory Coast's individual quality — too much for a debutant Curacao side.",
    confidence: "High"
  },
  "Ecuador||Germany": {
    h: 0, a: 2,
    insight: "Germany seal top spot with a controlled performance. Ecuador will be dangerous on the break but Germany's organisation and quality should contain them. Even with rotation, Germany's depth means they have too much for Ecuador.",
    key: "Germany's tactical discipline — they manage games superbly when qualification is secured.",
    confidence: "Medium"
  },

  // ── GROUP F ──────────────────────────────────────────────────────────────────
  "Netherlands||Japan": {
    h: 2, a: 1,
    insight: "Netherlands are genuine contenders with Van Dijk organising one of Europe's best defences and Gakpo, Depay and Bergwijn providing attacking threat. Japan's pressing game caused problems in 2022 but Netherlands are better prepared. Japan's resilience will keep them in it but Dutch quality tells.",
    key: "Van Dijk's leadership — Netherlands concede very few goals when he's fit and focused.",
    confidence: "Medium"
  },
  "Sweden||Tunisia": {
    h: 2, a: 0,
    insight: "Sweden's physicality and Isak's quality up front should be too much for Tunisia. Tunisia's AFCON performances have been solid but European-style pressing and set pieces are their weakness. Sweden's direct approach and aerial dominance should produce a comfortable win.",
    key: "Alexander Isak's movement — Sweden's Newcastle striker terrorises deep defences.",
    confidence: "High"
  },
  "Netherlands||Sweden": {
    h: 2, a: 1,
    insight: "A fascinating Scandinavian-Dutch clash. Sweden's physicality can trouble Netherlands but the Dutch quality in possession is a level above. Both sides are strong from set pieces which adds another dimension. Netherlands' individual talent in Gakpo and Depay should be the decisive factor.",
    key: "Netherlands' creativity — Gakpo's movement between the lines is difficult to track.",
    confidence: "Medium"
  },
  "Tunisia||Japan": {
    h: 0, a: 2,
    insight: "Japan's pressing and technical quality should overcome Tunisia's more conservative approach. Japan's Bundesliga contingent brings quality and work rate that Tunisia can't match for 90 minutes. Expect Japan to dominate possession and create chances through their structured attacking play.",
    key: "Japan's pressing intensity — they win the ball high up the pitch and create quick chances.",
    confidence: "Medium"
  },
  "Japan||Sweden": {
    h: 1, a: 2,
    insight: "A crucial match for both sides needing points. Sweden's physicality causes Japan real problems — they struggle against tall, direct teams. Isak's movement and Sweden's set piece threat should edge this, though Japan will make them work hard for it.",
    key: "Sweden's aerial dominance — Japan are vulnerable to balls into the box from wide.",
    confidence: "Medium"
  },
  "Tunisia||Netherlands": {
    h: 0, a: 3,
    insight: "Netherlands wrap up the group with a comfortable win. Tunisia will be defensively organised but Netherlands have too much quality. Gakpo and the Dutch attack should find gaps regularly while Tunisia rarely threaten on the counter.",
    key: "Netherlands' ruthlessness — they punish defensive mistakes clinically.",
    confidence: "High"
  },

  // ── GROUP G ──────────────────────────────────────────────────────────────────
  "Belgium||Egypt": {
    h: 3, a: 0,
    insight: "Belgium's golden generation may be ageing but De Bruyne, Lukaku and Courtois still represent world-class talent. Egypt have Salah but lack depth in other areas. Belgium's team quality is vastly superior and should produce a comfortable opening win.",
    key: "De Bruyne's vision and Lukaku's finishing — a devastating combination for any defence.",
    confidence: "High"
  },
  "Iran||New Zealand": {
    h: 2, a: 0,
    insight: "Iran's organised defensive structure and counter-attacking threat should be enough to beat a New Zealand side who qualified through the OFC play-offs. Iran's World Cup experience, having qualified for several recent tournaments, gives them the edge in game management.",
    key: "Iran's defensive discipline — they rarely concede and are lethal on the counter.",
    confidence: "High"
  },
  "Belgium||Iran": {
    h: 2, a: 0,
    insight: "Belgium's class should be too much for Iran's defensive setup. Iran will sit deep and try to frustrate Belgium, but De Bruyne's creativity and Belgium's pressing should eventually unlock them. Iran's counter-attacking threat means Belgium can't switch off.",
    key: "Belgium's patience in possession — they'll break Iran down eventually.",
    confidence: "High"
  },
  "New Zealand||Egypt": {
    h: 1, a: 2,
    insight: "Salah's quality is the decisive factor here. New Zealand will be organised and competitive but Salah creates goals out of nothing. Egypt's experience in major tournaments against African opposition and their tactical discipline should produce a narrow victory.",
    key: "Mo Salah — his individual brilliance can decide any match on his day.",
    confidence: "Medium"
  },
  "Egypt||Iran": {
    h: 1, a: 1,
    insight: "Two defensively strong sides fighting for second place. Both teams will be cautious and neither wants to concede. Salah provides the threat for Egypt while Iran's organised defence frustrates. A draw would suit both sides depending on other results.",
    key: "Tactical caution — both managers prioritise not losing over winning.",
    confidence: "Medium"
  },
  "New Zealand||Belgium": {
    h: 0, a: 3,
    insight: "Belgium secure the group with a dominant performance. New Zealand will be competitive for a while but Belgium's depth means they can rotate heavily and still win comfortably. A chance for fringe players to show what they can do.",
    key: "Belgium's squad depth — even their reserves have Champions League experience.",
    confidence: "High"
  },

  // ── GROUP H ──────────────────────────────────────────────────────────────────
  "Spain||Cape Verde": {
    h: 4, a: 0,
    insight: "Spain's possession-based tiki-taka has been modernised with a more direct approach. Pedri, Yamal, and Morata lead a squad bursting with La Liga talent. Cape Verde have impressed in AFCON but the step up in quality to face Spain is enormous. This should be a comfortable opening win.",
    key: "Spain's pressing and ball retention — Cape Verde will spend most of the game chasing.",
    confidence: "High"
  },
  "Saudi Arabia||Uruguay": {
    h: 0, a: 2,
    insight: "Saudi Arabia's famous 2022 win over Argentina created enormous pressure but their squad hasn't progressed significantly. Uruguay's experienced spine — Valverde, Bentancur, Darwin Nunez — is formidable. Uruguay's South American toughness and quality should secure three points.",
    key: "Darwin Nunez's raw power — Saudi Arabia's defence can't handle his directness.",
    confidence: "High"
  },
  "Spain||Saudi Arabia": {
    h: 3, a: 0,
    insight: "Spain's technical superiority is too much for Saudi Arabia in open play. While Saudi Arabia can upset through a compact defensive block, Spain's movement and quick passing will find solutions. Morata and Yamal's link-up play should produce multiple chances.",
    key: "Lamine Yamal's directness — the teenage sensation causes havoc against compact defences.",
    confidence: "High"
  },
  "Uruguay||Cape Verde": {
    h: 2, a: 0,
    insight: "Uruguay's physical and technical quality makes this a comfortable win. Cape Verde will try to make it scrappy and set-piece oriented, but Uruguay's experience in exactly these kinds of matches means they know how to navigate it. Nunez's pace settles any nerves.",
    key: "Uruguay's mental strength — they don't panic under pressure and manage games well.",
    confidence: "High"
  },
  "Cape Verde||Saudi Arabia": {
    h: 1, a: 1,
    insight: "A battle between two sides already eliminated. Cape Verde's technically gifted players can match Saudi Arabia's squad quality. Both teams will play with freedom and create an entertaining match with goals, though neither can progress.",
    key: "Pride and individual performances — players auditioning for club moves.",
    confidence: "Low"
  },
  "Uruguay||Spain": {
    h: 1, a: 2,
    insight: "An intriguing clash between Spain's technical football and Uruguay's organised aggression. Uruguay's defensive setup and set piece threat make them dangerous but Spain's ball retention and creativity should prevail. Expect Uruguay to make it competitive but Spain to have the last word.",
    key: "Spain's midfield control vs Uruguay's defensive organisation — the key tactical battle.",
    confidence: "Medium"
  },

  // ── GROUP I ──────────────────────────────────────────────────────────────────
  "France||Senegal": {
    h: 2, a: 1,
    insight: "A fascinating clash with cultural and historical dimensions. Senegal's 2022 AFCON triumph showed they have genuine quality — Mane, Sarr, and Diatta create problems for any defence. But France's depth is unmatched globally. Mbappe's pace will be the decisive factor in what promises to be an entertaining match.",
    key: "Mbappe vs Senegal's physical defence — the ultimate test of pace against organisation.",
    confidence: "Medium"
  },
  "Iraq||Norway": {
    h: 0, a: 3,
    insight: "Erling Haaland's return to World Cup football is the main event here. Iraq, appearing in their first World Cup in decades, lack the quality to contain Norway's powerful attacking play. Haaland's movement and finishing against Iraq's inexperienced defence should produce a goal-fest.",
    key: "Haaland's movement — Iraq have no answer to his relentless running and clinical finishing.",
    confidence: "High"
  },
  "France||Iraq": {
    h: 4, a: 0,
    insight: "France use this match to rotate and still win comfortably. Iraq's first World Cup in a generation is a historic achievement but the quality gap is enormous. Even France's reserves contain Champions League regulars. An opportunity for Giroud or Thuram to stake a claim.",
    key: "France's squad quality — whoever they field has too much individual quality for Iraq.",
    confidence: "High"
  },
  "Norway||Senegal": {
    h: 2, a: 1,
    insight: "An explosive match between two physically imposing sides. Haaland vs Senegal's tall defenders is the headline matchup. Norway's directness and Haaland's runs behind the defence should edge a competitive match. Senegal will create chances but Norway's clinical finishing is decisive.",
    key: "Norway's directness — they play to Haaland's strengths and it's devastatingly effective.",
    confidence: "Medium"
  },
  "Norway||France": {
    h: 1, a: 2,
    insight: "Norway's best result of the tournament sees them give France a real test. Haaland's goals keep Norway in it but France's depth and quality eventually tell. A rematch of some classic France-Norway encounters with Mbappe delivering the decisive moments.",
    key: "Mbappe vs Haaland — the two superstars headline what could be the match of the group.",
    confidence: "Medium"
  },
  "Senegal||Iraq": {
    h: 3, a: 0,
    insight: "Senegal need to win to secure their place in the knockout rounds. Iraq's inexperience at this level means Senegal should dominate. Mane's leadership and Sarr's pace create an attacking threat Iraq simply can't handle. A comfortable but crucial win for Senegal.",
    key: "Senegal's AFCON experience — they know how to handle high-pressure must-win situations.",
    confidence: "High"
  },

  // ── GROUP J ──────────────────────────────────────────────────────────────────
  "Argentina||Algeria": {
    h: 3, a: 0,
    insight: "World champions Argentina, led by the greatest player of all time, face a motivated but outclassed Algeria. Messi's genius and the South American champions' collective quality are simply too much. Argentina will dominate possession and create chance after chance. Algeria will make it physical but can't compete at this level.",
    key: "Messi's brilliance — he elevates everyone around him and delivers in big moments.",
    confidence: "High"
  },
  "Austria||Jordan": {
    h: 3, a: 0,
    insight: "Austria's Bundesliga-heavy squad has impressive depth and tactical sophistication under their current manager. Jordan, appearing in their first World Cup, will be proud to be here but lack the quality to compete. Austria's pressing game should dominate from the first whistle.",
    key: "Austria's pressing intensity — Jordan will struggle to build from the back against them.",
    confidence: "High"
  },
  "Argentina||Austria": {
    h: 2, a: 1,
    insight: "Argentina and Austria produce a classic European-South American clash. Austria's organisation and physicality will test Argentina but Messi, Di Maria, and Alvarez are too good. Argentina's movement and technical quality should produce a deserved win, though Austria make them work.",
    key: "Argentina's fluid movement — Austria's rigid structure struggles against South American creativity.",
    confidence: "Medium"
  },
  "Jordan||Algeria": {
    h: 0, a: 2,
    insight: "Algeria's AFCON experience gives them the edge in this battle for pride and third place points. Jordan's qualification was historic but Algeria's squad has more proven quality at international level. A comfortable Algerian win sets up whatever permutation is needed for group qualification.",
    key: "Algeria's AFCON experience — they know how to grind out results in difficult conditions.",
    confidence: "High"
  },
  "Algeria||Austria": {
    h: 1, a: 2,
    insight: "Austria need points to guarantee progression and Algeria won't give them up easily. This is a close encounter between two evenly matched sides but Austria's European tournament experience and organised pressing game should edge it. A tense match with the result in doubt until late.",
    key: "Austria's set piece threat — they score more goals from dead balls than any other European qualifier.",
    confidence: "Medium"
  },
  "Jordan||Argentina": {
    h: 0, a: 4,
    insight: "Argentina, with qualification secured, still have points to play for and individual players chasing form. Messi may rest but Argentina's depth — Dybala, Mac Allister, Enzo Fernandez — is enough to secure a comfortable win. Jordan's defensive effort is admirable but futile against this quality.",
    key: "Argentina's depth — even without Messi, this squad has too much quality for Jordan.",
    confidence: "High"
  },

  // ── GROUP K ──────────────────────────────────────────────────────────────────
  "Portugal||DR Congo": {
    h: 3, a: 0,
    insight: "Portugal's attacking talent is extraordinary — Bruno Fernandes, Bernardo Silva, Vitinha, and Joao Felix create a midfield that can unlock any defence. DR Congo's physical approach and pace on the counter provide a threat but Portugal's defensive organisation, anchored by Dias, should contain them comfortably.",
    key: "Bruno Fernandes's creativity — his through balls and long-range threat make him unplayable on his day.",
    confidence: "High"
  },
  "Uzbekistan||Colombia": {
    h: 0, a: 2,
    insight: "Colombia's South American quality and tournament experience make them heavy favourites. Uzbekistan's Central Asian football has improved dramatically but the gulf in quality against Colombia is significant. James Rodriguez's experience and the Cafeteros' technical skills should produce a comfortable win.",
    key: "James Rodriguez's vision — even at this stage of his career he's a class apart in this group.",
    confidence: "High"
  },
  "Portugal||Uzbekistan": {
    h: 4, a: 0,
    insight: "Portugal should cruise this match against Uzbekistan, who are outclassed at every level. An opportunity to rotate and rest key players while still winning comfortably. Rafael Leao's pace and Joao Felix's creativity should terrorise an Uzbek defence not used to facing this level of opposition.",
    key: "Portugal's attacking depth — they have world-class options in every position going forward.",
    confidence: "High"
  },
  "Colombia||DR Congo": {
    h: 2, a: 0,
    insight: "Colombia's superior technical quality and tactical sophistication should see them control this match. DR Congo's power and physicality creates some danger but Colombia's ability to keep the ball and create chances through patient build-up play is too much.",
    key: "Colombia's ball retention — they suffocate opponents and make the game on their terms.",
    confidence: "High"
  },
  "Colombia||Portugal": {
    h: 1, a: 2,
    insight: "The group's most anticipated clash. Portugal's individual quality edges a tight match against a Colombia side that can hurt any team. Bruno Fernandes and Bernardo Silva's quality is the decisive factor but Colombia's James Rodriguez will ensure this is no walkover.",
    key: "Portugal's midfield quality — Bruno and Bernardo create a partnership that's unmatched in this group.",
    confidence: "Medium"
  },
  "DR Congo||Uzbekistan": {
    h: 2, a: 0,
    insight: "DR Congo's physical approach and counter-attacking pace should be too much for Uzbekistan's more technical but physically inferior side. Both teams are eliminated but DR Congo's players have more to gain from a strong showing.",
    key: "DR Congo's pace — their wingers are physically too much for Uzbekistan's full-backs.",
    confidence: "High"
  },

  // ── GROUP L ──────────────────────────────────────────────────────────────────
  "England||Croatia": {
    h: 2, a: 1,
    insight: "England have a point to prove after consecutive European Championship near-misses. Croatia's famous 2018 semi-final win over England still haunts the Three Lions. This England squad with Bellingham, Saka, and Foden is significantly stronger but Croatia's tactical nous means England need to be at their best.",
    key: "Jude Bellingham's threat from midfield — his goals and creativity drive England forward.",
    confidence: "Medium"
  },
  "Ghana||Panama": {
    h: 2, a: 0,
    insight: "Ghana's talent pool has always been impressive and this squad brings Premier League quality throughout. Panama are physical and set-piece oriented but lack quality in open play. Ghana's technical players and pace should be too much for a Panama side that qualified through Central America.",
    key: "Ghana's Premier League contingent — their physical and technical quality is a level above Panama.",
    confidence: "High"
  },
  "England||Ghana": {
    h: 3, a: 0,
    insight: "England have too much quality for Ghana across the pitch. Saka's pace, Bellingham's goals, and the depth of options available to the manager make this a comfortable win. Ghana will defend deep but England's creativity should find solutions.",
    key: "England's right side — Saka and Kyle Walker create constant overloads down Ghana's left.",
    confidence: "High"
  },
  "Panama||Croatia": {
    h: 0, a: 2,
    insight: "Croatia's experience and technical quality is too much for Panama. Modric, even in the twilight of his career, controls games through his intelligence and passing range. Panama's physical approach cannot contain Croatia's patient ball movement.",
    key: "Modric's control — his reading of the game makes Croatia effortlessly dominant against Panama.",
    confidence: "High"
  },
  "Panama||England": {
    h: 0, a: 4,
    insight: "England's 6-1 win over Panama in 2018 set the template. With qualification secured, England will still win comfortably but may rotate. Panama's physical approach causes frustration but not problems. England's goalscorers use this as an opportunity to build confidence.",
    key: "England's firepower — even with rotation, they have too many goalscoring threats for Panama.",
    confidence: "High"
  },
  "Croatia||Ghana": {
    h: 2, a: 1,
    insight: "Croatia's tournament experience is decisive in this must-win encounter. Ghana will be dangerous on the counter but Croatia's composure and intelligence in managing big moments should see them through. Modric and Kovacic control the tempo and make the decisive difference.",
    key: "Croatia's big-game experience — they never panic and always find a way in key matches.",
    confidence: "Medium"
  },
};

export default GROUP_INSIGHTS;
