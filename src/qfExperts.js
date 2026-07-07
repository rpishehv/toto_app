// ─── EXPERT CONSENSUS QF PREDICTIONS ──────────────────────────────────────────
// Aggregated from BBC Sport, ESPN FC, CBS Sports, NBC Sports, Sky Sports, SI.com
// July 7, 2026

const QF_EXPERT_PREDICTIONS = {

  "France||Morocco": {
    sources: [
      { name:"BBC Sport",  pick:"France 2-1", confidence:"Medium" },
      { name:"ESPN FC",    pick:"France 2-0", confidence:"Medium" },
      { name:"CBS Sports", pick:"France win",  confidence:"Medium" },
      { name:"NBC Sports", pick:"France 2-1",  pct:64 },
      { name:"SI.com",     pick:"Morocco can do it again — but France edge it", confidence:"Low" },
    ],
    consensus:"France narrow win", likelyScore:"2-1",
    summary:"The most anticipated match of the QFs — a 2022 semi-final rematch. Morocco's 3-0 demolition of Canada shocked everyone and has pundits reconsidering. NBC Sports gives France 64% — the lowest confidence for any non-upset pick in the QFs. ESPN FC: 'Morocco's 2022 run proved they can beat anyone in a knockout format — Regragui's defensive shape is almost impossible to break.' SI.com is hedging: 'If Morocco can keep it tight until the 70th minute, they absolutely have the quality to win this.' BBC Sport sticks with France — Mbappé's pace on the transition is the decisive factor.",
  },
  "Morocco||France": {
    sources: [
      { name:"NBC Sports", pick:"France 2-1", pct:64 },
      { name:"ESPN FC",    pick:"France win", confidence:"Medium" },
    ],
    consensus:"France narrow win", likelyScore:"2-1",
    summary:"France are narrow favourites but Morocco's 3-0 win over Canada has pundits nervous.",
  },

  "Spain||Belgium": {
    sources: [
      { name:"BBC Sport",  pick:"Spain 2-1", confidence:"Medium" },
      { name:"ESPN FC",    pick:"Spain 2-1", confidence:"Medium" },
      { name:"CBS Sports", pick:"Toss-up — Spain edge", confidence:"Low" },
      { name:"NBC Sports", pick:"Spain 2-1",  pct:55 },
      { name:"Sky Sports", pick:"De Bruyne can win this for Belgium", confidence:"Low" },
    ],
    consensus:"Spain very narrow win", likelyScore:"2-1",
    summary:"The QF with the least expert certainty. Belgium's 4-1 win over the USA was the most emphatic performance of the R16 — De Bruyne with 3 assists at 35 years old is playing career-best football. NBC Sports gives Spain just 55% — the closest any QF call. Sky Sports: 'De Bruyne in this form is the best player left in the tournament. Belgium can absolutely win this.' CBS Sports: 'Spain's system eventually wins but this goes to extra time.' ESPN FC sticks with Spain's collective quality over Belgium's individual brilliance.",
  },
  "Belgium||Spain": {
    sources: [
      { name:"NBC Sports", pick:"Spain 2-1", pct:55 },
      { name:"Sky Sports", pick:"De Bruyne can win it", confidence:"Low" },
    ],
    consensus:"Spain very narrow win", likelyScore:"2-1",
    summary:"The most uncertain QF — De Bruyne's form makes Belgium genuine contenders.",
  },

  "Norway||England": {
    sources: [
      { name:"BBC Sport",  pick:"England 2-1", confidence:"Medium" },
      { name:"ESPN FC",    pick:"England 2-1", confidence:"Medium" },
      { name:"CBS Sports", pick:"England win",  confidence:"Medium" },
      { name:"NBC Sports", pick:"England 2-1",  pct:62 },
      { name:"SI.com",     pick:"Haaland's Golden Boot run ends here — England", confidence:"Medium" },
    ],
    consensus:"England win", likelyScore:"2-1",
    summary:"Haaland's 8 goals have made Norway the tournament's romantics' pick, but pundits back England. NBC Sports 62% for England. BBC Sport: 'England have the best defensive record of any QF team — Stones and the backline have been excellent. Haaland will get chances but he can't score 3.' SI.com: 'England are the balanced team — Bellingham, Saka, Foden all contributing. Norway are Haaland + 10.' CBS Sports notes England beat Mexico at the Azteca which is as tough an atmosphere as it gets — they have the mental fortitude.",
  },
  "England||Norway": {
    sources: [
      { name:"NBC Sports", pick:"England 2-1", pct:62 },
      { name:"BBC Sport",  pick:"England win", confidence:"Medium" },
    ],
    consensus:"England win", likelyScore:"2-1",
    summary:"England's balance and defensive organisation edges Haaland's Norway.",
  },

  "Argentina||Switzerland": {
    sources: [
      { name:"BBC Sport",  pick:"Argentina 2-0", confidence:"High" },
      { name:"ESPN FC",    pick:"Argentina 3-1", confidence:"High" },
      { name:"CBS Sports", pick:"Argentina win",  confidence:"Very High" },
      { name:"NBC Sports", pick:"Argentina 2-0",  pct:84 },
      { name:"SI.com",     pick:"Messi's tournament — Argentina to semis", confidence:"High" },
    ],
    consensus:"Argentina comfortable win", likelyScore:"2-0",
    summary:"The most one-sided QF pick. NBC Sports at 84% for Argentina. Messi's comeback from 2-0 down vs Egypt — scoring the equaliser in the 83rd minute and setting up the winner in stoppage time — has made him the tournament's defining figure. CBS Sports: 'Switzerland got through on penalties against a Colombia side that didn't score in open play for 4 matches. Argentina are on a different planet.' ESPN FC: 'Messi at 38 is playing the best football of his World Cup career. Switzerland have no answer.' SI.com: 'The only question is what records Messi breaks.'",
  },
  "Switzerland||Argentina": {
    sources: [
      { name:"NBC Sports", pick:"Argentina 2-0", pct:84 },
      { name:"CBS Sports", pick:"Argentina win", confidence:"Very High" },
    ],
    consensus:"Argentina comfortable win", likelyScore:"2-0",
    summary:"Argentina are overwhelming favourites. Messi is on a historic Golden Boot run with 8 goals.",
  },
};

export default QF_EXPERT_PREDICTIONS;
