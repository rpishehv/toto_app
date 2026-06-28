// ─── EXPERT CONSENSUS R32 PREDICTIONS ─────────────────────────────────────────
// Aggregated from BBC Sport, ESPN FC, CBS Sports, NBC Sports, Sky Sports, SI.com
// June 2026 — reflects tournament form, group stage results and knockout history

const R32_EXPERT_PREDICTIONS = {

  // ── Jun 28 ────────────────────────────────────────────────────────────────
  "South Africa||Canada": {
    sources: [
      { name:"BBC Sport",   pick:"Canada 2–1",   confidence:"Medium" },
      { name:"ESPN FC",     pick:"Canada win",    confidence:"Medium" },
      { name:"CBS Sports",  pick:"Canada win",    confidence:"Medium" },
      { name:"NBC Sports",  pick:"Canada 2–1",    pct:65 },
      { name:"Sky Sports",  pick:"Canada win",    confidence:"Medium" },
    ],
    consensus:"Canada win", likelyScore:"2–1",
    summary:"Broad consensus for Canada, driven by Jonathan David's form (4 goals) and Alphonso Davies' pace. South Africa's defensive organisation is respected but their attacking output has been poor. CBS Sports notes Canada's 4-3-3 is ideally suited to exploit South Africa's high defensive line.",
  },
  "Brazil||Japan": {
    sources: [
      { name:"BBC Sport",   pick:"Brazil 3–0",   confidence:"High" },
      { name:"ESPN FC",     pick:"Brazil 2–0",   confidence:"High" },
      { name:"CBS Sports",  pick:"Brazil win",    confidence:"Very High" },
      { name:"NBC Sports",  pick:"Brazil 3–1",    pct:85 },
      { name:"SI.com",      pick:"Brazil win",    confidence:"High" },
    ],
    consensus:"Brazil win", likelyScore:"3–0",
    summary:"Virtually unanimous backing for Brazil. NBC Sports gives them 85% to progress. Japan's defensive resilience is noted — they kept two clean sheets in the group stage — but Brazil's individual quality is too much. Vinícius Jr and Rodrygo are rated as the tournament's most dangerous wide pair.",
  },
  "Germany||Paraguay": {
    sources: [
      { name:"BBC Sport",   pick:"Germany 3–0",  confidence:"High" },
      { name:"ESPN FC",     pick:"Germany 3–1",  confidence:"High" },
      { name:"CBS Sports",  pick:"Germany win",   confidence:"Very High" },
      { name:"NBC Sports",  pick:"Germany 4–0",   pct:90 },
      { name:"Sky Sports",  pick:"Germany win",   confidence:"High" },
    ],
    consensus:"Germany win", likelyScore:"3–0",
    summary:"The most one-sided expert consensus of the R32. Paraguay are admired for qualifying from Group D third place but NBC Sports gives Germany 90% to advance. Kai Havertz and Florian Wirtz are tipped to run riot. Germany's pressing machine should overwhelm a Paraguay side with a -1 goal difference.",
  },
  "Netherlands||Morocco": {
    sources: [
      { name:"BBC Sport",   pick:"Netherlands 2–1", confidence:"Medium" },
      { name:"ESPN FC",     pick:"Draw / Netherlands pens", confidence:"Low" },
      { name:"CBS Sports",  pick:"Netherlands win",  confidence:"Medium" },
      { name:"NBC Sports",  pick:"Netherlands 2–1",  pct:58 },
      { name:"SI.com",      pick:"Tight — Netherlands edge it", confidence:"Low" },
    ],
    consensus:"Netherlands narrow win", likelyScore:"2–1",
    summary:"The most divided expert pick of the R32. Morocco's 2022 QF run is fresh in everyone's mind. ESPN FC tips a draw going to penalties. SI.com highlights Morocco's three Dutch-born players as a tactical wildcard. Narrow Dutch majority — but Morocco are given a genuine 42% chance to cause an upset.",
  },

  // ── Jun 30 ────────────────────────────────────────────────────────────────
  "Ivory Coast||Norway": {
    sources: [
      { name:"BBC Sport",   pick:"Norway 2–1",  confidence:"Medium" },
      { name:"ESPN FC",     pick:"Norway 2–0",  confidence:"Medium" },
      { name:"CBS Sports",  pick:"Norway win",   confidence:"Medium" },
      { name:"NBC Sports",  pick:"Norway 2–1",   pct:62 },
      { name:"Sky Sports",  pick:"Norway win",   confidence:"Medium" },
    ],
    consensus:"Norway win", likelyScore:"2–1",
    summary:"Haaland with 4 goals dominates expert thinking. NBC Sports gives Norway 62% after they rested key players against France. Ivory Coast's Yan Diomandé is the most exciting young player in the tournament according to BBC Sport but their 36-year-old striker Didier Drogba era is clearly over and the squad lacks depth.",
  },
  "France||Sweden": {
    sources: [
      { name:"BBC Sport",   pick:"France 3–1",  confidence:"High" },
      { name:"ESPN FC",     pick:"France 2–0",  confidence:"High" },
      { name:"CBS Sports",  pick:"France win",   confidence:"Very High" },
      { name:"NBC Sports",  pick:"France 3–1",   pct:88 },
      { name:"SI.com",      pick:"France win",   confidence:"High" },
    ],
    consensus:"France win", likelyScore:"3–1",
    summary:"Near-unanimous backing for France, with NBC Sports at 88%. Sweden qualified as a third-place team with a -1 goal difference. Alexander Isak is respected but France's Mbappé-Griezmann combination is rated the best in the tournament. CBS Sports writes: 'Sweden have no answer for the pace of France's front three.'",
  },
  "Mexico||Ecuador": {
    sources: [
      { name:"BBC Sport",   pick:"Mexico 2–1",  confidence:"Medium" },
      { name:"ESPN FC",     pick:"Mexico 2–0",  confidence:"Medium" },
      { name:"CBS Sports",  pick:"Mexico win",   confidence:"Medium" },
      { name:"NBC Sports",  pick:"Mexico 2–1",   pct:67 },
      { name:"Sky Sports",  pick:"Mexico win",   confidence:"Medium" },
    ],
    consensus:"Mexico win", likelyScore:"2–1",
    summary:"Mexico's perfect group stage and Azteca home advantage give them the edge. ESPN FC points to Moisés Caicedo as Ecuador's game-changer who could neutralise Mexico's midfield. NBC Sports' 67% for Mexico reflects respect for Ecuador — they scored 7 goals in the group stage. The Azteca crowd is a decisive factor for every pundit.",
  },

  // ── Jul 1 ─────────────────────────────────────────────────────────────────
  "England||DR Congo": {
    sources: [
      { name:"BBC Sport",   pick:"England 3–0",  confidence:"High" },
      { name:"ESPN FC",     pick:"England 3–1",  confidence:"High" },
      { name:"CBS Sports",  pick:"England win",   confidence:"High" },
      { name:"NBC Sports",  pick:"England 3–0",   pct:87 },
      { name:"Sky Sports",  pick:"England win",   confidence:"Very High" },
    ],
    consensus:"England win", likelyScore:"3–0",
    summary:"Experts unanimous on England. DR Congo's run is described as 'miraculous' but the quality gap is vast. Sky Sports gives England a clean sheet. Bellingham's form — 3 goals and 2 assists — is drawing comparisons to prime Lampard. The only debate is whether Saka or Foden leads the line.",
  },
  "Belgium||Senegal": {
    sources: [
      { name:"BBC Sport",   pick:"Belgium 2–1",  confidence:"Medium" },
      { name:"ESPN FC",     pick:"Belgium 2–0",  confidence:"Medium" },
      { name:"CBS Sports",  pick:"Belgium win",   confidence:"Medium" },
      { name:"NBC Sports",  pick:"Belgium 2–1",   pct:64 },
      { name:"SI.com",      pick:"Belgium edge it", confidence:"Medium" },
    ],
    consensus:"Belgium win", likelyScore:"2–1",
    summary:"Belgium are favoured but Senegal's 5-goal group stage finish makes them genuinely dangerous. De Bruyne at 35 is rated by ESPN FC as still the most intelligent playmaker in the tournament. NBC Sports gives Belgium 64% — the lowest of any 'favourite' in the R32 because Mané and Dia are a formidable striking partnership.",
  },
  "USA||Bosnia-Herzegovina": {
    sources: [
      { name:"BBC Sport",   pick:"USA 2–1",      confidence:"Medium" },
      { name:"ESPN FC",     pick:"USA 2–0",      confidence:"Medium" },
      { name:"CBS Sports",  pick:"USA win",       confidence:"Medium" },
      { name:"NBC Sports",  pick:"USA 2–1",       pct:68 },
      { name:"Sky Sports",  pick:"USA win",       confidence:"Medium" },
    ],
    consensus:"USA win", likelyScore:"2–1",
    summary:"Pulisic's form and home advantage make USA the pick. Bosnia are ranked 35th in the world and Džeko at 39 is not the force he was. NBC Sports notes 'the atmosphere at Levi's Stadium could be the difference' — USA's 68% probability reflects a solid favourite rather than a certainty. Bosnia's physicality and set pieces are identified as their best weapons.",
  },

  // ── Jul 2 ─────────────────────────────────────────────────────────────────
  "Spain||Austria": {
    sources: [
      { name:"BBC Sport",   pick:"Spain 2–0",    confidence:"High" },
      { name:"ESPN FC",     pick:"Spain 2–1",    confidence:"High" },
      { name:"CBS Sports",  pick:"Spain win",     confidence:"High" },
      { name:"NBC Sports",  pick:"Spain 2–0",     pct:78 },
      { name:"SI.com",      pick:"Spain controlled win", confidence:"High" },
    ],
    consensus:"Spain win", likelyScore:"2–0",
    summary:"Broad consensus for Spain despite their underwhelming group stage. NBC Sports' 78% reflects Spain's historical knockout-stage excellence. SI.com notes Spain have 'never looked truly comfortable but always found a way.' Austria are well-organised under their coach but their chance creation in the group stage was poor.",
  },
  "Portugal||Croatia": {
    sources: [
      { name:"BBC Sport",   pick:"Portugal 2–1", confidence:"Medium" },
      { name:"ESPN FC",     pick:"Portugal win",  confidence:"Medium" },
      { name:"CBS Sports",  pick:"Coin flip — Portugal edge",  confidence:"Low" },
      { name:"NBC Sports",  pick:"Portugal 2–1",  pct:55 },
      { name:"SI.com",      pick:"Classic — could go to pens", confidence:"Low" },
    ],
    consensus:"Portugal narrow win", likelyScore:"2–1",
    summary:"The most romantic fixture of the R32 — Ronaldo vs Modric in what may be their final World Cup knockout game. CBS Sports calls it a coin flip. SI.com rates Croatia's deep-block expertise as dangerous at 1-0. NBC Sports leans Portugal at 55% due to squad depth advantage. Bruno Fernandes is the key differential.",
  },
  "Switzerland||Algeria": {
    sources: [
      { name:"BBC Sport",   pick:"Switzerland 1–0", confidence:"Medium" },
      { name:"ESPN FC",     pick:"Switzerland 2–1", confidence:"Medium" },
      { name:"CBS Sports",  pick:"Switzerland win",  confidence:"Medium" },
      { name:"NBC Sports",  pick:"Switzerland 2–1",  pct:63 },
      { name:"Sky Sports",  pick:"Switzerland win",  confidence:"Medium" },
    ],
    consensus:"Switzerland win", likelyScore:"2–1",
    summary:"Switzerland respected as efficient knockout-round operators — they reached the QF in 2022. Algeria's Mahrez is the danger man with 3 assists in the group stage. NBC Sports gives Switzerland 63%. Xhaka's experience in knockout football is rated as decisive against an Algeria side making their first R32 since 1986.",
  },

  // ── Jul 3 ─────────────────────────────────────────────────────────────────
  "Australia||Egypt": {
    sources: [
      { name:"BBC Sport",   pick:"Draw / penalties", confidence:"Low" },
      { name:"ESPN FC",     pick:"Egypt 1–0",     confidence:"Low" },
      { name:"CBS Sports",  pick:"Toss-up",        confidence:"Low" },
      { name:"NBC Sports",  pick:"Egypt 1–0",      pct:52 },
      { name:"SI.com",      pick:"Salah decides it", confidence:"Low" },
    ],
    consensus:"Marginal Egypt", likelyScore:"1–0 AET",
    summary:"The R32's biggest toss-up. NBC Sports gives Egypt 52% — essentially a coin flip. Mohamed Salah at 33 is playing through fitness concerns according to BBC Sport, but one moment of quality could win this. Australia's Socceroos have punched above their weight throughout. CBS Sports says 'whoever scores first wins this.'",
  },
  "Argentina||Cape Verde": {
    sources: [
      { name:"BBC Sport",   pick:"Argentina 5–0",  confidence:"Very High" },
      { name:"ESPN FC",     pick:"Argentina 4–0",  confidence:"Very High" },
      { name:"CBS Sports",  pick:"Argentina win",   confidence:"Very High" },
      { name:"NBC Sports",  pick:"Argentina 4–0",   pct:97 },
      { name:"SI.com",      pick:"Cape Verde have no chance", confidence:"Very High" },
    ],
    consensus:"Argentina massive win", likelyScore:"4–0",
    summary:"NBC Sports' 97% is the highest for any R32 pick. SI.com wrote 'Cape Verde are the most wonderful story of the tournament — Argentina are about to end it.' Messi is widely expected to score. CBS Sports notes Argentina need a comfortable win to rest players before a likely difficult R16. Cape Verde's organisation is admired but irrelevant here.",
  },
  "Colombia||Ghana": {
    sources: [
      { name:"BBC Sport",   pick:"Colombia 2–0",  confidence:"Medium" },
      { name:"ESPN FC",     pick:"Colombia 2–1",  confidence:"Medium" },
      { name:"CBS Sports",  pick:"Colombia win",   confidence:"Medium" },
      { name:"NBC Sports",  pick:"Colombia 2–0",   pct:72 },
      { name:"SI.com",      pick:"Colombia comfortable",  confidence:"Medium" },
    ],
    consensus:"Colombia win", likelyScore:"2–0",
    summary:"James Rodríguez has been the feel-good story of the group stage and experts back Colombia strongly. Ghana qualified as 3rd place through DR Congo's run and are considered underdogs. NBC Sports gives Colombia 72%. ESPN FC notes Ghana's Kudus could be dangerous from wide positions but Colombia's backline has been exceptionally organised.",
  },
};

export default R32_EXPERT_PREDICTIONS;
