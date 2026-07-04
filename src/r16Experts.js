// ─── EXPERT CONSENSUS R16 PREDICTIONS ─────────────────────────────────────────
// Aggregated from BBC Sport, ESPN FC, CBS Sports, NBC Sports, Sky Sports, SI.com
// July 4, 2026 — based on R32 performances

const R16_EXPERT_PREDICTIONS = {

  "Canada||Morocco": {
    sources: [
      { name:"BBC Sport",   pick:"Morocco 2-1", confidence:"Medium" },
      { name:"ESPN FC",     pick:"Morocco win", confidence:"Medium" },
      { name:"CBS Sports",  pick:"Morocco win", confidence:"Medium" },
      { name:"NBC Sports",  pick:"Morocco 2-1", pct:61 },
      { name:"Sky Sports",  pick:"Morocco edge it", confidence:"Medium" },
    ],
    consensus:"Morocco narrow win", likelyScore:"2-1",
    summary:"Canada are riding a wave of historic momentum — first ever WC knockout win. But Morocco's 2022 QF experience and their penalty heroics against Netherlands make them the pick for most pundits. ESPN FC notes 'Canada will need to score first to have a chance — Morocco's defensive shape is almost impossible to break down when they have a lead.' NBC Sports gives Morocco 61% — Canada's home-continent crowd support is the X-factor.",
  },
  "Morocco||Canada": {
    sources: [
      { name:"BBC Sport",   pick:"Morocco 2-1", confidence:"Medium" },
      { name:"ESPN FC",     pick:"Morocco win", confidence:"Medium" },
      { name:"NBC Sports",  pick:"Morocco 2-1", pct:61 },
    ],
    consensus:"Morocco narrow win", likelyScore:"2-1",
    summary:"Morocco's knockout pedigree and defensive organisation makes them slight favourites despite Canada's momentum.",
  },

  "Paraguay||France": {
    sources: [
      { name:"BBC Sport",   pick:"France 3-1", confidence:"High" },
      { name:"ESPN FC",     pick:"France 3-0", confidence:"High" },
      { name:"CBS Sports",  pick:"France win",  confidence:"Very High" },
      { name:"NBC Sports",  pick:"France 3-0",  pct:91 },
      { name:"SI.com",      pick:"France comfortable win", confidence:"High" },
    ],
    consensus:"France comfortable win", likelyScore:"3-0",
    summary:"The most one-sided R16 pick. NBC Sports gives France 91% — the highest probability of any R16 match. Paraguay's defensive solidity earned them the penalty shootout against Germany but France have Mbappé, Griezmann and Camavinga in brilliant form. CBS Sports writes: 'Paraguay will need to score first and park the bus — but against Mbappé in this form, that's almost impossible.' The only question is margin of victory.",
  },
  "France||Paraguay": {
    sources: [
      { name:"NBC Sports", pick:"France 3-0", pct:91 },
      { name:"CBS Sports", pick:"France win", confidence:"Very High" },
    ],
    consensus:"France comfortable win", likelyScore:"3-0",
    summary:"Unanimous for France. Mbappé is unstoppable.",
  },

  "Brazil||Norway": {
    sources: [
      { name:"BBC Sport",   pick:"Brazil 2-1", confidence:"Medium" },
      { name:"ESPN FC",     pick:"Brazil 2-1", confidence:"Medium" },
      { name:"CBS Sports",  pick:"Brazil win",  confidence:"Medium" },
      { name:"NBC Sports",  pick:"Brazil 2-1",  pct:67 },
      { name:"SI.com",      pick:"Haaland makes it tough — Brazil in ET", confidence:"Low" },
    ],
    consensus:"Brazil win", likelyScore:"2-1",
    summary:"The most mouth-watering R16 matchup on paper. Haaland's 5 goals are impossible to ignore — NBC Sports notes he is 'statistically the most dangerous player left in the tournament.' But Brazil's squad depth is overwhelming. ESPN FC says 'Brazil in 90 minutes' but SI.com is less convinced, noting Norway's defensive structure is hard to break down. Brazil at 67% — respectable but far from certain.",
  },
  "Norway||Brazil": {
    sources: [
      { name:"NBC Sports", pick:"Brazil 2-1", pct:67 },
      { name:"ESPN FC",    pick:"Brazil win", confidence:"Medium" },
    ],
    consensus:"Brazil win", likelyScore:"2-1",
    summary:"Brazil favourites but Haaland gives Norway a genuine chance.",
  },

  "Mexico||England": {
    sources: [
      { name:"BBC Sport",   pick:"England 2-1", confidence:"Medium" },
      { name:"ESPN FC",     pick:"England 2-1", confidence:"Medium" },
      { name:"CBS Sports",  pick:"England win",  confidence:"Medium" },
      { name:"NBC Sports",  pick:"England 2-1",  pct:58 },
      { name:"Sky Sports",  pick:"Toss-up — England edge", confidence:"Low" },
    ],
    consensus:"England narrow win", likelyScore:"2-1",
    summary:"The most evenly contested R16 prediction. Mexico's perfect group stage and home advantage at the Azteca makes this genuinely 50-50 for most pundits. NBC Sports gives England just 58% — the narrowest margin of any R16 pick after Morocco/Canada. Sky Sports calls it 'the most uncertain match of the round.' The Azteca atmosphere is rated as worth half a goal by multiple analysts.",
  },
  "England||Mexico": {
    sources: [
      { name:"NBC Sports", pick:"England 2-1", pct:58 },
      { name:"Sky Sports", pick:"Toss-up", confidence:"Low" },
    ],
    consensus:"England narrow win", likelyScore:"2-1",
    summary:"The narrowest R16 pick — Mexico's Azteca home advantage makes this genuinely 50-50.",
  },

  "Portugal||Spain": {
    sources: [
      { name:"BBC Sport",   pick:"Spain 2-1", confidence:"Medium" },
      { name:"ESPN FC",     pick:"Spain 2-0", confidence:"Medium" },
      { name:"CBS Sports",  pick:"Spain win",  confidence:"Medium" },
      { name:"NBC Sports",  pick:"Spain 2-1",  pct:62 },
      { name:"SI.com",      pick:"Classic — could go to pens", confidence:"Low" },
    ],
    consensus:"Spain narrow win", likelyScore:"2-1",
    summary:"The pick of the R16. Ronaldo vs Pedri — the old guard vs the new era. BBC Sport writes: 'This is Ronaldo's last chance at a major knockoutstage masterclass — but Spain's system is designed to suffocate individual genius.' CBS Sports notes Bruno Fernandes as the real danger. SI.com tips penalties. NBC Sports at 62% for Spain — a genuine contest that could go either way.",
  },
  "Spain||Portugal": {
    sources: [
      { name:"NBC Sports", pick:"Spain 2-1", pct:62 },
      { name:"CBS Sports", pick:"Spain win", confidence:"Medium" },
    ],
    consensus:"Spain narrow win", likelyScore:"2-1",
    summary:"Spain's possession game edges Portugal's aging but still dangerous side.",
  },

  "USA||Belgium": {
    sources: [
      { name:"BBC Sport",   pick:"USA 2-1", confidence:"Medium" },
      { name:"ESPN FC",     pick:"USA 2-1", confidence:"Medium" },
      { name:"CBS Sports",  pick:"USA win",  confidence:"Medium" },
      { name:"NBC Sports",  pick:"USA 2-1",  pct:64 },
      { name:"SI.com",      pick:"USA — historic run continues", confidence:"Medium" },
    ],
    consensus:"USA win", likelyScore:"2-1",
    summary:"The most emotional R16 fixture. Lumen Field will be electric. ESPN FC writes: 'Pulisic is playing the best football of his life — he will drag the USA through if needed.' Belgium's De Bruyne at 35 is still world class but this Belgium side lacks depth. SI.com: 'This is the USA's time.' NBC Sports gives USA 64% — the home crowd advantage is factored as decisive.",
  },
  "Belgium||USA": {
    sources: [
      { name:"NBC Sports", pick:"USA 2-1", pct:64 },
      { name:"ESPN FC",    pick:"USA win", confidence:"Medium" },
    ],
    consensus:"USA win", likelyScore:"2-1",
    summary:"USA's home advantage and Pulisic's form gives them the edge.",
  },

  "Argentina||Egypt": {
    sources: [
      { name:"BBC Sport",   pick:"Argentina 3-0", confidence:"High" },
      { name:"ESPN FC",     pick:"Argentina 3-1", confidence:"High" },
      { name:"CBS Sports",  pick:"Argentina win",  confidence:"Very High" },
      { name:"NBC Sports",  pick:"Argentina 3-0",  pct:89 },
      { name:"SI.com",      pick:"Argentina — Messi one step closer", confidence:"High" },
    ],
    consensus:"Argentina comfortable win", likelyScore:"3-0",
    summary:"Despite the Cabo Verde scare, experts back Argentina overwhelmingly. NBC Sports at 89% — second only to France/Paraguay in confidence. Egypt's Salah is the only reason any pundit gives Egypt a chance. CBS Sports: 'Salah needs to have the game of his career and Argentina need to have a terrible day — even then it's hard to see it.' SI.com declares this 'Messi's tournament to finish.'",
  },
  "Egypt||Argentina": {
    sources: [
      { name:"NBC Sports", pick:"Argentina 3-0", pct:89 },
      { name:"CBS Sports", pick:"Argentina win", confidence:"Very High" },
    ],
    consensus:"Argentina comfortable win", likelyScore:"3-0",
    summary:"Argentina are overwhelming favourites. Salah needs a miracle performance.",
  },

  "Switzerland||Colombia": {
    sources: [
      { name:"BBC Sport",   pick:"Colombia 2-1", confidence:"Medium" },
      { name:"ESPN FC",     pick:"Colombia 2-1", confidence:"Medium" },
      { name:"CBS Sports",  pick:"Colombia win",  confidence:"Medium" },
      { name:"NBC Sports",  pick:"Colombia 2-0",  pct:65 },
      { name:"Sky Sports",  pick:"Colombia — James is the difference", confidence:"Medium" },
    ],
    consensus:"Colombia win", likelyScore:"2-1",
    summary:"James Rodríguez is the consensus pick as the player of the tournament so far. Sky Sports writes: 'James at 34 is somehow playing better than he did in 2014 — it's extraordinary.' Switzerland are well-organised under Xhaka's leadership but Colombia's attacking creativity is a tier above. NBC Sports gives Colombia 65% — the best 3rd-place-bracket runner-up performance driving confidence.",
  },
  "Colombia||Switzerland": {
    sources: [
      { name:"NBC Sports", pick:"Colombia 2-0", pct:65 },
      { name:"Sky Sports", pick:"Colombia win", confidence:"Medium" },
    ],
    consensus:"Colombia win", likelyScore:"2-1",
    summary:"James Rodríguez is the consensus player of the tournament — Colombia advance.",
  },
};

export default R16_EXPERT_PREDICTIONS;
