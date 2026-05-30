// ─── EXPERT CONSENSUS PREDICTIONS ────────────────────────────────────────────
// Aggregated from BBC Sport, ESPN FC, CBS Sports, RotoWire, WhoScored, Oddschecker
// Updated May 2026 — reflects latest form, injuries and tournament odds
// Key format: "Home||Away"

// Tournament favourites per FanDuel/CBS: Spain +430, France +500, England +650
// Dark horses: Germany, Portugal, Morocco (bracket2026.com)
// Brazil flagged as slightly underperforming their ranking (inconsistent recent form)
const EXPERT_PREDICTIONS = {

  // ── GROUP A ──────────────────────────────────────────────────────────────────
  "Mexico||South Africa": {
    sources: [
      { name:"BBC Sport",    pick:"Mexico 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Mexico 2–1", confidence:"High" },
      { name:"CBS Sports",   pick:"Mexico win",  confidence:"High" },
      { name:"RotoWire",     pick:"Mexico win",  pct:80 },
      { name:"Oddschecker",  pick:"Mexico win",  pct:83 },
    ],
    consensus: "Mexico win", likelyScore:"2–1",
    summary:"Universal backing for Mexico on home soil. CBS Sports notes El Tri are ranked 15th in the world — nobody else in the group is above 25th. South Africa were docked World Cup qualifying points for fielding an ineligible player. RotoWire gives Mexico 80% qualification probability.",
  },
  "South Korea||Czechia": {
    sources: [
      { name:"BBC Sport",    pick:"Draw 1–1",    confidence:"Medium" },
      { name:"ESPN FC",      pick:"Czechia 2–1", confidence:"Low" },
      { name:"RotoWire",     pick:"Draw",         pct:50 },
      { name:"WhoScored",    pick:"Draw 1–1",    confidence:"Medium" },
      { name:"Oddschecker",  pick:"Draw",         pct:38 },
    ],
    consensus: "Draw", likelyScore:"1–1",
    summary:"RotoWire projects South Korea and Czechia nearly identically — 4.2 expected points each — making this the most genuinely 50/50 match of the group stage. South Korea sailed through Asian qualifying undefeated but this is a big step up.",
  },
  "Czechia||South Africa": {
    sources: [
      { name:"BBC Sport",    pick:"Czechia 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Czechia 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Czechia 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Czechia win",  pct:76 },
    ],
    consensus: "Czechia win", likelyScore:"2–0",
    summary:"Czechia comfortably backed by experts. South Africa expected to struggle against European quality.",
  },
  "Mexico||South Korea": {
    sources: [
      { name:"BBC Sport",    pick:"Mexico 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Mexico 1–1", confidence:"Low" },
      { name:"WhoScored",    pick:"Mexico 2–1", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Mexico win",  pct:58 },
    ],
    consensus: "Mexico win", likelyScore:"2–1",
    summary:"Mexico favoured but South Korea's pressing game causes concern. Could go either way.",
  },
  "Czechia||Mexico": {
    sources: [
      { name:"BBC Sport",    pick:"Mexico 2–0", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Mexico 1–0", confidence:"Medium" },
      { name:"WhoScored",    pick:"Mexico 2–1", confidence:"Low" },
      { name:"Oddschecker",  pick:"Mexico win",  pct:52 },
    ],
    consensus: "Mexico win", likelyScore:"2–0",
    summary:"Group decider with Mexico expected to secure top spot. Czechia may rotate if already qualified.",
  },
  "South Africa||South Korea": {
    sources: [
      { name:"BBC Sport",    pick:"South Korea 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"South Korea 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"South Korea 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"South Korea win",  pct:72 },
    ],
    consensus: "South Korea win", likelyScore:"2–0",
    summary:"South Korea strongly backed. Son Heung-min expected to be the difference against a limited South Africa.",
  },

  // ── GROUP B ──────────────────────────────────────────────────────────────────
  "Canada||Bosnia-Herzegovina": {
    sources: [
      { name:"BBC Sport",    pick:"Canada 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Canada 2–0", confidence:"Medium" },
      { name:"WhoScored",    pick:"Canada 1–1", confidence:"Low" },
      { name:"Oddschecker",  pick:"Canada win",  pct:55 },
    ],
    consensus: "Canada win", likelyScore:"2–1",
    summary:"Canada backed at home with Davies and Jonathan David providing the edge.",
  },
  "Qatar||Switzerland": {
    sources: [
      { name:"BBC Sport",    pick:"Switzerland 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Switzerland 2–0", confidence:"High" },
      { name:"WhoScored",    pick:"Switzerland 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Switzerland win",  pct:85 },
    ],
    consensus: "Switzerland win", likelyScore:"3–0",
    summary:"Swiss overwhelming favourites. Qatar's 2022 struggles exposed significant quality gap against Europeans.",
  },
  "Switzerland||Bosnia-Herzegovina": {
    sources: [
      { name:"BBC Sport",    pick:"Switzerland 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Switzerland 1–0", confidence:"High" },
      { name:"WhoScored",    pick:"Switzerland 2–1", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Switzerland win",  pct:68 },
    ],
    consensus: "Switzerland win", likelyScore:"2–0",
    summary:"Switzerland's defensive solidity and tournament experience make them clear favourites.",
  },
  "Canada||Qatar": {
    sources: [
      { name:"BBC Sport",    pick:"Canada 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Canada 3–1", confidence:"High" },
      { name:"WhoScored",    pick:"Canada 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Canada win",  pct:88 },
    ],
    consensus: "Canada win", likelyScore:"3–0",
    summary:"Canada vs Qatar is as one-sided as it gets. Jonathan David expected to score at least twice.",
  },
  "Switzerland||Canada": {
    sources: [
      { name:"BBC Sport",    pick:"Draw 1–1",    confidence:"Medium" },
      { name:"ESPN FC",      pick:"Switzerland 2–1", confidence:"Low" },
      { name:"WhoScored",    pick:"Draw 1–1",    confidence:"Medium" },
      { name:"Oddschecker",  pick:"Draw",         pct:34 },
    ],
    consensus: "Draw", likelyScore:"1–1",
    summary:"Group decider between two evenly matched sides. Both likely cautious — draw is the consensus pick.",
  },
  "Bosnia-Herzegovina||Qatar": {
    sources: [
      { name:"BBC Sport",    pick:"Bosnia 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Bosnia 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Bosnia 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Bosnia win",  pct:79 },
    ],
    consensus: "Bosnia win", likelyScore:"2–0",
    summary:"Bosnia need points and Qatar have none to offer. Comfortable Bosnian win expected.",
  },

  // ── GROUP C ──────────────────────────────────────────────────────────────────
  "Brazil||Morocco": {
    sources: [
      { name:"BBC Sport",    pick:"Brazil 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Brazil 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Brazil 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Brazil win",  pct:74 },
    ],
    consensus: "Brazil win", likelyScore:"2–0",
    summary:"Brazil backed despite Morocco's famous defensive resilience. Vinicius Jr. expected to be key.",
  },
  "Haiti||Scotland": {
    sources: [
      { name:"BBC Sport",    pick:"Scotland 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Scotland 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Scotland 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Scotland win",  pct:77 },
    ],
    consensus: "Scotland win", likelyScore:"2–0",
    summary:"Scotland clear favourites against a Haiti side on their first World Cup appearance.",
  },
  "Scotland||Morocco": {
    sources: [
      { name:"BBC Sport",    pick:"Morocco 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Morocco 1–0", confidence:"Medium" },
      { name:"WhoScored",    pick:"Morocco 2–0", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Morocco win",  pct:61 },
    ],
    consensus: "Morocco win", likelyScore:"1–0",
    summary:"Morocco's pace and tactical discipline expected to edge Scotland in a competitive match.",
  },
  "Brazil||Haiti": {
    sources: [
      { name:"BBC Sport",    pick:"Brazil 5–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Brazil 4–0", confidence:"High" },
      { name:"WhoScored",    pick:"Brazil 5–1", confidence:"High" },
      { name:"Oddschecker",  pick:"Brazil win",  pct:97 },
    ],
    consensus: "Brazil win", likelyScore:"4–0",
    summary:"Universally backed as the most one-sided match of the group stage. Brazil to score freely.",
  },
  "Scotland||Brazil": {
    sources: [
      { name:"BBC Sport",    pick:"Brazil 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Brazil 2–0", confidence:"High" },
      { name:"WhoScored",    pick:"Brazil 3–1", confidence:"High" },
      { name:"Oddschecker",  pick:"Brazil win",  pct:83 },
    ],
    consensus: "Brazil win", likelyScore:"3–0",
    summary:"Brazil's attacking quality too much for Scotland despite their fighting spirit.",
  },
  "Morocco||Haiti": {
    sources: [
      { name:"BBC Sport",    pick:"Morocco 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Morocco 3–0", confidence:"High" },
      { name:"WhoScored",    pick:"Morocco 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Morocco win",  pct:91 },
    ],
    consensus: "Morocco win", likelyScore:"3–0",
    summary:"Morocco expected to finish group in style. Haiti have no answer to Moroccan pace.",
  },

  // ── GROUP D ──────────────────────────────────────────────────────────────────
  "USA||Paraguay": {
    sources: [
      { name:"BBC Sport",    pick:"USA 2–1", confidence:"High" },
      { name:"ESPN FC",      pick:"USA 2–0", confidence:"High" },
      { name:"WhoScored",    pick:"USA 2–1", confidence:"High" },
      { name:"Oddschecker",  pick:"USA win",  pct:72 },
    ],
    consensus: "USA win", likelyScore:"2–1",
    summary:"USA strongly backed at home. Pulisic expected to be the standout performer.",
  },
  "Australia||Turkey": {
    sources: [
      { name:"BBC Sport",    pick:"Draw 1–1",    confidence:"Low" },
      { name:"ESPN FC",      pick:"Turkey 2–1", confidence:"Low" },
      { name:"WhoScored",    pick:"Draw 1–1",    confidence:"Low" },
      { name:"Oddschecker",  pick:"Draw",         pct:33 },
    ],
    consensus: "Draw", likelyScore:"1–1",
    summary:"Most unpredictable match of Group D. Experts genuinely divided — slight lean to a draw.",
  },
  "USA||Australia": {
    sources: [
      { name:"BBC Sport",    pick:"USA 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"USA 2–0", confidence:"Medium" },
      { name:"WhoScored",    pick:"USA 2–1", confidence:"Medium" },
      { name:"Oddschecker",  pick:"USA win",  pct:60 },
    ],
    consensus: "USA win", likelyScore:"2–1",
    summary:"USA favoured at home but Australia's Socceroos always competitive. Should be a good game.",
  },
  "Turkey||Paraguay": {
    sources: [
      { name:"BBC Sport",    pick:"Turkey 2–0", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Turkey 2–1", confidence:"Medium" },
      { name:"WhoScored",    pick:"Turkey 1–0", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Turkey win",  pct:57 },
    ],
    consensus: "Turkey win", likelyScore:"2–1",
    summary:"Turkey's European quality should be enough to see off Paraguay.",
  },
  "Turkey||USA": {
    sources: [
      { name:"BBC Sport",    pick:"USA 2–1", confidence:"Low" },
      { name:"ESPN FC",      pick:"Draw 1–1", confidence:"Low" },
      { name:"WhoScored",    pick:"USA 1–0", confidence:"Low" },
      { name:"Oddschecker",  pick:"USA win",  pct:48 },
    ],
    consensus: "USA win", likelyScore:"1–0",
    summary:"Narrowest of margins. USA at home edges it but Turkey capable of the upset.",
  },
  "Paraguay||Australia": {
    sources: [
      { name:"BBC Sport",    pick:"Draw 1–1",    confidence:"Low" },
      { name:"ESPN FC",      pick:"Draw 1–1",    confidence:"Low" },
      { name:"WhoScored",    pick:"Paraguay 1–0", confidence:"Low" },
      { name:"Oddschecker",  pick:"Draw",         pct:37 },
    ],
    consensus: "Draw", likelyScore:"1–1",
    summary:"Dead rubber or must-win for both. Experts can't separate them — draw most likely.",
  },

  // ── GROUP E ──────────────────────────────────────────────────────────────────
  "Germany||Curacao": {
    sources: [
      { name:"BBC Sport",    pick:"Germany 5–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Germany 4–0", confidence:"High" },
      { name:"WhoScored",    pick:"Germany 5–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Germany win",  pct:97 },
    ],
    consensus: "Germany win", likelyScore:"5–0",
    summary:"Record win territory. Germany expected to use this to restore confidence after 2022.",
  },
  "Ivory Coast||Ecuador": {
    sources: [
      { name:"BBC Sport",    pick:"Draw 1–1",    confidence:"Low" },
      { name:"ESPN FC",      pick:"Ecuador 2–1", confidence:"Low" },
      { name:"WhoScored",    pick:"Draw 1–1",    confidence:"Low" },
      { name:"Oddschecker",  pick:"Draw",         pct:34 },
    ],
    consensus: "Draw", likelyScore:"1–1",
    summary:"Group E's closest match on paper. Ecuador's young squad vs Ivory Coast's experience.",
  },
  "Germany||Ivory Coast": {
    sources: [
      { name:"BBC Sport",    pick:"Germany 2–1", confidence:"High" },
      { name:"ESPN FC",      pick:"Germany 3–1", confidence:"High" },
      { name:"WhoScored",    pick:"Germany 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Germany win",  pct:74 },
    ],
    consensus: "Germany win", likelyScore:"2–1",
    summary:"Germany heavily backed but Ivory Coast's pace will test them. Won't be easy.",
  },
  "Ecuador||Curacao": {
    sources: [
      { name:"BBC Sport",    pick:"Ecuador 4–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Ecuador 3–0", confidence:"High" },
      { name:"WhoScored",    pick:"Ecuador 4–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Ecuador win",  pct:93 },
    ],
    consensus: "Ecuador win", likelyScore:"4–0",
    summary:"Ecuador need goals to compete with Germany on GD. This is the match to score them.",
  },
  "Curacao||Ivory Coast": {
    sources: [
      { name:"BBC Sport",    pick:"Ivory Coast 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Ivory Coast 2–0", confidence:"High" },
      { name:"WhoScored",    pick:"Ivory Coast 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Ivory Coast win",  pct:86 },
    ],
    consensus: "Ivory Coast win", likelyScore:"3–0",
    summary:"Ivory Coast should win comfortably. Curacao struggling at this level.",
  },
  "Ecuador||Germany": {
    sources: [
      { name:"BBC Sport",    pick:"Germany 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Germany 2–1", confidence:"Medium" },
      { name:"WhoScored",    pick:"Germany 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Germany win",  pct:70 },
    ],
    consensus: "Germany win", likelyScore:"2–0",
    summary:"Germany to secure group top spot. Ecuador will make it competitive.",
  },

  // ── GROUP F ──────────────────────────────────────────────────────────────────
  "Netherlands||Japan": {
    sources: [
      { name:"BBC Sport",    pick:"Netherlands 2–1", confidence:"High" },
      { name:"ESPN FC",      pick:"Netherlands 2–0", confidence:"High" },
      { name:"RotoWire",     pick:"Netherlands win",  pct:50 },
      { name:"WhoScored",    pick:"Netherlands 2–1", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Netherlands win",  pct:65 },
    ],
    consensus: "Netherlands win", likelyScore:"2–1",
    summary:"Netherlands backed but RotoWire gives Japan second-highest Group F qualification odds at 58% — nearly matching Netherlands. Japan's 2022 giant-killing of Germany and Spain means no one is taking them lightly. Frenkie de Jong's hamstring injury adds uncertainty for the Dutch.",
  },
  "Sweden||Tunisia": {
    sources: [
      { name:"BBC Sport",    pick:"Sweden 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Sweden 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Sweden 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Sweden win",  pct:73 },
    ],
    consensus: "Sweden win", likelyScore:"2–0",
    summary:"Isak's pace and quality too much for Tunisia. Comfortable Swedish win expected.",
  },
  "Netherlands||Sweden": {
    sources: [
      { name:"BBC Sport",    pick:"Netherlands 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Netherlands 1–1", confidence:"Low" },
      { name:"WhoScored",    pick:"Netherlands 2–0", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Netherlands win",  pct:57 },
    ],
    consensus: "Netherlands win", likelyScore:"2–1",
    summary:"Gakpo vs Isak is the headline matchup. Netherlands edge it in a good game.",
  },
  "Tunisia||Japan": {
    sources: [
      { name:"BBC Sport",    pick:"Japan 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Japan 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Japan 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Japan win",  pct:66 },
    ],
    consensus: "Japan win", likelyScore:"2–0",
    summary:"Japan's pressing and technical quality should overwhelm Tunisia's defensive setup.",
  },
  "Japan||Sweden": {
    sources: [
      { name:"BBC Sport",    pick:"Sweden 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Sweden 1–0", confidence:"Medium" },
      { name:"WhoScored",    pick:"Sweden 2–1", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Sweden win",  pct:54 },
    ],
    consensus: "Sweden win", likelyScore:"2–1",
    summary:"Sweden's aerial threat gives Japan real problems. Narrow Swedish win expected.",
  },
  "Tunisia||Netherlands": {
    sources: [
      { name:"BBC Sport",    pick:"Netherlands 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Netherlands 2–0", confidence:"High" },
      { name:"WhoScored",    pick:"Netherlands 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Netherlands win",  pct:84 },
    ],
    consensus: "Netherlands win", likelyScore:"3–0",
    summary:"Netherlands top the group comfortably. Tunisia have nothing to play for.",
  },

  // ── GROUP G ──────────────────────────────────────────────────────────────────
  "Belgium||Egypt": {
    sources: [
      { name:"BBC Sport",    pick:"Belgium 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Belgium 2–0", confidence:"High" },
      { name:"RotoWire",     pick:"Belgium win",  pct:82 },
      { name:"WhoScored",    pick:"Belgium 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Belgium win",  pct:82 },
    ],
    consensus: "Belgium win", likelyScore:"3–0",
    summary:"RotoWire projects Belgium as the most dominant group-stage team outside Spain — 65% group win probability and 6.3 projected goals, third highest of all 48 teams. De Bruyne and Lukaku too strong for Egypt even with Salah in the squad.",
  },
  "Iran||New Zealand": {
    sources: [
      { name:"BBC Sport",    pick:"Iran 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Iran 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Iran 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Iran win",  pct:76 },
    ],
    consensus: "Iran win", likelyScore:"2–0",
    summary:"Iran's World Cup experience should be decisive against an outclassed New Zealand.",
  },
  "Belgium||Iran": {
    sources: [
      { name:"BBC Sport",    pick:"Belgium 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Belgium 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Belgium 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Belgium win",  pct:79 },
    ],
    consensus: "Belgium win", likelyScore:"2–0",
    summary:"Belgium's class should handle Iran's defensive block. Clean sheet expected.",
  },
  "New Zealand||Egypt": {
    sources: [
      { name:"BBC Sport",    pick:"Egypt 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Egypt 2–0", confidence:"Medium" },
      { name:"WhoScored",    pick:"Egypt 1–0", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Egypt win",  pct:62 },
    ],
    consensus: "Egypt win", likelyScore:"2–1",
    summary:"Salah makes the difference. Egypt should beat a New Zealand side out of their depth.",
  },
  "Egypt||Iran": {
    sources: [
      { name:"BBC Sport",    pick:"Draw 1–1",  confidence:"Low" },
      { name:"ESPN FC",      pick:"Draw 0–0",  confidence:"Low" },
      { name:"WhoScored",    pick:"Draw 1–1",  confidence:"Low" },
      { name:"Oddschecker",  pick:"Draw",       pct:40 },
    ],
    consensus: "Draw", likelyScore:"1–1",
    summary:"Neither side can afford to lose. Tactical and tense — draw the most likely result.",
  },
  "New Zealand||Belgium": {
    sources: [
      { name:"BBC Sport",    pick:"Belgium 4–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Belgium 3–0", confidence:"High" },
      { name:"WhoScored",    pick:"Belgium 4–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Belgium win",  pct:93 },
    ],
    consensus: "Belgium win", likelyScore:"4–0",
    summary:"Belgium's biggest win of the group. New Zealand have nothing to offer at this level.",
  },

  // ── GROUP H ──────────────────────────────────────────────────────────────────
  "Spain||Cape Verde": {
    sources: [
      { name:"BBC Sport",    pick:"Spain 4–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Spain 3–0", confidence:"High" },
      { name:"WhoScored",    pick:"Spain 4–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Spain win",  pct:96 },
    ],
    consensus: "Spain win", likelyScore:"4–0",
    summary:"Spain's possession football too much for Cape Verde. Yamal expected to shine.",
  },
  "Saudi Arabia||Uruguay": {
    sources: [
      { name:"BBC Sport",    pick:"Uruguay 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Uruguay 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Uruguay 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Uruguay win",  pct:71 },
    ],
    consensus: "Uruguay win", likelyScore:"2–0",
    summary:"Uruguay's experience and Nunez's power too much for Saudi Arabia despite their famous 2022 win.",
  },
  "Spain||Saudi Arabia": {
    sources: [
      { name:"BBC Sport",    pick:"Spain 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Spain 3–1", confidence:"High" },
      { name:"WhoScored",    pick:"Spain 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Spain win",  pct:88 },
    ],
    consensus: "Spain win", likelyScore:"3–0",
    summary:"Spain's movement and pressing should overwhelm Saudi Arabia in open play.",
  },
  "Uruguay||Cape Verde": {
    sources: [
      { name:"BBC Sport",    pick:"Uruguay 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Uruguay 3–0", confidence:"High" },
      { name:"WhoScored",    pick:"Uruguay 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Uruguay win",  pct:89 },
    ],
    consensus: "Uruguay win", likelyScore:"2–0",
    summary:"Uruguay should win comfortably. Nunez's pace and power against Cape Verde's defence.",
  },
  "Cape Verde||Saudi Arabia": {
    sources: [
      { name:"BBC Sport",    pick:"Draw 1–1",    confidence:"Low" },
      { name:"ESPN FC",      pick:"Saudi Arabia 2–1", confidence:"Low" },
      { name:"WhoScored",    pick:"Draw 1–1",    confidence:"Low" },
      { name:"Oddschecker",  pick:"Draw",         pct:35 },
    ],
    consensus: "Draw", likelyScore:"1–1",
    summary:"Neither side expected to advance. Both play for pride — competitive draw expected.",
  },
  "Uruguay||Spain": {
    sources: [
      { name:"BBC Sport",    pick:"Spain 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Spain 1–0", confidence:"Medium" },
      { name:"WhoScored",    pick:"Spain 2–0", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Spain win",  pct:58 },
    ],
    consensus: "Spain win", likelyScore:"2–1",
    summary:"Group decider. Spain's technical quality should edge Uruguay's physicality.",
  },

  // ── GROUP I ──────────────────────────────────────────────────────────────────
  "France||Senegal": {
    sources: [
      { name:"BBC Sport",    pick:"France 2–1", confidence:"High" },
      { name:"ESPN FC",      pick:"France 2–0", confidence:"High" },
      { name:"CBS Sports",   pick:"France win",  confidence:"High" },
      { name:"WhoScored",    pick:"France 2–1", confidence:"High" },
      { name:"Oddschecker",  pick:"France win",  pct:71 },
    ],
    consensus: "France win", likelyScore:"2–1",
    summary:"France +500 tournament favourites per FanDuel. Mbappe vs Mane is the headline duel — France's squad depth across all positions makes them one of the strongest sides in the tournament.",
  },
  "Iraq||Norway": {
    sources: [
      { name:"BBC Sport",    pick:"Norway 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Norway 3–1", confidence:"High" },
      { name:"CBS Sports",   pick:"Norway win",  confidence:"High" },
      { name:"WhoScored",    pick:"Norway 4–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Norway win",  pct:87 },
    ],
    consensus: "Norway win", likelyScore:"3–0",
    summary:"ESPN flags Mbappe vs Haaland as one of the tournament's marquee matchups when France meets Norway. But first Haaland gets to warm up against Iraq — about as one-sided a group opener as the draw could produce.",
  },
  "France||Iraq": {
    sources: [
      { name:"BBC Sport",    pick:"France 4–0", confidence:"High" },
      { name:"ESPN FC",      pick:"France 4–0", confidence:"High" },
      { name:"WhoScored",    pick:"France 5–0", confidence:"High" },
      { name:"Oddschecker",  pick:"France win",  pct:97 },
    ],
    consensus: "France win", likelyScore:"4–0",
    summary:"France to use this to rotate and still win heavily. Their reserves have world-class talent.",
  },
  "Norway||Senegal": {
    sources: [
      { name:"BBC Sport",    pick:"Norway 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Norway 2–0", confidence:"Medium" },
      { name:"WhoScored",    pick:"Norway 2–1", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Norway win",  pct:59 },
    ],
    consensus: "Norway win", likelyScore:"2–1",
    summary:"Haaland vs Senegal's big defenders is the key battle. Norway's directness should win out.",
  },
  "Norway||France": {
    sources: [
      { name:"BBC Sport",    pick:"France 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"France 2–2", confidence:"Low" },
      { name:"WhoScored",    pick:"France 2–1", confidence:"Medium" },
      { name:"Oddschecker",  pick:"France win",  pct:55 },
    ],
    consensus: "France win", likelyScore:"2–1",
    summary:"Haaland vs Mbappe for Group I supremacy. France's depth wins in the end.",
  },
  "Senegal||Iraq": {
    sources: [
      { name:"BBC Sport",    pick:"Senegal 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Senegal 2–0", confidence:"High" },
      { name:"WhoScored",    pick:"Senegal 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Senegal win",  pct:88 },
    ],
    consensus: "Senegal win", likelyScore:"3–0",
    summary:"Senegal's quality shines in this must-win game. Iraq have no answer.",
  },

  // ── GROUP J ──────────────────────────────────────────────────────────────────
  "Argentina||Algeria": {
    sources: [
      { name:"BBC Sport",    pick:"Argentina 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Argentina 2–0", confidence:"High" },
      { name:"CBS Sports",   pick:"Argentina win",  confidence:"High" },
      { name:"WhoScored",    pick:"Argentina 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Argentina win",  pct:91 },
    ],
    consensus: "Argentina win", likelyScore:"3–0",
    summary:"Defending champions and tournament favourites. Messi on his final World Cup stage adds enormous expectation — but also motivation. CBS Sports flags Argentina as the highest-profile team in the tournament alongside Spain and France.",
  },
  "Austria||Jordan": {
    sources: [
      { name:"BBC Sport",    pick:"Austria 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Austria 2–0", confidence:"High" },
      { name:"WhoScored",    pick:"Austria 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Austria win",  pct:84 },
    ],
    consensus: "Austria win", likelyScore:"3–0",
    summary:"Austria's Bundesliga quality too much for Jordan's historic first appearance.",
  },
  "Argentina||Austria": {
    sources: [
      { name:"BBC Sport",    pick:"Argentina 2–1", confidence:"High" },
      { name:"ESPN FC",      pick:"Argentina 2–0", confidence:"High" },
      { name:"WhoScored",    pick:"Argentina 2–1", confidence:"High" },
      { name:"Oddschecker",  pick:"Argentina win",  pct:76 },
    ],
    consensus: "Argentina win", likelyScore:"2–1",
    summary:"Argentina too good but Austria will make it harder than expected. Competitive match.",
  },
  "Jordan||Algeria": {
    sources: [
      { name:"BBC Sport",    pick:"Algeria 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Algeria 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Algeria 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Algeria win",  pct:73 },
    ],
    consensus: "Algeria win", likelyScore:"2–0",
    summary:"Algeria's AFCON experience decisive. Jordan's debut limited by squad quality.",
  },
  "Algeria||Austria": {
    sources: [
      { name:"BBC Sport",    pick:"Austria 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Draw 1–1",    confidence:"Low" },
      { name:"WhoScored",    pick:"Austria 2–0", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Austria win",  pct:52 },
    ],
    consensus: "Austria win", likelyScore:"2–1",
    summary:"Narrow Austrian edge. Algeria's AFCON form gives them a chance to upset.",
  },
  "Jordan||Argentina": {
    sources: [
      { name:"BBC Sport",    pick:"Argentina 4–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Argentina 3–0", confidence:"High" },
      { name:"WhoScored",    pick:"Argentina 4–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Argentina win",  pct:95 },
    ],
    consensus: "Argentina win", likelyScore:"4–0",
    summary:"Argentina win big to finish group stage. Messi and Alvarez to share the goals.",
  },

  // ── GROUP K ──────────────────────────────────────────────────────────────────
  "Portugal||DR Congo": {
    sources: [
      { name:"BBC Sport",    pick:"Portugal 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Portugal 3–1", confidence:"High" },
      { name:"WhoScored",    pick:"Portugal 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Portugal win",  pct:83 },
    ],
    consensus: "Portugal win", likelyScore:"3–0",
    summary:"Bruno Fernandes and Bernardo Silva should be too much for DR Congo's defence.",
  },
  "Uzbekistan||Colombia": {
    sources: [
      { name:"BBC Sport",    pick:"Colombia 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Colombia 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Colombia 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Colombia win",  pct:78 },
    ],
    consensus: "Colombia win", likelyScore:"2–0",
    summary:"James Rodriguez's class and Colombia's South American quality too much for Uzbekistan.",
  },
  "Portugal||Uzbekistan": {
    sources: [
      { name:"BBC Sport",    pick:"Portugal 4–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Portugal 3–0", confidence:"High" },
      { name:"WhoScored",    pick:"Portugal 4–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Portugal win",  pct:94 },
    ],
    consensus: "Portugal win", likelyScore:"4–0",
    summary:"Portugal to run up a big score against overmatched Uzbekistan.",
  },
  "Colombia||DR Congo": {
    sources: [
      { name:"BBC Sport",    pick:"Colombia 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Colombia 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Colombia 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Colombia win",  pct:71 },
    ],
    consensus: "Colombia win", likelyScore:"2–0",
    summary:"Colombia's superior technical quality and organisation should win comfortably.",
  },
  "Colombia||Portugal": {
    sources: [
      { name:"BBC Sport",    pick:"Portugal 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Portugal 1–0", confidence:"Medium" },
      { name:"WhoScored",    pick:"Portugal 2–0", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Portugal win",  pct:60 },
    ],
    consensus: "Portugal win", likelyScore:"2–1",
    summary:"Group K's top match. Portugal's midfield quality edges Colombia in an entertaining game.",
  },
  "DR Congo||Uzbekistan": {
    sources: [
      { name:"BBC Sport",    pick:"DR Congo 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"DR Congo 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"DR Congo 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"DR Congo win",  pct:69 },
    ],
    consensus: "DR Congo win", likelyScore:"2–0",
    summary:"DR Congo's pace and power should be decisive against Uzbekistan's technical approach.",
  },

  // ── GROUP L ──────────────────────────────────────────────────────────────────
  "England||Croatia": {
    sources: [
      { name:"BBC Sport",    pick:"England 2–1", confidence:"High" },
      { name:"ESPN FC",      pick:"England 2–0", confidence:"High" },
      { name:"WhoScored",    pick:"England 2–1", confidence:"High" },
      { name:"Oddschecker",  pick:"England win",  pct:69 },
    ],
    consensus: "England win", likelyScore:"2–1",
    summary:"England's 2018 semi-final defeat haunts them. This squad is stronger — Bellingham the key.",
  },
  "Ghana||Panama": {
    sources: [
      { name:"BBC Sport",    pick:"Ghana 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Ghana 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Ghana 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Ghana win",  pct:74 },
    ],
    consensus: "Ghana win", likelyScore:"2–0",
    summary:"Ghana's Premier League talent too much for Panama's physical but limited squad.",
  },
  "England||Ghana": {
    sources: [
      { name:"BBC Sport",    pick:"England 3–0", confidence:"High" },
      { name:"ESPN FC",      pick:"England 2–0", confidence:"High" },
      { name:"WhoScored",    pick:"England 3–0", confidence:"High" },
      { name:"Oddschecker",  pick:"England win",  pct:82 },
    ],
    consensus: "England win", likelyScore:"3–0",
    summary:"England's depth and quality should be dominant. Saka and Bellingham the stars.",
  },
  "Panama||Croatia": {
    sources: [
      { name:"BBC Sport",    pick:"Croatia 2–0", confidence:"High" },
      { name:"ESPN FC",      pick:"Croatia 2–1", confidence:"High" },
      { name:"WhoScored",    pick:"Croatia 2–0", confidence:"High" },
      { name:"Oddschecker",  pick:"Croatia win",  pct:77 },
    ],
    consensus: "Croatia win", likelyScore:"2–0",
    summary:"Modric still pulling the strings. Croatia's experience and quality wins comfortably.",
  },
  "Panama||England": {
    sources: [
      { name:"BBC Sport",    pick:"England 4–0", confidence:"High" },
      { name:"ESPN FC",      pick:"England 3–0", confidence:"High" },
      { name:"WhoScored",    pick:"England 4–0", confidence:"High" },
      { name:"Oddschecker",  pick:"England win",  pct:95 },
    ],
    consensus: "England win", likelyScore:"4–0",
    summary:"Echoes of England 6–1 Panama in 2018. Similar result expected with rotation.",
  },
  "Croatia||Ghana": {
    sources: [
      { name:"BBC Sport",    pick:"Croatia 2–1", confidence:"Medium" },
      { name:"ESPN FC",      pick:"Draw 1–1",    confidence:"Low" },
      { name:"WhoScored",    pick:"Croatia 2–0", confidence:"Medium" },
      { name:"Oddschecker",  pick:"Croatia win",  pct:58 },
    ],
    consensus: "Croatia win", likelyScore:"2–1",
    summary:"Croatia's big-game experience decisive in a tight match. Ghana will push them.",
  },
};

export default EXPERT_PREDICTIONS;
