import { useState, useEffect, useCallback, useRef } from "react";
import React from "react";
import { supabase } from './supabase.js';
import {
  sbGetUser, sbCreateUser, sbResetPin, sbVerifyRecovery, sbClearUser, sbDeleteUser, sbTogglePaid,
  sbGetPrediction, sbSavePrediction,
  sbGetActualResults, sbSaveActualResults,
  sbGetLeaderboard, sbUpsertLeaderboard, sbGetAllGroupCodes,
  sbGetAllPredictions, sbBatchUpdateLeaderboard,
  sbGetSaveHistory, sbAddSaveHistory,
  sbGetAIContent, sbSaveAIContent, sbMergeAIContent,
  invalidateLBCache, invalidatePredsCache,
  sbGetAnalytics, sbSaveAnalytics,
  sbGetNews, sbSaveNews,
  sbGetMessages, sbSendMessage, sbDeleteMessage,
  sbUpdateRankHistory, sbGetRankHistory,
  sbGetReactions, sbToggleReaction,
  saveSession, getSession, clearSession,
  generateRecoveryCode,
  lsGet, lsSet, lsDel, detectStorage,
} from './storage.js';
import { fetchLiveFeed, parseFeed, applyFeedToState } from './liveFeed.js';
import GROUP_INSIGHTS from './insights.js';
import EXPERT_PREDICTIONS from './experts.js';
import GROUP_AI_PREDICTIONS from './groupPredictions.js';
import R32_AI_PREDICTIONS from './r32Predictions.js';
import R32_EXPERT_PREDICTIONS from './r32Experts.js';


// ─── DATA ────────────────────────────────────────────────────────────────────

const GROUPS = {
  A: ["Mexico", "South Korea", "South Africa", "Czechia"],
  B: ["Canada", "Switzerland", "Qatar", "Bosnia-Herzegovina"],
  C: ["Brazil", "Morocco", "Scotland", "Haiti"],
  D: ["USA", "Paraguay", "Australia", "Turkey"],
  E: ["Germany", "Ecuador", "Ivory Coast", "Curacao"],
  F: ["Netherlands", "Japan", "Tunisia", "Sweden"],
  G: ["Belgium", "Iran", "Egypt", "New Zealand"],
  H: ["Spain", "Uruguay", "Saudi Arabia", "Cape Verde"],
  I: ["France", "Senegal", "Norway", "Iraq"],
  J: ["Argentina", "Austria", "Algeria", "Jordan"],
  K: ["Portugal", "Colombia", "Uzbekistan", "DR Congo"],
  L: ["England", "Croatia", "Panama", "Ghana"],
};

// FIFA Rankings — April 2026 official update
const FIFA_RANKINGS = {
  'France':1,'Spain':2,'Argentina':3,'England':4,'Portugal':5,
  'Brazil':6,'Belgium':7,'Netherlands':8,'Germany':9,'Morocco':10,
  'Colombia':11,'Uruguay':12,'USA':13,'Croatia':14,'Mexico':15,
  'Japan':16,'Turkey':17,'Senegal':18,'Switzerland':19,'Ecuador':20,
  'Norway':21,'Austria':22,'Denmark':23,'South Korea':24,'Australia':25,
  'Canada':26,'Scotland':27,'Sweden':28,'Ivory Coast':29,'Ghana':30,
  'Serbia':31,'Algeria':32,'Iran':33,'Egypt':34,'Poland':35,
  'DR Congo':36,'Bosnia-Herzegovina':37,'Tunisia':38,'Paraguay':39,'Saudi Arabia':40,
  'Czechia':41,'Panama':42,'Iraq':43,'Qatar':44,'New Zealand':45,
  'South Africa':46,'Uzbekistan':47,'Cape Verde':48,'Jordan':49,'Haiti':50,
  'Curacao':51,
};

const FLAGS = {
  // Group A
  Mexico:"🇲🇽","South Korea":"🇰🇷","South Africa":"🇿🇦",Czechia:"🇨🇿",
  // Group B
  Canada:"🇨🇦",Switzerland:"🇨🇭",Qatar:"🇶🇦","Bosnia-Herzegovina":"🇧🇦",
  // Group C
  Brazil:"🇧🇷",Morocco:"🇲🇦",Scotland:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",Haiti:"🇭🇹",
  // Group D
  USA:"🇺🇸",Paraguay:"🇵🇾",Australia:"🇦🇺",Turkey:"🇹🇷",
  // Group E
  Germany:"🇩🇪",Ecuador:"🇪🇨","Ivory Coast":"🇨🇮",Curacao:"🇨🇼",
  // Group F
  Netherlands:"🇳🇱",Japan:"🇯🇵",Tunisia:"🇹🇳",Sweden:"🇸🇪",
  // Group G
  Belgium:"🇧🇪",Iran:"🇮🇷",Egypt:"🇪🇬","New Zealand":"🇳🇿",
  // Group H
  Spain:"🇪🇸",Uruguay:"🇺🇾","Saudi Arabia":"🇸🇦","Cape Verde":"🇨🇻",
  // Group I
  France:"🇫🇷",Senegal:"🇸🇳",Norway:"🇳🇴",Iraq:"🇮🇶",
  // Group J
  Argentina:"🇦🇷",Austria:"🇦🇹",Algeria:"🇩🇿",Jordan:"🇯🇴",
  // Group K
  Portugal:"🇵🇹",Colombia:"🇨🇴",Uzbekistan:"🇺🇿","DR Congo":"🇨🇩",
  // Group L
  England:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",Croatia:"🇭🇷",Panama:"🇵🇦",Ghana:"🇬🇭",
  TBD:"🏳️",
  // API-Football name aliases
  "Czech Republic":"🇨🇿","Korea Republic":"🇰🇷","IR Iran":"🇮🇷",
  "Bosnia and Herzegovina":"🇧🇦","Bosnia & Herzegovina":"🇧🇦",
  "Côte d'Ivoire":"🇨🇮","Cote d'Ivoire":"🇨🇮","Ivory Coast":"🇨🇮",
  "United States":"🇺🇸","Türkiye":"🇹🇷","Congo DR":"🇨🇩",
  "Curaçao":"🇨🇼","Serbia":"🇷🇸","Colombia":"🇨🇴",
  "Saudi Arabia":"🇸🇦","New Zealand":"🇳🇿","Cape Verde":"🇨🇻",
  "DR Congo":"🇨🇩","South Korea":"🇰🇷",
};

// Normalise team names from openfootball to match our app's names
const TEAM_ALIASES = {
  "United States": "USA",
  "Korea Republic": "South Korea",
  "Czechia": "Czechia",
  "Czech Republic": "Czechia",
  "Bosnia and Herzegovina": "Bosnia-Herzegovina",
  "Bosnia & Herzegovina":   "Bosnia-Herzegovina",
  "IR Iran": "Iran",
  "Congo DR": "DR Congo",
  "Côte d'Ivoire": "Ivory Coast",
  "Cote d'Ivoire": "Ivory Coast",
  "Türkiye": "Turkey",
  "Curacao": "Curacao",
  "Curaçao": "Curacao",
  "Cabo Verde": "Cape Verde",
  "Cape Verde Islands": "Cape Verde",
};
function normalise(name) { return TEAM_ALIASES[name] || name; }

function generateGroupMatches(group, teams) {
  const m = [];
  for (let i=0;i<teams.length;i++)
    for (let j=i+1;j<teams.length;j++)
      m.push({id:`${group}-${i}-${j}`,group,home:teams[i],away:teams[j],homeScore:null,awayScore:null});
  return m;
}

const ALL_MATCHES = Object.entries(GROUPS).flatMap(([g,t])=>generateGroupMatches(g,t));
const KO_ROUNDS = ["Round of 32","Round of 16","Quarter-Finals","Semi-Finals","Final"];

function makeKORound(name,count){
  return Array.from({length:count},(_,i)=>({
    id:`${name.replace(/\s/g,"_")}_${i}`,round:name,
    home:"TBD",away:"TBD",homeScore:null,awayScore:null,
  }));
}

const KNOCKOUT_TEMPLATE = [
  ...makeKORound("Round of 32",16),...makeKORound("Round of 16",8),
  ...makeKORound("Quarter-Finals",4),...makeKORound("Semi-Finals",2),
  ...makeKORound("Final",1),
];

// FIFA 2026 official Round of 32 bracket seeding
// Slots: G1=group winner, G2=runner-up, T=best 3rd place (seeded by FIFA after groups)
// The 16 R32 matchups — 3rd place slots filled by FIFA seeding table after group stage
// For predictions: top 2 auto-fill, 3rd place slots stay TBD until live feed confirms
const R32_SEEDING = [
  ["A1","B2"],["C1","D2"],["E1","F2"],["G1","H2"],
  ["I1","J2"],["K1","L2"],["B1","A2"],["D1","C2"],
  ["F1","E2"],["H1","G2"],["J1","I2"],["L1","K2"],
  ["A1","C2"],["B1","D2"],["E1","G2"],["F1","H2"],
];

// Rank 3rd-place teams: pts → gd → gf → alphabetical
function rankThirdPlace(standings3rd) {
  return [...standings3rd].sort((a,b)=>
    b.pts-a.pts || b.gd-a.gd || b.gf-a.gf || a.team.localeCompare(b.team)
  );
}

// Given any set of matches, derive qualifiers including best-8 third-place
function deriveQualifiers(matches) {
  const qualifiers = {};
  const thirdPlaceTeams = [];

  for (const [group, teams] of Object.entries(GROUPS)) {
    const groupMatches = matches.filter(m=>m.group===group);
    const standings = calcStandings(teams, groupMatches);
    if (standings[0]) qualifiers[`${group}1`] = standings[0].team;
    if (standings[1]) qualifiers[`${group}2`] = standings[1].team;
    if (standings[2]) thirdPlaceTeams.push({ ...standings[2], group });
  }

  // Rank all 3rd-place teams, best 8 qualify
  const best8 = rankThirdPlace(thirdPlaceTeams).slice(0, 8);
  best8.forEach((t, i) => { qualifiers[`T${i+1}`] = t.team; });

  return qualifiers;
}

// Parse actual qualifiers from live OFB feed group standings
function parseOFBQualifiers(data, appMatches) {
  if (!data || !data.matches) return null;
  // Apply OFB results to our match list to get actual standings
  const ofbResults = parseOFBResults(data);
  const actualMatches = applyOFBResults(appMatches, ofbResults);

  // Only compute if all group matches in a group are done
  const qualifiers = {};
  const thirdPlaceTeams = [];
  let anyGroupComplete = false;

  for (const [group, teams] of Object.entries(GROUPS)) {
    const groupMatches = actualMatches.filter(m=>m.group===group);
    const allPlayed = groupMatches.every(m=>m.homeScore!==null&&m.awayScore!==null);
    if (!allPlayed) continue; // skip incomplete groups
    anyGroupComplete = true;
    const standings = calcStandings(teams, groupMatches);
    if (standings[0]) qualifiers[`${group}1`] = standings[0].team;
    if (standings[1]) qualifiers[`${group}2`] = standings[1].team;
    if (standings[2]) thirdPlaceTeams.push({ ...standings[2], group });
  }

  if (!anyGroupComplete) return null;

  // Best 8 third-place teams from completed groups
  const best8 = rankThirdPlace(thirdPlaceTeams).slice(0, 8);
  best8.forEach((t, i) => { qualifiers[`T${i+1}`] = t.team; });

  return qualifiers;
}

// ── PREDICTION bracket: group stage only ──
// User predicts scores for knockout matches once teams are known from live feed.
// Team names in knockout come ONLY from live results, never from predicted winners.
// This function just resets any prediction-derived team names back to TBD.
function resetKnockoutTeams(knockout) {
  return knockout.map(m => ({ ...m, home: "TBD", away: "TBD" }));
}

// ── LIVE bracket fill: from actual results only ──
// 1. R32 team names from actual group qualifiers (live feed)
// 2. R16→Final team names from actual R32/R16/QF/SF winners (live feed scores)
function fillLiveBracket(actualKO, liveQualifiers, actualKOResults) {
  const getWinner = m => {
    if (m.homeScore===null||m.awayScore===null) return null;
    if (m.homeScore>m.awayScore) return m.home;
    if (m.awayScore>m.homeScore) return m.away;
    // Knockout draw — check ET/penalties (handled by feed already)
    return null;
  };

  let ko = actualKO.map(m=>({...m}));
  const r32 = ko.filter(m=>m.round==="Round of 32");

  // ── Step 1: Fill R32 team names from live group qualifiers ──
  if (liveQualifiers) {
    ko = ko.map(m => {
      if (m.round!=="Round of 32") return m;
      const idx = r32.findIndex(x=>x.id===m.id);
      const seed = R32_SEEDING[idx];
      if (!seed) return m;
      return {
        ...m,
        home: liveQualifiers[seed[0]] || "TBD",
        away: liveQualifiers[seed[1]] || "TBD",
      };
    });
  }

  // ── Step 2: Apply actual knockout scores from live feed ──
  if (actualKOResults) {
    ko = ko.map(m => {
      const key = `${m.home}||${m.away}`;
      const res = actualKOResults[key];
      if (!res) return m;
      return { ...m, homeScore: res.homeScore, awayScore: res.awayScore };
    });
  }

  // ── Step 3: Cascade winners R32→R16→QF→SF→Final ──
  const roundOrder = ["Round of 32","Round of 16","Quarter-Finals","Semi-Finals"];
  const nextRound  = {"Round of 32":"Round of 16","Round of 16":"Quarter-Finals","Quarter-Finals":"Semi-Finals","Semi-Finals":"Final"};

  for (const round of roundOrder) {
    const curRound = ko.filter(m=>m.round===round);
    const nxt      = nextRound[round];
    const nxtRound = ko.filter(m=>m.round===nxt);
    for (let i=0; i<nxtRound.length; i++) {
      const matchA = curRound[i*2];
      const matchB = curRound[i*2+1];
      if (!matchA||!matchB) continue;
      const winA = getWinner(matchA);
      const winB = getWinner(matchB);
      const target = ko.find(m=>m.id===nxtRound[i].id);
      if (!target) continue;
      if (winA) target.home = winA;
      if (winB) target.away = winB;
    }
  }

  return ko;
}

// ─── OPENFOOTBALL API ─────────────────────────────────────────────────────────
const OFB_RAW = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
// Use a CORS proxy since raw.githubusercontent.com is blocked in browser artifacts
const OFB_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(OFB_RAW)}`;

// Parse the openfootball JSON into a flat map: "Home||Away" -> { homeScore, awayScore }
function parseOFBResults(data) {
  const results = {};
  if (!data || !data.matches) return results;
  for (const m of data.matches) {
    if (!m.score || !m.score.ft) continue;
    const home = normalise(m.team1);
    const away = normalise(m.team2);
    const [hs, as] = m.score.ft;
    results[`${home}||${away}`] = { homeScore: hs, awayScore: as };
    results[`${away}||${home}`] = { homeScore: as, awayScore: hs };
  }
  return results;
}

// Parse kickoff times from OFB feed: "Home||Away" -> ISO timestamp (UTC)
// OFB time format: "13:00 UTC-6" or "20:00 UTC+2" alongside date "2026-06-11"
function parseOFBKickoffs(data) {
  const kickoffs = {};
  if (!data || !data.matches) return kickoffs;
  for (const m of data.matches) {
    if (!m.date || !m.time) continue;
    const home = normalise(m.team1);
    const away = normalise(m.team2);
    // Parse "HH:MM UTC±N" -> UTC milliseconds
    try {
      const timeMatch = m.time.match(/(\d{2}):(\d{2})\s*UTC([+-]\d+)/);
      if (!timeMatch) continue;
      const [, hh, mm, offset] = timeMatch;
      const offsetMs = parseInt(offset) * 60 * 60 * 1000;
      const localMs = new Date(`${m.date}T${hh}:${mm}:00Z`).getTime();
      const utcMs = localMs - offsetMs; // convert local to UTC
      kickoffs[`${home}||${away}`] = utcMs;
      kickoffs[`${away}||${home}`] = utcMs;
    } catch {}
  }
  return kickoffs;
}

// Lock predictions 15 min before kickoff
function isMatchLocked(match, kickoffs, koKickoffsById={}) {
  const key = `${match.home}||${match.away}`;
  const ko = kickoffs[key] || koKickoffsById[match.id];
  if (!ko) return false;
  const LOCK_BEFORE_MS = 15 * 60 * 1000;
  return Date.now() >= (ko - LOCK_BEFORE_MS);
}

function timeUntilLock(match, kickoffs, koKickoffsById={}) {
  const key = `${match.home}||${match.away}`;
  const ko = kickoffs[key] || koKickoffsById[match.id];
  if (!ko) return null;
  const diff = (ko - 15 * 60 * 1000) - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h/24)}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Champion pick locks at kickoff of first match — June 11, 2026 17:00 UTC
const CHAMPION_LOCK_DATE = new Date("2026-06-20T00:00:00Z").getTime(); // End of Friday June 19
function isChampionLocked(nowMs = Date.now()) { return nowMs >= CHAMPION_LOCK_DATE; }
function timeUntilChampionLock(nowMs = Date.now()) {
  const diff = CHAMPION_LOCK_DATE - nowMs;
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const h    = Math.floor((diff % 86400000) / 3600000);
  const m    = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${h}h`;
  if (h > 0)    return `${h}h ${m}m`;
  return `${m}m`;
}

// Parse the actual podium (1st/2nd/3rd) from OFB feed
function parseOFBPodium(data) {
  if (!data || !data.matches) return null;
  const podium = {};

  // Final → 1st and 2nd place
  const finalMatch = data.matches.find(m => {
    const round = (m.round || m.group || m.stage || "").toLowerCase();
    return round === "final" || round === "final round";
  });
  if (finalMatch?.score?.ft) {
    const [hs, as] = finalMatch.score.ft;
    const getKOWinner = (m, h, a) => {
      if (h===a) {
        const p=m.score?.p, et=m.score?.et;
        if (p)  return p[0]>p[1]  ? normalise(m.team1) : normalise(m.team2);
        if (et) return et[0]>et[1] ? normalise(m.team1) : normalise(m.team2);
        return null;
      }
      return h>a ? normalise(m.team1) : normalise(m.team2);
    };
    const winner = getKOWinner(finalMatch, hs, as);
    const loser  = winner===normalise(finalMatch.team1) ? normalise(finalMatch.team2) : normalise(finalMatch.team1);
    if (winner) { podium.first = winner; podium.second = loser; }
  }

  // 3rd place playoff
  const thirdMatch = data.matches.find(m => {
    const round = (m.round || m.group || m.stage || "").toLowerCase();
    return round.includes("third") || round.includes("3rd") || round.includes("third place");
  });
  if (thirdMatch?.score?.ft) {
    const [hs, as] = thirdMatch.score.ft;
    if (hs!==as) podium.third = hs>as ? normalise(thirdMatch.team1) : normalise(thirdMatch.team2);
    else {
      const p=thirdMatch.score?.p, et=thirdMatch.score?.et;
      if (p)  podium.third = p[0]>p[1]  ? normalise(thirdMatch.team1) : normalise(thirdMatch.team2);
      if (et) podium.third = et[0]>et[1] ? normalise(thirdMatch.team1) : normalise(thirdMatch.team2);
    }
  }

  return Object.keys(podium).length > 0 ? podium : null;
}
function applyOFBResults(appMatches, ofbResults) {
  return appMatches.map(m => {
    const key = `${m.home}||${m.away}`;
    const res = ofbResults[key];
    if (!res) return m;
    return { ...m, homeScore: res.homeScore, awayScore: res.awayScore };
  });
}


// ─── SCORING ─────────────────────────────────────────────────────────────────
function calcMatchPoints(pred, actual) {
  const ph=pred.homeScore,pa=pred.awayScore;
  const ah=actual.homeScore,aa=actual.awayScore;
  if (ph===null||pa===null||ah===null||aa===null) return null;
  const exact = ph===ah && pa===aa;
  const correctGD = (ph-pa)===(ah-aa);
  const predOut = ph>pa?"W":ph<pa?"L":"D";
  const actOut  = ah>aa?"W":ah<aa?"L":"D";
  const correctOut = predOut===actOut;
  if (exact)      return {points:6,label:"Exact score ⭐",     color:"#22c55e"};
  if (correctGD)  return {points:4,label:"Correct goal diff 📐",color:"#fcb900"};
  if (correctOut) return {points:2,label:"Correct outcome ✓",  color:"#60a5fa"};
  return            {points:0,label:"No points",               color:"#ef4444"};
}

function calcTotal(pM,aM,pK,aK,predPodium,actualPodium){
  let t=0;
  for(const p of pM){const a=aM.find(m=>m.id===p.id);if(a){const r=calcMatchPoints(p,a);if(r)t+=r.points;}}
  for(const p of pK){const a=aK.find(m=>m.id===p.id);if(a){const r=calcMatchPoints(p,a);if(r)t+=r.points;}}
  if(actualPodium&&predPodium){
    const actualPodiumTeams = new Set([actualPodium.first, actualPodium.second, actualPodium.third].filter(Boolean));
    const EXACT_PTS = {first:50, second:25, third:15};

    for(const place of ['first','second','third']){
      const pred = predPodium[place];
      if(!pred) continue;
      if(pred === actualPodium[place]) {
        // Exact rank match — full points
        t += EXACT_PTS[place];
      } else if(actualPodiumTeams.has(pred)) {
        // In podium but wrong rank — overlap bonus
        t += 10;
      }
    }
    // Top scorer — fuzzy match with edit distance for typos like "mbape" vs "mbappe"
    if(predPodium.topScorer && actualPodium.topScorer){
      const normS = s => {
        const cleaned = (s||'').trim().replace(/\b(jr|sr|ii|iii)\.?$/i,'').trim();
        const lastName = cleaned.split(/\s+/).pop()||cleaned;
        return lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
      };
      const editDist = (a,b) => {
        const m=a.length, n=b.length;
        const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i||j));
        for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
          dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
        return dp[m][n];
      };
      const predLast = normS(predPodium.topScorer);
      const actLast  = normS(actualPodium.topScorer);
      const norm = s => (s||'').toLowerCase().trim().replace(/[^a-z\s]/g,'').replace(/\s+/g,' ');
      const pred = norm(predPodium.topScorer);
      const act  = norm(actualPodium.topScorer);
      const predParts = pred.split(' ');
      const actParts  = act.split(' ');
      // Match if: exact last name, substring, prefix, or edit distance ≤ 2 on last name (min 5 chars)
      const fuzzy = pred===act ||
        act.includes(pred) || pred.includes(act) ||
        predParts.some(w=>w.length>=4 && actParts.some(a2=>a2.length>=4 && (a2.startsWith(w)||w.startsWith(a2)))) ||
        (predLast.length>=5 && actLast.length>=5 && editDist(predLast,actLast)<=2);
      if(fuzzy) t+=20;
    }
  }
  return t;
}

function calcStandings(teams,matches){
  const tbl=Object.fromEntries(teams.map(t=>[t,{p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}]));
  for(const m of matches){
    if(m.homeScore===null||m.awayScore===null)continue;
    if(!tbl[m.home]||!tbl[m.away])continue; // skip matches with unknown teams
    const h=m.homeScore,a=m.awayScore;
    tbl[m.home].p++;tbl[m.away].p++;
    tbl[m.home].gf+=h;tbl[m.home].ga+=a;tbl[m.away].gf+=a;tbl[m.away].ga+=h;
    if(h>a){tbl[m.home].w++;tbl[m.home].pts+=3;tbl[m.away].l++;}
    else if(h<a){tbl[m.away].w++;tbl[m.away].pts+=3;tbl[m.home].l++;}
    else{tbl[m.home].d++;tbl[m.home].pts++;tbl[m.away].d++;tbl[m.away].pts++;}
  }
  return Object.entries(tbl).map(([team,s])=>({team,...s,gd:s.gf-s.ga}))
    .sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);
}

function ScoreInput({value,onChange,readOnly=false}){
  return(
    <input type="number" min="0" max="20" readOnly={readOnly}
      value={value===null?"":value}
      onChange={e=>!readOnly&&onChange(e.target.value===""?null:Math.max(0,parseInt(e.target.value)||0))}
      style={{
        width:42,textAlign:"center",outline:"none",
        background:readOnly?"rgba(255,255,255,0.03)":"rgba(255,255,255,0.10)",
        border:"1px solid rgba(255,255,255,0.15)",borderRadius:6,
        color:readOnly?"#555":"#fff",fontSize:17,fontWeight:700,
        padding:"4px 0",fontFamily:"inherit",cursor:readOnly?"default":"text",
      }}
    />
  );
}

function PointsBadge({result}){
  const [hover,setHover]=useState(false);
  if(!result||result.points===0)return null;
  const{points,label,color}=result;
  return(
    <div style={{position:"relative",flexShrink:0}}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
      <div style={{
        background:`${color}22`,border:`1px solid ${color}55`,borderRadius:6,
        padding:"2px 8px",fontSize:11,fontWeight:700,color,cursor:"default",whiteSpace:"nowrap",
      }}>+{points}pts</div>
      {hover&&(
        <div style={{
          position:"absolute",right:0,top:"115%",background:"#161b27",
          border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"9px 13px",
          zIndex:999,boxShadow:"0 12px 40px rgba(0,0,0,0.65)",
          fontSize:12,color:"#bbb",whiteSpace:"nowrap",
        }}>{label} <span style={{color,fontWeight:700,marginLeft:8}}>+{points} pts</span></div>
      )}
    </div>
  );
}

const DEFAULT_AI_PREDICTIONS = {
  "Mexico||South Africa":{"h":2,"a":0,"r":"Mexico's experience and home-continent advantage"},
  "South Korea||Czechia":{"h":1,"a":1,"r":"Evenly matched European vs Asian sides"},
  "Mexico||South Korea":{"h":2,"a":1,"r":"Mexico's clinical finishing edges it"},
  "South Africa||Czechia":{"h":0,"a":2,"r":"Czechia's technical quality too strong"},
  "Mexico||Czechia":{"h":2,"a":0,"r":"Mexico dominate to secure top spot"},
  "South Africa||South Korea":{"h":0,"a":2,"r":"South Korea's pace and pressing wins"},
  "Canada||Bosnia-Herzegovina":{"h":2,"a":1,"r":"Canada's physical intensity at home"},
  "Qatar||Switzerland":{"h":0,"a":3,"r":"Switzerland's quality overwhelming for Qatar"},
  "Canada||Qatar":{"h":3,"a":0,"r":"Canada too strong for host nation"},
  "Bosnia-Herzegovina||Switzerland":{"h":1,"a":2,"r":"Swiss tactical discipline prevails"},
  "Canada||Switzerland":{"h":1,"a":1,"r":"Switzerland resist Canada's pressure"},
  "Bosnia-Herzegovina||Qatar":{"h":2,"a":0,"r":"Bosnia's firepower too much for Qatar"},
  "Brazil||Morocco":{"h":2,"a":0,"r":"Brazil's attacking depth too powerful"},
  "Haiti||Scotland":{"h":0,"a":2,"r":"Scotland's organised defence and set pieces"},
  "Brazil||Haiti":{"h":4,"a":0,"r":"Brazil expected to dominate heavily"},
  "Morocco||Scotland":{"h":2,"a":1,"r":"Morocco's African Cup experience shows"},
  "Brazil||Scotland":{"h":3,"a":0,"r":"Brazil secure group with comfortable win"},
  "Morocco||Haiti":{"h":2,"a":0,"r":"Morocco's defensive solidity and counter-attack"},
  "USA||Paraguay":{"h":2,"a":1,"r":"USA's home crowd and quality advantage"},
  "Australia||Turkey":{"h":1,"a":1,"r":"Both sides strong and hard to separate"},
  "USA||Australia":{"h":2,"a":1,"r":"USA's MLS experience and home advantage"},
  "Paraguay||Turkey":{"h":1,"a":2,"r":"Turkey's European quality edges it"},
  "USA||Turkey":{"h":1,"a":1,"r":"Turkey make it hard for USA at home"},
  "Paraguay||Australia":{"h":1,"a":1,"r":"Tight match with neither dominant"},
  "Germany||Curacao":{"h":5,"a":0,"r":"Germany's full strength too powerful"},
  "Ivory Coast||Ecuador":{"h":1,"a":1,"r":"Competitive match between physical sides"},
  "Germany||Ivory Coast":{"h":2,"a":1,"r":"Germany's efficiency wins tough game"},
  "Ecuador||Curacao":{"h":3,"a":0,"r":"Ecuador's South American quality dominates"},
  "Germany||Ecuador":{"h":2,"a":0,"r":"Germany secure top spot with clean sheet"},
  "Ivory Coast||Curacao":{"h":3,"a":0,"r":"Ivory Coast's pace and skill too much"},
  "Netherlands||Japan":{"h":2,"a":1,"r":"Netherlands' individual quality edges it"},
  "Sweden||Tunisia":{"h":2,"a":0,"r":"Sweden's physicality and organisation wins"},
  "Netherlands||Sweden":{"h":2,"a":1,"r":"Netherlands dominate Scandinavian rivals"},
  "Japan||Tunisia":{"h":2,"a":0,"r":"Japan's technical quality and intensity"},
  "Netherlands||Tunisia":{"h":3,"a":0,"r":"Netherlands wrap up group with big win"},
  "Japan||Sweden":{"h":1,"a":2,"r":"Sweden's physicality too much for Japan"},
  "Belgium||Egypt":{"h":3,"a":0,"r":"Belgium's golden generation still strong"},
  "Iran||New Zealand":{"h":1,"a":0,"r":"Iran's WC experience edges NZ"},
  "Belgium||Iran":{"h":2,"a":0,"r":"Belgium's quality in attack too strong"},
  "Egypt||New Zealand":{"h":2,"a":1,"r":"Salah's experience key for Egypt"},
  "Belgium||New Zealand":{"h":3,"a":0,"r":"Belgium dominate to top group"},
  "Egypt||Iran":{"h":1,"a":1,"r":"Tight tactical battle between Asian/African sides"},
  "Spain||Cape Verde":{"h":4,"a":0,"r":"Spain's tiki-taka too much for Cape Verde"},
  "Saudi Arabia||Uruguay":{"h":0,"a":2,"r":"Uruguay's South American experience wins"},
  "Spain||Saudi Arabia":{"h":3,"a":0,"r":"Spain's possession game dominates"},
  "Cape Verde||Uruguay":{"h":0,"a":2,"r":"Uruguay's quality too strong"},
  "Spain||Uruguay":{"h":2,"a":1,"r":"Spain edge tense group decider"},
  "Cape Verde||Saudi Arabia":{"h":1,"a":1,"r":"Evenly matched battle for third place"},
  "France||Senegal":{"h":2,"a":1,"r":"France's depth edges African champions"},
  "Iraq||Norway":{"h":0,"a":2,"r":"Haaland's Norway too strong for Iraq"},
  "France||Iraq":{"h":4,"a":0,"r":"France expected to win comfortably"},
  "Senegal||Norway":{"h":1,"a":2,"r":"Norway's finishing power through Haaland"},
  "France||Norway":{"h":2,"a":1,"r":"France vs Haaland — France edge it"},
  "Senegal||Iraq":{"h":2,"a":0,"r":"Senegal's physical and technical quality"},
  "Argentina||Algeria":{"h":2,"a":0,"r":"World champions too strong at every position"},
  "Austria||Jordan":{"h":3,"a":0,"r":"Austria's European quality comfortable"},
  "Argentina||Austria":{"h":2,"a":1,"r":"Argentina's individual brilliance wins"},
  "Algeria||Jordan":{"h":2,"a":0,"r":"Algeria's AFCON form shows"},
  "Argentina||Jordan":{"h":4,"a":0,"r":"Argentina wrap up with big win"},
  "Algeria||Austria":{"h":1,"a":1,"r":"Tight contest for second place"},
  "Portugal||DR Congo":{"h":3,"a":0,"r":"Ronaldo's experience and Portugal's depth"},
  "Uzbekistan||Colombia":{"h":0,"a":2,"r":"Colombia's South American quality decisive"},
  "Portugal||Uzbekistan":{"h":4,"a":0,"r":"Portugal expected to dominate"},
  "DR Congo||Colombia":{"h":1,"a":2,"r":"Colombia's quality edges it"},
  "Portugal||Colombia":{"h":2,"a":1,"r":"Portugal edge competitive match"},
  "DR Congo||Uzbekistan":{"h":2,"a":1,"r":"DR Congo's physical approach wins"},
  "England||Croatia":{"h":2,"a":1,"r":"England revenge for 2018 — stronger squad now"},
  "Ghana||Panama":{"h":2,"a":0,"r":"Ghana's African Cup form and quality"},
  "England||Ghana":{"h":3,"a":0,"r":"England's depth too much for Ghana"},
  "Croatia||Panama":{"h":3,"a":0,"r":"Croatia's technical quality dominates"},
  "England||Panama":{"h":4,"a":0,"r":"England wrap up with big win like 2018"},
  "Croatia||Ghana":{"h":1,"a":1,"r":"Ghana make it hard — draw for both"},
};

function getAIPrediction(home, away, livePreds) {
  const key = `${home}||${away}`;
  const keyRev = `${away}||${home}`;

  // 1. Check new Claude Sonnet group predictions first
  const groupAI = GROUP_AI_PREDICTIONS[key] || (GROUP_AI_PREDICTIONS[keyRev] ? {
    ...GROUP_AI_PREDICTIONS[keyRev], h: GROUP_AI_PREDICTIONS[keyRev].a, a: GROUP_AI_PREDICTIONS[keyRev].h
  } : null);
  if (groupAI) return groupAI;

  // 2. Fall back to legacy GROUP_INSIGHTS
  const groupInsight = GROUP_INSIGHTS[key] || (GROUP_INSIGHTS[keyRev] ? {
    ...GROUP_INSIGHTS[keyRev], h: GROUP_INSIGHTS[keyRev].a, a: GROUP_INSIGHTS[keyRev].h
  } : null);
  if (groupInsight) return groupInsight;

  // 3. Fall back to live predictions (KO or admin-generated)
  const merged = { ...DEFAULT_AI_PREDICTIONS, ...(livePreds||{}) };
  if (merged[key]) return merged[key];
  if (merged[keyRev]) {
    const p = merged[keyRev];
    return { h: p.a, a: p.h, r: p.r, insight: p.insight, key: p.key, confidence: p.confidence };
  }
  return null;
}

function MatchCard({match,actual,onUpdate,kickoffs,livePreds={},userName=""}){
  const locked = isMatchLocked(match, kickoffs);
  const countdown = !locked ? timeUntilLock(match, kickoffs) : null;
  const done=match.homeScore!==null&&match.awayScore!==null;
  const h=match.homeScore,a=match.awayScore;
  const winner=done?(h>a?match.home:a>h?match.away:null):null;
  const result=actual?calcMatchPoints(match,actual):null;
  const actDone=actual&&actual.homeScore!==null;
  const aiPred=getAIPrediction(match.home,match.away,livePreds);
  const expertData=EXPERT_PREDICTIONS[`${match.home}||${match.away}`]||EXPERT_PREDICTIONS[`${match.away}||${match.home}`];
  const [showAI,setShowAI]=useState(false);
  const [showOdds,setShowOdds]=useState(false);
  const [showExperts,setShowExperts]=useState(false);
  const [matchOdds,setMatchOdds]=useState(null);
  const [oddsLoading,setOddsLoading]=useState(false);

  const fetchOdds = async () => {
    if (matchOdds) { setShowOdds(p=>!p); return; }
    setShowOdds(true);
    setOddsLoading(true);
    try {
      const res = await fetch(`/api/odds?home=${encodeURIComponent(match.home)}&away=${encodeURIComponent(match.away)}`);
      const data = await res.json();
      setMatchOdds(data);
    } catch(e) {
      setMatchOdds({ found:false, message: 'Could not load odds' });
    }
    setOddsLoading(false);
  };
  return(
    <div style={{
      background:locked?"rgba(239,68,68,0.04)":done?"rgba(252,185,0,0.05)":"rgba(255,255,255,0.03)",
      border:`1px solid ${locked?"rgba(239,68,68,0.2)":done?"rgba(252,185,0,0.2)":"rgba(255,255,255,0.06)"}`,
      borderRadius:10,padding:"10px 10px",marginBottom:8,
    }}>
      {/* Main match row — no buttons, full width for teams */}
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        <span style={{fontSize:16,flexShrink:0}}>{FLAGS[match.home]||"🏳️"}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:11,color:winner===match.home?"#fcb900":locked?"#888":"#ddd",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{match.home}</div>
          {FIFA_RANKINGS[match.home]&&<div style={{fontSize:11,color:"#888"}}>#{FIFA_RANKINGS[match.home]} FIFA</div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:3}}>
            <ScoreInput value={match.homeScore} onChange={v=>onUpdate({...match,homeScore:v})} readOnly={locked}/>
            <span style={{color:"#444",fontWeight:700,fontSize:11}}>–</span>
            <ScoreInput value={match.awayScore} onChange={v=>onUpdate({...match,awayScore:v})} readOnly={locked}/>
          </div>
          {actDone&&<div style={{fontSize:10,color:"#555",fontFamily:"monospace"}}>{actual.homeScore}–{actual.awayScore}</div>}
          {!locked&&countdown&&<div style={{fontSize:10,color:"#60a5fa"}}>⏱ {countdown}</div>}
        </div>
        <div style={{flex:1,minWidth:0,textAlign:"right"}}>
          <div style={{fontWeight:600,fontSize:11,color:winner===match.away?"#fcb900":locked?"#888":"#ddd",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{match.away}</div>
          {FIFA_RANKINGS[match.away]&&<div style={{fontSize:11,color:"#888"}}>#{FIFA_RANKINGS[match.away]} FIFA</div>}
        </div>
        <span style={{fontSize:16,flexShrink:0}}>{FLAGS[match.away]||"🏳️"}</span>
        {locked&&!result&&<span style={{fontSize:11,flexShrink:0}}>🔒</span>}
        {result&&<PointsBadge result={result}/>}
      </div>

      {/* Tool buttons row */}
      {(aiPred&&!locked)||expertData||true?(
        <div style={{marginTop:6,paddingTop:5,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",gap:6}}>
            {aiPred&&!locked&&(
              <button onClick={()=>setShowAI(p=>!p)} style={{
                padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                background:showAI?"rgba(139,92,246,0.2)":"rgba(139,92,246,0.08)",
                border:"1px solid rgba(139,92,246,0.25)",borderRadius:4,color:"#a78bfa",
              }}>🤖 AI prediction</button>
            )}
            {expertData&&(
              <button onClick={()=>setShowExperts(p=>!p)} style={{
                padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                background:showExperts?"rgba(34,197,94,0.2)":"rgba(34,197,94,0.06)",
                border:"1px solid rgba(34,197,94,0.2)",borderRadius:4,color:"#22c55e",
              }}>🔍 Experts</button>
            )}
            <button onClick={fetchOdds} style={{
              padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              background:showOdds?"rgba(96,165,250,0.2)":"rgba(96,165,250,0.05)",
              border:"1px solid rgba(96,165,250,0.2)",borderRadius:4,color:"#60a5fa",
            }}>📊 Market odds</button>
          </div>
        </div>
      ):null}

      {/* Odds panel */}
      {showOdds&&(
        <div style={{marginTop:8,padding:"10px 12px",borderRadius:8,
          background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.18)"}}>
          {oddsLoading?(
            <div style={{fontSize:11,color:"#444",textAlign:"center"}}>⏳ Loading Polymarket odds…</div>
          ):matchOdds?.found?(
            <>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <span style={{fontSize:11,color:"#60a5fa",fontWeight:700}}>📊 Polymarket Crowd Odds</span>
                {matchOdds.volume&&<span style={{fontSize:10,color:"#444",marginLeft:"auto"}}>{matchOdds.volume} vol</span>}
                <button onClick={()=>setShowOdds(false)} style={{padding:"1px 6px",background:"rgba(255,255,255,0.06)",
                  border:"1px solid rgba(255,255,255,0.10)",borderRadius:4,color:"#555",
                  fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
              </div>
              {(()=>{
                // Normalise outcomes — replace Yes/No with team names
                let outcomes = matchOdds.outcomes?.length>0 ? matchOdds.outcomes : [
                  {label:match.home, prob:matchOdds.homeProb},
                  {label:"Draw",     prob:matchOdds.drawProb},
                  {label:match.away, prob:matchOdds.awayProb},
                ].filter(o=>o.prob!=null);
                // If only two outcomes and they're Yes/No, relabel them
                if(outcomes.length===2 && /^yes$/i.test(outcomes[0]?.label)) {
                  outcomes = [
                    {label:match.home, prob:outcomes[0].prob},
                    {label:match.away, prob:outcomes[1].prob},
                  ];
                }
                return outcomes.map((o,i)=>(
                  <div key={i} style={{marginBottom:5}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
                      <span style={{color:"#ccc",fontWeight:600}}>{o.label}</span>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,
                        color:o.prob>=50?"#22c55e":o.prob>=30?"#fcb900":"#888"}}>{o.prob}¢</span>
                    </div>
                    <div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
                      <div style={{width:`${o.prob}%`,height:"100%",
                        background:o.prob>=50?"#22c55e":o.prob>=30?"#fcb900":"#60a5fa",
                        borderRadius:2,transition:"width 0.5s"}}/>
                    </div>
                  </div>
                ));
              })()}
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                <span style={{fontSize:10,color:"#444"}}>Price in ¢ = % probability</span>
                {matchOdds.url&&<a href={matchOdds.url} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:10,color:"#60a5fa",textDecoration:"none"}}>View ↗</a>}
              </div>
            </>
          ):(
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:11,color:"#444"}}>
                  🔒 Match betting not open yet
                </span>
                <button onClick={()=>setShowOdds(false)} style={{padding:"1px 6px",background:"rgba(255,255,255,0.06)",
                  border:"1px solid rgba(255,255,255,0.10)",borderRadius:4,color:"#555",
                  fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
              </div>
              {(()=>{
                // Show group winner odds as context
                const grp = match.group;
                if(!grp) return null;
                const grpTeams = GROUPS[grp] || [];
                // Polymarket uses slightly different slugs for some groups
                const slugMap = {
                  A:'world-cup-group-a-winner', B:'world-cup-group-b-winner',
                  C:'world-cup-group-c-winner', D:'world-cup-group-d-winner',
                  E:'world-cup-group-e-winner', F:'world-cup-group-f-winner',
                  G:'world-cup-group-g-winner', H:'world-cup-group-h-winner',
                  I:'world-cup-group-i-winner', J:'world-cup-group-j-winner',
                  K:'world-cup-group-k-winner', L:'fifa-world-cup-group-l-winner',
                };
                const grpSlug = slugMap[grp] || `world-cup-group-${grp.toLowerCase()}-winner`;
                return(
                  <GroupWinnerOdds
                    groupLetter={grp}
                    teams={grpTeams}
                    slug={grpSlug}
                    highlight={[match.home, match.away]}
                  />
                );
              })()}
            </div>
          )}
        </div>
      )}
      {showAI&&aiPred&&(
        <div style={{marginTop:8,padding:"10px 12px",borderRadius:8,background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:11,color:"#a78bfa",fontWeight:700}}>🤖 AI Prediction</span>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#c4b5fd",letterSpacing:1}}>{aiPred.h} – {aiPred.a}</span>
            {aiPred.confidence&&(
              <span style={{display:"flex",alignItems:"center",gap:3,
                background:"rgba(139,92,246,0.15)",borderRadius:4,padding:"2px 6px"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:
                  aiPred.confidence==="High"?"#22c55e":aiPred.confidence==="Medium"?"#fcb900":"#555"}}/>
                <span style={{fontSize:10,color:"#9d8ccf"}}>{aiPred.confidence}</span>
              </span>
            )}
            <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
              {!locked&&<button onClick={()=>{onUpdate({...match,homeScore:aiPred.h,awayScore:aiPred.a});setShowAI(false);}} style={{padding:"3px 10px",background:"rgba(139,92,246,0.2)",border:"1px solid rgba(139,92,246,0.4)",borderRadius:4,color:"#c4b5fd",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Use</button>}
              <button onClick={()=>setShowAI(false)} style={{padding:"3px 8px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:4,color:"#555",fontSize:11,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>✕</button>
            </div>
          </div>
          {/* Short reason */}
          {aiPred.r&&(
            <div style={{fontSize:11,color:"#9d8ccf",fontStyle:"italic",marginBottom:aiPred.insight?6:0}}>
              {aiPred.r}
            </div>
          )}
          {/* Deeper insight */}
          {aiPred.insight&&(
            <div style={{fontSize:11,color:"#8b7dbf",lineHeight:1.6,marginBottom:aiPred.key?6:0,
              borderTop:"1px solid rgba(139,92,246,0.12)",paddingTop:6}}>
              {aiPred.insight}
            </div>
          )}
          {/* Key factor */}
          {aiPred.key&&(
            <div style={{display:"flex",alignItems:"center",gap:5,
              borderTop:"1px solid rgba(139,92,246,0.12)",paddingTop:6}}>
              <span style={{fontSize:10,color:"#6d5a9c",fontWeight:700,flexShrink:0}}>🔑 Key factor:</span>
              <span style={{fontSize:10,color:"#7c6db3",fontStyle:"italic"}}>{aiPred.key}</span>
            </div>
          )}
        </div>
      )}
      {showExperts&&<ExpertPanel home={match.home} away={match.away} data={expertData} onClose={()=>setShowExperts(false)}/>}
      <ReactionsBar matchId={match.id} userName={userName} home={match.home} away={match.away}/>
    </div>
  );
}

function ReactionsBar({matchId, userName, home, away}) {
  const EMOJIS = ["🔥","😱","😂","👏","💔","🎯"];
  const [counts, setCounts] = useState({});
  const [mine, setMine] = useState(new Set());
  const [undoEmoji, setUndoEmoji] = useState(null);
  const [loaded, setLoaded] = useState(false); // lazy load
  const [showAll, setShowAll] = useState(false);
  const undoTimer = React.useRef(null);
  const containerRef = React.useRef(null);

  // Only load reactions when card scrolls into view
  useEffect(()=>{
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(([entry])=>{
      if (entry.isIntersecting && !loaded) setLoaded(true);
    }, { threshold: 0.1 });
    observer.observe(containerRef.current);
    return ()=>observer.disconnect();
  },[]);

  const loadReactions = async () => {
    const rows = await sbGetReactions(matchId);
    const c={}, m=new Set();
    rows.forEach(r=>{ c[r.emoji]=(c[r.emoji]||0)+1; if(r.username===userName) m.add(r.emoji); });
    setCounts(c); setMine(m);
  };

  useEffect(()=>{
    if(!loaded||!matchId) return;
    loadReactions();
    const channelName = `reactions_${matchId}`;
    // Remove any existing channel with same name to avoid duplicate subscription error
    const existing = supabase.getChannels().find(c=>c.topic===`realtime:${channelName}`);
    if(existing) supabase.removeChannel(existing);
    const sub = supabase.channel(channelName)
      .on('postgres_changes',{event:'*',schema:'public',table:'reactions',
        filter:`match_id=eq.${matchId}`}, loadReactions)
      .subscribe();
    return ()=>supabase.removeChannel(sub);
  },[loaded, matchId]);

  const toggle = async(emoji) => {
    const isOn = mine.has(emoji);
    // Optimistic UI
    setMine(prev => { const n=new Set(prev); isOn?n.delete(emoji):n.add(emoji); return n; });
    setCounts(prev => ({ ...prev, [emoji]: Math.max(0,(prev[emoji]||0)+(isOn?-1:1)) }));

    if(!isOn) {
      // Show undo toast for 2 seconds
      clearTimeout(undoTimer.current);
      setUndoEmoji(emoji);
      undoTimer.current = setTimeout(async()=>{
        setUndoEmoji(null);
        await sbToggleReaction(matchId, userName, emoji);
        if(home && away) await sbSendMessage('⚡', `${emoji} ${userName} reacted to ${home} vs ${away}`, groupCode);
      }, 2000);
    } else {
      clearTimeout(undoTimer.current);
      setUndoEmoji(null);
      await sbToggleReaction(matchId, userName, emoji);
    }
  };

  const undo = () => {
    clearTimeout(undoTimer.current);
    const emoji = undoEmoji;
    setUndoEmoji(null);
    // Revert optimistic update
    setMine(prev => { const n=new Set(prev); n.delete(emoji); return n; });
    setCounts(prev => ({ ...prev, [emoji]: Math.max(0,(prev[emoji]||0)-1) }));
  };

  const hasAnyReactions = EMOJIS.some(e => (counts[e]||0) > 0);

  return(
    <div ref={containerRef} style={{marginTop:6}}>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
        {/* Only show emojis with reactions, or all if expanded */}
        {EMOJIS.filter(e => showAll || (counts[e]||0) > 0 || mine.has(e)).map(e=>{
          const active = mine.has(e);
          const count = counts[e]||0;
          return(
            <button key={e} onClick={()=>toggle(e)} style={{
              padding:"3px 8px",borderRadius:12,fontSize:12,cursor:"pointer",fontFamily:"inherit",
              background:active?"rgba(252,185,0,0.2)":"rgba(255,255,255,0.06)",
              border:`1px solid ${active?"rgba(252,185,0,0.6)":"rgba(255,255,255,0.10)"}`,
              color:active?"#fcb900":"#666",
              display:"flex",alignItems:"center",gap:3,
              transform:active?"scale(1.1)":"scale(1)",
              transition:"all 0.15s ease",fontWeight:active?700:400,
            }}>
              <span>{e}</span>
              {count>0&&<span style={{fontSize:10,fontWeight:700,color:active?"#fcb900":"#888"}}>{count}</span>}
            </button>
          );
        })}
        {/* Toggle button */}
        <button onClick={()=>setShowAll(p=>!p)} style={{
          padding:"3px 7px",borderRadius:12,fontSize:11,cursor:"pointer",fontFamily:"inherit",
          background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
          color:"#444",transition:"all 0.15s",
        }}>
          {showAll ? "✕" : hasAnyReactions ? "···" : "＋"}
        </button>
      </div>
      {undoEmoji&&(
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:5,
          padding:"4px 10px",borderRadius:8,
          background:"rgba(252,185,0,0.1)",border:"1px solid rgba(252,185,0,0.25)"}}>
          <span style={{fontSize:11,color:"#fcb900"}}>{undoEmoji} Reacted — sending in 2s</span>
          <button onClick={undo} style={{
            marginLeft:"auto",padding:"2px 8px",
            background:"rgba(252,185,0,0.15)",border:"1px solid rgba(252,185,0,0.3)",
            borderRadius:4,color:"#fcb900",fontSize:10,fontWeight:700,
            cursor:"pointer",fontFamily:"inherit",
          }}>Undo</button>
        </div>
      )}
    </div>
  );
}

function StandingsTable({teams,matches}){
  const rows=calcStandings(teams,matches);
  const [compact,setCompact]=useState(true); // default compact for mobile
  return(
    <div style={{marginTop:6}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <span style={{fontSize:10,color:"#444",fontWeight:600}}>
          {compact?"# / Team / GD / Pts":"Full table"}
        </span>
        <button onClick={()=>setCompact(p=>!p)} style={{
          padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
          background:compact?"rgba(252,185,0,0.10)":"rgba(255,255,255,0.06)",
          border:`1px solid ${compact?"rgba(252,185,0,0.3)":"rgba(255,255,255,0.10)"}`,
          borderRadius:6,color:compact?"#fcb900":"#555",
        }}>{compact?"📋 Full":"📱 Compact"}</button>
      </div>
      {compact?(
        // Compact mobile view: # / Team / GD / Pts only
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr style={{color:"#444"}}>
              <th style={{padding:"3px 4px",textAlign:"center",fontWeight:500,width:18}}>#</th>
              <th style={{padding:"3px 4px",textAlign:"left",fontWeight:500}}>Team</th>
              <th style={{padding:"3px 4px",textAlign:"center",fontWeight:500,width:24}}>GD</th>
              <th style={{padding:"3px 4px",textAlign:"center",fontWeight:500,width:28}}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={r.team} style={{background:i<2?"rgba(252,185,0,0.07)":"transparent",
                borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                <td style={{padding:"4px 4px",textAlign:"center",color:i<2?"#fcb900":"#444",fontWeight:700,fontSize:10}}>{i+1}</td>
                <td style={{padding:"4px 4px",fontWeight:600,fontSize:11}}>{FLAGS[r.team]} {r.team}</td>
                <td style={{padding:"4px 4px",textAlign:"center",fontSize:10,fontWeight:600,
                  color:r.gd>0?"#22c55e":r.gd<0?"#ef4444":"#555"}}>
                  {r.gd>0?`+${r.gd}`:r.gd}
                </td>
                <td style={{padding:"4px 4px",textAlign:"center",color:"#fcb900",fontWeight:700,fontSize:12}}>{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ):(
        // Full table
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:280}}>
            <thead>
              <tr style={{color:"#444"}}>
                {["#","Team","P","W","D","L","GD","Pts"].map(h=>(
                  <th key={h} style={{padding:"3px 5px",textAlign:h==="Team"?"left":"center",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.team} style={{background:i<2?"rgba(252,185,0,0.07)":"transparent",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                  <td style={{padding:"4px 5px",textAlign:"center",color:i<2?"#fcb900":"#444",fontWeight:700}}>{i+1}</td>
                  <td style={{padding:"4px 5px",fontWeight:600}}>{FLAGS[r.team]} {r.team}</td>
                  {[r.p,r.w,r.d,r.l,r.gd>0?`+${r.gd}`:r.gd,r.pts].map((v,j)=>(
                    <td key={j} style={{padding:"4px 5px",textAlign:"center",color:j===5?"#fcb900":"#999",fontWeight:j===5?700:400}}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScoringBar(){
  return(
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"11px 15px",marginBottom:20,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <span style={{fontSize:11,fontWeight:700,color:"#fcb900",marginRight:2}}>📋 Scoring:</span>
      {[
        {pts:50, text:"1st place",color:"#f59e0b",icon:"🥇"},
        {pts:25, text:"2nd place",color:"#c0c0c0",icon:"🥈"},
        {pts:15, text:"3rd place",color:"#cd7f32",icon:"🥉"},
        {pts:6,text:"Exact score",color:"#22c55e",icon:"⭐"},
        {pts:4,text:"Correct GD",color:"#fcb900",icon:"📐"},
        {pts:2,text:"Correct outcome",color:"#60a5fa",icon:"✓"},
      ].map((r,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:5,background:`${r.color}12`,border:`1px solid ${r.color}30`,borderRadius:6,padding:"5px 11px"}}>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:r.color,lineHeight:1}}>{r.pts}</span>
          <span style={{fontSize:11,color:"#777"}}>{r.icon} {r.text}</span>
        </div>
      ))}
      <span style={{fontSize:10,color:"#444",marginLeft:"auto"}}>Rules are mutually exclusive</span>
    </div>
  );
}

function GroupWinnerOdds({ groupLetter, teams, slug, highlight }) {
  const [odds, setOdds] = React.useState(null);
  const [source, setSource] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(()=>{
    fetch(`/api/group-odds?group=${encodeURIComponent(groupLetter)}`)
      .then(r=>r.json())
      .then(data=>{
        if(data.found && data.outcomes?.length>0){ setOdds(data.outcomes); setSource(data.source); }
        setLoading(false);
      }).catch(()=>setLoading(false));
  },[groupLetter]);

  if(loading) return <div style={{fontSize:10,color:"#444",fontStyle:"italic"}}>Loading group odds…</div>;
  if(!odds?.length) return <div style={{fontSize:10,color:"#444",fontStyle:"italic"}}>Group {groupLetter} winner odds not yet available</div>;

  return(
    <div style={{fontSize:10,color:"#555",lineHeight:1.8}}>
      <span style={{color:"#444",marginRight:4}}>Group {groupLetter} to win:</span>
      {odds.map((o,i)=>{
        const hl = highlight?.some(h => o.label?.toLowerCase().includes((h||'').toLowerCase().split(' ')[0]));
        return(
          <span key={i} style={{marginRight:8,fontWeight:hl?600:400,color:hl?"#60a5fa":"#555"}}>
            {o.label} {o.prob}%{i<odds.length-1?' ·':''}
          </span>
        );
      })}
      {source==='cached'&&<span style={{color:"#333",marginLeft:4}}>(Jun 6)</span>}
    </div>
  );
}

function BracketMethodology({ bracketPred, bayesianPred }) {
  const [open, setOpen] = React.useState(false);
  if (!bracketPred) return null;
  return (
    <div style={{marginBottom:14}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"10px 14px",
        background:"rgba(255,255,255,0.08)",
        border:"1px solid rgba(255,255,255,0.2)",
        borderRadius:open?"8px 8px 0 0":8,
        cursor:"pointer",fontFamily:"inherit",
        color:"#ddd",fontSize:12,fontWeight:700,
      }}>
        <span>🔬 How was this calculated?</span>
        <span style={{fontSize:14,display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▾</span>
      </button>
      {open&&(
        <div style={{padding:"12px",background:"rgba(139,92,246,0.04)",
          border:"1px solid rgba(139,92,246,0.2)",borderTop:"none",borderRadius:"0 0 8px 8px"}}>

          {/* Step 1–3: Pre-tournament model */}
          <div style={{fontSize:10,color:"#a78bfa",fontWeight:700,marginBottom:6,letterSpacing:0.5}}>
            STEP 1–3 · PRE-TOURNAMENT MODEL
          </div>
          <div style={{fontSize:11,color:"#888",lineHeight:1.7,marginBottom:10}}>
            {bracketPred.methodologySummary||
              "FIFA Elo + weighted squad ratings (0.6×Elo + 0.4×squad avg) → Dixon-Coles Poisson match probabilities → 5,000 full Monte Carlo tournament simulations including group-stage round-robin."}
          </div>

          {/* Convergence chart */}
          {bracketPred.convergenceSummary&&(
            <div style={{fontSize:11,color:"#888",lineHeight:1.7,marginBottom:10}}>
              <span style={{color:"#a78bfa",fontWeight:700}}>Convergence: </span>
              {bracketPred.convergenceSummary}
            </div>
          )}
          {bracketPred.convergenceData&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"#555",marginBottom:6}}>
                {bracketPred.champion} pre-tournament championship % — stabilised across simulation runs
              </div>
              <div style={{display:"flex",gap:6,alignItems:"flex-end",height:60}}>
                {Object.entries(bracketPred.convergenceData||{}).map(([n,top])=>(
                  <div key={n} style={{flex:1,textAlign:"center"}}>
                    <div style={{fontSize:10,color:"#a78bfa",fontWeight:700}}>{top[0]?.prob}%</div>
                    <div style={{height:Math.max(4,parseFloat(top[0]?.prob||0)*1.8),
                      background:"rgba(139,92,246,0.5)",borderRadius:"2px 2px 0 0",marginBottom:2}}/>
                    <div style={{fontSize:9,color:"#444"}}>{parseInt(n).toLocaleString()}</div>
                  </div>
                ))}
                <div style={{fontSize:9,color:"#444",alignSelf:"flex-end",paddingBottom:14,paddingLeft:2}}>sims</div>
              </div>
            </div>
          )}
          {!bracketPred.convergenceData&&(
            <div style={{fontSize:11,color:"#444",marginBottom:14}}>
              Regenerate the bracket to see convergence data from the latest simulation.
            </div>
          )}

          {/* Divider */}
          <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",margin:"10px 0"}}/>

          {/* Step 4: Bayesian update */}
          <div style={{fontSize:10,color:"#6ee7b7",fontWeight:700,marginBottom:6,letterSpacing:0.5}}>
            STEP 4 · BAYESIAN UPDATE FROM ACTUAL RESULTS
          </div>
          {bayesianPred?(
            <div>
              <div style={{fontSize:11,color:"#888",lineHeight:1.7,marginBottom:8}}>
                After each match, teams' Elo ratings are updated using the standard Elo formula (K=32 for World Cup games).
                Updated Elos feed back into a fresh 3,000-run Monte Carlo simulation, shifting championship probabilities
                to reflect what has actually happened on the pitch.
              </div>
              {bayesianPred.keyInsight&&(
                <div style={{fontSize:11,color:"#6ee7b7",lineHeight:1.6,marginBottom:8,
                  padding:"8px 10px",background:"rgba(16,185,129,0.06)",
                  border:"1px solid rgba(16,185,129,0.15)",borderRadius:6,fontStyle:"italic"}}>
                  {bayesianPred.keyInsight}
                </div>
              )}
              <div style={{fontSize:10,color:"#444"}}>
                {bayesianPred.matchesProcessed} match result{bayesianPred.matchesProcessed!==1?'s':''} processed ·
                3,000 simulations re-run with updated team ratings
              </div>
            </div>
          ):(
            <div style={{fontSize:11,color:"#444",lineHeight:1.6}}>
              Not run yet — tap <strong style={{color:"#6ee7b7"}}>🔁 Refresh Predictions</strong> after
              match results are in to update probabilities based on actual tournament performance.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecapButton() {
  const [recapStatus, setRecapStatus] = React.useState(null);
  const [recapLoading, setRecapLoading] = React.useState(false);
  return (
    <div>
      <button onClick={async()=>{
        setRecapLoading(true);
        setRecapStatus(null);
        try {
          const r = await fetch('/api/daily-recap', { method:'POST' });
          const d = await r.json();
          if (d.ok) {
            const allOk = d.results?.every(r=>r.chatOk);
            const chatErrors = d.results?.filter(r=>!r.chatOk).map(r=>`${r.group}: ${r.chatError}`).join(' | ');
            setRecapStatus(allOk
              ? { ok:true,  msg:`✅ Digest posted to ${d.groups} league${d.groups!==1?'s':''}!` }
              : { ok:false, msg:`⚠️ Partial: ${chatErrors}` });
          } else {
            setRecapStatus({ ok:false, msg:`❌ ${d.error||'Failed'}` });
          }
        } catch(e) {
          setRecapStatus({ ok:false, msg:`❌ Network error: ${e.message}` });
        }
        setRecapLoading(false);
      }} disabled={recapLoading} style={{
        padding:"8px 16px",
        background:recapLoading?"rgba(255,255,255,0.04)":"rgba(252,185,0,0.1)",
        border:"1px solid rgba(252,185,0,0.25)",borderRadius:8,
        color:recapLoading?"#555":"#fcb900",fontSize:12,fontWeight:700,
        cursor:recapLoading?"wait":"pointer",fontFamily:"inherit",
      }}>
        {recapLoading?"⏳ Generating digest…":"🌅 Post Daily Digest Now"}
      </button>
      {recapStatus&&(
        <div style={{marginTop:8,fontSize:11,
          color:recapStatus.ok?"#22c55e":"#ef4444",lineHeight:1.5,wordBreak:"break-word"}}>
          {recapStatus.msg}
        </div>
      )}
    </div>
  );
}

function VoiceClip({ url }) {
  const [playing, setPlaying] = React.useState(false);
  const audioRef = React.useRef(null);
  React.useEffect(()=>{
    if(!audioRef.current) return;
    const a = audioRef.current;
    a.onended = ()=>setPlaying(false);
    return ()=>{ a.onended=null; };
  },[]);
  const toggle = ()=>{
    if(!audioRef.current) return;
    if(playing){ audioRef.current.pause(); audioRef.current.currentTime=0; setPlaying(false); }
    else { audioRef.current.play().catch(()=>{}); setPlaying(true); }
  };
  return(
    <span onClick={toggle} style={{
      display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",
      padding:"4px 10px",borderRadius:20,
      background:playing?"rgba(252,185,0,0.15)":"rgba(255,255,255,0.08)",
      border:"1px solid rgba(255,255,255,0.12)",fontSize:11,color:"#ccc",
    }}>
      <span style={{fontSize:14}}>{playing?"⏹":"▶"}</span>
      {playing?"Playing…":"Voice clip"}
      <audio ref={audioRef} src={url} preload="none"/>
    </span>
  );
}

function LeagueSelector({ value, onChange, onEnter, inputStyle }) {
  const [leagues, setLeagues] = React.useState([]);
  const [showCustom, setShowCustom] = React.useState(false);

  React.useEffect(()=>{
    sbGetAllGroupCodes().then(codes => {
      setLeagues((codes||[]).filter(c => c && c !== 'default'));
    }).catch(()=>{});
  }, []);

  const selectStyle = {
    ...inputStyle,
    fontFamily:"monospace", fontSize:13,
    appearance:"none",
    backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
    backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center",
    paddingRight:32, cursor:"pointer",
  };

  if (!showCustom) return(
    <div>
      <select value={value||'default'} onChange={e=>{
        if(e.target.value==='__new__'){ setShowCustom(true); onChange(''); }
        else onChange(e.target.value==='default'?'':e.target.value);
      }} style={selectStyle}>
        <option value="default">default (main league)</option>
        {leagues.map(l=><option key={l} value={l}>{l}</option>)}
        <option value="__new__">+ Create new league…</option>
      </select>
      <div style={{fontSize:10,color:"#333",marginTop:4,marginBottom:12}}>
        Pick your league or create a new one
      </div>
    </div>
  );

  return(
    <div>
      <div style={{display:"flex",gap:8}}>
        <input placeholder="e.g. WC2026-FRIENDS"
          value={value} autoFocus
          onChange={e=>onChange(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==="Enter"&&onEnter()}
          style={{...inputStyle,flex:1,fontFamily:"monospace",fontSize:13,letterSpacing:1}}/>
        <button onClick={()=>{setShowCustom(false);onChange('');}}
          style={{padding:"8px 12px",background:"rgba(255,255,255,0.06)",
            border:"1px solid rgba(255,255,255,0.10)",borderRadius:6,
            color:"#555",fontSize:12,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
          ← Back
        </button>
      </div>
      <div style={{fontSize:10,color:"#333",marginTop:4,marginBottom:12}}>
        Enter a new league code — share it with your friends
      </div>
    </div>
  );
}

function ExpertPanel({ home, away, data, loading, onClose }) {
  if (loading) return (
    <div style={{marginTop:8,padding:"10px 12px",borderRadius:8,
      background:"rgba(34,197,94,0.05)",border:"1px solid rgba(34,197,94,0.15)",
      fontSize:11,color:"#444"}}>⏳ Fetching expert predictions…</div>
  );
  if (!data) return null;
  return (
    <div style={{marginTop:8,padding:"10px 12px",borderRadius:8,
      background:"rgba(34,197,94,0.05)",border:"1px solid rgba(34,197,94,0.18)"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <span style={{fontSize:11,color:"#22c55e",fontWeight:700}}>🔍 Expert Consensus</span>
        {data.consensus&&(
          <span style={{fontSize:10,color:"#16a34a",background:"rgba(34,197,94,0.12)",
            borderRadius:4,padding:"1px 7px",fontWeight:600}}>{data.consensus}</span>
        )}
        {data.likelyScore&&(
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:"#4ade80",marginLeft:"auto"}}>
            {data.likelyScore}
          </span>
        )}
        {onClose&&(
          <button onClick={onClose} style={{padding:"3px 8px",background:"rgba(255,255,255,0.06)",
            border:"1px solid rgba(255,255,255,0.10)",borderRadius:4,color:"#555",
            fontSize:11,cursor:"pointer",fontFamily:"inherit",lineHeight:1,marginLeft:data.likelyScore?0:"auto"}}>✕</button>
        )}
      </div>
      {data.sources?.length>0&&(
        <div style={{display:"flex",gap:8,padding:"2px 0 5px",marginBottom:2,
          borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <span style={{color:"#555",width:80,flexShrink:0,fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>Source</span>
          <span style={{flex:1,color:"#555",fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>Pick</span>
          <span style={{color:"#555",flexShrink:0,fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>Confidence</span>
        </div>
      )}
      {data.sources?.map((s,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,
          padding:"4px 0",borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",fontSize:10}}>
          <span style={{color:"#555",width:80,flexShrink:0,fontWeight:600}}>{s.name}</span>
          <span style={{flex:1,color:"#ccc"}}>{s.pick}</span>
          {s.pct!=null&&(
            <span style={{color:"#22c55e",fontWeight:700,flexShrink:0}}>{s.pct}%</span>
          )}
          {s.confidence&&(
            <span style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
              <span style={{width:6,height:6,borderRadius:"50%",flexShrink:0,background:
                s.confidence==="High"?"#22c55e":s.confidence==="Medium"?"#fcb900":"#555"}}/>
              <span style={{fontSize:10,color:
                s.confidence==="High"?"#22c55e":s.confidence==="Medium"?"#fcb900":"#555"}}>
                {s.confidence}
              </span>
            </span>
          )}
        </div>
      ))}
      {data.summary&&(
        <div style={{marginTop:8,fontSize:11,color:"#555",lineHeight:1.6,
          borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:7,fontStyle:"italic"}}>
          {data.summary}
        </div>
      )}
    </div>
  );
}

function KOMatchButtons({liveHome, liveAway, aiP, r32AI, r32Expert}) {
  const [showAI, setShowAI] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  const [showExperts, setShowExperts] = useState(false);
  const [odds, setOdds] = useState(aiP?.polymarket||null);
  const [oddsLoading, setOddsLoading] = useState(false);
  // Use stored expert data if admin generated it, otherwise fall back to hardcoded R32 experts
  const [expertData, setExpertData] = useState(aiP?.experts||r32Expert||null);
  const [expertLoading, setExpertLoading] = useState(false);

  // Combined AI prediction — admin-generated takes priority, then hardcoded R32
  const effectiveAI = aiP || r32AI;

  // Update if admin pushes new data via Supabase real-time
  React.useEffect(()=>{
    if (aiP?.experts) setExpertData(aiP.experts);
    else if (r32Expert && !expertData) setExpertData(r32Expert);
  }, [aiP?.experts, r32Expert]);

  const fetchOdds = async () => {
    if (odds) { setShowOdds(p=>!p); return; }
    setShowOdds(true); setOddsLoading(true);
    try {
      const res = await fetch(`/api/odds?home=${encodeURIComponent(liveHome)}&away=${encodeURIComponent(liveAway)}`);
      setOdds(await res.json());
    } catch { setOdds({found:false,message:"Could not load odds"}); }
    setOddsLoading(false);
  };

  const fetchExperts = async () => {
    if (expertData) { setShowExperts(p=>!p); return; }
    setShowExperts(true); setExpertLoading(true);
    try {
      const res = await fetch('/api/experts', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ home:liveHome, away:liveAway, round:'knockout' }),
      });
      setExpertData(await res.json());
    } catch { setExpertData({ sources:[], consensus:'Unknown', summary:'Could not fetch expert predictions.' }); }
    setExpertLoading(false);
  };

  return(
    <div>
      <div style={{display:"flex",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        {effectiveAI&&<button onClick={()=>setShowAI(p=>!p)} style={{
          padding:"3px 10px",background:"rgba(139,92,246,0.12)",
          border:"1px solid rgba(139,92,246,0.3)",borderRadius:4,
          color:"#a78bfa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
        }}>🤖 AI</button>}
        <button onClick={fetchExperts} style={{
          padding:"3px 10px",
          background:showExperts?"rgba(34,197,94,0.2)":"rgba(34,197,94,0.06)",
          border:"1px solid rgba(34,197,94,0.2)",borderRadius:4,
          color:"#22c55e",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
        }}>🔍 Experts</button>
        <button onClick={fetchOdds} style={{
          padding:"3px 10px",
          background:showOdds?"rgba(96,165,250,0.18)":"rgba(96,165,250,0.08)",
          border:"1px solid rgba(96,165,250,0.25)",borderRadius:4,
          color:"#60a5fa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
        }}>📊 Odds</button>
      </div>
      {showAI&&effectiveAI&&(
        <div style={{marginTop:8,padding:"10px 12px",borderRadius:8,
          background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:11,color:"#a78bfa",fontWeight:700}}>🤖 AI:</span>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#c4b5fd",letterSpacing:1}}>{effectiveAI.h} – {effectiveAI.a}</span>
            {effectiveAI.confidence&&<span style={{fontSize:10,color:"#6d5a9c",background:"rgba(139,92,246,0.15)",borderRadius:4,padding:"2px 6px"}}>{effectiveAI.confidence}</span>}
            <button onClick={()=>setShowAI(false)} style={{marginLeft:"auto",padding:"1px 6px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:4,color:"#555",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
          </div>
          {effectiveAI.insight&&<div style={{fontSize:11,color:"#8b7dbf",lineHeight:1.6,marginBottom:4}}>{effectiveAI.insight}</div>}
          {effectiveAI.key&&<div style={{fontSize:10,color:"#6d5a9c",fontStyle:"italic"}}>🔑 {effectiveAI.key}</div>}
          {!effectiveAI.insight&&effectiveAI.r&&<div style={{fontSize:10,color:"#7c6db3",fontStyle:"italic"}}>{effectiveAI.r}</div>}
        </div>
      )}
      {(showExperts||expertLoading)&&(
        <ExpertPanel home={liveHome} away={liveAway} data={expertData} loading={expertLoading} onClose={()=>setShowExperts(false)}/>
      )}
      {showOdds&&(
        <div style={{marginTop:8,padding:"10px 12px",borderRadius:8,
          background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.18)"}}>
          {oddsLoading?(
            <div style={{fontSize:11,color:"#444"}}>⏳ Loading Polymarket odds…</div>
          ):odds?.found?(
            <>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <span style={{fontSize:11,color:"#60a5fa",fontWeight:700}}>📊 Polymarket</span>
                {odds.volume&&<span style={{fontSize:10,color:"#444",marginLeft:"auto"}}>{odds.volume}</span>}
                <button onClick={()=>setShowOdds(false)} style={{padding:"1px 6px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:4,color:"#555",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
              </div>
              {(odds.outcomes?.length>0?odds.outcomes:[
                {label:liveHome,prob:odds.homeProb},
                {label:"Draw",prob:odds.drawProb},
                {label:liveAway,prob:odds.awayProb},
              ].filter(o=>o.prob!=null)).map((o,i)=>(
                <div key={i} style={{marginBottom:5}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
                    <span style={{color:"#ccc",fontWeight:600}}>{o.label}</span>
                    <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,
                      color:o.prob>=50?"#22c55e":o.prob>=30?"#fcb900":"#888"}}>{o.prob}¢</span>
                  </div>
                  <div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:`${o.prob}%`,height:"100%",
                      background:o.prob>=50?"#22c55e":o.prob>=30?"#fcb900":"#60a5fa",borderRadius:2}}/>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                <span style={{fontSize:10,color:"#444"}}>¢ = % probability</span>
                {odds.url&&<a href={odds.url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"#60a5fa",textDecoration:"none"}}>View ↗</a>}
              </div>
            </>
          ):(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:11,color:"#444"}}>📊 {odds?.message||"Markets not open yet"}</span>
              <button onClick={()=>setShowOdds(false)} style={{padding:"1px 6px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:4,color:"#555",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App(){
  const [tab,setTab]=useState("groups");
  const handleTabChange = (id) => {
    setTab(id);
    if(id==="chat") {
      setChatUnread(0);
      localStorage.setItem(`wc26_chat_seen_${groupCode}`, Date.now().toString());
      setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:'smooth'}), 100);
    }
  };

  // Poll chat messages every 10s while on chat tab
  useEffect(()=>{
    if(tab!=="chat") return;
    const poll = setInterval(()=>{
      sbGetMessages(50, groupCode).then(msgs=>{
        if(!msgs?.length) return;
        setChatMessages(prev=>{
          const optimistic = prev.filter(m=>m.id?.startsWith('optimistic_'));
          return [...msgs, ...optimistic.filter(o=>
            !msgs.some(m=>m.username===o.username&&m.message===o.message)
          )];
        });
      });
    }, 120000); // poll every 2 min as fallback — realtime handles new messages
    return ()=>clearInterval(poll);
  },[tab]);
  const [userName,setUserName]=useState("");
  const [groupCode,setGroupCode]=useState("default");
  const [groupCodeInput,setGroupCodeInput]=useState("");
  const [appError,setAppError]=useState(null);
  const [appLoading,setAppLoading]=useState(true);
  const [isOnline,setIsOnline]=useState(navigator.onLine);
  const [recentPoints,setRecentPoints]=useState(null); // points earned notification
  const [predictionCount,setPredictionCount]=useState({done:0,total:0}); // completion indicator
  const [showPredReminder,setShowPredReminder]=useState(false);
  const [showPodiumReminder,setShowPodiumReminder]=useState(false);
  const [podiumReminderItems,setPodiumReminderItems]=useState([]);
  const [liveMatches,setLiveMatches]=useState([]);
  const [topScorers,setTopScorers]=useState(null);
  const [scorersLoading,setScorersLoading]=useState(false);
  const [liveLoading,setLiveLoading]=useState(false);
  const [liveError,setLiveError]=useState(null);
  const [selectedFixture,setSelectedFixture]=useState(null);
  const [highlights,setHighlights]=useState(null);
  const [hlLoading,setHlLoading]=useState(false);
  const [hlVideo,setHlVideo]=useState(null);
  // Clear fixture-specific state when selected fixture changes
  useEffect(()=>{ setHighlights(null); setHlVideo(null); },[selectedFixture?.fixture?.id]);
  const [fixtureStats,setFixtureStats]=useState(null);
  const [fixtureEvents,setFixtureEvents]=useState([]);
  const [fixtureLineups,setFixtureLineups]=useState([]);
  const [fixturePlayers,setFixturePlayers]=useState([]);
  const [marketOdds,setMarketOdds]=useState({}); // "Home||Away" → odds data
  const [liveLastUpdated,setLiveLastUpdated]=useState(null);
  const [todayMatches,setTodayMatches]=useState([]);
  const [refreshCooldown,setRefreshCooldown]=useState(0); // seconds remaining
  const [matchAnalysis,setMatchAnalysis]=useState({});
  const [matchQuery,setMatchQuery]=useState('');
  const [matchQueryAnswer,setMatchQueryAnswer]=useState({});
  const [matchQueryLoading,setMatchQueryLoading]=useState(false);
  const [openMatch,setOpenMatch]=useState(null);
  const [filterGroup,setFilterGroup]=useState('All');
  const [showAllBest,setShowAllBest]=useState(false);
  const [showAllWorst,setShowAllWorst]=useState(false);
  const [showAllGD,setShowAllGD]=useState(false);
  const [mcResults,setMcResults]=useState(null);
  const [mcRunning,setMcRunning]=useState(false);
  const [projRefresh,setProjRefresh]=useState(0);
  const [allPlayerPreds,setAllPlayerPreds]=useState({});
  const [simActive,setSimActive]=useState(false);
  const [simMinute,setSimMinute]=useState(0);
  const [simEvents,setSimEvents]=useState([]);
  const [simStats,setSimStats]=useState(null);
  const [simAnalysis,setSimAnalysis]=useState(null);
  const [simAnalysisLoading,setSimAnalysisLoading]=useState(false);
  const [bracketPred,setBracketPred]=useState(null);
  const [bracketLoading,setBracketLoading]=useState(false);
  const [bracketError,setBracketError]=useState(null);
  const [bayesianPred,setBayesianPred]=useState(null);
  const [bayesianLoading,setBayesianLoading]=useState(false);
  const [bracketGeneratedBy,setBracketGeneratedBy]=useState(null);
  const [commentary,setCommentary]=useState(null);
  const [commentaryLoading,setCommentaryLoading]=useState(false);
  const [commentaryGeneratedBy,setCommentaryGeneratedBy]=useState(null);
  const [commentaryGeneratedAt,setCommentaryGeneratedAt]=useState(null);
  const [whatIfTeam,setWhatIfTeam]=useState("");
  const [whatIfPlace,setWhatIfPlace]=useState("first");
  const [whatIfResult,setWhatIfResult]=useState(null);
  const [whatIfLoading,setWhatIfLoading]=useState(false); // fixtureId → {text, loading}
  const [nameInput,setNameInput]=useState("");
  const [pinInput,setPinInput]=useState("");
  const [pinConfirm,setPinConfirm]=useState("");
  const [pinStep,setPinStep]=useState("name"); // "name"|"pin-new"|"pin-existing"|"recovery"|"reset-pin"
  const [pinError,setPinError]=useState("");
  const [rememberMe,setRememberMe]=useState(true);
  const [recoveryCode,setRecoveryCode]=useState(""); // shown after account creation
  const [recoveryInput,setRecoveryInput]=useState(""); // user types their code
  const [newPinInput,setNewPinInput]=useState(""); // for PIN reset
  const [newPinConfirm,setNewPinConfirm]=useState("");
  const [matches,setMatches]=useState(ALL_MATCHES);
  const [knockout,setKnockout]=useState(KNOCKOUT_TEMPLATE);
  const [actualMatches,setActualMatches]=useState(ALL_MATCHES.map(m=>({...m})));
  const [actualKO,setActualKO]=useState(KNOCKOUT_TEMPLATE.map(m=>({...m})));
  const [leaderboard,setLeaderboard]=useState([]);
  const [activeGroup,setActiveGroup]=useState("A");
  const [saved,setSaved]=useState(false);
  const [adminSaved,setAdminSaved]=useState(false);
  const [syncing,setSyncing]=useState(false);
  const [syncStatus,setSyncStatus]=useState(null);
  const [generatingAI,setGeneratingAI]=useState(false);
  const [aiGenStatus,setAiGenStatus]=useState(null);
  const [showStandings,setShowStandings]=useState(false);
  // Chat
  const [chatMessages,setChatMessages]=useState([]);
  const [chatInput,setChatInput]=useState("");
  const [isRecording,setIsRecording]=useState(false);
  const [mediaRecorder,setMediaRecorder]=useState(null);
  const audioChunksRef=React.useRef([]);
  const [chatSending,setChatSending]=useState(false);
  const [chatUnread,setChatUnread]=useState(0);
  const [showAdminReminderModal,setShowAdminReminderModal]=useState(false);
  const [adminReminderMsg,setAdminReminderMsg]=useState(null);
  const chatBottomRef=React.useRef(null);
  const chatScrollRef=React.useRef(null);

  // After every render while on chat tab, if near bottom stay at bottom
  useEffect(()=>{
    if(tab!=="chat") return;
    const el = chatScrollRef.current;
    if(!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if(distFromBottom < 100) {
      el.scrollTop = el.scrollHeight;
    }
  });
  // Analytics
  const [groupAnalytics,setGroupAnalytics]=useState(null);
  const [analyticsGeneratedBy,setAnalyticsGeneratedBy]=useState(null);
  const [analyticsGeneratedAt,setAnalyticsGeneratedAt]=useState(null);
  const [analyticsLoading,setAnalyticsLoading]=useState(false);
  const [analyticsError,setAnalyticsError]=useState(null);
  // News
  const [newsStories,setNewsStories]=useState([]);
  const [newsUpdatedBy,setNewsUpdatedBy]=useState(null);
  const [newsUpdatedAt,setNewsUpdatedAt]=useState(null);
  const [newsFetching,setNewsFetching]=useState(false);
  const [newsCooldown,setNewsCooldown]=useState(0);
  const newsTimerRef=React.useRef(null);
  const NEWS_COOLDOWN_SECS=21600; // 6 hours

  // Restore news cooldown from localStorage on mount
  useEffect(()=>{
    const expiresAt = parseInt(localStorage.getItem('news_cooldown_expires')||'0');
    const remaining = Math.floor((expiresAt - Date.now()) / 1000);
    if(remaining > 0) {
      setNewsCooldown(remaining);
      newsTimerRef.current = setInterval(()=>{
        setNewsCooldown(c=>{
          if(c<=1){ clearInterval(newsTimerRef.current); localStorage.removeItem('news_cooldown_expires'); return 0; }
          return c-1;
        });
      }, 1000);
    } else {
      // Expired — clear localStorage
      localStorage.removeItem('news_cooldown_expires');
      setNewsCooldown(0);
    }
    return ()=>clearInterval(newsTimerRef.current);
  },[]);
  const [newsError,setNewsError]=useState(null);
  // Share card
  const [showShareCard,setShowShareCard]=useState(false);
  // Rank history
  const [rankHistory,setRankHistory]=useState([]);
  // Reactions — matchId → { emoji → count, myEmojis: Set }
  const [reactions,setReactions]=useState({});
  const [generatingOdds,setGeneratingOdds]=useState(false);
  const [oddsGenStatus,setOddsGenStatus]=useState(null);
  const [generatingExperts,setGeneratingExperts]=useState(false);
  const [expertsGenStatus,setExpertsGenStatus]=useState(null);
  const [adminHasSaved,setAdminHasSaved]=useState(false); // true once admin saves any results
  const [saveHistory,setSaveHistory]=useState([]); // last 5 admin saves
  const [showConfirm,setShowConfirm]=useState(false); // confirmation dialog
  const [pendingChanges,setPendingChanges]=useState([]); // diff to show in dialog
  const [rollbackTarget,setRollbackTarget]=useState(null);
  const [showResetConfirm,setShowResetConfirm]=useState(false);
  const [showUserResetConfirm,setShowUserResetConfirm]=useState(false);
  const [viewingUser,setViewingUser]=useState(null);
  const [h2hUsers,setH2hUsers]=useState([null,null]); // [user1, user2] for head-to-head
  const [h2hData,setH2hData]=useState(null); // loaded predictions for h2h // {username, predictions} for leaderboard view
  const MAX_HISTORY=5;
  const [podium,setPodium]=useState({first:null,second:null,third:null,topScorer:null});
  const [actualPodium,setActualPodium]=useState({first:null,second:null,third:null,topScorer:null});
  const [now,setNow]=useState(Date.now());
  const [adminMode,setAdminMode]=useState(false);
  const [predCounts,setPredCounts]=useState({}); // {username: filledCount}
  const [allPredData,setAllPredData]=useState({}); // {username: matches[]}
  const [adminPinInput,setAdminPinInput]=useState("");
  const [adminPinError,setAdminPinError]=useState("");
  const [deleteConfirmUser,setDeleteConfirmUser]=useState(null);
  const [confirmResetKO,setConfirmResetKO]=useState(false);
  const [chatReminderSent,setChatReminderSent]=useState(false);
  const [showAdvancedTray,setShowAdvancedTray]=useState(true);
  // Agentic features — track which reminders have already fired
  const firedRemindersRef = React.useRef(new Set());
  const [adminActiveGroup,setAdminActiveGroup]=useState("A");
  const [adminActiveRound,setAdminActiveRound]=useState("Round of 32");
  const [koKickoffs,setKoKickoffs]=useState({}); // "matchId" -> UTC ms
  const [livePredictions,setLivePredictions]=useState({}); // admin-editable shared predictions
  const [podiumSearch,setPodiumSearch]=useState({first:"",second:"",third:""});
  const [newPredKey,setNewPredKey]=useState("");
  const [newPredH,setNewPredH]=useState("");
  const [newPredA,setNewPredA]=useState("");
  const [newPredR,setNewPredR]=useState("");
  const [importText,setImportText]=useState("");
  const [showImport,setShowImport]=useState(false);
  const [lastBackupAt,setLastBackupAt]=useState(null); // timestamp of last backup
  const BACKUP_WARN_DAYS=3; // show warning after 3 days without backup
  const ADMIN_PIN="2026";

  // Embedded kickoff times (UTC ms) — from openfootball 2026 feed
  const KICKOFFS = {"Mexico||South Africa":1781208000000,"South Africa||Mexico":1781208000000,"South Korea||Czechia":1781229600000,"Czechia||South Korea":1781229600000,"Czechia||South Africa":1781798400000,"South Africa||Czechia":1781798400000,"Mexico||South Korea":1781830800000,"South Korea||Mexico":1781830800000,"Czechia||Mexico":1782349200000,"Mexico||Czechia":1782349200000,"South Africa||South Korea":1782349200000,"South Korea||South Africa":1782349200000,"Canada||Bosnia-Herzegovina":1781290800000,"Bosnia-Herzegovina||Canada":1781290800000,"Qatar||Switzerland":1781377200000,"Switzerland||Qatar":1781377200000,"Switzerland||Bosnia-Herzegovina":1781809200000,"Bosnia-Herzegovina||Switzerland":1781809200000,"Canada||Qatar":1781820000000,"Qatar||Canada":1781820000000,"Switzerland||Canada":1782327600000,"Canada||Switzerland":1782327600000,"Bosnia-Herzegovina||Qatar":1782327600000,"Qatar||Bosnia-Herzegovina":1782327600000,"Brazil||Morocco":1781388000000,"Morocco||Brazil":1781388000000,"Haiti||Scotland":1781398800000,"Scotland||Haiti":1781398800000,"Scotland||Morocco":1781906400000,"Morocco||Scotland":1781906400000,"Brazil||Haiti":1781915400000,"Haiti||Brazil":1781915400000,"Scotland||Brazil":1782338400000,"Brazil||Scotland":1782338400000,"Morocco||Haiti":1782338400000,"Haiti||Morocco":1782338400000,"USA||Paraguay":1781312400000,"Paraguay||USA":1781312400000,"Australia||Turkey":1781409600000,"Turkey||Australia":1781409600000,"USA||Australia":1781895600000,"Australia||USA":1781895600000,"Turkey||Paraguay":1781924400000,"Paraguay||Turkey":1781924400000,"Turkey||USA":1782439200000,"USA||Turkey":1782439200000,"Paraguay||Australia":1782439200000,"Australia||Paraguay":1782439200000,"Germany||Curacao":1781456400000,"Curacao||Germany":1781456400000,"Ivory Coast||Ecuador":1781478000000,"Ecuador||Ivory Coast":1781478000000,"Germany||Ivory Coast":1781985600000,"Ivory Coast||Germany":1781985600000,"Ecuador||Curacao":1782000000000,"Curacao||Ecuador":1782000000000,"Curacao||Ivory Coast":1782417600000,"Ivory Coast||Curacao":1782417600000,"Ecuador||Germany":1782417600000,"Germany||Ecuador":1782417600000,"Netherlands||Japan":1781467200000,"Japan||Netherlands":1781467200000,"Sweden||Tunisia":1781488800000,"Tunisia||Sweden":1781488800000,"Netherlands||Sweden":1781974800000,"Sweden||Netherlands":1781974800000,"Tunisia||Japan":1782014400000,"Japan||Tunisia":1782014400000,"Japan||Sweden":1782428400000,"Sweden||Japan":1782428400000,"Tunisia||Netherlands":1782428400000,"Netherlands||Tunisia":1782428400000,"Belgium||Egypt":1781550000000,"Egypt||Belgium":1781550000000,"Iran||New Zealand":1781571600000,"New Zealand||Iran":1781571600000,"Belgium||Iran":1782068400000,"Iran||Belgium":1782068400000,"New Zealand||Egypt":1782090000000,"Egypt||New Zealand":1782090000000,"Egypt||Iran":1782529200000,"Iran||Egypt":1782529200000,"New Zealand||Belgium":1782529200000,"Belgium||New Zealand":1782529200000,"Spain||Cape Verde":1781539200000,"Cape Verde||Spain":1781539200000,"Saudi Arabia||Uruguay":1781560800000,"Uruguay||Saudi Arabia":1781560800000,"Spain||Saudi Arabia":1782057600000,"Saudi Arabia||Spain":1782057600000,"Uruguay||Cape Verde":1782079200000,"Cape Verde||Uruguay":1782079200000,"Cape Verde||Saudi Arabia":1782518400000,"Saudi Arabia||Cape Verde":1782518400000,"Uruguay||Spain":1782518400000,"Spain||Uruguay":1782518400000,"France||Senegal":1781636400000,"Senegal||France":1781636400000,"Iraq||Norway":1781647200000,"Norway||Iraq":1781647200000,"France||Iraq":1782162000000,"Iraq||France":1782162000000,"Norway||Senegal":1782172800000,"Senegal||Norway":1782172800000,"Norway||France":1782500400000,"France||Norway":1782500400000,"Senegal||Iraq":1782500400000,"Iraq||Senegal":1782500400000,"Argentina||Algeria":1781658000000,"Algeria||Argentina":1781658000000,"Austria||Jordan":1781668800000,"Jordan||Austria":1781668800000,"Argentina||Austria":1782147600000,"Austria||Argentina":1782147600000,"Jordan||Algeria":1782183600000,"Algeria||Jordan":1782183600000,"Algeria||Austria":1782612000000,"Austria||Algeria":1782612000000,"Jordan||Argentina":1782612000000,"Argentina||Jordan":1782612000000,"Portugal||DR Congo":1781715600000,"DR Congo||Portugal":1781715600000,"Uzbekistan||Colombia":1781748000000,"Colombia||Uzbekistan":1781748000000,"Portugal||Uzbekistan":1782234000000,"Uzbekistan||Portugal":1782234000000,"Colombia||DR Congo":1782266400000,"DR Congo||Colombia":1782266400000,"Colombia||Portugal":1782603000000,"Portugal||Colombia":1782603000000,"DR Congo||Uzbekistan":1782603000000,"Uzbekistan||DR Congo":1782603000000,"England||Croatia":1781726400000,"Croatia||England":1781726400000,"Ghana||Panama":1781737200000,"Panama||Ghana":1781737200000,"England||Ghana":1782244800000,"Ghana||England":1782244800000,"Panama||Croatia":1782255600000,"Croatia||Panama":1782255600000,"Panama||England":1782594000000,"England||Panama":1782594000000,"Croatia||Ghana":1782594000000,"Ghana||Croatia":1782594000000};

  // Initial load — detect storage then check session and load data
  useEffect(()=>{
    (async()=>{
      try {
        await detectStorage();
        const session = getSession();
        const gc = session?.groupCode || 'default';
        if (session?.username) {
          const userRecord = await sbGetUser(session.username, gc);
          console.log('Session restore check:', session.username, gc, 'pin:', userRecord?.pin, 'record:', !!userRecord);
          if (!userRecord || !userRecord.pin) {
            console.log('PIN is null/missing — clearing session');
            clearSession();
          } else {
            setUserName(session.username);
            setGroupCode(gc);
          }
        }
        // Only load group-scoped data if session is still valid
        const validSession = getSession();
        if (validSession?.username) {
          const lb=await sbGetLeaderboard(gc); if(lb) setLeaderboard(lb);
        }
        const actual=await sbGetActualResults(groupCode);
        if(actual?.matches?.length)       setActualMatches(actual.matches);
        if(actual?.knockout?.length)       setActualKO(actual.knockout);
        if(actual?.actual_podium)    setActualPodium(p=>({...p,...actual.actual_podium}));
        if(actual?.ko_kickoffs)      setKoKickoffs(actual.ko_kickoffs);
        if(actual?.live_predictions) setLivePredictions(actual.live_predictions);
        // Also load all players' predictions for live match social panel and stats breakdown
        sbGetAllPredictions(gc).then(allPreds => {
          if (!allPreds?.length) return;
          const predsMap = {};
          allPreds.forEach(p => {
            if (p?.username) {
              predsMap[p.username] = { username: p.username, matches: p.matches||[], knockout: p.knockout||[], podium: p.podium||null };
            }
          });
          setAllPlayerPreds(predsMap);
          setLivePredictions(prev => ({ ...prev, ...predsMap }));
        }).catch(()=>{});
        if(actual)                   setAdminHasSaved(true);
        const hist = await sbGetSaveHistory();
        if(hist) setSaveHistory(hist);
        // Load shared AI content scoped to group
        const aiContent = await sbGetAIContent(gc);
        if(aiContent?.bracket)   { setBracketPred(aiContent.bracket); setBracketGeneratedBy(aiContent.bracket_generated_by); }
        if(aiContent?.bayesian)  { setBayesianPred(aiContent.bayesian); }
        if(aiContent?.commentary){ setCommentary(aiContent.commentary); setCommentaryGeneratedBy(aiContent.commentary_generated_by); setCommentaryGeneratedAt(aiContent.commentary_generated_at||null); }
        if(aiContent?.match_analyses) {
          const analyses = {};
          Object.entries(aiContent.match_analyses||{}).forEach(([id, a]) => {
            analyses[id] = { text: a.text, loading: false };
          });
          setMatchAnalysis(analyses);
        }
        // Load news
        const newsData = await sbGetNews(gc);
        console.log('[News load] groupCode:', gc, 'has news:', !!newsData?.news, 'count:', newsData?.news?.length);
        if(newsData?.news?.length){ setNewsStories(newsData.news); setNewsUpdatedBy(newsData.news_updated_by); setNewsUpdatedAt(newsData.news_updated_at); }
        // Load analytics
        const analyticsData = await sbGetAnalytics(gc);
        if(analyticsData?.analytics){ setGroupAnalytics(analyticsData.analytics); setAnalyticsGeneratedBy(analyticsData.analytics_generated_by); setAnalyticsGeneratedAt(analyticsData.analytics_generated_at); }
        // Load rank history
        if(session?.username) {
          const rh = await sbGetRankHistory(session.username, gc);
          if(rh?.length) setRankHistory(rh);
        }
      } catch(e) {
        console.error('Initial load error:', e);
        setAppError(`Load failed: ${e.message}`);
      } finally {
        setAppLoading(false);
      }
    })();
    const nowInterval=setInterval(()=>setNow(Date.now()),60*1000);
    const goOnline  = ()=>setIsOnline(true);
    const goOffline = ()=>setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return ()=>{
      clearInterval(nowInterval);
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  },[]);

  // ── Real-time subscriptions ─────────────────────────────────────────────────
  useEffect(()=>{
    // Subscribe to actual_results changes (admin saves scores) — global
    const resultsSub = supabase
      .channel('actual_results_changes')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'actual_results' }, payload=>{
        const d = payload.new;
        if(d.matches?.length)    setActualMatches(d.matches);
        if(d.knockout?.length)   setActualKO(d.knockout);
        if(d.actual_podium)      setActualPodium(p=>({...p,...d.actual_podium}));
        if(d.ko_kickoffs)        setKoKickoffs(d.ko_kickoffs);
        if(d.live_predictions)   setLivePredictions(d.live_predictions);
        setAdminHasSaved(true);
      })
      .subscribe();

    // Subscribe to ai_content changes — filter by group_code
    const aiSub = supabase
      .channel(`ai_content_${groupCode}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'ai_content',
        filter:`group_code=eq.${groupCode}` }, payload=>{
        const d = payload.new;
        if(d.bracket)    { setBracketPred(d.bracket);   setBracketGeneratedBy(d.bracket_generated_by); }
        if(d.bayesian)   { setBayesianPred(d.bayesian); }
        if(d.commentary) { setCommentary(d.commentary); setCommentaryGeneratedBy(d.commentary_generated_by); setCommentaryGeneratedAt(d.commentary_generated_at||null); }
        if(d.news?.length){ setNewsStories(d.news);      setNewsUpdatedBy(d.news_updated_by); setNewsUpdatedAt(d.news_updated_at); }
        if(d.analytics)  { setGroupAnalytics(d.analytics); setAnalyticsGeneratedBy(d.analytics_generated_by); setAnalyticsGeneratedAt(d.analytics_generated_at); }
      })
      .subscribe();

    // Load chat + subscribe to new messages — filter by group_code
    sbGetMessages(50, groupCode).then(msgs => {
      if(msgs?.length) {
        setChatMessages(msgs);
        // Scroll to bottom on initial load only
        setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:'auto'}), 100);
      }
      const lastSeen = parseInt(localStorage.getItem(`wc26_chat_seen_${groupCode}`) || '0');
      const isAdminLike = u => ['Admin','AI Recap','🤖 AI','⚡'].includes(u);

      // Restore unread badge count from messages newer than lastSeen
      const unreadCount = msgs.filter(m => new Date(m.created_at).getTime() > lastSeen).length;
      if (unreadCount > 0) setChatUnread(unreadCount);

      const unreadAdmin = msgs.filter(m =>
        isAdminLike(m.username) &&
        new Date(m.created_at).getTime() > lastSeen
      );
      if (unreadAdmin.length > 0) {
        setTimeout(() => {
          setAdminReminderMsg(unreadAdmin[unreadAdmin.length - 1]);
          setShowAdminReminderModal(true);
        }, 4000);
      }
    });
    const chatSub = supabase
      .channel(`chat_${groupCode}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'chat_messages',
        filter:`group_code=eq.${groupCode}` }, payload=>{
        if(payload.new.group_code !== groupCode) return;
        setChatMessages(prev => {
          const filtered = prev.filter(m => {
            const isOptimisticMatch = m.id?.startsWith('optimistic_') &&
              m.username === payload.new.username &&
              m.message === payload.new.message;
            if(isOptimisticMatch) console.log('[Chat dedup] removing optimistic, adding real id:', payload.new.id);
            return !isOptimisticMatch;
          });
          if (filtered.some(m => m.id === payload.new.id)) {
              return filtered;
          }
          return [...filtered, payload.new];
        });
        // Only increment unread for other people's messages
        if (payload.new.username !== userName) {
          setChatUnread(u => u + 1);
        }
        // Always scroll to bottom when new message arrives
        setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:'smooth'}), 150);
        setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:'smooth'}), 100);
      })
      .subscribe();

    // Subscribe to leaderboard changes — debounced to avoid N fetches when N users save
    let lbDebounce = null;
    const lbSub = supabase
      .channel(`leaderboard_${groupCode}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'leaderboard',
        filter:`group_code=eq.${groupCode}` }, ()=>{
        clearTimeout(lbDebounce);
        lbDebounce = setTimeout(async()=>{
          invalidateLBCache(groupCode);
          const lb = await sbGetLeaderboard(groupCode);
          if(lb) setLeaderboard(lb);
        }, 2000); // wait 2s for all saves to complete before fetching
      })
      .subscribe();

    return ()=>{
      supabase.removeChannel(resultsSub);
      supabase.removeChannel(lbSub);
      supabase.removeChannel(aiSub);
      supabase.removeChannel(chatSub);
    };
  },[groupCode]);

  // ── Prediction completion counter — stage-dependent ───────────────────────
  useEffect(()=>{
    // Determine which stages are currently "open" for predictions
    // A KO match is open once both teams are known (not TBD)
    const groupDone = matches.filter(m=>m.homeScore!==null&&m.awayScore!==null).length;

    // Only show KO predictions as part of total once admin has entered group results
    const groupResultsExist = actualMatches.some(m=>m.homeScore!==null);
    const koResultsExist = actualKO.some(m=>m.homeScore!==null&&m.home!=='TBD');
    // KO slots open for prediction only when admin has set actual KO teams
    const actualKOTeams = new Set(actualKO.filter(m=>m.home!=='TBD'&&m.away!=='TBD').map(m=>m.id));
    const r32Open    = groupResultsExist ? knockout.filter(m=>m.round==='Round of 32'&&actualKOTeams.has(m.id)) : [];
    const r16Open    = groupResultsExist ? knockout.filter(m=>m.round==='Round of 16'&&actualKOTeams.has(m.id)) : [];
    const qfOpen     = groupResultsExist ? knockout.filter(m=>m.round==='Quarter-Finals'&&actualKOTeams.has(m.id)) : [];
    const sfOpen     = groupResultsExist ? knockout.filter(m=>m.round==='Semi-Finals'&&actualKOTeams.has(m.id)) : [];
    const finalOpen  = groupResultsExist ? knockout.filter(m=>m.round==='Final'&&actualKOTeams.has(m.id)) : [];

    const koDone = knockout.filter(m=>
      m.homeScore!==null&&m.awayScore!==null&&m.home!=='TBD'
    ).length;

    // Total = group matches + all open KO matches
    const koOpen = r32Open.length + r16Open.length + qfOpen.length + sfOpen.length + finalOpen.length;
    const total  = ALL_MATCHES.length + koOpen;
    const done   = groupDone + koDone;

    // Stage label for display
    let stage = 'Group Stage';
    if (finalOpen.length > 0)        stage = 'Final';
    else if (sfOpen.length > 0)      stage = 'Semi-Finals';
    else if (qfOpen.length > 0)      stage = 'Quarter-Finals';
    else if (r16Open.length > 0)     stage = 'Round of 16';
    else if (r32Open.length > 0)     stage = 'Round of 32';

    setPredictionCount({done, total, stage});
  },[matches,knockout]);

  useEffect(()=>{
    if(!userName)return;
    (async()=>{
      try {
        const p=await sbGetPrediction(userName, groupCode);
        if(p){
          if(p.matches) setMatches(p.matches);
          if(p.knockout) {
            // Merge saved predictions with current actual team names
            const merged = p.knockout.map(m => {
              const actual = actualKO.find(a => a.id === m.id);
              if (!actual) return m;
              return {
                ...m,
                home: (actual.home && actual.home !== "TBD") ? actual.home : m.home,
                away: (actual.away && actual.away !== "TBD") ? actual.away : m.away,
              };
            });
            setKnockout(merged);
          }
          if(p.podium) setPodium(p.podium);

          // Check completion — show reminder if less than 50% of current stage predicted
          const koOpenCount = (p.knockout||[]).filter(m=>m.home!=='TBD'&&m.away!=='TBD').length;
          const stageTotalPreds = ALL_MATCHES.length + koOpenCount;
          const donePreds = [
            ...(p.matches||[]).filter(m=>m.homeScore!==null&&m.awayScore!==null),
            ...(p.knockout||[]).filter(m=>m.homeScore!==null&&m.awayScore!==null&&m.home!=='TBD'),
          ].length;
          if(donePreds < stageTotalPreds * 0.5) setShowPredReminder(true);

          // Check podium + top scorer completeness
          const missing = [];
          if(!p.podium?.first)     missing.push({icon:'🥇', label:'Champion pick',  tab:'champion'});
          if(!p.podium?.second)    missing.push({icon:'🥈', label:'Runner-up pick', tab:'champion'});
          if(!p.podium?.third)     missing.push({icon:'🥉', label:'3rd place pick', tab:'champion'});
          if(!p.podium?.topScorer || (p.podium?.topScorer||'').trim().length < 3)
                                   missing.push({icon:'⚽', label:'Top scorer pick', tab:'champion'});
          if(missing.length > 0) { setPodiumReminderItems(missing); setShowPodiumReminder(true); }
        } else {
          // New user with no predictions — always show reminder
          setShowPredReminder(true);
          setShowPodiumReminder(true);
          setPodiumReminderItems([
            {icon:'🥇', label:'Champion pick',   tab:'champion'},
            {icon:'🥈', label:'Runner-up pick',  tab:'champion'},
            {icon:'🥉', label:'3rd place pick',  tab:'champion'},
            {icon:'⚽', label:'Top scorer pick', tab:'champion'},
          ]);
        }
      } catch(e) {
        console.error('Load predictions error:', e);
        setAppError(`Predictions load failed: ${e.message}`);
      }
    })();
  },[userName]);

  const upMatch        = u=>{setMatches(p=>p.map(m=>m.id===u.id?u:m));setSaved(false);};
  const upMatchAndSync = upMatch;
  const upKO           = u=>{setKnockout(p=>p.map(m=>m.id===u.id?u:m));setSaved(false);};

  const autoFillKnockout=()=>{setKnockout(prev=>resetKnockoutTeams(prev));setSaved(false);};

  // ── Backup helpers (Options 1+2+3) ──────────────────────────────────────────
  const saveBackup = async (m, k, p) => {
    const at = Date.now();
    const data = { matches:m, knockout:k, podium:p, exportedAt:new Date(at).toISOString() };
    lsSet(`wc26_backup_${userName}`, data);
    lsSet(`wc26_backup_meta_${userName}`, { at });
    setLastBackupAt(at);
    setImportText(JSON.stringify(data)); // Option 1: always ready to copy
    return data;
  };

  // Export predictions — triggers a fresh backup and shows JSON
  const exportPredictions = async () => {
    await saveBackup(matches, knockout, podium);
    setShowImport(true);
  };

  // Import predictions from JSON
  const importPredictions = () => {
    try {
      const data = JSON.parse(importText);
      if (data.matches)  { setMatches(data.matches);  }
      if (data.knockout) { setKnockout(data.knockout); }
      if (data.podium)   { setPodium(data.podium);     }
      // Handle old "champion" field from pre-v9 versions
      if (data.champion && !data.podium) { setPodium({first:data.champion, second:null, third:null}); }
      setSaved(false);
      setImportText(prev=>prev);setShowImport(true);
      setImportText("");
      setShowImport(false);
    } catch(e) {
      setPinError("❌ Invalid JSON. Make sure you pasted the full exported text.");
    }
  };

  // Reload history when admin unlocks
  useEffect(()=>{
    if(!adminMode) return;
    (async()=>{
      const hist = await sbGetSaveHistory();
      if(hist) setSaveHistory(hist);
    })();
  },[adminMode]);

  // When admin sets team names in actualKO, sync them into user's knockout predictions
  // Only updates home/away team names — never touches user's predicted scores
  useEffect(()=>{
    if(!userName) return;
    setKnockout(prev => prev.map(m => {
      const actual = actualKO.find(a => a.id === m.id);
      if (!actual) return m;
      const hasRealHome = actual.home && actual.home !== "TBD";
      const hasRealAway = actual.away && actual.away !== "TBD";
      if (!hasRealHome && !hasRealAway) return m;
      return {
        ...m,
        home: hasRealHome ? actual.home : m.home,
        away: hasRealAway ? actual.away : m.away,
      };
    }));
  },[actualKO]);

  // Reset all results to blank
  const adminResetToBlank = async () => {
    setShowResetConfirm(false);
    const blankMatches  = actualMatches.map(m=>({...m, homeScore:null, awayScore:null}));
    const blankKO       = actualKO.map(m=>({...m, home:"TBD", away:"TBD", homeScore:null, awayScore:null}));
    const blankPodium   = { first:null, second:null, third:null };
    setActualMatches(blankMatches);
    setActualKO(blankKO);
    setActualPodium(blankPodium);
    await sbSaveActualResults(blankMatches, blankKO, blankPodium, koKickoffs, {}, groupCode);
    const lb=await sbGetLeaderboard(groupCode);
    for(const e of lb){
      const p=await sbGetPrediction(e.username, groupCode);
      if(p){ e.points=calcTotal(p.matches||[],blankMatches,p.knockout||[],blankKO,p.podium,blankPodium); e.champion=p.podium?.first||"?"; }
    }
    lb.sort((a,b)=>b.points-a.points);
    // leaderboard updated via sbUpsertLeaderboard
    setLeaderboard(lb);
    setAdminHasSaved(true);
    setAdminHasSaved(true); setAdminSaved(true); setTimeout(()=>setAdminSaved(false),2500);
  };

  // Admin: update actual group match score
  const adminUpdateMatch = u => setActualMatches(p=>p.map(m=>m.id===u.id?u:m));

  // Admin: update actual KO match — no auto-cascade, admin controls teams manually
  const adminUpdateKO = u => {
    setActualKO(prev => prev.map(m=>m.id===u.id?u:m));
  };

  // Admin: manually trigger R32 fill from actual group standings (only when button pressed)
  const adminFillR32=()=>{
    const liveQuals = deriveQualifiers(actualMatches);
    const hasResults = actualMatches.some(m=>m.homeScore!==null);
    console.log('[adminFillR32] hasResults:', hasResults, 'qualifiers:', JSON.stringify(liveQuals));
    if (!hasResults) {
      setAdminPinError("Enter some group stage results first!");setTimeout(()=>setAdminPinError(""),3000);
      return;
    }
    const newKO = fillLiveBracket(actualKO, liveQuals, null);
    console.log('[adminFillR32] R32 teams:', newKO.filter(m=>m.round==="Round of 32").map(m=>`${m.home} vs ${m.away}`));
    setActualKO(newKO);
    setAdminPinError("✅ R32 filled from standings — review and hit Save Results");
    setTimeout(()=>setAdminPinError(""),4000);
  };

  // Admin: save all actual results + recalc leaderboard
  // Build human-readable diff of what changed
  // ── Live Feed Sync ─────────────────────────────────────────────────────────
  // ── AI KO Prediction Generator ─────────────────────────────────────────────
  const generateKOPolymarketOdds = async () => {
    setGeneratingOdds(true);
    setOddsGenStatus(null);
    const koMatches = actualKO.filter(m => m.home !== "TBD" && m.away !== "TBD");
    if (koMatches.length === 0) {
      setOddsGenStatus({ ok:false, msg:"No KO teams set yet — fill R32 first." });
      setGeneratingOdds(false);
      return;
    }
    let done=0, notFound=0, failed=0;
    const newPreds = { ...livePredictions };
    for (const m of koMatches) {
      const key = `${m.home}||${m.away}`;
      try {
        const res = await fetch(`/api/odds?home=${encodeURIComponent(m.home)}&away=${encodeURIComponent(m.away)}`);
        const data = await res.json();
        if (data.found) {
          // Store Polymarket odds alongside AI predictions
          newPreds[key] = { ...newPreds[key], polymarket: data };
          done++;
        } else {
          notFound++;
        }
        setOddsGenStatus({ ok:true, msg:`Fetching... ${done+notFound+failed}/${koMatches.length}` });
      } catch(e) {
        console.error(`Odds failed for ${key}:`, e);
        failed++;
      }
    }
    setLivePredictions(newPreds);
    await sbSaveActualResults(actualMatches, actualKO, actualPodium, koKickoffs, newPreds, groupCode);
    setOddsGenStatus({
      ok: done > 0,
      msg: done > 0
        ? `✅ Found ${done} Polymarket markets${notFound>0?`, ${notFound} not listed yet`:""}.`
        : `⏳ No Polymarket markets found yet — try again closer to June 11.`
    });
    setGeneratingOdds(false);
  };

  const generateGroupAnalytics = async () => {
    const playedCount = actualMatches.filter(m => m.homeScore !== null).length;
    if(playedCount === 0) {
      setAnalyticsError('No match results yet — admin needs to save some scores first.');
      return;
    }
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      // Always fetch fresh leaderboard so points are up-to-date
      invalidateLBCache(groupCode);
      const freshLB = await sbGetLeaderboard(groupCode);
      if(freshLB?.length) setLeaderboard(freshLB);
      const lbToUse = freshLB?.length ? freshLB : leaderboard;

      // Build players payload with predictions
      const players = await Promise.all(lbToUse.map(async(e, i) => {
        const pred = await sbGetPrediction(e.username, groupCode);
        return {
          username: e.username,
          rank: i + 1,
          points: e.points,
          predictions: pred?.matches || [],
        };
      }));
      const res = await fetch('/api/analytics', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          players,
          actualResults: actualMatches,
          generatedBy: userName,
        }),
      });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); }
      catch(e) { throw new Error(`Non-JSON response: ${raw.slice(0,300)}`); }
      if(data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      if(!data.analysis) throw new Error(`No analysis. Keys: ${Object.keys(data).join(', ')}`);
      const a = data.analysis;
      if(Array.isArray(a)) throw new Error(`Got array instead of object`);
      if(!a.headline && !a.player_profiles) throw new Error(`Unexpected shape: ${Object.keys(a).join(', ')}`);
      setGroupAnalytics(data.analysis);
      setAnalyticsGeneratedBy(userName);
      setAnalyticsGeneratedAt(new Date().toISOString());
      console.log('Analytics set:', JSON.stringify(data.analysis).slice(0, 200));
      await sbSaveAnalytics(data.analysis, userName, groupCode);
    } catch(e) {
      setAnalyticsError(typeof e.message === 'string' ? e.message : JSON.stringify(e));
    }
    setAnalyticsLoading(false);
  };

  const forceRefreshNews = async () => {
    localStorage.removeItem('news_cooldown_expires');
    setNewsCooldown(0);
    await fetchNews();
  };
  const fetchNews = async () => {
    if(newsFetching||newsCooldown>0) return;
    setNewsFetching(true);
    setNewsError(null);
    try {
      const res = await fetch('/api/news', { method:'POST',
        headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); }
      catch(e) { throw new Error(`Server returned non-JSON: ${raw.slice(0,200)}`); }

      if(data.error) {
        setNewsError(data.error + (data.raw ? ` — raw: ${data.raw}` : ''));
      } else if(data.stories?.length) {
        setNewsStories(data.stories);
        setNewsUpdatedBy(userName);
        setNewsUpdatedAt(new Date().toISOString());
          await sbSaveNews(data.stories, userName, groupCode);
        // Persist cooldown expiry in localStorage
        const expiresAt = Date.now() + NEWS_COOLDOWN_SECS * 1000;
        localStorage.setItem('news_cooldown_expires', String(expiresAt));
        setNewsCooldown(NEWS_COOLDOWN_SECS);
        clearInterval(newsTimerRef.current);
        newsTimerRef.current = setInterval(()=>{
          setNewsCooldown(c=>{ if(c<=1){ clearInterval(newsTimerRef.current); return 0; } return c-1; });
        }, 1000);
      } else {
        setNewsError(`No stories in response — raw: ${raw.slice(0,200)}`);
      }
    } catch(e) {
      setNewsError(e.message);
      console.error('News fetch error:', e);
    }
    setNewsFetching(false);
  };

  const generateKOExpertPredictions = async () => {
    setGeneratingExperts(true);
    setExpertsGenStatus(null);
    const koMatches = actualKO.filter(m => m.home !== "TBD" && m.away !== "TBD");
    if (koMatches.length === 0) {
      setExpertsGenStatus({ ok:false, msg:"No KO teams set yet — fill R32 first." });
      setGeneratingExperts(false);
      return;
    }
    let done=0, failed=0;
    const newPreds = { ...livePredictions };
    for (const m of koMatches) {
      const key = `${m.home}||${m.away}`;
      setExpertsGenStatus({ ok:true, msg:`🔍 Fetching experts for ${m.home} vs ${m.away}… (${done+failed+1}/${koMatches.length})` });
      try {
        const res = await fetch('/api/experts', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ home:m.home, away:m.away, round:m.round }),
        });
        const data = await res.json();
        if (data.consensus) {
          newPreds[key] = { ...newPreds[key], experts: data };
          done++;
        } else { failed++; }
      } catch(e) {
        console.error(`Expert fetch failed for ${key}:`, e);
        failed++;
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 800));
    }
    setLivePredictions(newPreds);
    await sbSaveActualResults(actualMatches, actualKO, actualPodium, koKickoffs, newPreds, groupCode);
    setExpertsGenStatus({
      ok: done > 0,
      msg: done > 0
        ? `✅ Expert predictions fetched for ${done} KO matches.${failed>0?` ${failed} failed.`:""}`
        : `❌ Failed to fetch expert predictions — check API key or try again.`
    });
    setGeneratingExperts(false);
  };

  const generateKOPredictions = async () => {
    setGeneratingAI(true);
    setAiGenStatus(null);
    const koMatches = actualKO.filter(m => m.home !== "TBD" && m.away !== "TBD");
    if (koMatches.length === 0) {
      setAiGenStatus({ ok:false, msg:"No KO teams set yet — fill R32 first." });
      setGeneratingAI(false);
      return;
    }
    let done = 0, failed = 0;
    const newPreds = { ...livePredictions };
    for (const m of koMatches) {
      const key = `${m.home}||${m.away}`;
      if (newPreds[key]) { done++; continue; }
      try {
        const res = await fetch('/api/insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ home: m.home, away: m.away, round: m.round }),
        });
        if (!res.ok) throw new Error(await res.text());
        const pred = await res.json();
        // Store full insight data
        newPreds[key] = {
          h: pred.h, a: pred.a,
          r: pred.insight || pred.r || "",
          insight: pred.insight,
          key: pred.key,
          confidence: pred.confidence,
        };
        done++;
        setAiGenStatus({ ok:true, msg:`Generating insights... ${done}/${koMatches.length}` });
      } catch(e) {
        console.error(`Insight failed for ${key}:`, e);
        failed++;
      }
    }
    setLivePredictions(newPreds);
    await sbSaveActualResults(actualMatches, actualKO, actualPodium, koKickoffs, newPreds, groupCode);
    setAiGenStatus({
      ok: failed === 0,
      msg: `✅ Generated ${done} KO insights${failed > 0 ? ` (${failed} failed)` : ""}. Tap 🤖 on any KO match to see the analysis.`
    });
    setGeneratingAI(false);
  };

  const syncFromLiveFeed = async (override=false) => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const data = await fetchLiveFeed();
      const parsed = parseFeed(data, actualMatches, actualKO);
      const applied = applyFeedToState(parsed, actualMatches, actualKO, actualPodium, koKickoffs, override);

      // Apply to state — admin reviews before saving
      setActualMatches(applied.matches);
      setActualKO(applied.ko);
      setActualPodium(applied.podium);
      setKoKickoffs(applied.koKickoffs);

      const { groupScores, koScores, koTeams, hasPodium } = applied.stats;
      const parts = [];
      if (groupScores > 0) parts.push(`${groupScores} group score${groupScores!==1?'s':''}`);
      if (koTeams > 0) parts.push(`${koTeams} KO team${koTeams!==1?'s':''}`);
      if (koScores > 0) parts.push(`${koScores} KO score${koScores!==1?'s':''}`);
      if (hasPodium) parts.push('podium');

      setSyncStatus({
        ok: true,
        msg: parts.length > 0
          ? `✅ Synced: ${parts.join(', ')}. Manually entered values preserved. Review then Save.`
          : '⏳ Feed connected — no results yet (tournament not started).'
      });
    } catch(e) {
      setSyncStatus({ ok: false, msg: `❌ Sync failed: ${e.message}` });
    }
    setSyncing(false);
  };

  // ── Live Match Functions ────────────────────────────────────────────────────
  const fetchLiveMatches = async (includeToday=false) => {
    if (refreshCooldown > 0) { return; }
    setLiveLoading(true);
    setLiveError(null);
    try {
      // Only fetch today on first load or manual refresh — saves 1 request per auto-refresh
      const fetches = [fetch('/api/live?type=live')];
      if (includeToday || todayMatches.length === 0) fetches.push(fetch('/api/live?type=today'));
      const responses = await Promise.all(fetches);
      const jsons = await Promise.all(responses.map(r => r.json()));
      const liveData = jsons[0];
      const todayData = jsons[1];

      if (liveData.error) {
        const isSeasonError = liveData.error.toLowerCase().includes('internal') ||
          liveData.error.toLowerCase().includes('season') ||
          liveData.error.toLowerCase().includes('2026');
        if (isSeasonError) {
          setLiveMatches([]);
          if (todayData) setTodayMatches([]);
          setLiveLastUpdated(new Date());
          setRefreshCooldown(900);
          setLiveLoading(false);
          return;
        }
        throw new Error(liveData.tip ? `${liveData.error} — ${liveData.tip}` : liveData.error);
      }
      setLiveMatches(liveData.response || []);
      if (todayData) setTodayMatches(todayData.response || []);
      setLiveLastUpdated(new Date());
      setRefreshCooldown(900);
      // Re-fetch fixture details if selected — force to get latest events
      if (selectedFixture?.fixture?.id) {
        fetchFixtureDetails(selectedFixture.fixture.id, true);
      }
    } catch(e) {
      setLiveError(e.message);
    }
    setLiveLoading(false);
  };

  // Cooldown countdown ticker
  useEffect(()=>{
    if (refreshCooldown <= 0) return;
    const timer = setInterval(()=>{
      setRefreshCooldown(c => Math.max(0, c-1));
    }, 1000);
    return ()=>clearInterval(timer);
  },[refreshCooldown]);

  const fixtureCache = React.useRef({});

  const fetchFixtureDetails = async (fixtureId, force=false) => {
    // Use cache if available and not forced (saves 4 API calls per re-tap)
    if (!force && fixtureCache.current[fixtureId]) {
      const cached = fixtureCache.current[fixtureId];
      setFixtureStats(cached.stats);
      setFixtureEvents(cached.events);
      setFixtureLineups(cached.lineups);
      setFixturePlayers(cached.players);
      return;
    }
    setFixtureStats(null);
    setFixtureEvents([]);
    setFixtureLineups([]);
    setFixturePlayers([]);
    try {
      // Single batched request instead of 4 separate calls
      const res = await fetch(`/api/live?type=fixture&fixtureId=${fixtureId}`);
      const data = await res.json();
      setFixtureStats(data.stats || []);
      setFixtureEvents(data.events || []);
      setFixtureLineups(data.lineups || []);
      setFixturePlayers(data.players || []);
      // Cache for 5 minutes
      fixtureCache.current[fixtureId] = {
        stats: data.stats || [],
        events: data.events || [],
        lineups: data.lineups || [],
        players: data.players || [],
        ts: Date.now(),
      };
    } catch(e) {
      console.error('Fixture details error:', e);
    }
  };

  const askMatchQuery = async (question, fixture) => {
    if (!question.trim() || matchQueryLoading) return;
    const id = fixture?.fixture?.id;
    setMatchQueryLoading(true);
    try {
      const res = await fetch('/api/matchquery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          home: fixture?.teams?.home?.name,
          away: fixture?.teams?.away?.name,
          homeScore: fixture?.goals?.home,
          awayScore: fixture?.goals?.away,
          elapsed: fixture?.fixture?.status?.elapsed,
          fixtureId: fixture?.fixture?.id,
          events: fixtureEvents.slice(-10),
          stats: fixtureStats,
        }),
      });
      const data = await res.json();
      setMatchQueryAnswer(prev => ({
        ...prev,
        [id]: [...(prev[id]||[]), { q: question, a: data.answer||data.error }],
      }));
    } catch(e) {
      setMatchQueryAnswer(prev => ({
        ...prev,
        [id]: [...(prev[id]||[]), { q: question, a: `Error: ${e.message}` }],
      }));
    }
    setMatchQueryLoading(false);
    setMatchQuery('');
  };

  const analyseMatch = async (fixture) => {
    const id = fixture.fixture?.id;
    if (!id) return;
    setMatchAnalysis(prev => ({...prev, [id]: {text:null, loading:true}}));
    const homeName = fixture.teams?.home?.name;
    const awayName = fixture.teams?.away?.name;
    const normHome = TEAM_ALIASES[homeName]||homeName;
    const normAway = TEAM_ALIASES[awayName]||awayName;
    const pred = matches.find(m =>
      (m.home===normHome&&m.away===normAway)||(m.home===normAway&&m.away===normHome)||
      (m.home===homeName&&m.away===awayName)||(m.home===awayName&&m.away===homeName)
    );
    const userPred = (pred && pred.homeScore!==null && pred.homeScore!==undefined) ? {
      home: (pred.home===normHome||pred.home===homeName) ? pred.homeScore : pred.awayScore,
      away: (pred.home===normHome||pred.home===homeName) ? pred.awayScore : pred.homeScore,
    } : null;
    try {
      const res = await fetch('/api/analyse', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          home: homeName, away: awayName,
          homeScore: fixture.goals?.home,
          awayScore: fixture.goals?.away,
          elapsed: fixture.fixture?.status?.elapsed,
          events: fixtureEvents,
          stats: fixtureStats,
          userPred,
        }),
      });
      const data = await res.json();
      console.log('[analyseMatch] response:', data.analysis ? 'got analysis' : data.error || 'no analysis');
      setMatchAnalysis(prev => ({...prev, [id]: {text: data.analysis||data.error, loading:false}}));
      // Persist to Supabase ai_content
      try {
        const existing = await sbGetAIContent(groupCode);
        const analyses = existing?.match_analyses || {};
        analyses[id] = { text: data.analysis||data.error, home: homeName, away: awayName, ts: Date.now() };
        const { data: upData } = await supabase.from('ai_content').update({ match_analyses: analyses }).eq('group_code', groupCode).select();
        if (!upData?.length) {
          // Only insert if truly no row exists
          const { data: existing2 } = await supabase.from('ai_content').select('group_code').eq('group_code', groupCode).maybeSingle();
          if (!existing2) await supabase.from('ai_content').insert({ group_code: groupCode, match_analyses: analyses });
        }
      } catch(e) { /* non-critical */ }
    } catch(e) {
      setMatchAnalysis(prev => ({...prev, [id]: {text:`Error: ${e.message}`, loading:false}}));
    }
  };

  // ── AI Tournament Features ─────────────────────────────────────────────────
  const generateBracket = async () => {
    setBracketLoading(true);
    setBracketError(null);
    try {
      const res = await fetch('/api/tournament', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ type:'bracket' }),
      });
      const text = await res.text();
      console.log('[Bracket] raw response:', text.slice(0,300));
      let data;
      try { data = JSON.parse(text); } catch(e) { throw new Error(`Non-JSON response: ${text.slice(0,200)}`); }
      if (data.error) throw new Error(data.error);
      if (!data.champion) throw new Error('No champion in response — bracket may have timed out');
      setBracketPred(data);
      setBracketGeneratedBy(userName);
      await sbSaveAIContent(data, commentary, userName, commentaryGeneratedBy, groupCode);
    } catch(e) {
      console.error('Bracket error:', e);
      setBracketError(e.message);
    }
    setBracketLoading(false);
  };

  const generateBayesianUpdate = async () => {
    setBayesianLoading(true);
    try {
      // Played matches from actualMatches
      const playedMatches = actualMatches
        .filter(m => m.homeScore !== null && m.awayScore !== null)
        .map(m => ({ home: m.home, away: m.away, homeScore: m.homeScore, awayScore: m.awayScore }));

      // Prior probs from existing bracket
      const priorProbs = {};
      if (bracketPred?.simulationData) {
        bracketPred.simulationData.forEach(d => { priorProbs[d.team] = d.prob; });
      }

      // Teams still in tournament (not eliminated)
      const eliminated = new Set();
      for (const m of playedMatches) {
        // Simple heuristic — track group stage eliminations after all group games played
      }
      const remainingTeams = [...new Set(Object.values(GROUPS).flat())];

      const res = await fetch('/api/tournament', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bayesian', playedMatches, priorProbs, remainingTeams }),
      });
      const text = await res.text();
      console.log('[Bayesian] response status:', res.status, 'body:', text.slice(0,200));
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error);
      setBayesianPred(data);
      // Persist to Supabase
      await sbMergeAIContent({ bayesian: data, bayesian_generated_at: new Date().toISOString() }, groupCode);
    } catch(e) { console.error('Bayesian error:', e); }
    setBayesianLoading(false);
  };

  const generateCommentary = async () => {
    setCommentaryLoading(true);
    try {
      const matchesPlayed = actualMatches.filter(m=>m.homeScore!==null).length;
      const res = await fetch('/api/tournament', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          type:'commentary',
          leaderboard,
          actualResults: { matchesPlayed },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCommentary(data.commentary);
      setCommentaryGeneratedBy(userName);
      // Save to Supabase — real-time pushes to all users
      await sbSaveAIContent(bracketPred, data.commentary, bracketGeneratedBy, userName, groupCode);
    } catch(e) { console.error('Commentary error:', e); }
    setCommentaryLoading(false);
  };

  const calculateWhatIf = async () => {
    if (!whatIfTeam) return;
    setWhatIfLoading(true);
    setWhatIfResult(null);
    try {
      const lbWithPodium = await Promise.all(
        leaderboard.map(async e => {
          const p = await sbGetPrediction(e.username, groupCode);
          return { ...e, podium: p?.podium || {} };
        })
      );
      const res = await fetch('/api/tournament', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          type:'whatif',
          leaderboard: lbWithPodium,
          whatIfTeam,
          whatIfPlace,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWhatIfResult(data);
    } catch(e) { console.error('What-if error:', e); }
    setWhatIfLoading(false);
  };

  // ── FORMATION PITCH COMPONENT ───────────────────────────────────────────────
  const FormationPitch = ({ homeTeam, awayTeam, homePlayers, awayPlayers,
                            homeFormation, awayFormation, events=[], homeFlag, awayFlag }) => {
    if (!homePlayers?.length && !awayPlayers?.length) return null;

    // Apply substitutions from events
    const applyEvents = (players, teamName, events) => {
      let current = players.map(p => ({ ...p }));
      const subs = events.filter(e =>
        (e.type === "subst" || e.type === "Substitution") &&
        e.team?.name === teamName
      );
      const reds = events.filter(e =>
        e.type === "Card" && 
        (e.detail === "Red Card" || e.detail === "Yellow-Red Card" || e.detail === "Direct Red") &&
        e.team?.name === teamName
      );
      // Apply subs
      subs.forEach(sub => {
        const outName = sub.player?.name || sub.assist?.name;
        const inName  = sub.assist?.name || sub.player?.name;
        const idx = current.findIndex(p => 
          p.name === outName || p.player?.name === outName ||
          (outName && p.name?.includes(outName?.split(' ').slice(-1)[0]))
        );
        if (idx >= 0) {
          current[idx] = { ...current[idx], name: inName, subbed: true };
        }
      });
      // Apply red cards — flexible name matching
      reds.forEach(red => {
        const name = red.player?.name;
        if (!name) return;
        const lastName = name.split(' ').slice(-1)[0].toLowerCase();
        const idx = current.findIndex(p => {
          const pName = (p.name || p.player?.name || '').toLowerCase();
          return pName === name.toLowerCase() || pName.includes(lastName);
        });
        if (idx >= 0) current[idx] = { ...current[idx], redCard: true };
      });
      return current;
    };

    const homeCurrent = applyEvents(homePlayers, homeTeam, events);
    const awayCurrent = applyEvents(awayPlayers, awayTeam, events);

    const PW = 320, PH = 420;

    const positionPlayers = (players, isHome) => {
      const byGrid = {};
      players.forEach(p => {
        const grid = p.grid || "1:1";
        const row = parseInt(grid.split(":")[0]);
        if (!byGrid[row]) byGrid[row] = [];
        byGrid[row].push(p);
      });
      const rows = Object.keys(byGrid).sort((a,b)=>parseInt(a)-parseInt(b));
      const positioned = [];
      rows.forEach((row, ri) => {
        const rowPlayers = byGrid[row];
        const totalRows = rows.length;
        // Home: GK at 6%, attackers at 44% (well clear of centre at 50%)
        // Away: GK at 94%, attackers at 56% (well clear of centre)
        const yPct = isHome
          ? 6 + (ri / (totalRows-1)) * 38
          : 94 - (ri / (totalRows-1)) * 38;
        rowPlayers.forEach((p, pi) => {
          const xPct = rowPlayers.length === 1
            ? 50
            : 12 + (pi / (rowPlayers.length-1)) * 76;
          positioned.push({ ...p, xPct, yPct });
        });
      });
      return positioned;
    };

    const toX = xPct => 20 + xPct/100 * (PW-40);
    const toY = yPct => 10 + yPct/100 * PH;

    const renderDot = (p, color, textColor) => {
      const x = toX(p.xPct);
      const y = toY(p.yPct);
      const name = (p.name || p.player?.name || "").split(" ").slice(-1)[0];
      const fill = p.redCard ? "#ef4444" : color;
      const opacity = p.redCard ? 0.3 : 1;
      return (
        `<g opacity="${opacity}">` +
        `<circle cx="${x}" cy="${y}" r="13" fill="${fill}" stroke="rgba(0,0,0,0.4)" stroke-width="1.5"/>` +
        `<text x="${x}" y="${y+4}" text-anchor="middle" fill="${textColor}" font-size="8" font-weight="700" font-family="system-ui">${p.number||""}</text>` +
        (p.subbed ? `<circle cx="${x+10}" cy="${y-10}" r="5" fill="#22c55e" stroke="#000" stroke-width="0.5"/>` : "") +
        (p.redCard ? `<text x="${x+10}" y="${y-8}" text-anchor="middle" font-size="10" font-family="system-ui">🟥</text>` : "") +
        `<text x="${x}" y="${y+22}" text-anchor="middle" fill="${color}" font-size="7.5" font-family="system-ui">${name}</text>` +
        `</g>`
      );
    };

    const homePos = positionPlayers(homeCurrent, true);
    const awayPos = positionPlayers(awayCurrent, false);

    const svg = `<svg width="100%" viewBox="0 0 ${PW} ${PH+30}" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="10" width="${PW-40}" height="${PH}" rx="4" fill="#1a4a2e" stroke="#2d6b45" stroke-width="0.5"/>
      <rect x="20" y="10" width="${PW-40}" height="${PH}" rx="4" fill="none" stroke="#2d6b45" stroke-width="1.5"/>
      <line x1="20" y1="${10+PH/2}" x2="${PW-20}" y2="${10+PH/2}" stroke="#2d6b45" stroke-width="1"/>
      <circle cx="${PW/2}" cy="${10+PH/2}" r="35" fill="none" stroke="#2d6b45" stroke-width="1"/>
      <rect x="${PW/2-80}" y="10" width="160" height="55" fill="none" stroke="#2d6b45" stroke-width="1"/>
      <rect x="${PW/2-80}" y="${10+PH-55}" width="160" height="55" fill="none" stroke="#2d6b45" stroke-width="1"/>
      <text x="${PW/2}" y="8" text-anchor="middle" fill="#fcb900" font-size="9" font-weight="700" font-family="system-ui">${homeFlag} ${homeTeam} ${homeFormation||""}</text>
      ${homePos.map(p=>renderDot(p,"#fcb900","#000")).join("")}
      ${awayPos.map(p=>renderDot(p,"#22c55e","#000")).join("")}
      <text x="${PW/2}" y="${PH+26}" text-anchor="middle" fill="#22c55e" font-size="9" font-weight="700" font-family="system-ui">${awayFlag} ${awayTeam} ${awayFormation||""}</text>
    </svg>`;

    return (
      <div style={{marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:6,letterSpacing:1}}>⚽ FORMATIONS</div>
        <div dangerouslySetInnerHTML={{__html:svg}}/>
        <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:4}}>
          <span style={{fontSize:10,color:"#444"}}>🟥 = red card</span>
          <span style={{fontSize:10,color:"#444"}}>🟢 = subbed on</span>
        </div>
      </div>
    );
  };

  // ── WIN PROBABILITY ENGINE ──────────────────────────────────────────────────
  const calcWinProbability = (homeScore, awayScore, elapsed, events=[], stats=null) => {
    if (elapsed === 0) return { home:45, away:30, draw:25 };

    const remaining = Math.max(0, 90 - elapsed);
    const diff = homeScore - awayScore;
    const timeWeight = elapsed / 90; // 0→1 as match progresses

    // Base probabilities from scoreline
    let homeWin, awayWin, draw;
    if (diff === 0) {
      // Level — draw likely but shifts with time
      draw = Math.round(35 - timeWeight * 10);
      homeWin = Math.round(35 + timeWeight * 5);
      awayWin = Math.round(30 + timeWeight * 5);
    } else if (diff === 1) {
      homeWin = Math.round(55 + timeWeight * 25);
      draw    = Math.round(25 - timeWeight * 20);
      awayWin = Math.round(20 - timeWeight * 5);
    } else if (diff === -1) {
      awayWin = Math.round(55 + timeWeight * 25);
      draw    = Math.round(25 - timeWeight * 20);
      homeWin = Math.round(20 - timeWeight * 5);
    } else if (diff >= 2) {
      homeWin = Math.round(75 + timeWeight * 20);
      draw    = Math.round(15 - timeWeight * 10);
      awayWin = Math.round(10 - timeWeight * 10);
    } else {
      awayWin = Math.round(75 + timeWeight * 20);
      draw    = Math.round(15 - timeWeight * 10);
      homeWin = Math.round(10 - timeWeight * 10);
    }

    // Red card adjustments
    const homeReds = events.filter(e=>e.type==="Card"&&e.detail==="Red Card"&&e.side==="home").length;
    const awayReds = events.filter(e=>e.type==="Card"&&e.detail==="Red Card"&&e.side==="away").length;
    const redAdj = (awayReds - homeReds) * 8;
    homeWin = Math.max(2, homeWin + redAdj);
    awayWin = Math.max(2, awayWin - redAdj);

    // Possession adjustment (subtle)
    if (stats) {
      const homePoss = parseInt(stats.possession?.home) || 50;
      const possAdj = Math.round((homePoss - 50) * 0.1);
      homeWin = Math.max(2, homeWin + possAdj);
      awayWin = Math.max(2, awayWin - possAdj);
    }

    // Normalise to 100%
    const total = homeWin + awayWin + draw;
    homeWin = Math.round((homeWin/total)*100);
    awayWin = Math.round((awayWin/total)*100);
    draw = 100 - homeWin - awayWin;

    return { home: Math.max(2,homeWin), away: Math.max(2,awayWin), draw: Math.max(1,draw) };
  };

  // ── WIN PROBABILITY UI COMPONENT ────────────────────────────────────────────
  const WinProbBar = ({home, away, homeName, awayName, draw, homeFlag, awayFlag}) => {
    const leader = home>away?"home":away>home?"away":null;
    return(
      <div style={{marginBottom:12,padding:"12px 14px",
        background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10}}>
        <div style={{fontSize:10,color:"#555",fontWeight:700,marginBottom:8,letterSpacing:1}}>WIN PROBABILITY</div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{textAlign:"center",width:50}}>
            <div style={{fontSize:18}}>{homeFlag}</div>
            <div style={{fontSize:10,color:"#888",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",
              textOverflow:"ellipsis",maxWidth:50}}>{homeName?.split(" ")[0]}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,
                color:leader==="home"?"#22c55e":"#ccc"}}>{home}%</span>
              <span style={{fontSize:11,color:"#555",alignSelf:"center"}}>{draw}% draw</span>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,
                color:leader==="away"?"#22c55e":"#ccc"}}>{away}%</span>
            </div>
            <div style={{display:"flex",height:8,borderRadius:4,overflow:"hidden",gap:1}}>
              <div style={{width:`${home}%`,background:leader==="home"?"#22c55e":"#60a5fa",
                borderRadius:"4px 0 0 4px",transition:"width 1s ease"}}/>
              <div style={{width:`${draw}%`,background:"rgba(255,255,255,0.15)",transition:"width 1s ease"}}/>
              <div style={{width:`${away}%`,background:leader==="away"?"#22c55e":"#fcb900",
                borderRadius:"0 4px 4px 0",transition:"width 1s ease"}}/>
            </div>
          </div>
          <div style={{textAlign:"center",width:50}}>
            <div style={{fontSize:18}}>{awayFlag}</div>
            <div style={{fontSize:10,color:"#888",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",
              textOverflow:"ellipsis",maxWidth:50}}>{awayName?.split(" ")[0]}</div>
          </div>
        </div>
        <div style={{fontSize:10,color:"#444",textAlign:"center"}}>
          Based on score, time remaining, cards & possession
        </div>
      </div>
    );
  };

  // ── SIMULATION ─────────────────────────────────────────────────────────────
  const SIM_MATCH = { home:"Mexico", away:"South Africa", homeScore:0, awayScore:0 };
  const SIM_SCRIPT = [
    { min:8,  type:"Card",   detail:"Yellow Card", player:"Moreno",     team:"Mexico",       side:"home" },
    { min:23, type:"Goal",   player:"Lozano",      assist:"Vega",       team:"Mexico",       side:"home", h:1, a:0 },
    { min:34, type:"Card",   detail:"Yellow Card", player:"Tau",        team:"South Africa", side:"away" },
    { min:45, type:"Goal",   player:"Manyama",     assist:null,         team:"South Africa", side:"away", h:1, a:1 },
    { min:58, type:"Sub",    player:"Jimenez",     off:"Guardado",      team:"Mexico",       side:"home" },
    { min:67, type:"Goal",   player:"Jimenez",     assist:"Lozano",     team:"Mexico",       side:"home", h:2, a:1 },
    { min:78, type:"Card",   detail:"Red Card",    player:"Hlatshwayo", team:"South Africa", side:"away" },
    { min:88, type:"Goal",   player:"Martin",      assist:"Jimenez",    team:"Mexico",       side:"home", h:3, a:1 },
    { min:90, type:"End" },
  ];

  const getSimScore = (minute) => {
    let h=0, a=0;
    for (const ev of SIM_SCRIPT) {
      if (ev.min > minute) break;
      if (ev.type==="Goal") { h=ev.h; a=ev.a; }
    }
    return { h, a };
  };

  const getSimStats = (minute) => {
    const pct = Math.min(minute/90, 1);
    return {
      possession: { home: Math.round(55 + pct*5), away: Math.round(45 - pct*5) },
      shots:      { home: Math.round(pct*14),       away: Math.round(pct*5) },
      shotsOn:    { home: Math.round(pct*6),         away: Math.round(pct*2) },
      corners:    { home: Math.round(pct*7),         away: Math.round(pct*3) },
      fouls:      { home: Math.round(pct*9),         away: Math.round(pct*12) },
    };
  };

  useEffect(()=>{
    if (!simActive) return;
    if (simMinute >= 90) { setSimActive(false); return; }
    const tick = setInterval(()=>{
      setSimMinute(m => {
        const next = m + 1;
        // Fire events at their minute
        const fired = SIM_SCRIPT.filter(e => e.min === next);
        if (fired.length > 0) {
          setSimEvents(prev => [...prev, ...fired]);
        }
        setSimStats(getSimStats(next));
        if (next >= 90) { setSimActive(false); }
        return next;
      });
    }, 600); // 600ms per minute = ~54s for full match
    return () => clearInterval(tick);
  }, [simActive]);

  const startSim = () => {
    setSimMinute(0);
    setSimEvents([]);
    setSimStats(getSimStats(0));
    setSimAnalysis(null);
    setSimActive(true);
  };

  const stopSim = () => setSimActive(false);

  const generateSimAnalysis = async () => {
    setSimAnalysisLoading(true);
    setSimAnalysis(null);
    const score = getSimScore(simMinute);
    const prob = calcWinProbability(score.h, score.a, simMinute, simEvents,
      simStats ? { possession:{ home:simStats.possession.home } } : null);
    const pred = matches.find(m =>
      (m.home==="Mexico"&&m.away==="South Africa")||
      (m.home==="South Africa"&&m.away==="Mexico")
    );
    const userPred = pred?.homeScore!==null ? { home:pred.homeScore, away:pred.awayScore } : null;
    try {
      const res = await fetch('/api/analyse', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          home:"Mexico", away:"South Africa",
          homeScore: score.h, awayScore: score.a,
          elapsed: simMinute,
          winProb: prob,
          events: simEvents.filter(e=>e.type!=="End").map(e=>({
            time:{ elapsed:e.min },
            type: e.type==="Sub"?"Substitution":e.type,
            detail: e.detail,
            player:{ name:e.player },
            team:{ name:e.team },
            assist: e.assist?{ name:e.assist }:null,
          })),
          stats: simStats ? [
            { team:{name:"Mexico"}, statistics:[
              {type:"Ball Possession",value:`${simStats.possession.home}%`},
              {type:"Total Shots",value:simStats.shots.home},
              {type:"Shots on Goal",value:simStats.shotsOn.home},
              {type:"Corner Kicks",value:simStats.corners.home},
              {type:"Fouls",value:simStats.fouls.home},
            ]},
            { team:{name:"South Africa"}, statistics:[
              {type:"Ball Possession",value:`${simStats.possession.away}%`},
              {type:"Total Shots",value:simStats.shots.away},
              {type:"Shots on Goal",value:simStats.shotsOn.away},
              {type:"Corner Kicks",value:simStats.corners.away},
              {type:"Fouls",value:simStats.fouls.away},
            ]},
          ] : [],
          userPred,
        }),
      });
      const data = await res.json();
      setSimAnalysis(data.analysis || data.error);
    } catch(e) { setSimAnalysis(`Error: ${e.message}`); }
    setSimAnalysisLoading(false);
  };

  const fetchMarketOdds = async (homeName, awayName) => {
    const key = `${homeName}||${awayName}`;
    if (marketOdds[key]) return; // already loaded
    setMarketOdds(prev => ({...prev, [key]: {loading:true}}));
    try {
      const res = await fetch(`/api/odds?home=${encodeURIComponent(homeName)}&away=${encodeURIComponent(awayName)}`);
      const data = await res.json();
      setMarketOdds(prev => ({...prev, [key]: {...data, loading:false}}));
    } catch(e) {
      setMarketOdds(prev => ({...prev, [key]: {loading:false, error:e.message}}));
    }
  };

  // Load live data when tab is opened — only if cooldown expired (saves API quota)
  useEffect(()=>{
    if(tab!=="live") return;
    if(refreshCooldown > 0) return;
    fetchLiveMatches(true); // include today on tab open
  },[tab]);

  // Refresh allPlayerPreds when stats tab opens — 5min TTL to balance freshness vs egress
  const allPredsLastFetch = React.useRef(0);
  useEffect(()=>{
    if(tab!=="stats"||!groupCode) return;
    const now = Date.now();
    if(Object.keys(allPlayerPreds).length>0 && now - allPredsLastFetch.current < 5*60*1000) return;
    invalidatePredsCache(groupCode);
    sbGetAllPredictions(groupCode).then(allPreds=>{
      console.log('[Stats] sbGetAllPredictions returned:', allPreds?.length, 'users');
      if(!allPreds?.length) return;
      allPredsLastFetch.current = Date.now();
      const predsMap={};
      allPreds.forEach(p=>{
        if(p?.username) predsMap[p.username]={username:p.username,matches:p.matches||[],knockout:p.knockout||[],podium:p.podium||null};
      });
      console.log('[Stats] allPlayerPreds keys:', Object.keys(predsMap));
      setAllPlayerPreds(predsMap);
    }).catch(e=>console.error('[Stats] fetch error:', e));
  },[tab]);

  // Fetch top scorers when news tab opens — always refresh
  useEffect(()=>{
    if(tab!=="news") return;
    setScorersLoading(true);
    fetch('/api/live?type=topscorers')
      .then(r=>r.json())
      .then(d=>{ setTopScorers(d.response||[]); setScorersLoading(false); })
      .catch(()=>{ setTopScorers([]); setScorersLoading(false); });
  },[tab]);

  const buildChangeDiff = (prevMatches, newMatches, prevKO, newKO, prevPodium, newPodium) => {
    const changes = [];
    // Group match score changes
    for (const nm of newMatches) {
      const pm = prevMatches.find(m=>m.id===nm.id);
      if (!pm) continue;
      if ((nm.homeScore!==pm.homeScore || nm.awayScore!==pm.awayScore) && nm.homeScore!==null && nm.awayScore!==null)
        changes.push(`⚽ ${nm.home} ${nm.homeScore}–${nm.awayScore} ${nm.away}`);
    }
    // KO team name and score changes
    for (const nm of newKO) {
      const pm = prevKO.find(m=>m.id===nm.id);
      if (!pm) continue;
      if ((nm.home!==pm.home || nm.away!==pm.away) && nm.home!=="TBD" && nm.away!=="TBD")
        changes.push(`📋 [${nm.round}] ${nm.home} vs ${nm.away}`);
      if ((nm.homeScore!==pm.homeScore || nm.awayScore!==pm.awayScore) && nm.homeScore!==null && nm.awayScore!==null && nm.home!=="TBD")
        changes.push(`🏆 [${nm.round}] ${nm.home} ${nm.homeScore}–${nm.awayScore} ${nm.away}`);
    }
    // Podium changes — only show if new value is non-null AND actually different
    const p = newPodium  || {};
    const q = prevPodium || {};
    if (p.first  && p.first  !== q.first)  changes.push(`🥇 1st place: ${p.first}`);
    if (p.second && p.second !== q.second) changes.push(`🥈 2nd place: ${p.second}`);
    if (p.third  && p.third  !== q.third)  changes.push(`🥉 3rd place: ${p.third}`);
    return changes;
  };

  // Step 1: show confirmation dialog
  const adminSaveWithConfirm = async () => {
    try {
      const prev = await sbGetActualResults(groupCode) || {};
      const changes = buildChangeDiff(
        prev.matches||[], actualMatches,
        prev.knockout||[], actualKO,
        prev.actualPodium||{}, actualPodium
      );
      setPendingChanges(changes.length > 0 ? changes : ["💾 Saving current state"]);
      setShowConfirm(true);
    } catch(e) {
      setAdminPinError(`Error preparing save: ${e.message}`);
    }
  };

  // Step 2: confirmed — actually save + snapshot history
  const adminSave=async()=>{
    setShowConfirm(false);
    try {
      const getKOWinner = m => {
        if(!m||m.homeScore===null||m.awayScore===null) return null;
        return m.homeScore>m.awayScore?m.home:m.awayScore>m.homeScore?m.away:null;
      };
      const newPodium = {...actualPodium};
      const finalMatch = actualKO.find(m=>m.round==="Final");
      if(finalMatch?.homeScore!==null&&finalMatch?.awayScore!==null){
        const w=getKOWinner(finalMatch);
        if(w){ newPodium.first=w; newPodium.second=w===finalMatch.home?finalMatch.away:finalMatch.home; }
      }
      setActualPodium(newPodium);

      // Save history snapshot
      const snapshot = {
        at: new Date().toISOString(),
        label: `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`,
        matches: actualMatches,
        knockout: actualKO,
        actualPodium: newPodium,
        koKickoffs,
      };
      const newHistory = [snapshot, ...saveHistory].slice(0, MAX_HISTORY);
      setSaveHistory(newHistory);
      await sbAddSaveHistory(snapshot.label, snapshot.matches, snapshot.knockout, snapshot.actualPodium||snapshot.actual_podium, snapshot.koKickoffs||snapshot.ko_kickoffs);
      await sbSaveActualResults(actualMatches, actualKO, newPodium, koKickoffs, livePredictions, groupCode);

      // Recalculate leaderboard for ALL groups — batched for performance
      const allGroupCodes = await sbGetAllGroupCodes();
      for (const gc of allGroupCodes) {
        // Invalidate both caches to ensure fresh data
        invalidateLBCache(gc);
        invalidatePredsCache(gc);
        // Fetch ALL predictions for this group in one query
        const [lb, allPreds] = await Promise.all([
          sbGetLeaderboard(gc),
          sbGetAllPredictions(gc),
        ]);

        // Calculate points for each user using in-memory predictions
        const predMap = Object.fromEntries(allPreds.map(p => [p.username.trim().toLowerCase(), p]));
        const updatedEntries = lb.map(e => {
          const p = predMap[e.username.trim().toLowerCase()];
          if (!p) return e;
          const pts = calcTotal(p.matches||[], actualMatches, p.knockout||[], actualKO, p.podium, newPodium);
          if (e.username.toLowerCase().includes('germany')) {
            console.log('[Debug Germany]', e.username, 'pts:', pts,
              'matches:', p.matches?.length, 'actual:', actualMatches?.length,
              'scored actual:', actualMatches?.filter(m=>m.homeScore!==null).length,
              'scored pred:', p.matches?.filter(m=>m.homeScore!==null).length);
          }
          return {
            ...e,
            points: pts,
            podium: p.podium || {},
            champion: p.podium?.first || '?',
          };
        });

        // Batch update all leaderboard rows in one upsert
        await sbBatchUpdateLeaderboard(updatedEntries, gc);

        // Update UI for admin's own group
        if (gc === groupCode) {
          updatedEntries.sort((a,b) => b.points - a.points);
          setLeaderboard(updatedEntries);
        }
      }
      setAdminHasSaved(true); setAdminSaved(true); setTimeout(()=>setAdminSaved(false),2500);
    } catch(e) {
      setAdminPinError(`Save failed: ${e.message}`);
    }
  };

  // Rollback to a history snapshot — shows inline confirmation first
  const adminRollback = async (snapshot) => {
    setRollbackTarget(snapshot);
  };

  // Confirmed rollback — actually apply the snapshot
  const adminRollbackConfirmed = async () => {
    const snapshot = rollbackTarget;
    setRollbackTarget(null);
    setActualMatches(snapshot.matches);
    setActualKO(snapshot.knockout);
    setActualPodium(snapshot.actual_podium || snapshot.actualPodium || {});
    if(snapshot.ko_kickoffs || snapshot.koKickoffs) setKoKickoffs(snapshot.ko_kickoffs || snapshot.koKickoffs);
    await sbSaveActualResults(snapshot.matches, snapshot.knockout, snapshot.actual_podium || snapshot.actualPodium || {}, snapshot.ko_kickoffs || snapshot.koKickoffs || {}, livePredictions, groupCode);
    const snapMatches = snapshot.matches;
    const snapKO = snapshot.knockout;
    const snapPodium = snapshot.actual_podium || snapshot.actualPodium || {};
    const allGroupCodes = await sbGetAllGroupCodes();
    for (const gc of allGroupCodes) {
      const [lb, allPreds] = await Promise.all([
        sbGetLeaderboard(gc),
        sbGetAllPredictions(gc),
      ]);
      const predMap = Object.fromEntries(allPreds.map(p => [p.username, p]));
      const updatedEntries = lb.map(e => {
        const p = predMap[e.username];
        if (!p) return e;
        return {
          ...e,
          points: calcTotal(p.matches||[], snapMatches, p.knockout||[], snapKO, p.podium, snapPodium),
          podium: p.podium || {},
          champion: p.podium?.first || '?',
        };
      });
      await sbBatchUpdateLeaderboard(updatedEntries, gc);
      if (gc === groupCode) {
        updatedEntries.sort((a,b) => b.points - a.points);
        setLeaderboard(updatedEntries);
      }
    }
    setAdminHasSaved(true); setAdminSaved(true); setTimeout(()=>setAdminSaved(false),2500);
  };

  const myPts=calcTotal(matches,actualMatches,knockout,actualKO,podium,actualPodium);

  // Animate points when actual results change — don't upsert (admin save is source of truth)
  useEffect(()=>{
    if(!userName) return;
    const newPts = calcTotal(matches,actualMatches,knockout,actualKO,podium,actualPodium);
    setLeaderboard(prev => {
      const updated = prev.map(e =>
        e.username === userName ? { ...e, points: newPts } : e
      );
      return updated.sort((a,b)=>(b.points||0)-(a.points||0));
    });
  },[actualMatches,actualKO,actualPodium]);


  // Step 1: check if name exists in storage
  const submitName=async()=>{
    const n=nameInput.trim();if(!n)return;
    // Set group code — default to 'default' if blank
    const gc = groupCodeInput.trim() || 'default';
    setGroupCode(gc);
    setPinError("Checking…");
    const user=await sbGetUser(n, gc);
    if(user && user.pin){ setPinStep("pin-existing"); setPinError(""); }
    else                { setPinStep("pin-new");      setPinError(""); }
  };

  // Step 2a: new user — create account in storage
  const SESSION_DAYS = 30;
  const _saveSession = async (username) => {
    lsSet("wc26_session", {
      username,
      expiry: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    });
  };
  // clearSession imported from storage.js

  const submitNewPin=async()=>{
    const n=nameInput.trim();
    if(pinInput.length<4){setPinError("PIN must be at least 4 characters.");return;}
    if(pinInput!==pinConfirm){setPinError("PINs don't match — try again.");return;}
    setPinError("Creating account…");
    try {
      const code = generateRecoveryCode();
      await sbCreateUser(n, pinInput, code, groupCode);
      // Add to leaderboard immediately with 0 pts so they appear in standings
      const lb = await sbUpsertLeaderboard(n, {first:'?',second:'?',third:'?'}, 0, groupCode);
      console.log('New user leaderboard result:', lb?.length, 'entries for group', groupCode);
      if(lb) setLeaderboard(lb);
      setRecoveryCode(code);
      setPinStep("show-recovery");
    } catch(e) {
      console.error('submitNewPin error:', e);
      setPinError(`Error creating account: ${e.message}`);
    }
  };

  // Confirm recovery code seen — proceed to app
  const confirmRecoverySeen=async()=>{
    const n=nameInput.trim();
    try {
      saveSession(n, groupCode); // always save — user just registered
      setUserName(n);
      const lb = await sbGetLeaderboard(groupCode);
      if(lb) setLeaderboard(lb);
      setRecoveryCode("");
    } catch(e) {
      setAppError(`Login error: ${e.message}`);
    }
  };

  // Step 2b: returning user — verify PIN from storage
  const submitExistingPin=async()=>{
    const n=nameInput.trim();
    setPinError("Verifying…");
    try {
      const user=await sbGetUser(n, groupCode);
      if(user && pinInput===user.pin){
        saveSession(n, groupCode); // always save session
        setUserName(n);
        // Load this group's leaderboard on login
        const lb = await sbGetLeaderboard(groupCode);
        if(lb) setLeaderboard(lb);
        setRecoveryCode("");
      } else {
        setPinError("Incorrect PIN. Try again.");
        setPinInput("");
      }
    } catch(e) {
      setPinError(`Verification error: ${e.message}`);
    }
  };

  // Recovery: verify code and go to PIN reset step
  const submitRecoveryCode=async()=>{
    const n=nameInput.trim();
    if(!recoveryInput.trim()){setPinError("Enter your recovery code.");return;}
    setPinError("Checking code…");
    const valid = await sbVerifyRecovery(n, recoveryInput.trim());
    if(valid){
      setPinError("");
      setNewPinInput("");
      setNewPinConfirm("");
      setPinStep("reset-pin");
    } else {
      setPinError("Recovery code incorrect. Check the code you saved at signup.");
      setRecoveryInput("");
    }
  };

  // Recovery: set new PIN after successful code verification
  const submitResetPin=async()=>{
    const n=nameInput.trim();
    if(newPinInput.length<4){setPinError("PIN must be at least 4 characters.");return;}
    if(newPinInput!==newPinConfirm){setPinError("PINs don't match.");return;}
    await sbResetPin(n, newPinInput, groupCode);
    if(rememberMe) await saveSession(n, groupCode);
    setUserName(n);
    setPinError("");
    setNewPinInput("");
    setNewPinConfirm("");
    setRecoveryInput("");
  };

  // Reset user's own predictions to blank
  const userResetPredictions = async () => {
    setShowUserResetConfirm(false);
    const blankMatches  = ALL_MATCHES.map(m=>({...m})); // fresh from template
    const blankKO       = KNOCKOUT_TEMPLATE.map(m=>({...m}));
    const blankPodium   = { first:null, second:null, third:null };
    setMatches(blankMatches);
    setKnockout(blankKO);
    setPodium(blankPodium);
    setPodiumSearch({first:"",second:"",third:""});
    await sbSavePrediction(userName, blankMatches, blankKO, blankPodium, groupCode);
    const lb = await sbUpsertLeaderboard(userName, blankPodium, 0, groupCode);
    setLeaderboard(lb);
    setSaved(true);
  };

  const savePreds=async()=>{
    if(!userName)return;
    await sbSavePrediction(userName, matches, knockout, podium, groupCode);
    const lb = await sbUpsertLeaderboard(userName, podium, myPts, groupCode);
    setLeaderboard(lb);
    await saveBackup(matches, knockout, podium);
    setSaved(true);
  };

  // Auto-save every 30s when predictions are dirty
  const [autoSaveToast,setAutoSaveToast]=useState(false);
  useEffect(()=>{
    if(!userName || saved) return;
    const timer = setTimeout(async()=>{
      await sbSavePrediction(userName, matches, knockout, podium, groupCode);
      const lb = await sbUpsertLeaderboard(userName, podium, myPts, groupCode);
      setLeaderboard(lb);
      setSaved(true);
      // Brief toast
      setAutoSaveToast(true);
      setTimeout(()=>setAutoSaveToast(false), 2000);
    }, 30000);
    return ()=>clearTimeout(timer);
  },[matches, knockout, podium, userName]);

  // ── AGENT #7: Prediction deadline reminder ────────────────────────────────
  // Posts to chat when a match locks in ~2 hours, if players haven't predicted
  useEffect(()=>{
    if(!userName || !adminMode) return; // only admin triggers this
    const check = async () => {
      const now = Date.now();
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const unpredictedUsers = leaderboard.filter(e=>(predCounts[e.username]||0)===0).map(e=>e.username);

      for(const m of matches){
        const kickoff = KICKOFFS[m.id];
        if(!kickoff) continue;
        const lockTime = new Date(kickoff).getTime() - (15 * 60 * 1000);
        const timeToLock = lockTime - now;

        // Fires once when 90-120 minutes to lock
        if(timeToLock > 0 && timeToLock < TWO_HOURS && !firedRemindersRef.current.has(m.id)) {
          firedRemindersRef.current.add(m.id);
          const minsToLock = Math.round(timeToLock / 60000);
          const msg = [
            `⏰ Match locking in ~${minsToLock} mins!`,
            `${m.home} vs ${m.away}`,
            unpredictedUsers.length > 0
              ? `⚠️ Still needs predictions: ${unpredictedUsers.join(', ')}`
              : `✅ All players have predicted this match!`,
          ].join('\n');
          await sbSendMessage('⚡', msg, groupCode);
        }
      }
    };
    const interval = setInterval(check, 60 * 1000); // check every minute
    check(); // run immediately
    return () => clearInterval(interval);
  }, [adminMode, userName, matches, leaderboard]);

  const saveActualResults=async(newMatches, newKO)=>{
    await sbSaveActualResults(newMatches||actualMatches, newKO||actualKO, actualPodium, koKickoffs, livePredictions, groupCode);
    const lb=await sbGetLeaderboard(groupCode);
    const prevTop3 = leaderboard.slice(0,3).map(e=>e.username);
    for(const e of lb){
      const p=await sbGetPrediction(e.username, groupCode);
      if(p){
        e.points=calcTotal(p.matches||[],newMatches||actualMatches,p.knockout||[],newKO||actualKO,p.podium,actualPodium);
        e.champion=p.podium?.first||"?";
      }
    }
    lb.sort((a,b)=>b.points-a.points);
    setLeaderboard(lb);
    // Persist updated points back to Supabase for all players
    invalidateLBCache(groupCode);
    await Promise.all(lb.map(e =>
      supabase.from('leaderboard')
        .update({ points: e.points, champion: e.champion, updated_at: new Date().toISOString() })
        .eq('username', e.username).eq('group_code', groupCode)
    ));
    // Final authoritative fetch to confirm sync
    const confirmed = await sbGetLeaderboard(groupCode);
    if(confirmed?.length) setLeaderboard(confirmed);
    // Update rank history for each user
    for(const [i,e] of lb.entries()){
      await sbUpdateRankHistory(e.username, i+1, e.points, groupCode);
    }
    // Refresh own rank history
    const rh = await sbGetRankHistory(userName, groupCode);
    if(rh?.length) setRankHistory(rh);

    // ── AGENT #3: Leaderboard shake-up alert ─────────────────────────────────
    const newTop3 = lb.slice(0,3).map(e=>e.username);
    const changed = newTop3.some((u,i)=>u!==prevTop3[i]);
    if(changed && lb.length > 0) {
      const medals = ["🥇","🥈","🥉"];
      const top3Str = lb.slice(0,3).map((e,i)=>`${medals[i]} ${e.username} — ${e.points}pts`).join('\n');
      const newLeader = newTop3[0] !== prevTop3[0];
      const msg = [
        newLeader
          ? `🚨 New leader! ${newTop3[0]} takes the top spot!`
          : `📊 Leaderboard update — top 3 has changed!`,
        ``,
        top3Str,
        ``,
        `Check the 🥇 Board for full standings.`,
      ].join('\n');
      await sbSendMessage('⚡', msg, groupCode);
    }

    // ── AGENT #2: Post-match analysis ────────────────────────────────────────
    const justCompleted = (newMatches||actualMatches).filter(m=>{
      const prev = actualMatches.find(p=>p.id===m.id);
      return m.homeScore!==null && prev?.homeScore===null;
    });
    for(const m of justCompleted){
      const exactCount  = lb.filter(e=>{
        const pred = e.predictions?.find?.(p=>p.id===m.id);
        return pred && pred.homeScore===m.homeScore && pred.awayScore===m.awayScore;
      }).length;
      const winner = m.homeScore > m.awayScore ? m.home : m.homeScore < m.awayScore ? m.away : "Draw";
      const msg = [
        `⚽ Full time: ${m.home} ${m.homeScore}–${m.awayScore} ${m.away}`,
        winner==="Draw" ? `🤝 It ends all square!` : `🏆 ${winner} take the points!`,
        exactCount > 0
          ? `🎯 ${exactCount} player${exactCount!==1?"s":""} nailed the exact score — 6pts each!`
          : `No exact scores this time.`,
        `Check your points on 🥇 Board.`,
      ].join('\n');
      await sbSendMessage('⚡', msg, groupCode);
    }
  };

  const gm=matches.filter(m=>m.group===activeGroup);
  const ga=actualMatches.filter(m=>m.group===activeGroup);
  const gt=GROUPS[activeGroup];
  // Key forces StandingsTable to remount when actual results change
  const standingsKey=ga.map(m=>`${m.id}:${m.homeScore}:${m.awayScore}`).join("|");

  // Admin status pill
  const AdminPill=()=>{
    const scored = actualMatches.filter(m=>m.homeScore!==null).length;
    const total  = actualMatches.length;
    const color  = scored>0?"#22c55e":"#555";
    return(
      <div style={{
        display:"inline-flex",alignItems:"center",gap:8,
        background:`${color}12`,border:`1px solid ${color}40`,
        borderRadius:8,padding:"5px 12px",fontSize:11,color,
      }}>
        <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0}}/>
        {scored>0
          ? `${scored}/${total} group results entered`
          : "No results yet — admin enters scores as matches are played"}
      </div>
    );
  };

  // LOADING SPINNER
  if(appLoading) return(
    <div style={{minHeight:"100vh",background:"#0a0d12",display:"flex",
      flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontSize:40}}>⚽</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,
        letterSpacing:3,color:"#fcb900"}}>FIFA 2026</div>
      <div style={{display:"flex",gap:6,marginTop:8}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{
            width:8,height:8,borderRadius:"50%",background:"#fcb900",
            animation:`pulse 1.2s ease ${i*0.2}s infinite`,
          }}/>
        ))}
      </div>
      <div style={{fontSize:11,color:"#444",marginTop:4}}>Loading…</div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.2}50%{opacity:1}}`}</style>
    </div>
  );

  // LOGIN (multi-step: name → PIN)
  if(!userName) {
    const inputStyle={
      width:"100%",padding:"13px 16px",background:"rgba(255,255,255,0.06)",
      border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,
      color:"#fff",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",
      marginBottom:10,boxSizing:"border-box",
    };
    const btnStyle={
      width:"100%",padding:"13px",background:"#fcb900",border:"none",
      borderRadius:10,color:"#000",fontFamily:"'Bebas Neue',sans-serif",
      fontSize:20,cursor:"pointer",letterSpacing:1,marginTop:4,
    };
    return(
      <div style={{minHeight:"100vh",background:"#0a0d12",
        backgroundImage:"radial-gradient(ellipse 80% 55% at 50% -5%,rgba(0,115,55,0.4) 0%,transparent 68%)",
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700&display=swap');
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        `}</style>
        <div style={{textAlign:"center",maxWidth:400,width:"90%"}}>
          <div style={{fontSize:72,marginBottom:4}}>⚽</div>
          <h1 style={{fontSize:52,color:"#fcb900",letterSpacing:2,margin:"0 0 4px",lineHeight:1,fontFamily:"'Bebas Neue',sans-serif"}}>FIFA 2026</h1>
          <p style={{color:"#555",fontSize:13,marginBottom:28}}>World Cup Prediction Challenge</p>

          {/* Step 1: enter name */}
          {pinStep==="name" && (
            <div style={{textAlign:"left"}}>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>Your name</label>
              <input placeholder="e.g. Ramin" value={nameInput}
                onChange={e=>setNameInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&document.getElementById('groupCodeInput')?.focus()}
                style={inputStyle}/>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6,marginTop:12}}>
                League code
                <span style={{fontSize:10,color:"#444",marginLeft:6}}>— shared with your group</span>
              </label>
              <LeagueSelector
                value={groupCodeInput}
                onChange={setGroupCodeInput}
                onEnter={submitName}
                inputStyle={inputStyle}
              />
              <button onClick={submitName} style={btnStyle}>CONTINUE →</button>
            </div>
          )}

          {/* Step 2a: new user — set PIN */}
          {pinStep==="pin-new" && (
            <div style={{textAlign:"left"}}>
              <div style={{
                background:"rgba(252,185,0,0.08)",border:"1px solid rgba(252,185,0,0.2)",
                borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#999",
              }}>
                👋 Welcome, <strong style={{color:"#fcb900"}}>{nameInput}</strong>! Set a PIN to protect your predictions.
              </div>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>Choose a PIN (min 4 characters)</label>
              <input type="password" placeholder="Choose a PIN…" value={pinInput}
                onChange={e=>{setPinInput(e.target.value);setPinError("");}}
                onKeyDown={e=>e.key==="Enter"&&submitNewPin()}
                style={inputStyle}/>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>Confirm PIN</label>
              <input type="password" placeholder="Repeat PIN…" value={pinConfirm}
                onChange={e=>{setPinConfirm(e.target.value);setPinError("");}}
                onKeyDown={e=>e.key==="Enter"&&submitNewPin()}
                style={inputStyle}/>
              {pinError && <div style={{color:"#ef4444",fontSize:12,marginBottom:8}}>{pinError}</div>}
              {/* Remember Me */}
              <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,cursor:"pointer"}}>
                <input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)}
                  style={{width:15,height:15,accentColor:"#fcb900",cursor:"pointer"}}/>
                <span style={{fontSize:12,color:"#777"}}>Remember me for 30 days</span>
              </label>
              <button onClick={submitNewPin} style={btnStyle}>CREATE ACCOUNT</button>
              <button onClick={()=>{setPinStep("name");setPinInput("");setPinConfirm("");setPinError("");}}
                style={{width:"100%",marginTop:8,padding:"9px",background:"transparent",
                  border:"1px solid rgba(255,255,255,0.10)",borderRadius:10,color:"#555",
                  fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
            </div>
          )}

          {/* Step 2b: returning user — verify PIN */}
          {pinStep==="pin-existing" && (
            <div style={{textAlign:"left"}}>
              <div style={{
                background:"rgba(34,197,94,0.07)",border:"1px solid rgba(34,197,94,0.2)",
                borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#999",
              }}>
                🔒 Welcome back, <strong style={{color:"#22c55e"}}>{nameInput}</strong>! Enter your PIN to access your predictions.
              </div>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>Your PIN</label>
              <input type="password" placeholder="Enter your PIN…" value={pinInput}
                onChange={e=>{setPinInput(e.target.value);setPinError("");}}
                onKeyDown={e=>e.key==="Enter"&&submitExistingPin()}
                style={inputStyle} autoFocus/>
              {pinError && <div style={{color:"#ef4444",fontSize:12,marginBottom:8}}>{pinError}</div>}
              {/* Remember Me */}
              <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,cursor:"pointer"}}>
                <input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)}
                  style={{width:15,height:15,accentColor:"#fcb900",cursor:"pointer"}}/>
                <span style={{fontSize:12,color:"#777"}}>Remember me for 30 days</span>
              </label>
              <button onClick={submitExistingPin} style={btnStyle}>UNLOCK →</button>
              {/* Forgot PIN link */}
              <button onClick={()=>{setPinStep("recovery");setPinInput("");setPinError("");setRecoveryInput("");}}
                style={{width:"100%",marginTop:8,padding:"9px",background:"transparent",
                  border:"none",color:"#555",fontSize:12,cursor:"pointer",fontFamily:"inherit",
                  textDecoration:"underline"}}>Forgot PIN? Use recovery code</button>
              <button onClick={()=>{setPinStep("name");setPinInput("");setPinError("");}}
                style={{width:"100%",marginTop:4,padding:"9px",background:"transparent",
                  border:"1px solid rgba(255,255,255,0.10)",borderRadius:10,color:"#555",
                  fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Different name</button>
            </div>
          )}

          {/* Step: show recovery code after account creation */}
          {pinStep==="show-recovery" && (
            <div style={{textAlign:"left"}}>
              <div style={{
                background:"rgba(252,185,0,0.08)",border:"1px solid rgba(252,185,0,0.3)",
                borderRadius:10,padding:"14px",marginBottom:16,
              }}>
                <div style={{fontWeight:700,color:"#fcb900",fontSize:13,marginBottom:6}}>
                  🔑 Your Recovery Code
                </div>
                <div style={{fontFamily:"monospace",fontSize:22,letterSpacing:3,color:"#fff",
                  textAlign:"center",padding:"10px 0",fontWeight:700}}>
                  {recoveryCode}
                </div>
                <div style={{fontSize:11,color:"#888",marginTop:8,lineHeight:1.6}}>
                  Save this somewhere safe — you'll need it if you forget your PIN. It won't be shown again.
                </div>
              </div>
              <button onClick={confirmRecoverySeen} style={btnStyle}>
                I've saved my code → Enter App
              </button>
            </div>
          )}

          {/* Step: enter recovery code */}
          {pinStep==="recovery" && (
            <div style={{textAlign:"left"}}>
              <div style={{
                background:"rgba(96,165,250,0.07)",border:"1px solid rgba(96,165,250,0.2)",
                borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#999",
              }}>
                🔑 Enter the recovery code you saved when you created your account for <strong style={{color:"#60a5fa"}}>{nameInput}</strong>.
              </div>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>Recovery Code</label>
              <input placeholder="WC26-XXXX-XXXX" value={recoveryInput}
                onChange={e=>{setRecoveryInput(e.target.value.toUpperCase());setPinError("");}}
                onKeyDown={e=>e.key==="Enter"&&submitRecoveryCode()}
                style={{...inputStyle,fontFamily:"monospace",letterSpacing:2}} autoFocus/>
              {pinError && <div style={{color:"#ef4444",fontSize:12,marginBottom:8}}>{pinError}</div>}
              <button onClick={submitRecoveryCode} style={btnStyle}>Verify Code →</button>
              <button onClick={()=>{setPinStep("pin-existing");setRecoveryInput("");setPinError("");}}
                style={{width:"100%",marginTop:8,padding:"9px",background:"transparent",
                  border:"1px solid rgba(255,255,255,0.10)",borderRadius:10,color:"#555",
                  fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Back to PIN</button>
            </div>
          )}

          {/* Step: reset PIN after recovery code verified */}
          {pinStep==="reset-pin" && (
            <div style={{textAlign:"left"}}>
              <div style={{
                background:"rgba(34,197,94,0.07)",border:"1px solid rgba(34,197,94,0.2)",
                borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#999",
              }}>
                ✅ Recovery code verified for <strong style={{color:"#22c55e"}}>{nameInput}</strong>! Set a new PIN.
              </div>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6}}>New PIN</label>
              <input type="password" placeholder="New PIN (min 4 chars)…" value={newPinInput}
                onChange={e=>{setNewPinInput(e.target.value);setPinError("");}}
                onKeyDown={e=>e.key==="Enter"&&submitResetPin()}
                style={inputStyle} autoFocus/>
              <label style={{fontSize:12,color:"#666",display:"block",marginBottom:6,marginTop:10}}>Confirm New PIN</label>
              <input type="password" placeholder="Repeat new PIN…" value={newPinConfirm}
                onChange={e=>{setNewPinConfirm(e.target.value);setPinError("");}}
                onKeyDown={e=>e.key==="Enter"&&submitResetPin()}
                style={inputStyle}/>
              {pinError && <div style={{color:"#ef4444",fontSize:12,marginBottom:8}}>{pinError}</div>}
              <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,cursor:"pointer"}}>
                <input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)}
                  style={{width:15,height:15,accentColor:"#fcb900",cursor:"pointer"}}/>
                <span style={{fontSize:12,color:"#777"}}>Remember me for 30 days</span>
              </label>
              <button onClick={submitResetPin} style={btnStyle}>Set New PIN & Enter →</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const TABS_MAIN=[
    {id:"groups",      label:"⚽", full:"⚽ Groups"},
    {id:"knockout",    label:"🏆", full:"🏆 Knockout"},
    {id:"champion",    label:"👑", full:"👑 My Pick"},
    {id:"leaderboard", label:"🥇", full:"🥇 Board"},
    {id:"help",        label:"❓", full:"❓ Help"},
  ];
  const TABS_ADVANCED=[
    {id:"chat",    label:"💬", full:"💬 Chat"},
    {id:"live",    label:"🔴", full:"🔴 Live"},
    {id:"news",    label:"📰", full:"📰 News"},
    {id:"stats",   label:"📈", full:"📈 Stats"},
    {id:"ai",      label:"🤖", full:"🤖 AI"},
    {id:"admin",   label:"🔧", full:"🔧 Admin", restricted:true},
  ];
  const TABS=[...TABS_MAIN,...TABS_ADVANCED];
  const advancedTabActive = TABS_ADVANCED.some(t=>t.id===tab);

  return(
    <div style={{minHeight:"100vh",background:"#0a0d12",
      backgroundImage:"radial-gradient(ellipse 70% 38% at 50% 0%,rgba(0,90,48,0.3) 0%,transparent 65%)",
      fontFamily:"'DM Sans',sans-serif",color:"#e8e8e8"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700&display=swap');
        :root {
          --fs-xs: 9px; --fs-sm: 11px; --fs-md: 13px; --fs-lg: 15px;
          --border-subtle: rgba(255,255,255,0.06);
          --border-mid:    rgba(255,255,255,0.10);
          --border-strong: rgba(255,255,255,0.15);
          --bg-card:   rgba(255,255,255,0.03);
          --bg-hover:  rgba(255,255,255,0.06);
          --col-gold:  #fcb900; --col-green: #22c55e;
          --col-blue:  #60a5fa; --col-red:   #ef4444;
          --col-purple:#a78bfa;
        }
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button{opacity:1;}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:4px}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        body{-webkit-text-size-adjust:100%;overscroll-behavior:none}
        select{-webkit-appearance:auto}
        button{touch-action:manipulation}
      `}</style>

      {/* Global error banner — shows if any async error occurs */}
      {appError&&(
        <div style={{background:"#7f1d1d",color:"#fca5a5",padding:"12px 20px",fontSize:13,lineHeight:1.6,position:"relative",zIndex:1000}}>
          ⚠️ {appError}
          <button onClick={()=>setAppError(null)} style={{marginLeft:16,background:"transparent",border:"1px solid #fca5a5",borderRadius:4,color:"#fca5a5",padding:"2px 8px",cursor:"pointer",fontSize:11}}>✕</button>
        </div>
      )}

      {/* Points earned toast notification */}
      {recentPoints&&(
        <div style={{
          position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",
          zIndex:10000,background:"#22c55e",color:"#000",
          fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:1,
          padding:"12px 24px",borderRadius:12,
          boxShadow:"0 8px 32px rgba(34,197,94,0.4)",
          animation:"fadeUp 0.3s ease",whiteSpace:"nowrap",
        }}>
          🎉 +{recentPoints} pts just added!
        </div>
      )}

      {/* Prediction reminder modal */}
      {showPredReminder&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
          <div style={{background:"#141922",border:"1px solid rgba(252,185,0,0.3)",
            borderRadius:16,padding:"24px 22px",maxWidth:360,width:"100%"}}>
            <div style={{fontSize:32,textAlign:"center",marginBottom:8}}>⚠️</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#fcb900",
              textAlign:"center",letterSpacing:1,marginBottom:10}}>
              Fill In Your Predictions!
            </div>
            <div style={{fontSize:13,color:"#c0c0c0",lineHeight:1.7,marginBottom:8,textAlign:"center"}}>
              You've predicted{" "}
              <strong style={{color:"#fff"}}>
                {predictionCount.done}/{predictionCount.total}
              </strong>{" "}
              {predictionCount.stage&&predictionCount.stage!=='Group Stage'
                ? `${predictionCount.stage} matches.`
                : "group matches."}
            </div>
            <div style={{
              background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",
              borderRadius:10,padding:"10px 14px",marginBottom:18,fontSize:12,color:"#fca5a5",
              textAlign:"center",lineHeight:1.6,
            }}>
              🔒 Predictions lock <strong>15 minutes before kickoff</strong>.<br/>
              First match kicks off <strong>June 11, 2026</strong> — don't miss it!
            </div>
            {/* Progress bar */}
            <div style={{marginBottom:18}}>
              <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden",marginBottom:4}}>
                <div style={{
                  width:`${predictionCount.total>0?Math.round(predictionCount.done/predictionCount.total*100):0}%`,
                  height:"100%",background:"#fcb900",borderRadius:4,transition:"width 0.5s",
                }}/>
              </div>
              <div style={{fontSize:10,color:"#555",textAlign:"right"}}>
                {predictionCount.total>0?Math.round(predictionCount.done/predictionCount.total*100):0}% complete
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setShowPredReminder(false);setTab("groups");}} style={{
                flex:2,padding:"12px",background:"#fcb900",border:"none",borderRadius:10,
                color:"#000",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
              }}>⚽ Go to Predictions</button>
              <button onClick={()=>setShowPredReminder(false)} style={{
                flex:1,padding:"12px",background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.10)",borderRadius:10,
                color:"#666",fontSize:13,cursor:"pointer",fontFamily:"inherit",
              }}>Later</button>
            </div>
          </div>
        </div>
      )}

      {showPodiumReminder&&!showPredReminder&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
          <div style={{background:"#141922",border:"1px solid rgba(139,92,246,0.3)",
            borderRadius:16,padding:"24px 22px",maxWidth:360,width:"100%"}}>
            <div style={{fontSize:32,textAlign:"center",marginBottom:8}}>👑</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#a78bfa",
              textAlign:"center",letterSpacing:1,marginBottom:10}}>
              Complete Your Picks!
            </div>
            <div style={{fontSize:13,color:"#c0c0c0",lineHeight:1.7,marginBottom:14,textAlign:"center"}}>
              You haven't filled in all your bonus picks — these are worth up to{" "}
              <strong style={{color:"#a78bfa"}}>100 extra points!</strong>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
              {podiumReminderItems.map((item,i)=>(
                <div key={i} style={{
                  display:"flex",alignItems:"center",gap:12,
                  padding:"10px 14px",borderRadius:10,
                  background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)",
                }}>
                  <span style={{fontSize:20,flexShrink:0}}>{item.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#c4b5fd"}}>{item.label}</div>
                    <div style={{fontSize:10,color:"#555"}}>Missing — tap to fill in</div>
                  </div>
                  <span style={{fontSize:11,color:"#ef4444",fontWeight:700}}>!</span>
                </div>
              ))}
            </div>
            <div style={{
              background:"rgba(252,185,0,0.06)",border:"1px solid rgba(252,185,0,0.15)",
              borderRadius:8,padding:"8px 12px",marginBottom:16,fontSize:11,color:"#888",textAlign:"center",
            }}>
              🔒 Picks lock <strong style={{color:"#fcb900"}}>Friday June 19, midnight UTC</strong>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setShowPodiumReminder(false);setTab("champion");setShowAdvancedTray(false);}} style={{
                flex:2,padding:"12px",background:"#a78bfa",border:"none",borderRadius:10,
                color:"#000",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
              }}>👑 Go to My Pick</button>
              <button onClick={()=>setShowPodiumReminder(false)} style={{
                flex:1,padding:"12px",background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.10)",borderRadius:10,
                color:"#666",fontSize:13,cursor:"pointer",fontFamily:"inherit",
              }}>Later</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin/AI reminder modal */}
      {showAdminReminderModal&&adminReminderMsg&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
          <div style={{background:"#141922",border:"1px solid rgba(96,165,250,0.3)",
            borderRadius:16,padding:"24px 22px",maxWidth:360,width:"100%"}}>
            <div style={{fontSize:28,textAlign:"center",marginBottom:8}}>
              {(adminReminderMsg.username==="🤖 AI"||adminReminderMsg.username==="AI Recap")?"🤖":"📣"}
            </div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,
              color:"#60a5fa",textAlign:"center",letterSpacing:1,marginBottom:10}}>
              {(adminReminderMsg.username==="🤖 AI"||adminReminderMsg.username==="AI Recap")?"New AI Digest":"Admin Message"}
            </div>
            <div style={{
              fontSize:12,color:"#888",lineHeight:1.7,marginBottom:16,
              background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px",
              maxHeight:120,overflow:"hidden",position:"relative",
            }}>
              {(adminReminderMsg.message||'').slice(0,200)}{adminReminderMsg.message?.length>200?'…':''}
              <div style={{
                position:"absolute",bottom:0,left:0,right:0,height:30,
                background:"linear-gradient(transparent,#141922)",
              }}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{
                setShowAdminReminderModal(false);
                handleTabChange("chat");
                setShowAdvancedTray(true);
              }} style={{
                flex:2,padding:"12px",background:"#60a5fa",border:"none",borderRadius:10,
                color:"#000",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
              }}>💬 Open Chat</button>
              <button onClick={()=>setShowAdminReminderModal(false)} style={{
                flex:1,padding:"12px",background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.10)",borderRadius:10,
                color:"#666",fontSize:13,cursor:"pointer",fontFamily:"inherit",
              }}>Later</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:"rgba(0,0,0,0.4)",backdropFilter:"blur(14px)",
        position:"sticky",top:0,zIndex:100,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        {/* Main header row */}
        <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>⚽</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:"#fcb900",lineHeight:1}}>FIFA 2026</div>
            <div style={{fontSize:10,color:"#444"}}>
              {groupCode&&groupCode!=='default'?groupCode:'Prediction Challenge'}
            </div>
          </div>
          {myPts>0&&<div style={{background:"rgba(252,185,0,0.12)",border:"1px solid rgba(252,185,0,0.28)",
            borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,color:"#fcb900",flexShrink:0}}>🏅 {myPts}pts</div>}
          <span style={{fontSize:10,color:"#444",flexShrink:0,maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>👤 {userName}</span>
          <button onClick={savePreds} style={{padding:"6px 14px",background:saved?"#22c55e":"#fcb900",
            border:"none",borderRadius:6,color:"#000",fontWeight:700,fontSize:12,cursor:"pointer",
            transition:"all 0.3s",fontFamily:"inherit",flexShrink:0}}>
            {saved?"✓ Saved":"Save"}
          </button>
        </div>

        {/* Action row — logout only, rest moved to Admin */}
        <div style={{padding:"0 14px 8px",display:"flex",gap:6,justifyContent:"flex-end"}}>
          <button onClick={()=>{clearSession();setUserName("");setGroupCode("default");setGroupCodeInput("");setNameInput("");setPinInput("");setPinConfirm("");setPinStep("name");setPinError("");}} style={{
            padding:"4px 9px",background:"transparent",border:"1px solid rgba(255,255,255,0.10)",
            borderRadius:6,color:"#555",fontSize:10,cursor:"pointer",fontFamily:"inherit",
          }}>↩ Logout</button>
        </div>
        {/* Prediction completion bar */}
        {predictionCount.total>0&&(
          <div style={{padding:"0 14px 8px",display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1,height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
              <div style={{
                width:`${Math.round(predictionCount.done/predictionCount.total*100)}%`,
                height:"100%",background:predictionCount.done===predictionCount.total?"#22c55e":"#fcb900",
                borderRadius:2,transition:"width 0.5s",
              }}/>
            </div>
            <div style={{fontSize:10,color:predictionCount.done===predictionCount.total?"#22c55e":"#555",flexShrink:0}}>
              {predictionCount.done}/{predictionCount.total}
              {predictionCount.stage&&predictionCount.stage!=='Group Stage'&&(
                <span style={{color:"#444",marginLeft:4}}>· {predictionCount.stage}</span>
              )}
              {predictionCount.done<predictionCount.total&&" ⚠️"}
            </div>
          </div>
        )}
      </div>

      {/* User reset predictions confirmation */}
      {showUserResetConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
          <div style={{background:"#1a1f2e",border:"1px solid rgba(239,68,68,0.35)",
            borderRadius:16,padding:"22px 24px",maxWidth:360,width:"100%"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#ef4444",marginBottom:10}}>
              Reset My Predictions?
            </div>
            <div style={{fontSize:13,color:"#c0c0c0",marginBottom:8,lineHeight:1.6}}>
              This will clear <strong style={{color:"#fff"}}>all your score predictions</strong> and <strong style={{color:"#fff"}}>podium picks</strong> back to blank.
            </div>
            <div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",
              borderRadius:8,padding:"10px 12px",marginBottom:16,fontSize:11,color:"#ef4444"}}>
              Only your own predictions are affected. Other participants are not impacted. Your backup will be preserved.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={userResetPredictions} style={{flex:1,padding:"11px",
                background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)",
                borderRadius:8,color:"#ef4444",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Yes, Reset Mine
              </button>
              <button onClick={()=>setShowUserResetConfirm(false)} style={{flex:1,padding:"11px",
                background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
                borderRadius:8,color:"#888",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import/export panel */}
      {showImport&&(
        <div style={{
          background:"rgba(252,185,0,0.07)",borderBottom:"1px solid rgba(252,185,0,0.2)",
          padding:"12px 16px",
        }}>
          <div style={{fontSize:12,color:"#fcb900",fontWeight:700,marginBottom:4}}>
            📦 Backup: Copy the text below and save it somewhere safe.<br/>
            📥 Import: Paste previously exported text here, then tap Import.
            {lastBackupAt&&<span style={{color:"#22c55e",fontWeight:400,fontSize:11}}> · Last backup: {new Date(lastBackupAt).toLocaleDateString()} {new Date(lastBackupAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>}
          </div>
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <textarea value={importText} onChange={e=>setImportText(e.target.value)}
              placeholder='Tap Export above to see your predictions, or paste exported JSON here to import…'
              style={{flex:1,height:80,padding:"8px",background:"rgba(0,0,0,0.3)",
                border:"1px solid rgba(255,255,255,0.15)",borderRadius:6,
                color:"#fff",fontSize:11,fontFamily:"monospace",resize:"none",outline:"none"}}/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={importPredictions} style={{
                padding:"8px 14px",background:"#fcb900",border:"none",borderRadius:6,
                color:"#000",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",
              }}>Import</button>
              <button onClick={async()=>{
                const backup=lsGet(`wc26_backup_${userName}`);
                if(backup){setImportText(JSON.stringify(backup));}
                else{setImportText("No backup found in storage yet.");}
              }} style={{
                padding:"8px 14px",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",
                borderRadius:6,color:"#22c55e",fontSize:11,cursor:"pointer",fontFamily:"inherit",
              }}>♻️ Restore</button>
              <button onClick={()=>{setShowImport(false);setImportText("");}} style={{
                padding:"8px 14px",background:"transparent",border:"1px solid rgba(255,255,255,0.10)",
                borderRadius:6,color:"#555",fontSize:12,cursor:"pointer",fontFamily:"inherit",
              }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* OFFLINE BANNER */}
      {!isOnline&&(
        <div style={{
          background:"rgba(239,68,68,0.12)",borderBottom:"1px solid rgba(239,68,68,0.3)",
          padding:"8px 16px",display:"flex",alignItems:"center",gap:8,
        }}>
          <span style={{fontSize:14}}>📡</span>
          <span style={{fontSize:11,color:"#fca5a5",fontWeight:600}}>
            No connection — changes will save automatically when reconnected
          </span>
        </div>
      )}

      {/* SHARE CARD MODAL */}
      {showShareCard&&(()=>{
        const myRank=leaderboard.findIndex(e=>e.username===userName)+1;
        const total=leaderboard.length;
        const pct=Math.round(predictionCount.done/predictionCount.total*100);
        const shareText=`🏆 FIFA World Cup 2026 Predictions\n👤 ${userName} · #${myRank} of ${total}\n🏅 ${myPts} points · ${pct}% predicted\n⚽ Picked ${podium?.first||"?"} to win it all\n\nPlay at: toto-app-oqdi.vercel.app`;
        const handleShare=async()=>{
          if(navigator.share){
            await navigator.share({title:"FIFA 2026 Predictions",text:shareText});
          } else {
            navigator.clipboard?.writeText(shareText);
            alert("Copied to clipboard!");
          }
        };
        return(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",
            zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",
            padding:20}} onClick={()=>setShowShareCard(false)}>
            <div onClick={e=>e.stopPropagation()} style={{
              width:"100%",maxWidth:340,borderRadius:20,overflow:"hidden",
              background:"linear-gradient(135deg,#1a1f2e 0%,#0d1117 100%)",
              border:"1px solid rgba(252,185,0,0.3)",boxShadow:"0 24px 80px rgba(0,0,0,0.6)",
            }}>
              {/* Card header */}
              <div style={{background:"linear-gradient(135deg,rgba(252,185,0,0.15),rgba(252,185,0,0.05))",
                padding:"24px 24px 20px",textAlign:"center",
                borderBottom:"1px solid rgba(252,185,0,0.15)"}}>
                <div style={{fontSize:32,marginBottom:8}}>⚽</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:"#fcb900",letterSpacing:3}}>FIFA 2026</div>
                <div style={{fontSize:11,color:"#555",marginTop:2}}>Prediction Challenge</div>
              </div>
              {/* Stats */}
              <div style={{padding:"20px 24px"}}>
                <div style={{fontSize:20,fontWeight:700,color:"#fff",marginBottom:16}}>👤 {userName}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                  {[
                    {label:"Rank",value:`#${myRank} of ${total}`,color:"#fcb900"},
                    {label:"Points",value:`${myPts}pts`,color:"#22c55e"},
                    {label:"Predicted",value:`${pct}%`,color:"#60a5fa"},
                    {label:"My Champion",value:podium?.first||"?",color:"#a78bfa"},
                  ].map((s,i)=>(
                    <div key={i} style={{background:"rgba(255,255,255,0.06)",
                      border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:10,color:"#444",marginBottom:4}}>{s.label}</div>
                      <div style={{fontSize:15,fontWeight:700,color:s.color}}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {/* Rank chart sparkline */}
                {rankHistory.length>1&&(
                  <div style={{marginBottom:16,padding:"10px 12px",
                    background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
                    borderRadius:10}}>
                    <div style={{fontSize:10,color:"#444",marginBottom:6}}>📈 Rank History</div>
                    <svg width="100%" height="40" viewBox={`0 0 ${rankHistory.length*20} 40`}>
                      {rankHistory.map((r,i)=>{
                        const maxRank=Math.max(...rankHistory.map(x=>x.rank));
                        const y=4+(r.rank-1)/(maxRank-1||1)*32;
                        const x=i*20+10;
                        return(
                          <g key={i}>
                            {i>0&&(()=>{
                              const prev=rankHistory[i-1];
                              const py=4+(prev.rank-1)/(maxRank-1||1)*32;
                              return<line x1={(i-1)*20+10} y1={py} x2={x} y2={y}
                                stroke="#fcb900" strokeWidth="1.5" opacity="0.6"/>;
                            })()}
                            <circle cx={x} cy={y} r="3" fill="#fcb900"/>
                            <text x={x} y={y-6} textAnchor="middle"
                              fill="#555" fontSize="7">#{r.rank}</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                )}
                {/* Podium picks */}
                {(podium?.first||podium?.second||podium?.third)&&(
                  <div style={{display:"flex",gap:6,marginBottom:16}}>
                    {[{e:"🥇",t:podium.first},{e:"🥈",t:podium.second},{e:"🥉",t:podium.third}]
                      .filter(p=>p.t).map((p,i)=>(
                      <div key={i} style={{flex:1,textAlign:"center",padding:"6px 4px",
                        background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
                        borderRadius:8,fontSize:10}}>
                        <div style={{fontSize:14}}>{p.e}</div>
                        <div style={{color:"#888",marginTop:2,fontSize:10}}>{p.t}</div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={handleShare} style={{
                  width:"100%",padding:"13px",
                  background:"linear-gradient(135deg,#25d366,#128c7e)",
                  border:"none",borderRadius:10,color:"#fff",
                  fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,
                  cursor:"pointer",
                }}>📤 Share to WhatsApp</button>
                <button onClick={()=>{
                  navigator.clipboard?.writeText(shareText);
                  alert("Copied to clipboard! Paste anywhere.");
                }} style={{
                  width:"100%",padding:"9px",marginTop:6,
                  background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
                  borderRadius:10,color:"#888",fontSize:12,cursor:"pointer",fontFamily:"inherit",
                }}>📋 Copy text</button>
                <button onClick={()=>setShowShareCard(false)} style={{
                  width:"100%",padding:"8px",marginTop:6,
                  background:"transparent",border:"1px solid rgba(255,255,255,0.10)",
                  borderRadius:8,color:"#444",fontSize:11,cursor:"pointer",fontFamily:"inherit",
                }}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* AUTO-SAVE TOAST */}
      {autoSaveToast&&(
        <div style={{
          position:"fixed",bottom:100,left:"50%",transform:"translateX(-50%)",
          background:"rgba(34,197,94,0.9)",backdropFilter:"blur(8px)",
          color:"#000",padding:"6px 16px",borderRadius:20,
          fontSize:12,fontWeight:700,zIndex:9999,
          animation:"fadeUp 0.3s ease",pointerEvents:"none",
          whiteSpace:"nowrap",
        }}>✓ Auto-saved</div>
      )}

      {/* TABS */}
      <div style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.22)"}}>
        {/* Main row */}
        <div style={{display:"flex"}}>
          {TABS_MAIN.map(t=>{
            const isActive = tab===t.id;
            const name = t.full.split(" ").slice(1).join(" ");
            return(
              <button key={t.id} onClick={()=>{handleTabChange(t.id);setShowAdvancedTray(false);}}
                style={{
                  flex:1,padding:"6px 4px",background:"transparent",border:"none",
                  borderBottom:`2px solid ${isActive?"#fcb900":"transparent"}`,
                  color:isActive?"#fcb900":"#ccc",
                  cursor:"pointer",transition:"all 0.2s",fontFamily:"inherit",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:1,
                }}>
                <span style={{fontSize:22,lineHeight:1,opacity:1}}>{t.label}</span>
                <span style={{fontSize:11,fontWeight:isActive?700:400,
                  color:isActive?"#fcb900":"#fff",letterSpacing:0.3}}>{name}</span>
              </button>
            );
          })}
          {/* More button */}
          {(()=>{
            const trayOpen = showAdvancedTray || advancedTabActive;
            const hasUnread = chatUnread > 0;
            return(
              <button onClick={()=>setShowAdvancedTray(v=>!v)}
                style={{
                  flex:1,padding:"6px 4px",background:"transparent",border:"none",
                  borderBottom:`2px solid ${advancedTabActive?"#60a5fa":"transparent"}`,
                  color:advancedTabActive?"#60a5fa":trayOpen?"#60a5fa":"#555",
                  cursor:"pointer",transition:"all 0.2s",fontFamily:"inherit",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:1,
                  position:"relative",
                }}>
                <span style={{fontSize:18,lineHeight:1,position:"relative"}}>
                  ⚡
                  <span style={{
                    position:"absolute",bottom:-2,right:-6,fontSize:8,
                    color:trayOpen?"#60a5fa":"#444",lineHeight:1,
                  }}>{trayOpen?"▲":"▼"}</span>
                </span>
                <span style={{fontSize:11,fontWeight:400,
                  color:advancedTabActive?"#60a5fa":trayOpen?"#60a5fa":"var(--color-text-secondary)",letterSpacing:0.3}}>
                  {trayOpen?"Less":"More"}
                </span>
                {hasUnread&&!advancedTabActive&&(
                  <span style={{
                    position:"absolute",top:2,right:"calc(50% - 14px)",
                    background:"#ef4444",color:"#fff",borderRadius:"50%",
                    width:13,height:13,fontSize:7,fontWeight:700,
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>{chatUnread>9?"9+":chatUnread}</span>
                )}
              </button>
            );
          })()}
        </div>

        {/* Collapsible advanced tray */}
        {(showAdvancedTray||advancedTabActive)&&(
          <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",
            background:"rgba(96,165,250,0.03)"}}>
            <div style={{padding:"3px 6px 4px",
              fontSize:9,color:"var(--color-text-secondary)",textAlign:"center",
              letterSpacing:0.8,textTransform:"uppercase",fontWeight:600}}>
              Advanced
            </div>
            <div style={{display:"flex"}}>
              {TABS_ADVANCED.map(t=>{
                const isActive = tab===t.id;
                const name = t.full.split(" ").slice(1).join(" ");
                return(
                  <button key={t.id} onClick={()=>handleTabChange(t.id)}
                    style={{
                      flex:1,padding:"4px 2px 5px",
                      background:t.restricted?"rgba(251,146,60,0.04)":"transparent",
                      border:"none",
                      borderBottom:`2px solid ${isActive?"#60a5fa":"transparent"}`,
                      color:isActive?"#60a5fa":t.restricted?"#6b5a4a":"#555",
                      cursor:"pointer",fontFamily:"inherit",
                      display:"flex",flexDirection:"column",alignItems:"center",gap:0,
                      position:"relative",
                    }}>
                    <span style={{fontSize:20,lineHeight:1,opacity:1}}>{t.label}</span>
                    <span style={{fontSize:10,fontWeight:isActive?700:400,
                      color:isActive?"#60a5fa":t.restricted?"#8b6a4a":"#fff",letterSpacing:0.2}}>
                      {name}
                    </span>
                    {t.id==="chat"&&chatUnread>0&&!isActive&&(
                      <span style={{
                        position:"absolute",top:1,right:"calc(50% - 12px)",
                        background:"#ef4444",color:"#fff",borderRadius:"50%",
                        width:11,height:11,fontSize:6,fontWeight:700,
                        display:"flex",alignItems:"center",justifyContent:"center",
                      }}>{chatUnread>9?"9+":chatUnread}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{maxWidth:820,margin:"0 auto",padding:"16px 12px"}}>

        {/* ── GROUPS ── */}
        {tab==="groups"&&<div>
          {/* Today's / upcoming games quick predict */}
          {(()=>{
            const now = Date.now();
            const tomorrow = now + 24*60*60*1000;
            const upcomingToday = ALL_MATCHES.filter(m=>{
              const ko = KICKOFFS[m.id]||KICKOFFS[`${m.home}||${m.away}`];
              return ko && ko > now && ko < tomorrow;
            }).sort((a,b)=>{
              const ka=KICKOFFS[a.id]||KICKOFFS[`${a.home}||${a.away}`]||0;
              const kb=KICKOFFS[b.id]||KICKOFFS[`${b.home}||${b.away}`]||0;
              return ka-kb;
            });
            if (!upcomingToday.length) return null;
            return(
              <div style={{marginBottom:16}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,
                  letterSpacing:1,color:"#fcb900",marginBottom:10}}>
                  ⚡ Upcoming — Enter Your Picks
                </div>
                {upcomingToday.map(m=>{
                  const pred = matches.find(p=>p.id===m.id);
                  const ko = KICKOFFS[m.id]||KICKOFFS[`${m.home}||${m.away}`];
                  const koTime = ko ? new Date(ko).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "";
                  const locked = isMatchLocked(m, KICKOFFS);
                  const hasPred = pred?.homeScore!==null&&pred?.homeScore!==undefined;
                  const aiPred = getAIPrediction(m.home, m.away, livePredictions);
                  const expertData = EXPERT_PREDICTIONS[`${m.home}||${m.away}`]||EXPERT_PREDICTIONS[`${m.away}||${m.home}`];
                  return(
                    <MatchCard
                      key={m.id}
                      match={pred||m}
                      actual={actualMatches.find(a=>a.id===m.id)||null}
                      onUpdate={u=>{setMatches(prev=>prev.map(p=>p.id===u.id?u:p));setSaved(false);}}
                      kickoffs={KICKOFFS}
                      livePreds={livePredictions}
                      userName={userName}
                    />
                  );
                })}
              </div>
            );
          })()}
          {/* Live sync status */}
          <div style={{marginBottom:12}}><AdminPill/></div>

          {/* Lock info banner */}
          <div style={{
            background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",
            borderRadius:10,padding:"9px 14px",marginBottom:18,
            fontSize:11,color:"#c0c0c0",display:"flex",alignItems:"center",gap:8,
          }}>
            <span style={{fontSize:14}}>🔒</span>
            <span>
              <span style={{color:"#ef4444",fontWeight:700}}>Predictions lock 15 minutes before kickoff.</span>
              {" "}Once a match starts you can no longer change your score for that game.
              Upcoming matches show a countdown timer.
            </span>
          </div>

          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:18}}>
            {Object.keys(GROUPS).map(g=>(
              <button key={g} onClick={()=>setActiveGroup(g)} style={{
                padding:"6px 12px",borderRadius:6,border:"1px solid",
                borderColor:activeGroup===g?"#fcb900":"rgba(255,255,255,0.10)",
                background:activeGroup===g?"#fcb900":"transparent",
                color:activeGroup===g?"#000":"#666",
                fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",
              }}>Group {g}</button>
            ))}
          </div>
          <div style={{position:"relative"}}>
            {/* Tips row — standings button inline with tip */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{flex:1,fontSize:10,color:"#444"}}>
                  💡 Tap <span style={{color:"#fcb900",fontWeight:700}}>📊 Standings</span> to see the Group {activeGroup} table
                </div>
                <button onClick={()=>setShowStandings(p=>!p)} style={{
                  flexShrink:0,padding:"4px 12px",
                  background:showStandings?"rgba(252,185,0,0.2)":"rgba(252,185,0,0.08)",
                  border:`1px solid ${showStandings?"rgba(252,185,0,0.5)":"rgba(252,185,0,0.2)"}`,
                  borderRadius:6,color:"#fcb900",fontSize:11,fontWeight:700,
                  cursor:"pointer",fontFamily:"inherit",
                }}>{showStandings?"✕ Hide":"📊 Standings"}</button>
              </div>
              <div style={{fontSize:10,color:"#444"}}>
                💡 Each match has <span style={{color:"#a78bfa",fontWeight:700}}>🤖 AI</span> · <span style={{color:"#22c55e",fontWeight:700}}>🔍 Experts</span> · <span style={{color:"#60a5fa",fontWeight:700}}>📊 Market odds</span> — tap the buttons below each match
              </div>
            </div>

            <h3 style={{margin:"0 0 10px",fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1,color:"#fcb900"}}>
              Group {activeGroup} — My Predictions
            </h3>

            {/* Standings panel — appears inline above matches */}
            {showStandings&&(
              <div style={{
                background:"rgba(255,255,255,0.03)",border:"1px solid rgba(252,185,0,0.2)",
                borderRadius:10,padding:11,marginBottom:14,
              }}>
                <div style={{fontSize:10,color:ga.some(m=>m.homeScore!==null)?"#22c55e":"#555",marginBottom:6,fontWeight:600}}>
                  {adminHasSaved
                    ? ga.some(m=>m.homeScore!==null) ? "📊 Based on actual results" : "📊 Actual results (none yet)"
                    : "📊 Based on your predictions"}
                </div>
                <StandingsTable key={standingsKey} teams={gt} matches={adminHasSaved?ga:gm}/>
                <div style={{marginTop:9,fontSize:10,color:"#333",display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:8,height:8,background:"rgba(252,185,0,0.18)",borderRadius:2,display:"inline-block"}}/>Top 2 qualify
                </div>
              </div>
            )}

            {/* Matches */}
            {gm.map(m=><MatchCard key={m.id} match={m} actual={ga.find(a=>a.id===m.id)} onUpdate={upMatchAndSync} kickoffs={KICKOFFS} livePreds={livePredictions} userName={userName}/>)}
          </div>
        </div>}

        {/* ── KNOCKOUT ── */}
        {tab==="knockout"&&<div>
          <div style={{marginBottom:18}}><AdminPill/></div>

          {/* ── Live Bracket Diagram — FIFA style two-sided ── */}
          {(()=>{
            const byRound = r => actualKO.filter(m=>m.round===r);
            const r32 = byRound('Round of 32');
            const r16 = byRound('Round of 16');
            const qf  = byRound('Quarter-Finals');
            const sf  = byRound('Semi-Finals');
            const fin = byRound('Final');

            // Split each round: left = first half, right = second half
            const half = n => Math.ceil(n/2);
            const L = arr => arr.slice(0, half(arr.length));
            const R = arr => arr.slice(half(arr.length));

            const TBD = {id:'tbd',round:'',home:'TBD',away:'TBD',homeScore:null,awayScore:null};
            const pad = (arr, n) => [...arr, ...Array(Math.max(0,n-arr.length)).fill(TBD)];

            const lR32=pad(L(r32),8), rR32=pad(R(r32),8);
            const lR16=pad(L(r16),4), rR16=pad(R(r16),4);
            const lQF =pad(L(qf),2),  rQF =pad(R(qf),2);
            const lSF =pad(L(sf),1),  rSF =pad(R(sf),1);
            const finM=fin[0]||TBD;

            const Team = ({name,score,won,flip}) => {
              const hasName = name && name!=='TBD';
              const shortName = hasName ? (name.split(' ').pop()||name).slice(0,9) : 'TBD';
              return(
                <div style={{display:"flex",alignItems:"center",gap:3,padding:"3px 5px",minHeight:20,
                  background:won?"rgba(34,197,94,0.15)":"transparent"}}>
                  {!flip&&hasName&&<span style={{fontSize:11,flexShrink:0,lineHeight:1}}>{FLAGS[name]||"🏳️"}</span>}
                  {flip&&score!=null&&<span style={{fontSize:10,fontFamily:"monospace",color:won?"#22c55e":"#555",flexShrink:0,marginRight:2}}>{score}</span>}
                  <span style={{fontSize:9,fontWeight:500,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                    color:won?"#22c55e":hasName?"#bbb":"#555",
                    textAlign:flip?"right":"left",direction:flip?"rtl":"ltr"}}>
                    {shortName}
                  </span>
                  {!flip&&score!=null&&<span style={{fontSize:10,fontFamily:"monospace",color:won?"#22c55e":"#555",flexShrink:0}}>{score}</span>}
                  {flip&&hasName&&<span style={{fontSize:11,flexShrink:0,lineHeight:1}}>{FLAGS[name]||"🏳️"}</span>}
                </div>
              );
            };

            const Match = ({m, flip=false}) => {
              if(!m) return null;
              const hasTeams = m.home && m.home!=='TBD';
              const hasScore = m.homeScore!=null && m.awayScore!=null;
              const hWon = hasScore && m.homeScore>m.awayScore;
              const aWon = hasScore && m.awayScore>m.homeScore;
              return(
                <div style={{
                  background:"rgba(255,255,255,0.08)",
                  border:`0.5px solid ${hasTeams?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.09)"}`,
                  borderRadius:5,overflow:"hidden",width:104,flexShrink:0,
                }}>
                  <Team name={m.home} score={hasScore?m.homeScore:null} won={hWon} flip={flip}/>
                  <div style={{height:"0.5px",background:"rgba(255,255,255,0.15)"}}/>
                  <Team name={m.away} score={hasScore?m.awayScore:null} won={aWon} flip={flip}/>
                </div>
              );
            };

            const Col = ({matches, label, flip=false, height=440}) => {
              const n = matches.length;
              const slotH = height/n;
              return(
                <div style={{display:"flex",flexDirection:"column",flexShrink:0,width:104}}>
                  <div style={{fontSize:9,fontWeight:500,color:"#555",textAlign:"center",
                    paddingBottom:6,letterSpacing:0.5,textTransform:"uppercase"}}>{label}</div>
                  <div style={{display:"flex",flexDirection:"column",height,justifyContent:"space-around",gap:2}}>
                    {matches.map((m,i)=><Match key={m.id||i} m={m} flip={flip}/>)}
                  </div>
                </div>
              );
            };

            const Conn = ({n, flip=false, height=440}) => {
              const rowH = height/n;
              const lines = [];
              for(let i=0;i<n;i++){
                const y = rowH*i + rowH/2 + 16;
                if(flip){
                  lines.push(<line key={`h${i}`} x1="24" y1={y} x2="12" y2={y} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8"/>);
                  if(i%2===0&&i+1<n){
                    const y2=rowH*(i+1)+rowH/2+16;
                    const mid=(y+y2)/2;
                    lines.push(<line key={`v${i}`} x1="12" y1={y} x2="12" y2={y2} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8"/>);
                    lines.push(<line key={`h2${i}`} x1="24" y1={y2} x2="12" y2={y2} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8"/>);
                    lines.push(<line key={`out${i}`} x1="0" y1={mid} x2="12" y2={mid} stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>);
                  }
                } else {
                  lines.push(<line key={`h${i}`} x1="0" y1={y} x2="12" y2={y} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8"/>);
                  if(i%2===0&&i+1<n){
                    const y2=rowH*(i+1)+rowH/2+16;
                    const mid=(y+y2)/2;
                    lines.push(<line key={`v${i}`} x1="12" y1={y} x2="12" y2={y2} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8"/>);
                    lines.push(<line key={`h2${i}`} x1="12" y1={y2} x2="0" y2={y2} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8"/>);
                    lines.push(<line key={`out${i}`} x1="12" y1={mid} x2="24" y2={mid} stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>);
                  }
                }
              }
              return(
                <svg style={{flexShrink:0,alignSelf:"stretch",marginTop:16}} width="24" height={height} viewBox={`0 0 24 ${height}`} preserveAspectRatio="none">
                  {lines}
                </svg>
              );
            };

            const H=456;
            const midY=H/2;
            return(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:700,color:"#fcb900",marginBottom:10,
                  fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>
                  🏆 Knockout Bracket
                </div>
                <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:0,minWidth:900,padding:"0 4px"}}>
                    <Col matches={lR32} label="R32" height={H}/>
                    <Conn n={8} flip={false} height={H}/>
                    <Col matches={lR16} label="R16" height={H}/>
                    <Conn n={4} flip={false} height={H}/>
                    <Col matches={lQF} label="QF" height={H}/>
                    <Conn n={2} flip={false} height={H}/>
                    <Col matches={lSF} label="SF" height={H}/>
                    <svg style={{flexShrink:0,marginTop:16}} width="24" height={H} viewBox={`0 0 24 ${H}`} preserveAspectRatio="none">
                      <line x1="0" y1={midY} x2="24" y2={midY} stroke="rgba(96,165,250,0.3)" strokeWidth="0.8"/>
                    </svg>
                    {/* Final */}
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,
                      width:104,paddingTop:0,justifyContent:"flex-start"}}>
                      <div style={{fontSize:9,fontWeight:500,color:"#60a5fa",marginBottom:6,
                        letterSpacing:0.5,textTransform:"uppercase",textAlign:"center"}}>Final</div>
                      <div style={{height:midY-20,display:"flex",alignItems:"flex-end",paddingBottom:2}}>
                        <Match m={finM}/>
                      </div>
                      <div style={{fontSize:8,color:"#555",marginTop:4}}>Jul 19 · NJ</div>
                      <div style={{fontSize:18,marginTop:4}}>🏆</div>
                    </div>
                    <svg style={{flexShrink:0,marginTop:16}} width="24" height={H} viewBox={`0 0 24 ${H}`} preserveAspectRatio="none">
                      <line x1="0" y1={midY} x2="24" y2={midY} stroke="rgba(96,165,250,0.3)" strokeWidth="0.8"/>
                    </svg>
                    <Col matches={rSF} label="SF" flip={true} height={H}/>
                    <Conn n={2} flip={true} height={H}/>
                    <Col matches={rQF} label="QF" flip={true} height={H}/>
                    <Conn n={4} flip={true} height={H}/>
                    <Col matches={rR16} label="R16" flip={true} height={H}/>
                    <Conn n={8} flip={true} height={H}/>
                    <Col matches={rR32} label="R32" flip={true} height={H}/>
                  </div>
                </div>
                <div style={{fontSize:9,color:"#444",textAlign:"center",marginTop:4}}>← scroll →</div>
              </div>
            );
          })()}


          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#fcb900",margin:0}}>Knockout Predictions</h2>
            <button onClick={autoFillKnockout} style={{
              padding:"8px 16px",background:"rgba(239,68,68,0.1)",
              border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,
              color:"#ef4444",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            }}>↺ Reset to TBD</button>
          </div>
          <div style={{
            fontSize:11,color:"#555",marginBottom:18,
            background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"10px 14px",
            border:"1px solid rgba(255,255,255,0.06)",lineHeight:1.8,
          }}>
            <div style={{marginBottom:4}}>
              <span style={{color:"#fcb900",fontWeight:700}}>How it works:</span>
            </div>
            <div>🔧 <strong style={{color:"#c0c0c0"}}>Admin fills team names</strong> — after the group stage, the admin uses ⚡ Fill R32 to populate teams from actual standings, then enters scores round by round.</div>
            <div style={{marginTop:4}}>✏️ <strong style={{color:"#c0c0c0"}}>You predict the scores</strong> for each match once teams are known. You can also type any team name manually to override.</div>
            <div style={{marginTop:4}}>↺ <strong style={{color:"#c0c0c0"}}>Reset to TBD</strong> clears all team names so the admin can repopulate cleanly.</div>
          </div>
          {KO_ROUNDS.map(round=>{
            const rM=knockout.filter(m=>m.round===round)
              .filter(m=>{
                const act=actualKO.find(a=>a.id===m.id);
                const liveHome=act?.home||"TBD";
                // Hide TBD slots with no kickoff set — they're empty placeholders
                return liveHome!=="TBD" || koKickoffs[m.id];
              })
              .sort((a,b)=>{
                const ka = koKickoffs[a.id] || 0;
                const kb = koKickoffs[b.id] || 0;
                return ka - kb;
              });
            const rA=actualKO.filter(m=>m.round===round);
            if(!rM.length) return null;
            return(
              <div key={round} style={{marginBottom:24}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{height:1,flex:1,background:"rgba(255,255,255,0.15)"}}/>
                  <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2,color:"#555",whiteSpace:"nowrap"}}>{round}</span>
                  <div style={{height:1,flex:1,background:"rgba(255,255,255,0.15)"}}/>
                </div>
                {rM.map(m=>{
                  const act=rA.find(a=>a.id===m.id);
                  const res=act?calcMatchPoints(m,act):null;
                  const liveHome=act?.home||"TBD";
                  const liveAway=act?.away||"TBD";
                  const teamsKnown=liveHome!=="TBD"&&liveAway!=="TBD";
                  // Merge group kickoffs with admin-set KO kickoffs
                  const allKickoffs={...KICKOFFS,...Object.fromEntries(
                    Object.entries(koKickoffs||{}).map(([id,ms])=>{
                      const ko=actualKO.find(x=>x.id===id);
                      return ko?[[`${ko.home}||${ko.away}`,ms],[`${ko.away}||${ko.home}`,ms]]:[];
                    }).flat().filter(e=>e.length)
                  )};
                  const locked=isMatchLocked({...m,home:liveHome,away:liveAway},allKickoffs,koKickoffs);
                  const countdown=!locked?timeUntilLock({...m,home:liveHome,away:liveAway},allKickoffs,koKickoffs):null;
                  return(
                    <div key={m.id} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${locked?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.06)"}`,
                      borderRadius:10,padding:"11px 13px",marginBottom:8}}>
                      {/* Live team names from feed */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:teamsKnown?4:0}}>
                        <span style={{fontSize:16}}>{FLAGS[liveHome]||"🏳️"}</span>
                        <span style={{flex:1,fontWeight:700,fontSize:13,color:teamsKnown?"#fff":"#444"}}>
                          {teamsKnown?liveHome:"TBD — admin fills after group stage"}
                        </span>
                        {teamsKnown&&<span style={{fontSize:11,color:"#444",fontStyle:"italic"}}>vs</span>}
                        <span style={{flex:1,textAlign:"right",fontWeight:700,fontSize:13,color:teamsKnown?"#fff":"#444"}}>
                          {teamsKnown?liveAway:""}
                        </span>
                        {teamsKnown&&<span style={{fontSize:16}}>{FLAGS[liveAway]||"🏳️"}</span>}
                        {locked&&<span style={{fontSize:12,flexShrink:0}}>🔒</span>}
                      </div>
                      {/* Lock countdown — always show if kickoff set */}
                      {!locked&&(countdown||koKickoffs[m.id])&&(
                        <div style={{fontSize:10,marginBottom:teamsKnown?4:0,
                          color:countdown?"#60a5fa":"#555"}}>
                          {countdown
                            ? `⏱ Locks in ${countdown}`
                            : `🔒 Locks at ${new Date(koKickoffs[m.id]).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`
                          }
                        </div>
                      )}
                      {/* Actual result — show when available */}
                      {act?.homeScore!=null&&(
                        <div style={{display:"flex",alignItems:"center",justifyContent:"center",
                          gap:8,padding:"4px 0",marginBottom:4}}>
                          <span style={{fontSize:10,color:"#555"}}>Result:</span>
                          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,
                            color:"#fcb900",letterSpacing:2}}>
                            {act.homeScore} – {act.awayScore}
                          </span>
                          <span style={{fontSize:9,color:"#555",background:"rgba(252,185,0,0.1)",
                            borderRadius:4,padding:"1px 5px"}}>FT</span>
                        </div>
                      )}
                      {/* Score prediction — only when teams known */}
                      {teamsKnown&&(
                        <div style={{display:"flex",alignItems:"center",gap:8,
                          paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                          <span style={{fontSize:10,color:"#555",flexShrink:0}}>Your score:</span>
                          <div style={{flex:1}}/>
                          <ScoreInput value={m.homeScore} onChange={v=>!locked&&upKO({...m,homeScore:v,home:liveHome,away:liveAway})} readOnly={locked}/>
                          <span style={{color:"#333",fontWeight:700}}>–</span>
                          <ScoreInput value={m.awayScore} onChange={v=>!locked&&upKO({...m,awayScore:v,home:liveHome,away:liveAway})} readOnly={locked}/>
                          <div style={{flex:1}}/>
                          {res&&<PointsBadge result={res}/>}
                        </div>
                      )}
                      {/* Manual override — always available */}
                      {!locked&&(
                        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                          <input value={m.home==="TBD"?"":m.home} placeholder="✏️ Team 1…"
                            onChange={e=>upKO({...m,home:e.target.value||"TBD"})}
                            style={{flex:1,background:"transparent",border:"none",
                              borderBottom:"1px solid rgba(255,255,255,0.10)",
                              color:"#c0c0c0",fontSize:11,padding:"4px 0",outline:"none",fontFamily:"inherit"}}/>
                          <span style={{color:"#333",fontSize:10}}>vs</span>
                          <input value={m.away==="TBD"?"":m.away} placeholder="✏️ Team 2…"
                            onChange={e=>upKO({...m,away:e.target.value||"TBD"})}
                            style={{flex:1,textAlign:"right",background:"transparent",border:"none",
                              borderBottom:"1px solid rgba(255,255,255,0.10)",
                              color:"#c0c0c0",fontSize:11,padding:"4px 0",outline:"none",fontFamily:"inherit"}}/>
                        </div>
                      )}
                      {/* AI + Polymarket buttons for KO matches */}
                      {teamsKnown&&<KOMatchButtons
                        liveHome={liveHome} liveAway={liveAway}
                        aiP={livePredictions[`${liveHome}||${liveAway}`]}
                        r32AI={R32_AI_PREDICTIONS[`${liveHome}||${liveAway}`]||R32_AI_PREDICTIONS[`${liveAway}||${liveHome}`]}
                        r32Expert={R32_EXPERT_PREDICTIONS[`${liveHome}||${liveAway}`]||R32_EXPERT_PREDICTIONS[`${liveAway}||${liveHome}`]}
                      />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>}

        {/* ── PODIUM PICKS ── */}
        {tab==="champion"&&(()=>{
          const champLocked = isChampionLocked(now);
          const champCountdown = timeUntilChampionLock(now);
          const allTeams = Object.values(GROUPS).flat();
          const places = [
            {key:"first",     label:"1st Place 🥇", pts:50, color:"#f59e0b", actual:actualPodium?.first, overlap:10},
            {key:"second",    label:"2nd Place 🥈", pts:25, color:"#c0c0c0", actual:actualPodium?.second, overlap:10},
            {key:"third",     label:"3rd Place 🥉", pts:15, color:"#cd7f32", actual:actualPodium?.third, overlap:10},
            {key:"topScorer", label:"Top Scorer ⚽", pts:20, color:"#60a5fa", actual:actualPodium?.topScorer, freeText:true},
          ];

          // AI podium suggestion — default or admin-updated
          const DEFAULT_AI_PODIUM = { first:"Brazil", second:"France", third:"Argentina",
            reason:"Brazil's squad depth and form make them favourites. France runners-up from their European base. Argentina defending champions but aging squad." };
          // Use AI bracket prediction if available, otherwise fall back to admin-set or default
          const aiPodium = bracketPred?.champion
            ? { first: bracketPred.champion, second: bracketPred.runnerUp, third: bracketPred.thirdPlace,
                topScorer: bracketPred.topScorer || null,
                reason: bracketPred.reasoning || `AI bracket prediction by ${bracketGeneratedBy||'AI'}` }
            : (livePredictions["__podium__"] || DEFAULT_AI_PODIUM);

          return(
            <div style={{paddingTop:14}}>
              <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:3,color:"#fcb900",marginTop:0,textAlign:"center"}}>
                Podium Predictions
              </h2>
              <p style={{color:"#555",marginBottom:14,fontSize:12,textAlign:"center"}}>Pick the top 3 teams — the higher the place, the more points!</p>

              {/* AI Podium Suggestion */}
              {!champLocked&&(
                <div style={{
                  marginBottom:20,padding:"12px 16px",
                  background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.25)",
                  borderRadius:12,
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#a78bfa"}}>🤖 AI Podium Suggestion</span>
                    <button onClick={()=>{
                      setPodium(prev=>({...prev,
                        first:aiPodium.first, second:aiPodium.second, third:aiPodium.third,
                        ...(aiPodium.topScorer?{topScorer:aiPodium.topScorer}:{})
                      }));
                      setSaved(false);
                    }} style={{
                      marginLeft:"auto",padding:"4px 12px",background:"rgba(139,92,246,0.2)",
                      border:"1px solid rgba(139,92,246,0.4)",borderRadius:6,
                      color:"#c4b5fd",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                    }}>Use all</button>
                  </div>
                  <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                    {[
                      {place:"first",  label:"🥇", color:"#f59e0b"},
                      {place:"second", label:"🥈", color:"#c0c0c0"},
                      {place:"third",  label:"🥉", color:"#cd7f32"},
                    ].map(p=>(
                      <div key={p.place} style={{
                        flex:1,minWidth:70,background:`${p.color}10`,border:`1px solid ${p.color}30`,
                        borderRadius:8,padding:"8px 10px",textAlign:"center",
                      }}>
                        <div style={{fontSize:11,color:p.color,marginBottom:4}}>{p.label}</div>
                        <div style={{fontSize:14}}>{FLAGS[aiPodium[p.place]]||"🏳️"}</div>
                        <div style={{fontWeight:700,fontSize:12,color:"#c4b5fd",marginTop:3}}>{aiPodium[p.place]||"TBD"}</div>
                        {!champLocked&&(
                          <button onClick={()=>{
                            setPodium(prev=>({...prev,[p.place]:aiPodium[p.place]}));
                            setSaved(false);
                          }} style={{
                            marginTop:6,padding:"3px 8px",background:"rgba(139,92,246,0.15)",
                            border:"1px solid rgba(139,92,246,0.3)",borderRadius:4,
                            color:"#a78bfa",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                          }}>Use</button>
                        )}
                      </div>
                    ))}
                    {aiPodium.topScorer&&(
                      <div style={{
                        flex:1,minWidth:70,background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.2)",
                        borderRadius:8,padding:"8px 10px",textAlign:"center",
                      }}>
                        <div style={{fontSize:11,color:"#60a5fa",marginBottom:4}}>⚽</div>
                        <div style={{fontSize:14}}>👤</div>
                        <div style={{fontWeight:700,fontSize:11,color:"#93c5fd",marginTop:3,lineHeight:1.3}}>{aiPodium.topScorer}</div>
                        {!champLocked&&(
                          <button onClick={()=>{
                            setPodium(prev=>({...prev,topScorer:aiPodium.topScorer}));
                            setSaved(false);
                          }} style={{
                            marginTop:6,padding:"3px 8px",background:"rgba(96,165,250,0.15)",
                            border:"1px solid rgba(96,165,250,0.3)",borderRadius:4,
                            color:"#60a5fa",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                          }}>Use</button>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{fontSize:10,color:"#6b5fa0",fontStyle:"italic"}}>{aiPodium.reason}</div>
                </div>
              )}

              {/* Lock banner */}
              <div style={{textAlign:"center",marginBottom:18}}>
                {!champLocked && champCountdown && (
                  <div style={{display:"inline-flex",alignItems:"center",gap:8,
                    background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.3)",
                    borderRadius:10,padding:"8px 16px",fontSize:12,color:"#60a5fa"}}>
                    ⏱ Locks in <strong>{champCountdown}</strong> — midnight Friday June 20 UTC
                  </div>
                )}
                {champLocked && (
                  <div style={{display:"inline-flex",alignItems:"center",gap:8,
                    background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",
                    borderRadius:10,padding:"8px 16px",fontSize:12,color:"#ef4444"}}>
                    🔒 Podium picks locked — tournament has started
                  </div>
                )}
              </div>

              {/* Points reminder */}
              <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:24,flexWrap:"wrap"}}>
                {places.map(p=>(
                  <div key={p.key} style={{
                    background:`${p.color}15`,border:`1px solid ${p.color}40`,
                    borderRadius:10,padding:"8px 12px",textAlign:"center",minWidth:64,
                  }}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:p.color}}>{p.pts}</div>
                    <div style={{fontSize:10,color:"#666"}}>pts</div>
                    <div style={{fontSize:10,color:"#888",marginTop:2}}>{p.label}</div>
                  </div>
                ))}
              </div>

              {/* One picker per place */}
              {places.map(place=>(
                <div key={place.key} style={{marginBottom:24}}>
                  <div style={{
                    display:"flex",alignItems:"center",gap:10,marginBottom:10,
                  }}>
                    <div style={{height:1,flex:1,background:"rgba(255,255,255,0.15)"}}/>
                    <span style={{
                      fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:2,
                      color:place.color,whiteSpace:"nowrap",
                    }}>{place.label} — {place.pts} pts{place.overlap?<span style={{fontSize:10,color:"#555",fontWeight:400,fontFamily:"system-ui",letterSpacing:0}}> · 10 if in podium wrong rank</span>:""}</span>
                    <div style={{height:1,flex:1,background:"rgba(255,255,255,0.15)"}}/>
                  </div>

                  {/* Current pick card */}
                  {podium[place.key] && (
                    <div style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"10px 14px",marginBottom:10,borderRadius:10,
                      background:place.actual&&podium[place.key]===place.actual
                        ?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.06)",
                      border:`1px solid ${place.actual&&podium[place.key]===place.actual
                        ?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.10)"}`,
                    }}>
                      {!place.freeText&&<span style={{fontSize:22}}>{FLAGS[podium[place.key]]}</span>}
                      {place.freeText&&<span style={{fontSize:22}}>⚽</span>}
                      <span style={{fontWeight:700,fontSize:14,flex:1,
                        color:place.actual&&podium[place.key]===place.actual?"#22c55e":"#fff"}}>
                        {podium[place.key]}
                      </span>
                      {place.actual && podium[place.key]===place.actual && (
                        <span style={{color:"#22c55e",fontWeight:700,fontSize:13}}>🎉 +{place.pts} pts</span>
                      )}
                      {place.freeText && place.actual && (()=>{
                        const norm = s=>(s||'').toLowerCase().trim().replace(/[^a-z\s]/g,'');
                        const pred=norm(podium[place.key]), act=norm(place.actual);
                        const hit = pred&&act&&(pred===act||act.includes(pred)||pred.includes(act)||
                          pred.split(' ').some(w=>w.length>=4&&act.split(' ').some(a=>a.startsWith(w)||w.startsWith(a))));
                        return hit
                          ? <span style={{color:"#22c55e",fontWeight:700,fontSize:13}}>🎉 +{place.pts} pts</span>
                          : <span style={{color:"#555",fontSize:11}}>Actual: {place.actual}</span>;
                      })()}
                      {!place.freeText && place.actual && podium[place.key]!==place.actual && (
                        <span style={{color:"#555",fontSize:11}}>
                          Actual: {FLAGS[place.actual]} {place.actual}
                        </span>
                      )}
                      {!champLocked && (
                        <button onClick={()=>{setPodium(p=>({...p,[place.key]:null}));setSaved(false);}}
                          style={{padding:"3px 8px",background:"rgba(239,68,68,0.1)",
                            border:"1px solid rgba(239,68,68,0.25)",borderRadius:4,
                            color:"#ef4444",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                      )}
                    </div>
                  )}

                  {/* Free text input for top scorer */}
                  {place.freeText && !champLocked && (
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <input
                        value={podium[place.key]||""}
                        onChange={e=>{setPodium(p=>({...p,[place.key]:e.target.value||null}));setSaved(false);}}
                        placeholder="Type player name (e.g. Mbappe, Vinicius…)"
                        style={{
                          flex:1,padding:"9px 12px",
                          background:"rgba(255,255,255,0.06)",
                          border:`1px solid ${(podium[place.key]||'').trim().length>=3?'rgba(34,197,94,0.5)':place.color+'40'}`,
                          borderRadius:8,color:"#fff",fontSize:13,
                          fontFamily:"inherit",outline:"none",
                          transition:"border-color 0.2s",
                        }}
                      />
                      {(podium[place.key]||'').trim().length>=3 && (
                        <div style={{
                          flexShrink:0,width:32,height:32,borderRadius:"50%",
                          background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.4)",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:16,
                        }}>✓</div>
                      )}
                    </div>
                  )}
                  {place.freeText && !champLocked && (
                    <div style={{fontSize:10,color:(podium[place.key]||'').trim().length>=3?"#22c55e":"#444",marginTop:4,transition:"color 0.2s"}}>
                      {(podium[place.key]||'').trim().length>=3
                        ? `✓ "${podium[place.key]}" saved — fuzzy matching will handle spelling`
                        : `Fuzzy matching — "mbappe" will match "Kylian Mbappé"`}
                    </div>
                  )}

                  {/* Searchable team picker — not for freeText fields */}
                  {!champLocked && !place.freeText && (()=>{
                    const search = podiumSearch[place.key] || "";
                    const setSearch = v => setPodiumSearch(p=>({...p,[place.key]:v}));
                    const filtered = allTeams.filter(t =>
                      t.toLowerCase().includes(search.toLowerCase())
                    );
                    return(
                      <div>
                        <input
                          value={search}
                          onChange={e=>setSearch(e.target.value)}
                          placeholder={`🔍 Search team for ${place.label}…`}
                          style={{
                            width:"100%",padding:"9px 12px",marginBottom:8,
                            background:"rgba(255,255,255,0.06)",
                            border:`1px solid ${place.color}40`,
                            borderRadius:8,color:"#fff",fontSize:12,
                            fontFamily:"inherit",outline:"none",boxSizing:"border-box",
                          }}
                        />
                        <div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:160,overflowY:"auto"}}>
                          {filtered.length===0 && (
                            <div style={{fontSize:12,color:"#444",padding:"4px 0"}}>No teams match "{search}"</div>
                          )}
                          {filtered.map(team=>{
                            const selected = podium[place.key]===team;
                            const usedElsewhere = !selected && Object.entries(podium||{})
                              .some(([k,v])=>k!==place.key&&v===team);
                            return(
                              <button key={team}
                                onClick={()=>{
                                  if(!usedElsewhere){
                                    setPodium(p=>({...p,[place.key]:team}));
                                    setSaved(false);
                                    setSearch("");
                                  }
                                }}
                                style={{
                                  padding:"6px 11px",borderRadius:6,
                                  border:`1px solid ${selected?place.color:"rgba(255,255,255,0.06)"}`,
                                  background:selected?`${place.color}18`:"rgba(255,255,255,0.03)",
                                  color:selected?place.color:usedElsewhere?"#333":"#888",
                                  fontWeight:600,fontSize:11,fontFamily:"inherit",
                                  cursor:usedElsewhere?"not-allowed":"pointer",
                                  opacity:usedElsewhere?0.35:1,transition:"all 0.12s",
                                }}>{FLAGS[team]} {team}</button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {champLocked && !podium[place.key] && (
                    <div style={{color:"#444",fontSize:12,fontStyle:"italic"}}>No pick made</div>
                  )}
                </div>
              ))}

            {/* Incomplete picks warning */}
            {!champLocked&&(()=>{
              const missing = [];
              if(!podium.first)   missing.push('🥇 Champion');
              if(!podium.second)  missing.push('🥈 Runner-up');
              if(!podium.third)   missing.push('🥉 3rd place');
              if(!podium.topScorer||(podium.topScorer||'').trim().length<3) missing.push('⚽ Top scorer');
              if(missing.length===0||missing.length===4) return null; // all done or all empty — no partial warning needed
              return(
                <div style={{
                  margin:"12px 0",padding:"10px 14px",
                  background:"rgba(252,185,0,0.07)",
                  border:"1px solid rgba(252,185,0,0.25)",
                  borderRadius:8,display:"flex",alignItems:"center",gap:10,
                }}>
                  <span style={{fontSize:16,flexShrink:0}}>⚠️</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"#fcb900",fontWeight:700,marginBottom:2}}>
                      {missing.length} pick{missing.length!==1?'s':''} still missing
                    </div>
                    <div style={{fontSize:11,color:"#666"}}>
                      {missing.join(' · ')}
                    </div>
                  </div>
                  <div style={{fontSize:11,color:"#555",flexShrink:0,textAlign:"right"}}>
                    Locks Jun 19
                  </div>
                </div>
              );
            })()}
            </div>
          );
        })()}

        {/* ── SCORING ── */}
        {tab==="scoring"&&<div>
          {/* My score */}
          <div style={{background:"rgba(252,185,0,0.08)",border:"1px solid rgba(252,185,0,0.22)",
            borderRadius:12,padding:"16px 20px",marginBottom:16,
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:11,color:"#666"}}>Your total points</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:40,color:"#fcb900",lineHeight:1,marginTop:3}}>
                {myPts} <span style={{fontSize:15,color:"#555"}}>pts</span>
              </div>
            </div>
            <div style={{fontSize:44}}>🏅</div>
          </div>

          {/* Podium status */}
          <div style={{
            background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.10)",
            borderRadius:10,padding:"12px 16px",marginBottom:20,
          }}>
            <div style={{fontSize:11,color:"#555",marginBottom:10}}>🏆 Podium Picks</div>
            {[
              {key:"first", label:"🥇 1st Place", pts:50, color:"#f59e0b"},
              {key:"second",label:"🥈 2nd Place", pts:25,  color:"#c0c0c0"},
              {key:"third", label:"🥉 3rd Place", pts:15,  color:"#cd7f32"},
            ].map(place=>{
              const myPick   = podium?.[place.key];
              const actual   = actualPodium?.[place.key];
              const correct  = myPick && actual && myPick===actual;
              return(
                <div key={place.key} style={{
                  display:"flex",alignItems:"center",gap:10,
                  padding:"7px 0",borderTop:"1px solid rgba(255,255,255,0.06)",
                }}>
                  <span style={{fontSize:12,color:place.color,width:80,flexShrink:0}}>{place.label}</span>
                  <span style={{flex:1,fontSize:13,fontWeight:600}}>
                    {myPick ? <>{FLAGS[myPick]} {myPick}</> : <span style={{color:"#444"}}>No pick</span>}
                  </span>
                  {actual && <span style={{fontSize:11,color:"#555"}}>Actual: {FLAGS[actual]} {actual}</span>}
                  {myPick && actual && (
                    <span style={{
                      fontFamily:"'Bebas Neue',sans-serif",fontSize:15,flexShrink:0,
                      color:correct?"#22c55e":"#ef4444",
                    }}>{correct?`🎉 +${place.pts}`:"✗ 0"}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Breakdown */}
          {actualMatches.some(m=>m.homeScore!==null)?(
            <div>
              <div style={{fontWeight:600,fontSize:12,color:"#555",marginBottom:9}}>Match breakdown:</div>
              {matches.map(pred=>{
                const actual=actualMatches.find(m=>m.id===pred.id);
                if(!actual||actual.homeScore===null)return null;
                const res=calcMatchPoints(pred,actual);
                if(!res)return null;
                return(
                  <div key={pred.id} style={{display:"flex",alignItems:"center",gap:9,
                    padding:"8px 12px",borderRadius:10,marginBottom:6,
                    background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",fontSize:11}}>
                    <span style={{fontWeight:600}}>{FLAGS[pred.home]||"🏳️"} {pred.home}</span>
                    <span style={{color:"#333",flex:1,textAlign:"center",fontFamily:"monospace",fontSize:10}}>
                      pred {pred.homeScore}–{pred.awayScore} · actual {actual.homeScore}–{actual.awayScore}
                    </span>
                    <span style={{fontWeight:600}}>{pred.away} {FLAGS[pred.away]||"🏳️"}</span>
                    {res.points>0?<PointsBadge result={res}/>:
                      <span style={{fontSize:11,color:"#ef4444",fontWeight:700}}>0</span>}
                  </div>
                );
              })}
            </div>
          ):(
            <div style={{color:"#3a3a3a",fontSize:13,textAlign:"center",padding:"22px 0"}}>
              No match results yet — the tournament starts June 11, 2026.
              Scores will appear here automatically once matches are played.
            </div>
          )}
        </div>}

        {/* ── LEADERBOARD ── */}
        {tab==="leaderboard"&&<div>
          <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#fcb900",marginTop:0}}>
            Friends Leaderboard
          </h2>
          <div style={{marginBottom:18}}><AdminPill/></div>
          {leaderboard.length===0?(
            <div style={{textAlign:"center",color:"#444",padding:50,fontSize:13}}>
              No participants yet. Save your predictions to appear here!
            </div>
          ):(
            <div>
              {leaderboard.map((entry,i)=>{
                const isMe=entry.username===userName;
                const medal=["🥇","🥈","🥉"][i]||"";
                // Only show View button for locked matches (after kickoff)
                const hasLockedResults = actualMatches.some(m=>m.homeScore!==null);
                return(
                  <div key={entry.username} style={{display:"flex",alignItems:"center",gap:13,
                    padding:"14px 17px",marginBottom:8,borderRadius:12,
                    background:isMe?"rgba(252,185,0,0.07)":"rgba(255,255,255,0.03)",
                    border:`1px solid ${isMe?"rgba(252,185,0,0.25)":"rgba(255,255,255,0.06)"}`}}>
                    <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,width:28,textAlign:"center",
                      color:i===0?"#fcb900":i===1?"#c0c0c0":i===2?"#cd7f32":"#777"}}>{medal||i+1}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                        {entry.username}{isMe&&<span style={{color:"#fcb900",fontSize:10}}>(you)</span>}
                        {entry.paid&&(
                          <span title="Paid" style={{
                            display:"inline-flex",alignItems:"center",justifyContent:"center",
                            width:16,height:16,borderRadius:"50%",
                            background:"#22c55e",flexShrink:0,
                          }}>
                            <span style={{color:"#000",fontSize:9,fontWeight:900,lineHeight:1}}>✓</span>
                          </span>
                        )}
                      </div>
                      <div style={{fontSize:11,color:"#444",marginTop:1}}>
                        🥇 {FLAGS[entry.champion]||"?"} {entry.champion||"?"}
                      </div>
                    </div>
                    {hasLockedResults&&(
                      <button onClick={async()=>{
                        const p = await sbGetPrediction(entry.username);
                        setViewingUser({ username:entry.username, predictions:p });
                      }} style={{
                        padding:"5px 10px",background:"rgba(96,165,250,0.1)",
                        border:"1px solid rgba(96,165,250,0.25)",borderRadius:6,
                        color:"#60a5fa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0,
                      }}>👁 View</button>
                    )}
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,
                      color:i===0?"#fcb900":i===1?"#c0c0c0":i===2?"#cd7f32":"#777"}}>
                      {entry.points||0} <span style={{fontSize:12,color:"#777"}}>pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{marginTop:24,padding:"14px 17px",background:"rgba(255,255,255,0.03)",
            borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{fontWeight:700,marginBottom:7,fontSize:12}}>📋 How to compete</div>
            <ol style={{color:"#444",fontSize:11,margin:0,paddingLeft:16,lineHeight:2.1}}>
              <li>Everyone opens this same app URL</li>
              <li>Enter your name + PIN and predict all match scores</li>
              <li>Hit <strong style={{color:"#fcb900"}}>Save</strong> to appear on the board</li>
              <li>Admin enters results as matches are played — scores update automatically</li>
              <li>Highest score at the end wins 🏆</li>
            </ol>
          </div>

          {/* Head-to-head comparison */}
          {actualMatches.some(m=>m.homeScore!==null)&&(
            <div style={{marginTop:20,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px"}}>
              <div style={{fontWeight:700,fontSize:12,marginBottom:10}}>⚔️ Head-to-Head Comparison</div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                {[0,1].map(i=>(
                  <select key={i} value={h2hUsers[i]||""} onChange={async e=>{
                    const name = e.target.value;
                    const newUsers = [...h2hUsers];
                    newUsers[i] = name || null;
                    setH2hUsers(newUsers);
                    if(newUsers[0]&&newUsers[1]){
                      const [p1,p2] = await Promise.all([sbGetPrediction(newUsers[0]),sbGetPrediction(newUsers[1])]);
                      setH2hData({[newUsers[0]]:p1,[newUsers[1]]:p2});
                    }
                  }} style={{flex:1,padding:"8px 10px",background:"rgba(255,255,255,0.06)",
                    border:"1px solid rgba(255,255,255,0.10)",borderRadius:6,
                    color:"#fff",fontSize:12,fontFamily:"inherit",outline:"none"}}>
                    <option value="">Select player {i+1}…</option>
                    {leaderboard.map(e=><option key={e.username} value={e.username}>{e.username}</option>)}
                  </select>
                ))}
              </div>
              {h2hUsers[0]&&h2hUsers[1]&&h2hData&&(()=>{
                const p1 = h2hData[h2hUsers[0]];
                const p2 = h2hData[h2hUsers[1]];
                const played = actualMatches.filter(m=>m.homeScore!==null);
                let w1=0,w2=0,draws=0;
                const rows = played.map(actual=>{
                  const pred1 = p1?.matches?.find(m=>m.id===actual.id);
                  const pred2 = p2?.matches?.find(m=>m.id===actual.id);
                  const r1 = pred1 ? calcMatchPoints(pred1,actual) : null;
                  const r2 = pred2 ? calcMatchPoints(pred2,actual) : null;
                  if(r1&&r2){ if(r1.points>r2.points)w1++; else if(r2.points>r1.points)w2++; else draws++; }
                  return {actual,r1,r2};
                });
                return(
                  <div>
                    {/* Score summary */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,
                      background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"10px 12px"}}>
                      <div style={{flex:1,textAlign:"center"}}>
                        <div style={{fontWeight:700,fontSize:13}}>{h2hUsers[0]}</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:"#fcb900"}}>{w1}</div>
                        <div style={{fontSize:10,color:"#555"}}>matches won</div>
                      </div>
                      <div style={{textAlign:"center",padding:"0 8px"}}>
                        <div style={{fontSize:11,color:"#555"}}>{draws} draws</div>
                        <div style={{fontSize:10,color:"#444"}}>{rows.filter(r=>r.r1&&r.r2).length} compared</div>
                        {rows.filter(r=>!r.r1||!r.r2).length>0&&(
                          <div style={{fontSize:10,color:"#333",marginTop:2}}>
                            {rows.filter(r=>!r.r1||!r.r2).length} skipped<br/>(missing pred)
                          </div>
                        )}
                      </div>
                      <div style={{flex:1,textAlign:"center"}}>
                        <div style={{fontWeight:700,fontSize:13}}>{h2hUsers[1]}</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:"#60a5fa"}}>{w2}</div>
                        <div style={{fontSize:10,color:"#555"}}>matches won</div>
                      </div>
                    </div>
                    {/* Per-match comparison */}
                    {rows.slice(0,8).map(({actual,r1,r2},i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:6,
                        padding:"6px 8px",marginBottom:4,borderRadius:6,
                        background:!r1||!r2?"rgba(255,255,255,0.03)":"rgba(255,255,255,0.03)",
                        opacity:!r1||!r2?0.4:1}}>
                        <div style={{
                          width:28,textAlign:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:13,
                          color:r1&&r2?(r1.points>r2.points?"#fcb900":r1.points===r2.points?"#888":"#333"):"#333"
                        }}>{r1?`+${r1.points}`:"—"}</div>
                        <div style={{flex:1,fontSize:10,color:"#666",textAlign:"center"}}>
                          {FLAGS[actual.home]||"🏳️"} {actual.homeScore}–{actual.awayScore} {FLAGS[actual.away]||"🏳️"}
                          {(!r1||!r2)&&<div style={{fontSize:10,color:"#333"}}>no prediction</div>}
                        </div>
                        <div style={{
                          width:28,textAlign:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:13,
                          color:r1&&r2?(r2.points>r1.points?"#60a5fa":r1.points===r2.points?"#888":"#333"):"#333"
                        }}>{r2?`+${r2.points}`:"—"}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}</div>
          )}

          {/* User prediction view modal */}
          {viewingUser&&(()=>{
            const p = viewingUser.predictions;
            const lockedMatches = actualMatches.filter(m=>m.homeScore!==null);
            const totalPts = p ? calcTotal(p.matches||[],actualMatches,p.knockout||[],actualKO,p.podium,actualPodium) : 0;
            return(
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",
                display:"flex",alignItems:"flex-start",justifyContent:"center",
                zIndex:9999,padding:"20px 16px",overflowY:"auto"}}>
                <div style={{background:"#141922",border:"1px solid rgba(255,255,255,0.10)",
                  borderRadius:16,width:"100%",maxWidth:480,padding:"22px 20px"}}>
                  {/* Header */}
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#fcb900",letterSpacing:2}}>
                        {viewingUser.username}'s Predictions
                      </div>
                      <div style={{fontSize:12,color:"#555",marginTop:2}}>
                        Only locked matches shown · {totalPts} pts total
                      </div>
                    </div>
                    <button onClick={()=>setViewingUser(null)} style={{
                      padding:"6px 12px",background:"rgba(255,255,255,0.06)",
                      border:"1px solid rgba(255,255,255,0.10)",borderRadius:8,
                      color:"#888",fontSize:13,cursor:"pointer",fontFamily:"inherit",flexShrink:0,
                    }}>✕ Close</button>
                  </div>

                  {/* Podium picks */}
                  {p?.podium&&(
                    <div style={{marginBottom:18,padding:"12px 14px",
                      background:"rgba(139,92,246,0.07)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:10}}>
                      <div style={{fontSize:11,color:"#a78bfa",fontWeight:700,marginBottom:8}}>👑 Podium Picks</div>
                      <div style={{display:"flex",gap:8}}>
                        {[
                          {key:"first", label:"🥇",pts:50, color:"#f59e0b",actual:actualPodium?.first},
                          {key:"second",label:"🥈",pts:25, color:"#c0c0c0",actual:actualPodium?.second},
                          {key:"third", label:"🥉",pts:15, color:"#cd7f32",actual:actualPodium?.third},
                        ].map(place=>{
                          const pick = p.podium[place.key];
                          const correct = pick && place.actual && pick===place.actual;
                          return(
                            <div key={place.key} style={{flex:1,textAlign:"center",
                              background:`${place.color}10`,border:`1px solid ${correct?"#22c55e":place.color}30`,
                              borderRadius:8,padding:"8px 6px"}}>
                              <div style={{fontSize:11,color:place.color}}>{place.label}</div>
                              <div style={{fontSize:13,marginTop:2}}>{FLAGS[pick]||"?"}</div>
                              <div style={{fontSize:11,fontWeight:700,color:correct?"#22c55e":"#ccc",marginTop:2}}>{pick||"—"}</div>
                              {place.actual&&<div style={{fontSize:10,color:correct?"#22c55e":"#ef4444",marginTop:2}}>{correct?`+${place.pts}pts`:"✗"}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Group matches — only locked */}
                  {lockedMatches.length===0?(
                    <div style={{textAlign:"center",color:"#444",fontSize:12,padding:20}}>
                      No results entered yet — predictions visible after matches kick off.
                    </div>
                  ):(
                    <div>
                      <div style={{fontSize:11,color:"#555",marginBottom:10}}>⚽ Group Stage (played matches)</div>
                      {lockedMatches.map(actual=>{
                        const pred = p?.matches?.find(m=>m.id===actual.id);
                        if (!pred||pred.homeScore===null) return null;
                        const result = calcMatchPoints(pred, actual);
                        return(
                          <div key={actual.id} style={{
                            display:"flex",alignItems:"center",gap:8,
                            padding:"8px 10px",marginBottom:5,borderRadius:10,
                            background:`${result?.color||"#333"}10`,
                            border:`1px solid ${result?.color||"#333"}25`,
                          }}>
                            <span style={{fontSize:13}}>{FLAGS[actual.home]}</span>
                            <span style={{fontSize:11,flex:1,fontWeight:600}}>{actual.home}</span>
                            {/* Predicted */}
                            <div style={{textAlign:"center",minWidth:50}}>
                              <div style={{fontSize:10,color:"#444",marginBottom:1}}>pred</div>
                              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#c0c0c0",letterSpacing:1}}>
                                {pred.homeScore}–{pred.awayScore}
                              </div>
                            </div>
                            <div style={{color:"#333",fontSize:10}}>vs</div>
                            {/* Actual */}
                            <div style={{textAlign:"center",minWidth:50}}>
                              <div style={{fontSize:10,color:"#444",marginBottom:1}}>actual</div>
                              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#22c55e",letterSpacing:1}}>
                                {actual.homeScore}–{actual.awayScore}
                              </div>
                            </div>
                            <span style={{fontSize:11,flex:1,textAlign:"right",fontWeight:600}}>{actual.away}</span>
                            <span style={{fontSize:13}}>{FLAGS[actual.away]}</span>
                            {/* Points */}
                            <div style={{
                              fontFamily:"'Bebas Neue',sans-serif",fontSize:14,
                              color:result?.color||"#333",flexShrink:0,minWidth:30,textAlign:"right",
                            }}>{result?`+${result.points}`:"–"}</div>
                          </div>
                        );
                      })}

                      {/* KO matches — only with scores */}
                      {actualKO.filter(m=>m.homeScore!==null&&m.home!=="TBD").length>0&&(
                        <div style={{marginTop:12}}>
                          <div style={{fontSize:11,color:"#555",marginBottom:10}}>🏆 Knockout Stage</div>
                          {actualKO.filter(m=>m.homeScore!==null&&m.home!=="TBD").map(actual=>{
                            const pred = p?.knockout?.find(m=>m.id===actual.id);
                            if (!pred||pred.homeScore===null) return null;
                            const result = calcMatchPoints(pred, actual);
                            return(
                              <div key={actual.id} style={{
                                display:"flex",alignItems:"center",gap:8,
                                padding:"8px 10px",marginBottom:5,borderRadius:10,
                                background:`${result?.color||"#333"}10`,
                                border:`1px solid ${result?.color||"#333"}25`,
                              }}>
                                <span style={{fontSize:13}}>{FLAGS[actual.home]}</span>
                                <span style={{fontSize:11,flex:1,fontWeight:600}}>{actual.home}</span>
                                <div style={{textAlign:"center",minWidth:50}}>
                                  <div style={{fontSize:10,color:"#444",marginBottom:1}}>pred</div>
                                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#c0c0c0",letterSpacing:1}}>
                                    {pred.homeScore}–{pred.awayScore}
                                  </div>
                                </div>
                                <div style={{color:"#333",fontSize:10}}>vs</div>
                                <div style={{textAlign:"center",minWidth:50}}>
                                  <div style={{fontSize:10,color:"#444",marginBottom:1}}>actual</div>
                                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#22c55e",letterSpacing:1}}>
                                    {actual.homeScore}–{actual.awayScore}
                                  </div>
                                </div>
                                <span style={{fontSize:11,flex:1,textAlign:"right",fontWeight:600}}>{actual.away}</span>
                                <span style={{fontSize:13}}>{FLAGS[actual.away]}</span>
                                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,
                                  color:result?.color||"#333",flexShrink:0,minWidth:30,textAlign:"right"}}>
                                  {result?`+${result.points}`:"–"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>}

        {/* ── STATS ── */}
        {tab==="stats"&&(()=>{
          // ── Personal stats ──────────────────────────────────────────────
          const playedMatches = actualMatches.filter(m=>m.homeScore!==null && m.home && m.away);
          const playedKO = actualKO.filter(m=>m.homeScore!==null&&m.home!=="TBD"&&m.home&&m.away);
          const allPlayed = [...playedMatches, ...playedKO];
          console.log('[Stats] actualMatches with scores:', playedMatches.length, 'allPlayed:', allPlayed.length, 'allPlayerPreds keys:', Object.keys(allPlayerPreds).length, 'myPreds with scores:', [...matches,...knockout].filter(m=>m.homeScore!==null).length);

          const myResults = allPlayed.map(actual=>{
            const pred = [...matches,...knockout].find(m=>m.id===actual.id);
            return pred ? calcMatchPoints(pred,actual) : null;
          }).filter(Boolean);

          const exact   = myResults.filter(r=>r.points===6).length;
          const gd      = myResults.filter(r=>r.points===4).length;
          const outcome = myResults.filter(r=>r.points===2).length;
          const wrong   = myResults.filter(r=>r.points===0).length;
          const total   = myResults.length;
          const myPts   = myResults.reduce((s,r)=>s+r.points,0);
          const accuracy = total>0 ? Math.round(((exact+gd+outcome)/total)*100) : 0;

          // Best/worst matches — full lists, collapsible in UI
          const matchDetails = allPlayed.map(actual=>{
            const pred = [...matches,...knockout].find(m=>m.id===actual.id);
            const result = pred ? calcMatchPoints(pred,actual) : null;
            return result ? { actual, pred, result } : null;
          }).filter(Boolean);
          const best  = matchDetails.filter(m=>m.result.points===6);
          const worst = matchDetails.filter(m=>m.result.points===0);
          const gdHits = matchDetails.filter(m=>m.result.points===4);

          // ── Group analytics ─────────────────────────────────────────────
          // Per-match: how many players got it right
          const matchGroupStats = playedMatches.map(actual=>{
            let exactCount=0, anyPointsCount=0, totalPreds=0;
            leaderboard.forEach(e=>{
              totalPreds++;
            });
            return { actual, exactCount, anyPointsCount, totalPreds };
          });

          // Points distribution
          const ptsBands = {
            elite: leaderboard.filter(e=>e.points>=100).length,
            good:  leaderboard.filter(e=>e.points>=50&&e.points<100).length,
            avg:   leaderboard.filter(e=>e.points>=20&&e.points<50).length,
            low:   leaderboard.filter(e=>e.points<20).length,
          };
          const avgPts = leaderboard.length>0
            ? Math.round(leaderboard.reduce((s,e)=>s+e.points,0)/leaderboard.length)
            : 0;
          const myRank = leaderboard.findIndex(e=>e.username===userName)+1;

          const StatBox = ({value,label,color="#fcb900",sub=""})=>(
            <div style={{flex:1,minWidth:80,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color,lineHeight:1}}>{value}</div>
              <div style={{fontSize:10,color:"#555",marginTop:3}}>{label}</div>
              {sub&&<div style={{fontSize:10,color:"#444",marginTop:2}}>{sub}</div>}
            </div>
          );

          return(
            <div>
              <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#fcb900",marginTop:0}}>
                📈 Stats
              </h2>

              {total===0?(
                <div style={{textAlign:"center",color:"#444",padding:"20px 20px 0",fontSize:13}}>
                  No personal stats yet — enter your predictions to see your scoring breakdown.
                </div>
              ):(
                <>
                  {/* ── My Stats ── */}
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#555",letterSpacing:1,marginBottom:10}}>
                    My Performance
                  </div>

                  {/* Overview row */}
                  <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                    <StatBox value={myPts} label="Total Pts" color="#fcb900"/>
                    <StatBox value={`#${myRank}`} label="Rank" color={myRank===1?"#fcb900":myRank===2?"#c0c0c0":myRank===3?"#cd7f32":"#60a5fa"}/>
                    <StatBox value={`${accuracy}%`} label="Accuracy" color="#22c55e"/>
                    <StatBox value={total} label="Predicted"/>
                  </div>

                  {/* Breakdown bar */}
                  <div style={{marginBottom:16}}>
                    <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                      {[
                        {count:exact,   label:"⭐ Exact",    color:"#22c55e", pts:6},
                        {count:gd,      label:"📐 GD",       color:"#fcb900", pts:3},
                        {count:outcome, label:"✓ Outcome",   color:"#60a5fa", pts:2},
                        {count:wrong,   label:"❌ Wrong",     color:"#ef4444", pts:0},
                      ].map((b,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:6,
                          background:`${b.color}12`,border:`1px solid ${b.color}25`,
                          borderRadius:8,padding:"7px 11px",flex:1,minWidth:70}}>
                          <div>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:b.color,lineHeight:1}}>{b.count}</div>
                            <div style={{fontSize:10,color:"#555"}}>{b.label}</div>
                          </div>
                          <div style={{marginLeft:"auto",fontSize:10,color:"#444"}}>×{b.pts}pts</div>
                        </div>
                      ))}
                    </div>
                    {/* Visual bar */}
                    {total>0&&(
                      <div style={{display:"flex",height:8,borderRadius:4,overflow:"hidden",gap:1}}>
                        {exact>0&&<div style={{flex:exact,background:"#22c55e"}}/>}
                        {gd>0&&<div style={{flex:gd,background:"#fcb900"}}/>}
                        {outcome>0&&<div style={{flex:outcome,background:"#60a5fa"}}/>}
                        {wrong>0&&<div style={{flex:wrong,background:"rgba(239,68,68,0.3)"}}/>}
                      </div>
                    )}
                  </div>

                  {/* Best predictions — collapsible */}
                  {best.length>0&&(
                    <div style={{marginBottom:16}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#22c55e"}}>⭐ Exact Scores ({best.length})</div>
                        {best.length>3&&<button onClick={()=>setShowAllBest(p=>!p)} style={{
                          fontSize:10,color:"#22c55e",background:"rgba(34,197,94,0.08)",
                          border:"1px solid rgba(34,197,94,0.2)",borderRadius:5,
                          padding:"2px 8px",cursor:"pointer",fontFamily:"inherit",
                        }}>{showAllBest?`Show less ▲`:`Show all ${best.length} ▼`}</button>}
                      </div>
                      {(showAllBest?best:best.slice(0,3)).map(({actual,pred},i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                          padding:"7px 10px",marginBottom:5,borderRadius:8,
                          background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.15)"}}>
                          <span style={{fontSize:12}}>{FLAGS[actual.home]||"🏳️"}</span>
                          <span style={{flex:1,fontSize:11,fontWeight:600}}>{actual.home}</span>
                          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"#22c55e"}}>
                            {pred.homeScore}–{pred.awayScore}
                          </span>
                          <span style={{flex:1,textAlign:"right",fontSize:11,fontWeight:600}}>{actual.away}</span>
                          <span style={{fontSize:12}}>{FLAGS[actual.away]||"🏳️"}</span>
                          <span style={{fontSize:10,color:"#22c55e",marginLeft:4}}>+6pts</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Worst predictions — collapsible */}
                  {worst.length>0&&(
                    <div style={{marginBottom:24}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#ef4444"}}>❌ Missed Predictions ({worst.length})</div>
                        {worst.length>3&&<button onClick={()=>setShowAllWorst(p=>!p)} style={{
                          fontSize:10,color:"#ef4444",background:"rgba(239,68,68,0.06)",
                          border:"1px solid rgba(239,68,68,0.2)",borderRadius:5,
                          padding:"2px 8px",cursor:"pointer",fontFamily:"inherit",
                        }}>{showAllWorst?`Show less ▲`:`Show all ${worst.length} ▼`}</button>}
                      </div>
                      {(showAllWorst?worst:worst.slice(0,3)).map(({actual,pred},i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                          padding:"7px 10px",marginBottom:5,borderRadius:8,
                          background:"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.12)"}}>
                          <span style={{fontSize:12}}>{FLAGS[actual.home]||"🏳️"}</span>
                          <span style={{flex:1,fontSize:11,fontWeight:600}}>{actual.home}</span>
                          <div style={{textAlign:"center"}}>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:12,color:"#555"}}>
                              pred {pred.homeScore}–{pred.awayScore}
                            </div>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"#22c55e"}}>
                              {actual.homeScore}–{actual.awayScore}
                            </div>
                          </div>
                          <span style={{flex:1,textAlign:"right",fontSize:11,fontWeight:600}}>{actual.away}</span>
                          <span style={{fontSize:12}}>{FLAGS[actual.away]||"🏳️"}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Group Stats ── */}
                  <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:16}}/>

                  {/* ── Rank History chart ── */}
                  {rankHistory.length>1&&(
                    <div style={{marginBottom:20,padding:"14px",
                      background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
                      borderRadius:10}}>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#fcb900",
                        letterSpacing:1,marginBottom:12}}>📈 Rank History</div>
                      {(()=>{
                        const W=280, H=80;
                        const n=rankHistory.length;
                        const maxRank=Math.max(...rankHistory.map(r=>r.rank));
                        const toX=i=>n===1?W/2:(i/(n-1))*W;
                        const toY=r=>8+((r-1)/(maxRank-1||1))*(H-16);
                        const pts=rankHistory.map((r,i)=>({x:toX(i),y:toY(r.rank),...r}));
                        const pathD=pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
                        return(
                          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
                            {/* Grid lines */}
                            {[1,Math.ceil(maxRank/2),maxRank].map(r=>(
                              <line key={r} x1="0" y1={toY(r)} x2={W} y2={toY(r)}
                                stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
                            ))}
                            {/* Line */}
                            <path d={pathD} fill="none" stroke="#fcb900" strokeWidth="2"
                              strokeLinecap="round" strokeLinejoin="round"/>
                            {/* Area fill */}
                            <path d={`${pathD} L${W},${H} L0,${H} Z`}
                              fill="url(#rankGrad)" opacity="0.15"/>
                            <defs>
                              <linearGradient id="rankGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fcb900" stopOpacity="0.8"/>
                                <stop offset="100%" stopColor="#fcb900" stopOpacity="0"/>
                              </linearGradient>
                            </defs>
                            {/* Points */}
                            {pts.map((p,i)=>(
                              <g key={i}>
                                <circle cx={p.x} cy={p.y} r="4"
                                  fill={i===pts.length-1?"#fcb900":"#1a1f2e"}
                                  stroke="#fcb900" strokeWidth="2"/>
                                <text x={p.x} y={p.y-9} textAnchor="middle"
                                  fill="#fcb900" fontSize="9" fontWeight="700">#{p.rank}</text>
                                <text x={p.x} y={H+12} textAnchor="middle"
                                  fill="#333" fontSize="7">
                                  {new Date(p.savedAt).toLocaleDateString('en',{month:'short',day:'numeric'})}
                                </text>
                              </g>
                            ))}
                          </svg>
                        );
                      })()}
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:10}}>
                        <span style={{color:"#444"}}>
                          Started: #{rankHistory[0]?.rank}
                        </span>
                        <span style={{color:rankHistory[rankHistory.length-1]?.rank<rankHistory[0]?.rank?"#22c55e":"#ef4444",fontWeight:700}}>
                          Current: #{rankHistory[rankHistory.length-1]?.rank}
                          {rankHistory.length>1&&(()=>{
                            const diff=rankHistory[0].rank-rankHistory[rankHistory.length-1].rank;
                            return diff!==0?<span> ({diff>0?`▲${diff}`:`▼${Math.abs(diff)}`})</span>:null;
                          })()}
                        </span>
                      </div>
                    </div>
                  )}

                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#555",letterSpacing:1,marginBottom:12}}>
                    Group Analytics
                  </div>

                  {/* Points distribution */}
                  <div style={{marginBottom:16,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"14px"}}>
                    <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Points Distribution</div>
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <StatBox value={leaderboard.length} label="Players" color="#60a5fa"/>
                      <StatBox value={avgPts} label="Avg Pts" color="#fcb900"/>
                      <StatBox value={leaderboard[0]?.points||0} label="High Score" color="#22c55e"/>
                      <StatBox value={leaderboard[leaderboard.length-1]?.points||0} label="Low Score" color="#ef4444"/>
                    </div>
                    {[
                      {label:"100+ pts 🔥", count:ptsBands.elite, color:"#fcb900"},
                      {label:"50–99 pts ✅", count:ptsBands.good,  color:"#22c55e"},
                      {label:"20–49 pts 📊", count:ptsBands.avg,   color:"#60a5fa"},
                      {label:"Under 20 pts", count:ptsBands.low,   color:"#ef4444"},
                    ].map((b,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <div style={{fontSize:11,width:120,color:"#888"}}>{b.label}</div>
                        <div style={{flex:1,height:6,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden"}}>
                          <div style={{width:leaderboard.length>0?`${(b.count/leaderboard.length)*100}%`:"0%",
                            height:"100%",background:b.color,borderRadius:4,transition:"width 0.5s"}}/>
                        </div>
                        <div style={{fontSize:11,color:"#555",width:20,textAlign:"right"}}>{b.count}</div>
                      </div>
                    ))}
                  </div>

                  {/* Podium picks breakdown */}
                  {leaderboard.length>0&&(()=>{
                    // Build counts for each place from leaderboard podium field
                    const normScorer = s => {
                      if (!s) return '';
                      const cleaned = s.trim().replace(/\b(jr|sr|ii|iii)\.?$/i,'').trim();
                      const lastName = cleaned.split(/\s+/).pop()||cleaned;
                      return lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
                    };
                    const editDist = (a,b) => {
                      const m=a.length,n=b.length;
                      const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i||j));
                      for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
                        dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
                      return dp[m][n];
                    };
                    // Merge similar keys (edit distance ≤ 2) — keeps the most popular display name
                    const mergeScorers = (raw) => {
                      const keys = Object.keys(raw);
                      const merged = {};
                      const used = new Set();
                      keys.sort((a,b) => raw[b].count - raw[a].count); // most popular first
                      for (const k of keys) {
                        if (used.has(k)) continue;
                        let canonical = k;
                        for (const k2 of keys) {
                          if (k2 === k || used.has(k2)) continue;
                          if (k.length >= 4 && k2.length >= 4 && editDist(k, k2) <= 2) {
                            raw[canonical].count += raw[k2].count;
                            used.add(k2);
                          }
                        }
                        merged[canonical] = raw[canonical];
                        used.add(k);
                      }
                      return merged;
                    };
                    const placeCounts = { first:{}, second:{}, third:{}, topScorer:{} };
                    leaderboard.forEach(e=>{
                      const p = e.podium || {};
                      ['first','second','third'].forEach(place=>{
                        const t = p[place] || (place==='first' ? (e.champion||'?') : '?');
                        placeCounts[place][t] = (placeCounts[place][t]||0)+1;
                      });
                      if(p.topScorer) {
                        const key = normScorer(p.topScorer);
                        // Store with display name = first occurrence of this normalized key
                        if(!placeCounts.topScorer[key]) placeCounts.topScorer[key] = {count:0, display:p.topScorer};
                        placeCounts.topScorer[key].count++;
                      }
                    });

                    const places = [
                      {key:'first',     label:'🥇 1st Place', color:'#f59e0b', pts:50},
                      {key:'second',    label:'🥈 2nd Place', color:'#c0c0c0', pts:25},
                      {key:'third',     label:'🥉 3rd Place', color:'#cd7f32', pts:15},
                      {key:'topScorer', label:'⚽ Top Scorer', color:'#60a5fa', pts:20, freeText:true},
                    ];

                    return(
                      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"14px"}}>
                        <div style={{fontSize:12,fontWeight:700,marginBottom:14}}>👑 Podium Picks</div>
                        {places.map(place=>{
                          const counts = place.key === 'topScorer'
                            ? mergeScorers(placeCounts[place.key] || {})
                            : placeCounts[place.key] || {};
                          const isScorer = place.key === 'topScorer';
                          const sorted = Object.entries(counts)
                            .filter(([t])=>t!=='?')
                            .map(([key,val])=>({
                              key,
                              display: isScorer ? val.display : key,
                              count: isScorer ? val.count : val,
                            }))
                            .sort((a,b)=>b.count-a.count).slice(0,5);
                          const unknown = isScorer ? 0 : (counts['?']||0);
                          return(
                            <div key={place.key} style={{marginBottom:16}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                                <span style={{fontSize:12,fontWeight:700,color:place.color}}>{place.label}</span>
                                <span style={{fontSize:10,color:"#444"}}>+{place.pts}pts if correct</span>
                              </div>
                              {sorted.map(({display,count},i)=>(
                                <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                                  <span style={{fontSize:13}}>{FLAGS[display]||"🏳️"}</span>
                                  <span style={{fontSize:11,flex:1,fontWeight:600}}>{display}</span>
                                  <div style={{flex:2,height:5,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden"}}>
                                    <div style={{width:`${(count/leaderboard.length)*100}%`,
                                      height:"100%",background:place.color,borderRadius:4}}/>
                                  </div>
                                  <span style={{fontSize:10,color:"#555",width:40,textAlign:"right"}}>
                                    {count} ({Math.round(count/leaderboard.length*100)}%)
                                  </span>
                                </div>
                              ))}
                              {sorted.length===0&&(
                                <div style={{fontSize:11,color:"#333"}}>No picks yet</div>
                              )}
                              {unknown>0&&(
                                <div style={{fontSize:10,color:"#333",marginTop:3}}>
                                  + {unknown} player{unknown>1?'s':''} haven't picked yet
                                </div>
                              )}
                              {place.key!=='third'&&<div style={{height:1,background:"rgba(255,255,255,0.06)",marginTop:10}}/>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* ── AI Group Analytics ── */}
              <div style={{height:1,background:"rgba(255,255,255,0.06)",margin:"20px 0 16px"}}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#a78bfa",letterSpacing:1}}>🔍 Group Analytics</div>
                {(()=>{
                  const SIX_HOURS = 6 * 60 * 60 * 1000;
                  const lastGen = analyticsGeneratedAt ? new Date(analyticsGeneratedAt).getTime() : 0;
                  const msSince = Date.now() - lastGen;
                  const onCooldown = msSince < SIX_HOURS && lastGen > 0;
                  const hoursLeft = onCooldown ? Math.ceil((SIX_HOURS - msSince) / 3600000) : 0;
                  return(
                    <button onClick={generateGroupAnalytics}
                      disabled={analyticsLoading||onCooldown} style={{
                      padding:"6px 14px",borderRadius:8,fontFamily:"inherit",fontWeight:700,fontSize:12,
                      cursor:(analyticsLoading||onCooldown)?"not-allowed":"pointer",
                      background:(analyticsLoading||onCooldown)?"rgba(139,92,246,0.04)":"rgba(139,92,246,0.12)",
                      border:"1px solid rgba(139,92,246,0.3)",
                      color:(analyticsLoading||onCooldown)?"#444":"#a78bfa",
                    }}>
                      {analyticsLoading?"⏳ Analysing…":onCooldown?`⏱ ${hoursLeft}h cooldown`:"🔍 Generate Analysis"}
                    </button>
                  );
                })()}
              </div>
              {analyticsError&&<div style={{padding:"10px 14px",borderRadius:8,marginBottom:12,
                background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",
                fontSize:11,color:"#fca5a5"}}>⚠️ {analyticsError}</div>}
              {analyticsGeneratedBy&&<div style={{fontSize:10,color:"#444",marginBottom:10}}>
                Generated by {analyticsGeneratedBy} · {new Date(analyticsGeneratedAt).toLocaleString()} · visible to all players
              </div>}
              {!groupAnalytics&&!analyticsLoading&&<div style={{textAlign:"center",padding:"32px 20px",color:"#444"}}>
                <div style={{fontSize:32,marginBottom:8}}>🔍</div>
                <div style={{fontSize:12}}>No analysis yet — generate once matches have been played</div>
              </div>}
              {groupAnalytics&&!Array.isArray(groupAnalytics)&&(()=>{
                const ga = groupAnalytics;
                if(!ga.headline&&!ga.player_profiles?.length) return(
                  <pre style={{fontSize:10,color:"#555",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>{JSON.stringify(ga,null,2)}</pre>
                );
                return(<div>
                  {ga.headline&&<div style={{padding:"12px 16px",borderRadius:10,marginBottom:12,
                    background:"linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.06))",
                    border:"1px solid rgba(139,92,246,0.25)"}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#c4b5fd"}}>{ga.headline}</div>
                  </div>}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                    {[
                      {label:"🏆 Leader",value:ga.leader_analysis,color:"#fcb900"},
                      {label:"🎯 Most skillful",value:ga.most_skillful,color:"#22c55e"},
                      {label:"🍀 Luckiest",value:ga.luckiest,color:"#60a5fa"},
                      {label:"📉 Weakness",value:ga.biggest_weakness,color:"#fb923c"},
                    ].filter(x=>x.value).map((item,i)=>(
                      <div key={i} style={{padding:"10px 12px",borderRadius:8,
                        background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                        <div style={{fontSize:10,fontWeight:700,color:item.color,marginBottom:4}}>{item.label}</div>
                        <div style={{fontSize:11,color:"#888",lineHeight:1.5}}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  {ga.player_profiles?.length>0&&<>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"#555",letterSpacing:1,marginBottom:8}}>Player Profiles</div>
                    {ga.player_profiles.map((p,i)=>(
                      <div key={i} style={{marginBottom:8,padding:"10px 14px",borderRadius:8,
                        background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <span style={{fontSize:12,fontWeight:700,color:"#ddd"}}>{p.username}</span>
                          {p.style&&<span style={{fontSize:10,color:"#a78bfa",background:"rgba(139,92,246,0.12)",borderRadius:4,padding:"2px 7px"}}>{p.style}</span>}
                        </div>
                        {p.insight&&<div style={{fontSize:11,color:"#666",lineHeight:1.5,marginBottom:4}}>{p.insight}</div>}
                        {p.tip&&<div style={{fontSize:10,color:"#22c55e"}}>💡 {p.tip}</div>}
                      </div>
                    ))}
                  </>}
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
                    {ga.prediction&&<div style={{padding:"10px 14px",borderRadius:8,background:"rgba(252,185,0,0.06)",border:"1px solid rgba(252,185,0,0.2)"}}>
                      <div style={{fontSize:10,color:"#fcb900",fontWeight:700,marginBottom:4}}>🏆 Who wins this?</div>
                      <div style={{fontSize:11,color:"#888",lineHeight:1.5}}>{ga.prediction}</div>
                    </div>}
                    {ga.banter&&<div style={{padding:"10px 14px",borderRadius:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                      <div style={{fontSize:10,color:"#fb923c",fontWeight:700,marginBottom:4}}>😂 Banter corner</div>
                      <div style={{fontSize:11,color:"#888",lineHeight:1.5,fontStyle:"italic"}}>{ga.banter}</div>
                    </div>}
                  </div>
                </div>);
              })()}

              {/* ── Match Results Breakdown — always visible when results exist ── */}
              {allPlayed.length>0&&(()=>{
                // Group completed matches by round/group
                const groups = {};
                allPlayed.forEach(m => {
                  const key = m.round ? m.round : m.group ? ('Group ' + m.group) : 'Other';
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(m);
                });

                const filterOptions = ['All', ...Object.keys(groups)];
                const filteredGroups = filterGroup === 'All'
                  ? groups
                  : { [filterGroup]: groups[filterGroup] || [] };

                return(
                  <div style={{marginTop:20}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"#fcb900",marginBottom:8}}>
                      📋 Match Results — Everyone's Picks
                    </div>

                    {/* Filter bar */}
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                      {filterOptions.map(opt=>(
                        <button key={opt} onClick={()=>setFilterGroup(opt)} style={{
                          padding:"4px 10px",borderRadius:6,border:"1px solid",cursor:"pointer",
                          fontFamily:"inherit",fontSize:10,fontWeight:600,
                          background:filterGroup===opt?"rgba(252,185,0,0.15)":"rgba(255,255,255,0.04)",
                          borderColor:filterGroup===opt?"rgba(252,185,0,0.4)":"rgba(255,255,255,0.08)",
                          color:filterGroup===opt?"#fcb900":"#555",
                        }}>{opt}</button>
                      ))}
                    </div>

                    {Object.entries(filteredGroups||{}).map(([groupKey, groupMatches])=>(
                      <div key={groupKey} style={{marginBottom:16}}>
                        <div style={{fontSize:11,color:"#555",fontWeight:700,letterSpacing:0.5,marginBottom:6,textTransform:"uppercase"}}>{groupKey}</div>
                        {(groupMatches||[]).filter(actual=>actual&&actual.id).map(actual=>{
                          const isOpen = openMatch === actual.id;
                          const playerRows = (leaderboard||[]).map(e=>{
                            if (!e?.username) return null;
                            const isMe = e.username===userName;
                            const playerPreds = isMe
                              ? [...(matches||[]),...(knockout||[])]
                              : [...(allPlayerPreds[e.username]?.matches||[]),...(allPlayerPreds[e.username]?.knockout||[])];
                            const pred = playerPreds.find(m=>m&&m.id===actual.id);
                            const result = pred ? calcMatchPoints(pred, actual) : null;
                            return { username:e.username, pred, result };
                          }).filter(r=>r&&r.pred&&r.pred.homeScore!==null);
                          if(actual.id==='A-0-1'||actual.id==='KO-R32-0') console.log('[Stats rows]', actual.id, 'playerRows:', playerRows.length, 'allPlayerPreds keys:', Object.keys(allPlayerPreds).length);

                          // Summary counts for collapsed view
                          const exactCount = playerRows.filter(r=>r.result?.points===6).length;
                          const anyPts = playerRows.filter(r=>(r.result?.points||0)>0).length;

                          return(
                            <div key={actual.id} style={{
                              marginBottom:6,borderRadius:8,overflow:"hidden",
                              border:"1px solid rgba(255,255,255,0.08)",
                            }}>
                              {/* Collapsed header — always visible, tap to expand */}
                              <button onClick={()=>setOpenMatch(isOpen?null:actual.id)} style={{
                                width:"100%",display:"flex",alignItems:"center",gap:8,
                                padding:"8px 12px",background:"rgba(255,255,255,0.03)",
                                border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",
                              }}>
                                <span style={{fontSize:12}}>{FLAGS[actual.home]||"🏳️"}</span>
                                <span style={{fontSize:11,fontWeight:700,color:"#ddd",flex:1}}>
                                  {actual.home} <span style={{color:"#fcb900",fontFamily:"monospace"}}>{actual.homeScore}–{actual.awayScore}</span> {actual.away}
                                </span>
                                <span style={{fontSize:12}}>{FLAGS[actual.away]||"🏳️"}</span>
                                {exactCount>0&&<span style={{fontSize:10,color:"#22c55e",marginLeft:4}}>⭐{exactCount}</span>}
                                {anyPts>0&&<span style={{fontSize:10,color:"#555"}}>{anyPts}/{playerRows.length} pts</span>}
                                <span style={{fontSize:12,color:"#444",marginLeft:4}}>{isOpen?"▲":"▼"}</span>
                              </button>

                              {/* Expanded player breakdown */}
                              {isOpen&&playerRows.map(row=>{
                                const pts = row.result?.points||0;
                                const ptColor = pts===6?"#22c55e":pts===4?"#fcb900":pts===2?"#60a5fa":"#555";
                                const ptLabel = pts===6?"⭐ Exact":pts===4?"📐 GD":pts===2?"✓ Outcome":"✗ Wrong";
                                const isMe = row.username===userName;
                                return(
                                  <div key={row.username} style={{
                                    display:"flex",alignItems:"center",gap:8,
                                    padding:"6px 12px",
                                    borderTop:"1px solid rgba(255,255,255,0.04)",
                                    background:isMe?"rgba(252,185,0,0.04)":undefined,
                                  }}>
                                    <div style={{
                                      width:22,height:22,borderRadius:"50%",flexShrink:0,
                                      background:"rgba(255,255,255,0.06)",
                                      display:"flex",alignItems:"center",justifyContent:"center",
                                      fontSize:9,color:"#555",fontWeight:700,
                                    }}>{(row.username||'??').slice(0,2).toUpperCase()}</div>
                                    <div style={{flex:1,fontSize:11,color:isMe?"#fcb900":"#888",fontWeight:isMe?700:400}}>
                                      {row.username}{isMe?" (you)":""}
                                    </div>
                                    <div style={{fontFamily:"monospace",fontSize:12,color:"#aaa",minWidth:28,textAlign:"center"}}>
                                      {row.pred.homeScore}–{row.pred.awayScore}
                                    </div>
                                    <div style={{fontSize:10,color:ptColor,minWidth:70,textAlign:"right",fontWeight:pts>0?700:400}}>
                                      {ptLabel}{pts>0?` +${pts}pts`:""}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── Projected Final Standings + Monte Carlo ── */}
              {(()=>{
                const remainingKO = actualKO.filter(m=>m.homeScore===null&&m.home!=="TBD"&&m.away!=="TBD");
                const hasAnyKO = actualKO.some(m=>m.home!=="TBD");
                void projRefresh; // triggers re-render when refresh is clicked
                if(!hasAnyKO) return null; // no KO teams yet at all

                // AI prediction lookup
                const aiResultFor = (home, away) => {
                  const key=`${home}||${away}`, keyR=`${away}||${home}`;
                  const pred=R32_AI_PREDICTIONS[key]||R32_AI_PREDICTIONS[keyR];
                  if(!pred) return null;
                  const flipped=!!R32_AI_PREDICTIONS[keyR]&&!R32_AI_PREDICTIONS[key];
                  return {homeScore:flipped?pred.a:pred.h, awayScore:flipped?pred.h:pred.a,
                    confidence:pred.confidence||'Medium'};
                };

                // Use remaining matches, OR if all played, use all KO for future round projection
                const koForProjection = remainingKO.length > 0
                  ? remainingKO
                  : actualKO.filter(m=>m.home!=="TBD"&&m.homeScore===null);

                const aiPredictions = koForProjection.map(m=>({...m,...(aiResultFor(m.home,m.away)||{})}))
                  .filter(m=>m.homeScore!=null); // only keep ones AI can predict

                // Confidence → variance mapping
                const confToSigma = c => ({'Very High':0.5,'High':0.8,'Medium':1.2,'Low':1.8,'Very Low':2.2}[c]||1.2);

                // Single deterministic projection
                const buildProjected = (playerKOMap) => leaderboard.map(e=>{
                  const playerKO = playerKOMap[e.username]||[];
                  let bonus=0;
                  aiPredictions.forEach(aiM=>{
                    if(aiM.homeScore==null) return;
                    const p=playerKO.find(m=>m.id===aiM.id);
                    if(!p||p.homeScore==null) return;
                    bonus+=(calcMatchPoints(p,aiM)?.points||0);
                  });
                  return {...e, bonus, projected:(e.points||0)+bonus};
                }).sort((a,b)=>b.projected-a.projected);

                // Build player KO map
                const playerKOMap={};
                leaderboard.forEach(e=>{
                  const isMe=e.username===userName;
                  playerKOMap[e.username]=isMe?knockout:(allPlayerPreds[e.username]?.knockout||[]);
                });

                const projectedLB = buildProjected(playerKOMap);
                if(!projectedLB.length) return null;
                const maxProj = projectedLB[0].projected;

                // Monte Carlo simulation
                const runMonteCarlo = () => {
                  setMcRunning(true);
                  setTimeout(()=>{
                    const N_SIMS = 2000;
                    // win counts per player
                    const winCounts={};
                    const rankSums={};
                    const ptsSums={};
                    leaderboard.forEach(e=>{ winCounts[e.username]=0; rankSums[e.username]=0; ptsSums[e.username]=0; });

                    for(let sim=0;sim<N_SIMS;sim++){
                      // For each remaining match, sample a random scoreline
                      const simMatches = aiPredictions.map(aiM=>{
                        if(aiM.homeScore==null) return aiM;
                        const sigma=confToSigma(aiM.confidence);
                        // Sample score: Poisson-like around AI prediction with noise
                        const noise = ()=>Math.round((Math.random()+Math.random()-1)*sigma);
                        const sh=Math.max(0,aiM.homeScore+noise());
                        const sa=Math.max(0,aiM.awayScore+noise());
                        return {...aiM, homeScore:sh, awayScore:sa};
                      });

                      // Score each player
                      const simLB=leaderboard.map(e=>{
                        const playerKO=playerKOMap[e.username]||[];
                        let bonus=0;
                        simMatches.forEach(simM=>{
                          if(simM.homeScore==null) return;
                          const p=playerKO.find(m=>m.id===simM.id);
                          if(!p||p.homeScore==null) return;
                          bonus+=(calcMatchPoints(p,simM)?.points||0);
                        });
                        return {...e, simPts:(e.points||0)+bonus};
                      }).sort((a,b)=>b.simPts-a.simPts);

                      simLB.forEach((e,rank)=>{
                        if(rank===0) winCounts[e.username]=(winCounts[e.username]||0)+1;
                        rankSums[e.username]=(rankSums[e.username]||0)+(rank+1);
                        ptsSums[e.username]=(ptsSums[e.username]||0)+e.simPts;
                      });
                    }

                    const mcLB=leaderboard.map(e=>({
                      username:e.username,
                      current:e.points||0,
                      winPct:Math.round((winCounts[e.username]||0)/N_SIMS*100),
                      avgRank:((rankSums[e.username]||0)/N_SIMS).toFixed(1),
                      avgPts:Math.round((ptsSums[e.username]||0)/N_SIMS),
                    })).sort((a,b)=>b.winPct-a.winPct||a.avgRank-b.avgRank);

                    setMcResults({lb:mcLB, sims:N_SIMS, matches:aiPredictions.length});
                    setMcRunning(false);
                  }, 50); // yield to UI first
                };

                return(
                  <div style={{marginBottom:20}}>
                    {/* Deterministic projection */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#a78bfa",
                        fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>
                        🤖 AI-Projected Final Standings
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>{
                          console.log('[Refresh] invalidating cache and re-fetching...');
                          invalidatePredsCache(groupCode);
                          allPredsLastFetch.current=0;
                          sbGetAllPredictions(groupCode).then(allPreds=>{
                            console.log('[Refresh] got', allPreds?.length, 'predictions');
                            if(!allPreds?.length) return;
                            allPredsLastFetch.current=Date.now();
                            const predsMap={};
                            allPreds.forEach(p=>{
                              if(p?.username) predsMap[p.username]={username:p.username,matches:p.matches||[],knockout:p.knockout||[],podium:p.podium||null};
                            });
                            console.log('[Refresh] setting allPlayerPreds keys:', Object.keys(predsMap).length);
                            setAllPlayerPreds({...predsMap});
                            setProjRefresh(p=>p+1);
                          });
                          setMcResults(null);
                        }} style={{
                          fontSize:10,color:"#a78bfa",background:"rgba(139,92,246,0.08)",
                          border:"1px solid rgba(139,92,246,0.2)",borderRadius:5,
                          padding:"3px 8px",cursor:"pointer",fontFamily:"inherit",
                        }}>🔄 Refresh</button>
                        <button onClick={runMonteCarlo} disabled={mcRunning} style={{
                          fontSize:10,color:mcRunning?"#555":"#fcb900",
                          background:mcRunning?"rgba(255,255,255,0.02)":"rgba(252,185,0,0.08)",
                          border:`1px solid ${mcRunning?"rgba(255,255,255,0.06)":"rgba(252,185,0,0.2)"}`,
                          borderRadius:5,padding:"3px 8px",cursor:mcRunning?"wait":"pointer",fontFamily:"inherit",
                        }}>{mcRunning?"⏳ Simulating…":"🎲 Monte Carlo"}</button>
                      </div>
                    </div>

                    {projectedLB.map((e,i)=>{
                      const isMe=e.username===userName;
                      const barW=maxProj>0?Math.round((e.projected/maxProj)*100):0;
                      const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`;
                      return(
                        <div key={e.username} style={{
                          marginBottom:4,padding:"6px 10px",borderRadius:8,
                          background:isMe?"rgba(139,92,246,0.08)":"rgba(255,255,255,0.02)",
                          border:`1px solid ${isMe?"rgba(139,92,246,0.25)":"rgba(255,255,255,0.05)"}`,
                        }}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                            <span style={{fontSize:11,minWidth:22}}>{medal}</span>
                            <span style={{fontSize:11,flex:1,fontWeight:isMe?700:500,
                              color:isMe?"#a78bfa":"#ccc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {e.username}
                            </span>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              <span style={{fontSize:12,fontWeight:700,color:isMe?"#a78bfa":"#fcb900"}}>{e.projected}</span>
                              <span style={{fontSize:9,color:"#555",marginLeft:3}}>pts</span>
                              {e.bonus>0&&<span style={{fontSize:9,color:"#22c55e",marginLeft:4}}>+{e.bonus}</span>}
                            </div>
                          </div>
                          <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.05)",overflow:"hidden"}}>
                            <div style={{width:`${barW}%`,height:"100%",borderRadius:2,
                              background:isMe?"rgba(139,92,246,0.6)":"rgba(252,185,0,0.35)"}}/>
                          </div>
                        </div>
                      );
                    })}

                    {/* Monte Carlo results */}
                    {mcResults&&(
                      <div style={{marginTop:16}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#fcb900",marginBottom:8,
                          fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>
                          🎲 Monte Carlo ({mcResults.sims.toLocaleString()} simulations)
                        </div>
                        <div style={{display:"flex",gap:4,fontSize:9,color:"#555",marginBottom:8,flexWrap:"wrap"}}>
                          <span style={{background:"rgba(255,255,255,0.04)",borderRadius:4,padding:"2px 6px"}}>Win% = probability of finishing 1st</span>
                          <span style={{background:"rgba(255,255,255,0.04)",borderRadius:4,padding:"2px 6px"}}>Avg rank across all simulations</span>
                        </div>
                        {mcResults.lb.map((e,i)=>{
                          const isMe=e.username===userName;
                          const barW=Math.max(2,e.winPct);
                          return(
                            <div key={e.username} style={{
                              marginBottom:4,padding:"6px 10px",borderRadius:8,
                              background:isMe?"rgba(252,185,0,0.06)":"rgba(255,255,255,0.02)",
                              border:`1px solid ${isMe?"rgba(252,185,0,0.2)":"rgba(255,255,255,0.05)"}`,
                            }}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                                <span style={{fontSize:11,minWidth:22}}>#{i+1}</span>
                                <span style={{fontSize:11,flex:1,fontWeight:isMe?700:500,
                                  color:isMe?"#fcb900":"#ccc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                  {e.username}
                                </span>
                                <div style={{display:"flex",gap:8,flexShrink:0,alignItems:"center"}}>
                                  <span style={{fontSize:12,fontWeight:700,
                                    color:e.winPct>=20?"#22c55e":e.winPct>=10?"#fcb900":"#555"}}>
                                    {e.winPct}%
                                  </span>
                                  <span style={{fontSize:9,color:"#555"}}>avg #{e.avgRank}</span>
                                  <span style={{fontSize:9,color:"#888"}}>{e.avgPts}pts</span>
                                </div>
                              </div>
                              <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.05)",overflow:"hidden"}}>
                                <div style={{width:`${barW}%`,height:"100%",borderRadius:2,
                                  background:e.winPct>=20?"rgba(34,197,94,0.5)":e.winPct>=10?"rgba(252,185,0,0.4)":"rgba(255,255,255,0.1)"}}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{marginTop:10,padding:"8px 10px",borderRadius:8,
                      background:"rgba(139,92,246,0.05)",border:"1px solid rgba(139,92,246,0.1)"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#a78bfa",marginBottom:4}}>How is this calculated?</div>
                      <div style={{fontSize:10,color:"#555",lineHeight:1.5}}>
                        <strong style={{color:"#888"}}>Projection:</strong> Scores your KO predictions against AI's predicted results using the standard 6/4/2/0 point rules. Current pts + projected bonus = projected total.
                        {mcResults&&<><br/><strong style={{color:"#888"}}>Monte Carlo:</strong> Runs {mcResults.sims.toLocaleString()} simulations. Each sim randomly varies the AI's predicted scores (noise proportional to confidence level — High confidence = small variance). Win% = how often you finish 1st across all simulations.</>}
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          );
        })()}

        {tab==="live"&&<div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#ef4444",margin:0}}>
              🔴 Live
            </h2>
            {liveLastUpdated&&(
              <span style={{fontSize:10,color:"#555"}}>
                Updated {liveLastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
              </span>
            )}
            <button onClick={()=>{setRefreshCooldown(0); fetchLiveMatches(true);}} disabled={liveLoading} style={{
              marginLeft:"auto",padding:"6px 14px",
              background:liveLoading?"rgba(255,255,255,0.03)":"rgba(239,68,68,0.1)",
              border:`1px solid ${liveLoading?"rgba(255,255,255,0.06)":"rgba(239,68,68,0.25)"}`,
              borderRadius:6,color:liveLoading?"#444":"#ef4444",fontSize:12,fontWeight:700,
              cursor:liveLoading?"not-allowed":"pointer",fontFamily:"inherit",
              minWidth:90,textAlign:"center",
            }}>
              {liveLoading?"⏳ Loading…":refreshCooldown>0?`🔄 Refresh (${refreshCooldown}s)`:"🔄 Refresh"}
            </button>
          </div>

          {liveError&&!liveError.toLowerCase().includes('internal')&&(
            <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",
              borderRadius:10,padding:"12px 14px",marginBottom:16,fontSize:12,color:"#fca5a5"}}>
              <div style={{fontWeight:700,marginBottom:4}}>❌ {liveError.split('—')[0]}</div>
              {liveError.includes('—')&&(
                <div style={{fontSize:11,color:"#888",marginTop:4}}>
                  💡 {liveError.split('—')[1]?.trim()}
                </div>
              )}
            </div>
          )}

          {/* Live matches */}
          {liveMatches.length>0&&(
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,color:"#ef4444",marginBottom:10,
                display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:"#ef4444",
                  animation:"pulse 1.5s ease infinite"}}/>
                LIVE NOW — {liveMatches.length} match{liveMatches.length>1?"es":""} in progress
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                {liveMatches.map(f=>{
                  const home=f.teams?.home, away=f.teams?.away;
                  const score=f.goals, status=f.fixture?.status;
                  const isSelected=selectedFixture?.fixture?.id===f.fixture?.id;
                  return(
                    <div key={f.fixture?.id} onClick={()=>{
                      if(isSelected){setSelectedFixture(null);return;}
                      setSelectedFixture(f); fetchFixtureDetails(f.fixture?.id);
                    }} style={{
                      padding:"10px",borderRadius:10,cursor:"pointer",
                      background:isSelected?"rgba(239,68,68,0.1)":"rgba(239,68,68,0.04)",
                      border:`1.5px solid ${isSelected?"#ef4444":"rgba(239,68,68,0.15)"}`,
                    }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <div style={{width:5,height:5,borderRadius:"50%",background:"#ef4444",animation:"pulse 1.5s ease infinite"}}/>
                          <span style={{fontSize:10,color:"#ef4444",fontWeight:700}}>
                            {status?.elapsed?`${status.elapsed}'`:status?.short}
                          </span>
                        </div>
                        {isSelected&&<span style={{fontSize:10,color:"#555"}}>tap to close</span>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:5,minWidth:0}}>
                          <span style={{fontSize:14,flexShrink:0}}>{FLAGS[home?.name]||"🏳️"}</span>
                          <span style={{fontSize:10,fontWeight:700,color:score?.home>score?.away?"#fcb900":"#ccc",
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {home?.name?.split(" ")[0]}
                          </span>
                        </div>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,
                          color:score?.home>score?.away?"#fcb900":"#fff",flexShrink:0}}>{score?.home??"-"}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:5,minWidth:0}}>
                          <span style={{fontSize:14,flexShrink:0}}>{FLAGS[away?.name]||"🏳️"}</span>
                          <span style={{fontSize:10,fontWeight:700,color:score?.away>score?.home?"#fcb900":"#ccc",
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {away?.name?.split(" ")[0]}
                          </span>
                        </div>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,
                          color:score?.away>score?.home?"#fcb900":"#fff",flexShrink:0}}>{score?.away??"-"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:11,color:"#555",textAlign:"center",marginBottom:8}}>
                ☝️ Tap a match to see live stats, formations & everyone's predictions
              </div>
              {selectedFixture&&(()=>{
                const f=selectedFixture;
                const home=f.teams?.home, away=f.teams?.away;
                const score=f.goals, status=f.fixture?.status, id=f.fixture?.id;
                const analysis=matchAnalysis[id];
                return(
                  <div style={{marginBottom:12,padding:"14px",
                    background:"rgba(255,255,255,0.03)",borderRadius:12,
                    border:"1px solid rgba(239,68,68,0.2)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <span style={{fontSize:16}}>{FLAGS[home?.name]||"🏳️"}</span>
                          <span style={{fontWeight:700,fontSize:13,color:score?.home>score?.away?"#fcb900":"#ccc"}}>{home?.name}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:7,marginTop:5}}>
                          <span style={{fontSize:16}}>{FLAGS[away?.name]||"🏳️"}</span>
                          <span style={{fontWeight:700,fontSize:13,color:score?.away>score?.home?"#fcb900":"#ccc"}}>{away?.name}</span>
                        </div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:36,color:"#fff",lineHeight:1,letterSpacing:3}}>
                          {score?.home??"-"} – {score?.away??"-"}
                        </div>
                        <div style={{fontSize:10,color:"#ef4444",fontWeight:700,marginTop:2}}>
                          {status?.elapsed?`${status.elapsed}'`:status?.short}
                        </div>
                      </div>
                    </div>
                    {fixtureLineups.length>=2&&(()=>{
                      const hl=fixtureLineups[0], al=fixtureLineups[1];
                      return <FormationPitch
                        homeTeam={hl?.team?.name} awayTeam={al?.team?.name}
                        homeFormation={hl?.formation} awayFormation={al?.formation}
                        homePlayers={hl?.startXI?.map(p=>({...p.player,grid:p.player?.grid,number:p.player?.number,name:p.player?.name}))}
                        awayPlayers={al?.startXI?.map(p=>({...p.player,grid:p.player?.grid,number:p.player?.number,name:p.player?.name}))}
                        events={fixtureEvents}
                        homeFlag={FLAGS[hl?.team?.name]||"🏳️"} awayFlag={FLAGS[al?.team?.name]||"🏳️"}
                      />;
                    })()}
                    {(()=>{
                      const prob=calcWinProbability(score?.home||0,score?.away||0,
                        f.fixture?.status?.elapsed||0,fixtureEvents,
                        fixtureStats?.length>=2?{possession:{home:parseInt(fixtureStats[0]?.statistics?.find(s=>s.type==="Ball Possession")?.value)||50}}:null);
                      return <WinProbBar home={prob.home} away={prob.away} draw={prob.draw}
                        homeName={home?.name} awayName={away?.name}
                        homeFlag={FLAGS[home?.name]||"🏳️"} awayFlag={FLAGS[away?.name]||"🏳️"}/>;
                    })()}

                    {/* 👥 Social live panel — who's winning this match */}
                    {(()=>{
                      const homeName=home?.name, awayName=away?.name;
                      if(!homeName||!awayName) return null;
                      const key1=`${homeName}||${awayName}`, key2=`${awayName}||${homeName}`;
                      const currentScore={homeScore:score?.home??0, awayScore:score?.away??0};
                      const normHome = TEAM_ALIASES[homeName]||homeName;
                      const normAway = TEAM_ALIASES[awayName]||awayName;
                      const matchPreds = Object.entries({...allPlayerPreds, ...Object.fromEntries(Object.entries(livePredictions).filter(([,v])=>v?.username&&Array.isArray(v?.matches)))})
                        .filter(([k,v])=>k && typeof v==='object'&&v!==null&&!Array.isArray(v)&&v.username&&(Array.isArray(v.matches)||Array.isArray(v.knockout)))
                        .map(([,v])=>v)
                        .filter(p=>{
                          // Check both group matches and knockout predictions
                          const allPreds = [...(p.matches||[]), ...(p.knockout||[])];
                          const m=allPreds.find(m=>
                            (m.home===normHome&&m.away===normAway)||(m.home===normAway&&m.away===normHome)||
                            (m.home===homeName&&m.away===awayName)||(m.home===awayName&&m.away===homeName));
                          return m?.homeScore!==null&&m?.homeScore!==undefined;
                        })
                        .map(p=>{
                          const allPreds = [...(p.matches||[]), ...(p.knockout||[])];
                          const m=allPreds.find(m=>
                            (m.home===normHome&&m.away===normAway)||(m.home===normAway&&m.away===normHome)||
                            (m.home===homeName&&m.away===awayName)||(m.home===awayName&&m.away===homeName));
                          const flipped=m?.home===normAway||m?.home===awayName;
                          const pred={homeScore:flipped?m.awayScore:m.homeScore, awayScore:flipped?m.homeScore:m.awayScore};
                          const pts=score?.home!=null?calcMatchPoints(pred,currentScore):null;
                          return{username:p.username||'?', pred, pts, points:pts?.points??0};
                        })
                        .sort((a,b)=>b.points-a.points);

                      if(!matchPreds.length) return null;
                      return(
                        <div style={{marginTop:12,marginBottom:12}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8,
                            display:"flex",alignItems:"center",gap:6}}>
                            <span>👥</span> Who's winning this match
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {matchPreds.map((p,i)=>{
                              const isMe=p.username===userName;
                              const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":"";
                              return(
                                <div key={p.username} style={{
                                  display:"flex",alignItems:"center",gap:8,
                                  padding:"6px 10px",borderRadius:8,
                                  background:isMe?"rgba(252,185,0,0.08)":"rgba(255,255,255,0.03)",
                                  border:`1px solid ${isMe?"rgba(252,185,0,0.25)":"rgba(255,255,255,0.06)"}`,
                                }}>
                                  <span style={{fontSize:11,width:16}}>{medal||i+1}</span>
                                  <span style={{fontSize:12,flex:1,fontWeight:isMe?700:400,
                                    color:isMe?"#fcb900":"#ccc"}}>
                                    {p.username}{isMe?" (you)":""}
                                  </span>
                                  <span style={{fontSize:11,color:"#555"}}>
                                    {p.pred.homeScore}–{p.pred.awayScore}
                                  </span>
                                  {p.pts&&score?.home!=null?(
                                    <span style={{
                                      fontSize:11,fontWeight:700,minWidth:40,textAlign:"right",
                                      color:p.points===6?"#22c55e":p.points===4?"#fcb900":p.points===2?"#60a5fa":"#444",
                                    }}>
                                      {p.points>0?`+${p.points}pts`:"—"}
                                    </span>
                                  ):(
                                    <span style={{fontSize:10,color:"#333",minWidth:40,textAlign:"right"}}>waiting</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {score?.home!=null&&(
                            <div style={{fontSize:10,color:"#333",marginTop:6}}>
                              Points based on current score {score.home}–{score.away} · updates live
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {fixtureEvents.length>0&&<div style={{marginBottom:14}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#fcb900",marginBottom:8}}>📋 Match Events</div>

                      {/* 🎲 Scoreline Predictor */}
                      {(()=>{
                        const _homeName = home?.name;
                        const _awayName = away?.name;
                        if (!_homeName||!_awayName) return null;
                        const normH = TEAM_ALIASES[_homeName]||_homeName;
                        const normA = TEAM_ALIASES[_awayName]||_awayName;
                        const counts = {};
                        let total = 0;
                        Object.values({...allPlayerPreds}).forEach(p => {
                          const m = p.matches?.find(m =>
                            (m.home===normH&&m.away===normA)||(m.home===normA&&m.away===normH)||
                            (m.home===_homeName&&m.away===_awayName)||(m.home===_awayName&&m.away===_homeName)
                          );
                          if (!m||m.homeScore===null||m.homeScore===undefined) return;
                          const flipped = m.home===normA||m.home===_awayName;
                          const key = flipped ? `${m.awayScore}-${m.homeScore}` : `${m.homeScore}-${m.awayScore}`;
                          counts[key] = (counts[key]||0) + 1;
                          total++;
                        });
                        if (!total) return null;
                        const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
                        const currentKey = score?.home!=null ? `${score.home}-${score.away}` : null;
                        return(
                          <div style={{marginBottom:14}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",marginBottom:8}}>
                              🎲 Group Predictions
                            </div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                              {sorted.map(([key,cnt])=>{
                                const pct = Math.round(cnt/total*100);
                                const isCurrent = key===currentKey;
                                return(
                                  <div key={key} style={{
                                    padding:"5px 10px",borderRadius:8,
                                    background:isCurrent?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.04)",
                                    border:`1px solid ${isCurrent?"rgba(34,197,94,0.4)":"rgba(255,255,255,0.08)"}`,
                                    textAlign:"center",minWidth:52,
                                  }}>
                                    <div style={{fontSize:14,fontWeight:700,
                                      color:isCurrent?"#22c55e":"#ddd",fontFamily:"monospace"}}>
                                      {key}
                                    </div>
                                    <div style={{fontSize:10,color:isCurrent?"#22c55e":"#555",marginTop:1}}>
                                      {cnt} · {pct}%
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {currentKey&&counts[currentKey]&&(
                              <div style={{fontSize:10,color:"#22c55e",marginTop:6}}>
                                ✓ {counts[currentKey]} player{counts[currentKey]>1?'s':''} predicted this exact score
                              </div>
                            )}
                          </div>
                        );
                      })()}

                        {fixtureEvents.map((ev,i)=>{
                          const isHome=ev.team?.id===home?.id;
                          const icon=ev.type==="Goal"?"⚽":ev.type==="Card"?(ev.detail==="Yellow Card"?"🟨":"🟥"):"🔄";
                          return(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",
                              borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none"}}>
                              <span style={{fontSize:10,color:"#555",width:28,textAlign:"center",flexShrink:0}}>{ev.time?.elapsed}'</span>
                              {!isHome&&<div style={{flex:1}}/>}
                              <span style={{fontSize:12}}>{icon}</span>
                              <div style={{flex:1}}>
                                <div style={{fontSize:11,fontWeight:600}}>{ev.player?.name}</div>
                                {ev.assist?.name&&ev.type==="Goal"&&<div style={{fontSize:10,color:"#555"}}>Assist: {ev.assist.name}</div>}
                              </div>
                              {isHome&&<div style={{flex:1}}/>}
                            </div>
                          );
                        })}
                      </div>}
                    {fixtureStats?.length>=2&&(()=>{
                      const hs=fixtureStats[0]?.statistics||[], as_=fixtureStats[1]?.statistics||[];
                      const getStat=(arr,key)=>parseInt(String(arr.find(s=>s.type===key)?.value||0).replace('%',''))||0;

                      // ── Match Quality Score ─────────────────────────────
                      const hShots=getStat(hs,'Total Shots'), aShots=getStat(as_,'Total Shots');
                      const hOnT=getStat(hs,'Shots on Goal'), aOnT=getStat(as_,'Shots on Goal');
                      const hCorners=getStat(hs,'Corner Kicks'), aCorners=getStat(as_,'Corner Kicks');
                      const hFouls=getStat(hs,'Fouls'), aFouls=getStat(as_,'Fouls');
                      const elapsed=f?.fixture?.status?.elapsed||1;
                      const goals=(score?.home||0)+(score?.away||0);
                      const totalShots=hShots+aShots;
                      const totalOnTarget=hOnT+aOnT;
                      const totalCorners=hCorners+aCorners;
                      // Quality formula: shots pace + accuracy + goals + balance
                      const shotsPer90 = (totalShots/elapsed)*90;
                      const accuracy = totalShots>0 ? totalOnTarget/totalShots : 0;
                      const goalBonus = Math.min(goals*1.2, 4);
                      const balance = 1 - Math.abs((hShots-aShots)/(totalShots||1));
                      const rawScore = (shotsPer90/30)*4 + accuracy*2 + goalBonus + balance*2;
                      const quality = Math.min(10, Math.max(1, Math.round(rawScore*10)/10));
                      const qualityColor = quality>=8?"#22c55e":quality>=6?"#fcb900":quality>=4?"#fb923c":"#ef4444";
                      const qualityLabel = quality>=8?"🔥 Thriller":quality>=6?"⚡ Good Game":quality>=4?"👍 Decent":"😴 Slow";

                      // ── Momentum Graph ──────────────────────────────────
                      // Simulate 15-min momentum windows from events
                      const windows = [0,15,30,45,60,75,90];
                      const getMomentum = (events, teamName, from, to) => {
                        return events.filter(e=>{
                          const min = e.time?.elapsed||0;
                          return min>=from && min<to && (
                            e.team?.name===teamName ||
                            TEAM_ALIASES[e.team?.name]===teamName
                          ) && ['Goal','Card','subst','Var'].includes(e.type);
                        }).length;
                      };
                      // Use fixtureEvents for momentum
                      const homeName_ = fixtureLineups[0]?.team?.name||home?.name||'';
                      const awayName_ = fixtureLineups[1]?.team?.name||away?.name||'';
                      const momentumData = windows.slice(0,-1).map((w,i)=>{
                        const to = windows[i+1];
                        // Use shot-based proxy if no events
                        const hMom = getMomentum(fixtureEvents, homeName_, w, to);
                        const aMom = getMomentum(fixtureEvents, awayName_, w, to);
                        // Normalize to -1 (away dominant) to +1 (home dominant)
                        const total = hMom+aMom;
                        const val = total===0 ? 0 : (hMom-aMom)/Math.max(total,1);
                        return { label:`${w}'`, val, hMom, aMom };
                      });

                      const graphH = 48;
                      const graphW = 100;
                      const barW = graphW/momentumData.length - 2;

                      return(
                        <div style={{marginBottom:14}}>
                          {/* Match Quality */}
                          <div style={{display:"flex",alignItems:"center",gap:12,
                            padding:"10px 12px",borderRadius:8,marginBottom:10,
                            background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                            <div style={{textAlign:"center",flexShrink:0}}>
                              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,
                                color:qualityColor,lineHeight:1}}>{quality}</div>
                              <div style={{fontSize:9,color:"#555",marginTop:1}}>/10</div>
                            </div>
                            <div>
                              <div style={{fontSize:11,fontWeight:700,color:qualityColor}}>{qualityLabel}</div>
                              <div style={{fontSize:10,color:"#555",marginTop:2}}>
                                Match quality · {totalShots} shots · {totalOnTarget} on target · {totalCorners} corners
                              </div>
                            </div>
                          </div>

                          {/* Momentum Graph */}
                          <div style={{marginBottom:6}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",marginBottom:6}}>
                              📈 Momentum
                              <span style={{fontSize:9,color:"#555",fontWeight:400,marginLeft:8}}>
                                🟡 {TEAM_ALIASES[homeName_]||homeName_} &nbsp; 🔵 {TEAM_ALIASES[awayName_]||awayName_}
                              </span>
                            </div>
                            <div style={{position:"relative",borderRadius:6,overflow:"hidden",
                              background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
                              <svg width="100%" height={graphH+20} viewBox={`0 0 ${graphW} ${graphH+20}`} preserveAspectRatio="none">
                                {/* Centre line */}
                                <line x1="0" y1={graphH/2+2} x2={graphW} y2={graphH/2+2}
                                  stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeDasharray="2,2"/>
                                {momentumData.map((d,i)=>{
                                  const x = i*(graphW/momentumData.length)+1;
                                  const midY = graphH/2+2;
                                  const barHeight = Math.abs(d.val)*(graphH/2-2);
                                  const isHome = d.val>0;
                                  const isNeutral = d.val===0;
                                  return(
                                    <g key={i}>
                                      {!isNeutral&&<rect
                                        x={x} y={isHome ? midY-barHeight : midY}
                                        width={barW} height={barHeight}
                                        fill={isHome?"#fcb900":"#60a5fa"} opacity="0.7" rx="1"
                                      />}
                                      <text x={x+barW/2} y={graphH+14} textAnchor="middle"
                                        fill="#555" fontSize="4">{d.label}</text>
                                    </g>
                                  );
                                })}
                              </svg>
                            </div>
                            <div style={{display:"flex",justifyContent:"space-between",
                              fontSize:9,color:"#555",marginTop:3,padding:"0 2px"}}>
                              <span>← {TEAM_ALIASES[homeName_]||homeName_} dominant</span>
                              <span>{TEAM_ALIASES[awayName_]||awayName_} dominant →</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 🎬 Match Highlights */}
                    {(()=>{
                      const fetchHighlights = async() => {
                        if(highlights) { setHlVideo(null); setHighlights(null); return; }
                        setHlLoading(true);
                        try {
                          const res = await fetch(`/api/highlights?home=${encodeURIComponent(home?.name||'')}&away=${encodeURIComponent(away?.name||'')}`);
                          const data = await res.json();
                          setHighlights(data.videos||[]);
                          if(data.videos?.length) setHlVideo(data.videos[0].id);
                        } catch(e) { setHighlights([]); }
                        setHlLoading(false);
                      };

                      return(
                        <div style={{marginBottom:14}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#f472b6"}}>🎬 Highlights</div>
                            <button onClick={fetchHighlights} style={{
                              padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:700,
                              background:highlights?"rgba(244,114,182,0.15)":"rgba(244,114,182,0.1)",
                              border:"1px solid rgba(244,114,182,0.3)",color:"#f472b6",
                              cursor:"pointer",fontFamily:"inherit",
                            }}>{hlLoading?"⏳ Searching…":highlights?"✕ Close":"🔍 Find Videos"}</button>
                          </div>
                          {hlVideo&&(
                            <div style={{borderRadius:8,overflow:"hidden",marginBottom:8,
                              background:"#000",aspectRatio:"16/9",position:"relative"}}>
                              <iframe
                                key={hlVideo}
                                width="100%" height="100%"
                                src={`https://www.youtube.com/embed/${hlVideo}?autoplay=0&rel=0`}
                                frameBorder="0"
                                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{display:"block",position:"absolute",inset:0}}
                                onError={()=>{
                                  // Skip to next embeddable video
                                  if(highlights?.length) {
                                    const idx = highlights.findIndex(v=>v.id===hlVideo);
                                    const next = highlights[idx+1];
                                    if(next) setHlVideo(next.id);
                                  }
                                }}
                              />
                            </div>
                          )}
                          {highlights&&highlights.length>0&&(
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {highlights.map(v=>(
                                <div key={v.id} onClick={()=>setHlVideo(v.id)}
                                  style={{
                                    display:"flex",alignItems:"center",gap:8,padding:"6px 8px",
                                    borderRadius:6,cursor:"pointer",
                                    background:hlVideo===v.id?"rgba(244,114,182,0.1)":"rgba(255,255,255,0.02)",
                                    border:`1px solid ${hlVideo===v.id?"rgba(244,114,182,0.3)":"rgba(255,255,255,0.05)"}`,
                                  }}>
                                  {v.thumbnail&&<img src={v.thumbnail} alt="" style={{width:60,height:34,borderRadius:4,objectFit:"cover",flexShrink:0}}/>}
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:11,color:"#ddd",lineHeight:1.3,
                                      overflow:"hidden",textOverflow:"ellipsis",
                                      display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                                      {v.title}
                                    </div>
                                    <div style={{fontSize:9,color:"#555",marginTop:2}}>{v.channel}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {highlights&&highlights.length===0&&(
                            <div style={{fontSize:11,color:"#555"}}>No highlights found yet — try again after the match.</div>
                          )}
                        </div>
                      );
                    })()}

                    {fixtureStats?.length>=2&&(()=>{
                      const hs=fixtureStats[0]?.statistics||[], as_=fixtureStats[1]?.statistics||[];
                      const getStat=(arr,key)=>parseInt(String(arr.find(s=>s.type===key)?.value||0).replace('%',''))||0;
                      const hOnTarget=getStat(hs,'Shots on Goal');
                      const hOffTarget=getStat(hs,'Shots off Goal');
                      const hBlocked=getStat(hs,'Blocked Shots');
                      const hInsideBox=getStat(hs,'Shots insidebox');
                      const hOutsideBox=getStat(hs,'Shots outsidebox');
                      const aOnTarget=getStat(as_,'Shots on Goal');
                      const aOffTarget=getStat(as_,'Shots off Goal');
                      const aBlocked=getStat(as_,'Blocked Shots');
                      const aInsideBox=getStat(as_,'Shots insidebox');
                      const aOutsideBox=getStat(as_,'Shots outsidebox');
                      // Use total shots as fallback so map always shows if any shots exist
                      const hTotal=getStat(hs,'Total Shots');
                      const aTotal=getStat(as_,'Total Shots');
                      const totalShots = hTotal + aTotal;
                      if (!totalShots) return null;

                      // Generate deterministic shot positions based on counts
                      const seededPos = (seed, count, isHome, zone) => {
                        const positions = [];
                        for (let i=0; i<count; i++) {
                          const s1 = ((seed * 1664525 + i * 1013904223) & 0x7fffffff) % 100;
                          const s2 = ((seed * 22695477 + i * 1234567891) & 0x7fffffff) % 100;
                          if (zone === 'inside') {
                            positions.push({
                              x: isHome ? 84 + (s1 % 12) : 4 + (s1 % 12),
                              y: 14 + (s2 % 26),
                            });
                          } else {
                            positions.push({
                              x: isHome ? 65 + (s1 % 18) : 17 + (s1 % 18),
                              y: 8 + (s2 % 38),
                            });
                          }
                        }
                        return positions;
                      };

                      // Fallback: if insidebox not available, use total shots
                      const hInside = hInsideBox || hTotal;
                      const aInside = aInsideBox || aTotal;
                      const hShotsOn  = seededPos(1, Math.min(hOnTarget, 8),  true,  'inside');
                      const hShotsOff = seededPos(2, Math.min(Math.max(hOffTarget, hInside-hOnTarget), 6), true, 'inside');
                      const hOutside  = seededPos(3, Math.min(hOutsideBox, 4), true,  'outside');
                      const aShotsOn  = seededPos(4, Math.min(aOnTarget, 8),  false, 'inside');
                      const aShotsOff = seededPos(5, Math.min(Math.max(aOffTarget, aInside-aOnTarget), 6), false,'inside');
                      const aOutside  = seededPos(6, Math.min(aOutsideBox, 4), false, 'outside');

                      return(
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#60a5fa",marginBottom:8}}>
                            🎯 Shot Map
                            <span style={{fontSize:10,color:"#555",fontWeight:400,marginLeft:8}}>
                              <span style={{color:"#fcb900"}}>●</span> {home?.name||homeName}
                              <span style={{color:"#60a5fa",marginLeft:8}}>●</span> {away?.name||awayName}
                            </span>
                          </div>
                          <div style={{position:"relative",width:"100%",paddingBottom:"52%",
                            background:"rgba(34,197,94,0.08)",borderRadius:8,
                            border:"1px solid rgba(255,255,255,0.08)",overflow:"hidden"}}>
                            {/* Pitch markings */}
                            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 100 52" preserveAspectRatio="none">
                              {/* Halfway line */}
                              <line x1="50" y1="0" x2="50" y2="52" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
                              {/* Left penalty box */}
                              <rect x="0" y="14" width="16" height="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
                              {/* Right penalty box */}
                              <rect x="84" y="14" width="16" height="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
                              {/* Left goal */}
                              <rect x="0" y="21" width="3" height="10" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"/>
                              {/* Right goal */}
                              <rect x="97" y="21" width="3" height="10" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"/>
                              {/* Centre circle */}
                              <circle cx="50" cy="26" r="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>

                              {/* Home shots on target — filled yellow */}
                              {hShotsOn.map((p,i)=><circle key={`hon${i}`} cx={p.x} cy={p.y} r="2.5" fill="#fcb900" opacity="0.9"/>)}
                              {/* Home shots off target — outline yellow */}
                              {hShotsOff.map((p,i)=><circle key={`hoff${i}`} cx={p.x} cy={p.y} r="2.5" fill="none" stroke="#fcb900" strokeWidth="0.8" opacity="0.7"/>)}
                              {/* Home outside box — small yellow */}
                              {hOutside.map((p,i)=><circle key={`hout${i}`} cx={p.x} cy={p.y} r="1.8" fill="none" stroke="#fcb900" strokeWidth="0.6" opacity="0.5"/>)}

                              {/* Away shots on target — filled blue */}
                              {aShotsOn.map((p,i)=><circle key={`aon${i}`} cx={p.x} cy={p.y} r="2.5" fill="#60a5fa" opacity="0.9"/>)}
                              {/* Away shots off target — outline blue */}
                              {aShotsOff.map((p,i)=><circle key={`aoff${i}`} cx={p.x} cy={p.y} r="2.5" fill="none" stroke="#60a5fa" strokeWidth="0.8" opacity="0.7"/>)}
                              {/* Away outside box — small blue */}
                              {aOutside.map((p,i)=><circle key={`aout${i}`} cx={p.x} cy={p.y} r="1.8" fill="none" stroke="#60a5fa" strokeWidth="0.6" opacity="0.5"/>)}
                            </svg>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#555",marginTop:6}}>
                            <span>🟡 On target: {hOnTarget} | Off: {hOffTarget} | Box: {hInsideBox}</span>
                            <span>On: {aOnTarget} | Off: {aOffTarget} | Box: {aInsideBox} 🔵</span>
                          </div>
                        </div>
                      );
                    })()}

                    {fixtureStats?.length>=2&&(()=>{
                      const hs=fixtureStats[0]?.statistics||[], as_=fixtureStats[1]?.statistics||[];
                      const keys=["Ball Possession","Total Shots","Shots on Goal","Corner Kicks","Fouls","Yellow Cards"];

                    {/* 🏃 Player Heatmap */}
                    {fixturePlayers?.length>=2&&fixtureLineups?.length>=2&&(()=>{
                      const homePlayers = fixturePlayers[0]?.players||[];
                      const awayPlayers = fixturePlayers[1]?.players||[];
                      const hl = fixtureLineups[0];
                      const al = fixtureLineups[1];
                      if (!homePlayers.length) return null;

                      // Formation positions helper (reuse from FormationPitch)
                      const getPositions = (formation) => {
                        const lines = (formation||'4-3-3').split('-').map(Number);
                        const positions = [];
                        let row = 90;
                        const step = 80/(lines.length+1);
                        lines.forEach(count => {
                          row -= step;
                          for (let i=0; i<count; i++) {
                            positions.push({x: row, y: (100/(count+1))*(i+1)});
                          }
                        });
                        return positions;
                      };

                      const getActivity = (p) => {
                        const s = p.statistics?.[0]||{};
                        return (s.shots?.total||0)*3 + (s.passes?.key||0)*2 +
                               (s.tackles?.total||0)*1.5 + (s.dribbles?.success||0)*2 +
                               (s.duels?.won||0)*0.5;
                      };

                      const hStarting = homePlayers.filter(p=>p.statistics?.[0]?.games?.minutes>0).slice(0,11);
                      const aStarting = awayPlayers.filter(p=>p.statistics?.[0]?.games?.minutes>0).slice(0,11);
                      const hPos = getPositions(hl?.formation);
                      const aPos = getPositions(al?.formation);
                      const maxActivity = Math.max(1, ...[...hStarting,...aStarting].map(getActivity));

                      return(
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#fb923c",marginBottom:8}}>
                            🏃 Player Activity
                            <span style={{fontSize:9,color:"#555",fontWeight:400,marginLeft:6}}>size = involvement</span>
                          </div>
                          <div style={{position:"relative",width:"100%",paddingBottom:"52%",
                            background:"rgba(34,197,94,0.07)",borderRadius:8,
                            border:"1px solid rgba(255,255,255,0.08)",overflow:"hidden"}}>
                            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 100 52" preserveAspectRatio="none">
                              <line x1="50" y1="0" x2="50" y2="52" stroke="rgba(255,255,255,0.1)" strokeWidth="0.4"/>
                              <rect x="1" y="15" width="16" height="24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4"/>
                              <rect x="83" y="15" width="16" height="24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4"/>
                              <circle cx="50" cy="26" r="9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4"/>
                              {/* Goalkeeper */}
                              <circle cx="4" cy="26" r="2.5" fill="#fcb900" opacity="0.8"/>
                              <circle cx="96" cy="26" r="2.5" fill="#60a5fa" opacity="0.8"/>
                              {/* Home outfield */}
                              {hStarting.slice(1).map((p,i)=>{
                                const pos = hPos[i]||{x:50,y:50};
                                const act = getActivity(p);
                                const r = 1.5 + (act/maxActivity)*2.5;
                                const opacity = 0.4 + (act/maxActivity)*0.6;
                                const x = pos.x * 0.5; // left half
                                const y = pos.y * 0.52;
                                return <circle key={i} cx={x} cy={y} r={r} fill="#fcb900" opacity={opacity}/>;
                              })}
                              {/* Away outfield */}
                              {aStarting.slice(1).map((p,i)=>{
                                const pos = aPos[i]||{x:50,y:50};
                                const act = getActivity(p);
                                const r = 1.5 + (act/maxActivity)*2.5;
                                const opacity = 0.4 + (act/maxActivity)*0.6;
                                const x = 100 - (pos.x * 0.5); // right half
                                const y = pos.y * 0.52;
                                return <circle key={i} cx={x} cy={y} r={r} fill="#60a5fa" opacity={opacity}/>;
                              })}
                            </svg>
                          </div>
                          {/* Top active players */}
                          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"#555"}}>
                            <div>
                              {hStarting.sort((a,b)=>getActivity(b)-getActivity(a)).slice(0,2).map(p=>(
                                <div key={p.player?.id}>🟡 {p.player?.name?.split(' ').slice(-1)[0]}</div>
                              ))}
                            </div>
                            <div style={{textAlign:"right"}}>
                              {aStarting.sort((a,b)=>getActivity(b)-getActivity(a)).slice(0,2).map(p=>(
                                <div key={p.player?.id}>{p.player?.name?.split(' ').slice(-1)[0]} 🔵</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                      return(
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#60a5fa",marginBottom:8}}>📊 Match Stats</div>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:10,color:"#555"}}>
                            <span style={{fontWeight:700,color:"#ccc"}}>{home?.name}</span>
                            <span style={{fontWeight:700,color:"#ccc"}}>{away?.name}</span>
                          </div>
                          {keys.map(k=>{
                            const hv=hs.find(s=>s.type===k)?.value||0, av=as_.find(s=>s.type===k)?.value||0;
                            const hn=parseInt(String(hv).replace("%",""))||0, an=parseInt(String(av).replace("%",""))||0;
                            const tot=hn+an||1;
                            return(
                              <div key={k} style={{marginBottom:8}}>
                                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
                                  <span style={{color:"#fcb900",fontWeight:700}}>{hv}</span>
                                  <span style={{color:"#555",fontSize:10}}>{k}</span>
                                  <span style={{color:"#60a5fa",fontWeight:700}}>{av}</span>
                                </div>
                                <div style={{display:"flex",height:4,borderRadius:2,overflow:"hidden",background:"rgba(255,255,255,0.06)"}}>
                                  <div style={{width:`${(hn/tot)*100}%`,background:"#fcb900",borderRadius:"2px 0 0 2px"}}/>
                                  <div style={{width:`${(an/tot)*100}%`,background:"#60a5fa",borderRadius:"0 2px 2px 0"}}/>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {fixturePlayers?.length>=2&&(()=>{
                      const all=fixturePlayers.flatMap(team=>(team.players||[]).map(p=>({
                        ...(p.player||{}), ...(p.statistics?.[0]||{}), teamFlag:FLAGS[team.team?.name]||"🏳️"
                      }))).filter(p=>p.games?.rating&&p.games?.minutes>0);
                      if(!all.length) return null;
                      const sorted=[...all].sort((a,b)=>parseFloat(b.games?.rating||0)-parseFloat(a.games?.rating||0));
                      const top=sorted.slice(0,3), poor=sorted.slice(-2).reverse();
                      const PR=({p,rank,isTop})=>{
                        const r=parseFloat(p.games?.rating||0).toFixed(1);
                        const c=isTop?(r>=8?"#22c55e":r>=7?"#fcb900":"#60a5fa"):"#ef4444";
                        return(
                          <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",marginBottom:4,
                            borderRadius:6,background:`${c}08`,border:`1px solid ${c}18`}}>
                            <span style={{fontSize:10,color:"#555",width:14,flexShrink:0}}>{isTop?`#${rank}`:"▼"}</span>
                            <span style={{fontSize:11,flexShrink:0}}>{p.teamFlag}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                              <div style={{fontSize:10,color:"#555",display:"flex",gap:6,marginTop:1}}>
                                {p.goals?.total>0&&<span>⚽{p.goals.total}</span>}
                                {p.goals?.assists>0&&<span>🅰️{p.goals.assists}</span>}
                                {p.passes?.accuracy&&<span>🎯{p.passes.accuracy}%</span>}
                                {p.tackles?.total>0&&<span>💪{p.tackles.total}</span>}
                                <span>{p.games?.minutes}'</span>
                              </div>
                            </div>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:c,flexShrink:0}}>{r}</div>
                          </div>
                        );
                      };
                      return(
                        <div style={{marginBottom:14}}>
                          <div style={{display:"flex",gap:8}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:10,fontWeight:700,color:"#22c55e",marginBottom:6}}>⭐ Top Performers</div>
                              {top.map((p,i)=><PR key={i} p={p} rank={i+1} isTop={true}/>)}
                            </div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:10,fontWeight:700,color:"#ef4444",marginBottom:6}}>📉 Struggling</div>
                              {poor.map((p,i)=><PR key={i} p={p} rank={i+1} isTop={false}/>)}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── 1. Passing Accuracy ── */}
                    {fixtureStats?.length>=2&&(()=>{
                      const hs2=fixtureStats[0]?.statistics||[], as2=fixtureStats[1]?.statistics||[];
                      if(!hs2.length&&!as2.length) return null;
                      const getStat2=(arr,key)=>parseInt(String(arr.find(s=>s.type===key)?.value||0).replace('%',''))||0;
                      const hAcc=getStat2(hs2,'Passes %'), aAcc=getStat2(as2,'Passes %');
                      const hTotal=getStat2(hs2,'Total passes'), aTotal=getStat2(as2,'Total passes');
                      if(!hAcc&&!aAcc) return null;
                      return(
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#34d399",marginBottom:8}}>🎯 Passing Accuracy</div>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <div style={{textAlign:"center",flexShrink:0}}>
                              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,
                                color:hAcc>=aAcc?"#fcb900":"#666",lineHeight:1}}>{hAcc}%</div>
                              <div style={{fontSize:9,color:"#555"}}>{hTotal}</div>
                            </div>
                            <div style={{flex:1}}>
                              <div style={{height:5,borderRadius:3,overflow:"hidden",
                                background:"rgba(255,255,255,0.06)",display:"flex"}}>
                                <div style={{width:`${hAcc/(hAcc+aAcc||1)*100}%`,background:"#fcb900"}}/>
                                <div style={{flex:1,background:"#60a5fa"}}/>
                              </div>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#555",marginTop:2}}>
                                <span>{FLAGS[home?.name]||"🏳️"}</span>
                                <span>{FLAGS[away?.name]||"🏳️"}</span>
                              </div>
                            </div>
                            <div style={{textAlign:"center",flexShrink:0}}>
                              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,
                                color:aAcc>hAcc?"#60a5fa":"#666",lineHeight:1}}>{aAcc}%</div>
                              <div style={{fontSize:9,color:"#555"}}>{aTotal}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── 4. Work Rate ── */}
                    {fixturePlayers?.length>=2&&(()=>{
                      const sumP=(players,key1,key2)=>(players||[]).reduce((acc,p)=>{
                        const s=p.statistics?.[0]||{};
                        const v=key2?s[key1]?.[key2]:s[key1];
                        return acc+(typeof v==='number'?v:0);
                      },0);
                      const hP=fixturePlayers[0]?.players||[], aP=fixturePlayers[1]?.players||[];
                      const hPasses=sumP(hP,'passes','total'), aPasses=sumP(aP,'passes','total');
                      const hDuels=sumP(hP,'duels','total'), aDuels=sumP(aP,'duels','total');
                      if(!hPasses&&!aPasses) return null;
                      const hDist=+(hPasses*0.06+hDuels*0.12).toFixed(1);
                      const aDist=+(aPasses*0.06+aDuels*0.12).toFixed(1);
                      const maxD=Math.max(hDist,aDist,1);
                      const elapsed=f?.fixture?.status?.elapsed||90;
                      return(
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#fb923c",marginBottom:8}}>
                            🏃 Work Rate
                            <span style={{fontSize:9,color:"#555",fontWeight:400,marginLeft:6}}>est. km · {elapsed}'</span>
                          </div>
                          {[{name:home?.name,dist:hDist,color:"#fcb900"},{name:away?.name,dist:aDist,color:"#60a5fa"}].map((t,i)=>(
                            <div key={i} style={{marginBottom:6}}>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
                                <span style={{color:"#888"}}>{FLAGS[t.name]||"🏳️"} {TEAM_ALIASES[t.name]||t.name}</span>
                                <span style={{color:t.color,fontWeight:700}}>{t.dist} km</span>
                              </div>
                              <div style={{height:5,borderRadius:3,background:"rgba(255,255,255,0.06)"}}>
                                <div style={{height:"100%",borderRadius:3,background:t.color,
                                  width:`${(t.dist/maxD)*100}%`}}/>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* ── 6. Who Benefits? ── */}
                    {score?.home!==null&&score?.home!==undefined&&leaderboard?.length>0&&(()=>{
                      const normH=TEAM_ALIASES[home?.name]||home?.name||'';
                      const normA=TEAM_ALIASES[away?.name]||away?.name||'';
                      if(!normH||!normA) return null;
                      const curScore={homeScore:score.home,awayScore:score.away};
                      const impacts=leaderboard.slice(0,10).map(e=>{
                        const isMe=e.username===userName;
                        const preds=isMe?[...matches,...knockout]:(allPlayerPreds[e.username]?.matches||[]);
                        const pred=preds.find(m=>
                          (m.home===normH&&m.away===normA)||(m.home===normA&&m.away===normH)||
                          (m.home===home?.name&&m.away===away?.name)||(m.home===away?.name&&m.away===home?.name)
                        );
                        if(!pred||pred.homeScore===null) return null;
                        const fl=pred.home===normA||pred.home===away?.name;
                        const p={homeScore:fl?pred.awayScore:pred.homeScore,awayScore:fl?pred.homeScore:pred.awayScore};
                        const pts=calcMatchPoints(p,curScore)?.points||0;
                        return {username:e.username,pts,isMe,cur:e.points||0};
                      }).filter(Boolean);
                      if(!impacts.length) return null;
                      const sorted=[...impacts].sort((a,b)=>(b.cur+b.pts)-(a.cur+a.pts));
                      const rankNow={};
                      [...leaderboard].sort((a,b)=>(b.points||0)-(a.points||0)).forEach((e,i)=>rankNow[e.username]=i+1);
                      const rankAfter={};
                      sorted.forEach((e,i)=>rankAfter[e.username]=i+1);
                      return(
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#f472b6",marginBottom:8}}>
                            🔮 If this score holds…
                          </div>
                          {sorted.slice(0,6).map((e,i)=>{
                            const before=rankNow[e.username]||99;
                            const after=rankAfter[e.username]||i+1;
                            const delta=before-after;
                            return(
                              <div key={e.username} style={{
                                display:"flex",alignItems:"center",gap:8,
                                padding:"5px 8px",borderRadius:6,marginBottom:3,
                                background:e.isMe?"rgba(252,185,0,0.06)":"rgba(255,255,255,0.02)",
                                border:`1px solid ${e.isMe?"rgba(252,185,0,0.2)":"rgba(255,255,255,0.05)"}`,
                              }}>
                                <span style={{fontSize:10,color:"#555",width:18,flexShrink:0}}>#{after}</span>
                                <span style={{fontSize:11,flex:1,fontWeight:e.isMe?700:400,
                                  color:e.isMe?"#fcb900":"#ccc",
                                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                  {e.username}{e.isMe?" (you)":""}
                                </span>
                                <span style={{fontSize:10,color:e.pts>0?"#22c55e":"#555",flexShrink:0}}>
                                  {e.pts>0?`+${e.pts}pts`:"0pts"}
                                </span>
                                <span style={{fontSize:11,fontWeight:700,flexShrink:0,width:20,textAlign:"center",
                                  color:delta>0?"#22c55e":delta<0?"#ef4444":"#555"}}>
                                  {delta>0?`↑${delta}`:delta<0?`↓${Math.abs(delta)}`:"–"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {(()=>{
                      const nm=home?.name, am=away?.name;
                      const normH=TEAM_ALIASES[nm]||nm, normA=TEAM_ALIASES[am]||am;
                      const allMyPreds=[...matches,...knockout];
                      const pred=allMyPreds.find(m=>
                        (m.home===nm&&m.away===am)||(m.home===am&&m.away===nm)||
                        (m.home===normH&&m.away===normA)||(m.home===normA&&m.away===normH));
                      if(!pred||pred.homeScore===null) return null;
                      const flipped=pred.home===am||pred.home===normA;
                      const adjPred={homeScore:flipped?pred.awayScore:pred.homeScore,awayScore:flipped?pred.homeScore:pred.awayScore};
                      const result=score?.home!=null?calcMatchPoints(adjPred,{homeScore:score?.home,awayScore:score?.away}):null;
                      return(
                        <div style={{marginBottom:12,padding:"10px 12px",
                          background:`${result?.color||"rgba(255,255,255,0.03)"}10`,
                          border:`1px solid ${result?.color||"rgba(255,255,255,0.06)"}25`,borderRadius:8}}>
                          <div style={{fontSize:10,color:"#555",marginBottom:4}}>Your prediction</div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#c0c0c0"}}>{adjPred.homeScore}–{adjPred.awayScore}</span>
                            {result&&<span style={{fontSize:11,color:result.color,fontWeight:700}}>{result.label} {result.points>0?`+${result.points}pts`:""}</span>}
                          </div>
                        </div>
                      );
                    })()}
                    <div>
                      <button onClick={()=>analyseMatch(f)} disabled={analysis?.loading} style={{
                        width:"100%",padding:"10px 14px",
                        background:analysis?.loading?"rgba(139,92,246,0.05)":"rgba(139,92,246,0.1)",
                        border:"1px solid rgba(139,92,246,0.25)",borderRadius:8,
                        color:"#a78bfa",fontSize:12,fontWeight:700,
                        cursor:analysis?.loading?"wait":"pointer",
                        fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:8,
                      }}>
                        <span>{analysis?.loading?"⏳":"🤖"}</span>
                        <span>{analysis?.loading?"Analysing…":analysis?.text?"🔄 Refresh Analysis":"AI Match Analysis"}</span>
                        <button onClick={(e)=>{e.stopPropagation();setSelectedFixture(null);}} style={{
                          marginLeft:"auto",padding:"2px 8px",background:"rgba(255,255,255,0.06)",
                          border:"1px solid rgba(255,255,255,0.10)",borderRadius:4,
                          color:"#555",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                      </button>
                      {analysis?.text&&!analysis?.loading&&(
                        <div style={{marginTop:8,padding:"12px 14px",
                          background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.15)",
                          borderRadius:8,fontSize:12,color:"#c4b5fd",lineHeight:1.7,fontStyle:"italic"}}>
                          {analysis.text}
                        </div>
                      )}

                      {/* 🔍 Match Q&A */}
                      <div style={{marginTop:10}}>
                        <div style={{fontSize:11,color:"#555",fontWeight:700,marginBottom:6}}>
                          🔍 Ask anything about this match
                        </div>
                        {/* Previous answers */}
                        {(matchQueryAnswer[id]||[]).map((qa,i)=>(
                          <div key={i} style={{marginBottom:8}}>
                            <div style={{fontSize:11,color:"#888",marginBottom:3}}>Q: {qa.q}</div>
                            <div style={{fontSize:12,color:"#c4b5fd",lineHeight:1.6,padding:"8px 10px",
                              background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.15)",
                              borderRadius:6}}>{qa.a}</div>
                          </div>
                        ))}
                        {/* Suggested questions */}
                        {!(matchQueryAnswer[id]?.length) && (
                          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                            {["How many fans in the stadium?","Who's the referee?","What's the weather like?","Any injury news?"].map(q=>(
                              <button key={q} onClick={()=>askMatchQuery(q,f)} style={{
                                fontSize:10,padding:"4px 8px",borderRadius:6,
                                background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.2)",
                                color:"#60a5fa",cursor:"pointer",fontFamily:"inherit",
                              }}>{q}</button>
                            ))}
                          </div>
                        )}
                        {/* Input */}
                        <div style={{display:"flex",gap:6}}>
                          <input
                            value={matchQuery}
                            onChange={e=>setMatchQuery(e.target.value)}
                            onKeyDown={e=>e.key==="Enter"&&askMatchQuery(matchQuery,f)}
                            placeholder="Ask about the match…"
                            style={{flex:1,padding:"8px 10px",background:"rgba(255,255,255,0.05)",
                              border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,
                              color:"#fff",fontSize:12,fontFamily:"inherit",outline:"none"}}
                          />
                          <button onClick={()=>askMatchQuery(matchQuery,f)} disabled={matchQueryLoading||!matchQuery.trim()}
                            style={{padding:"8px 12px",background:matchQueryLoading?"rgba(96,165,250,0.1)":"rgba(96,165,250,0.2)",
                              border:"1px solid rgba(96,165,250,0.3)",borderRadius:7,
                              color:"#60a5fa",fontSize:12,fontWeight:700,cursor:matchQueryLoading?"wait":"pointer",
                              fontFamily:"inherit",minWidth:48}}>
                            {matchQueryLoading?"⏳":"Ask"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Today's matches */}
          {/* KO matches scheduled today/upcoming — shown even if API-Football hasn't returned them yet */}
          {(()=>{
            const now = Date.now();
            const ptNow = new Date(now - 7*60*60*1000);
            const ptDateStr = ptNow.toISOString().split('T')[0];
            const ptDayStart = new Date(ptDateStr + 'T07:00:00Z').getTime();
            const ptDayEnd = ptDayStart + 48*60*60*1000; // show 48h window for KO
            const upcomingKO = actualKO.filter(m => {
              const ko = koKickoffs[m.id];
              if (!ko || m.home==="TBD") return false;
              // Already in todayMatches from API? Skip
              const inApi = todayMatches.some(f =>
                (TEAM_ALIASES[f.teams?.home?.name]||f.teams?.home?.name)===m.home ||
                (TEAM_ALIASES[f.teams?.away?.name]||f.teams?.away?.name)===m.away
              );
              return !inApi && ko > now && ko < ptDayEnd;
            }).sort((a,b)=>(koKickoffs[a.id]||0)-(koKickoffs[b.id]||0));
            if (!upcomingKO.length) return null;
            return(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:10}}>
                  🏆 UPCOMING KNOCKOUT MATCHES
                </div>
                {upcomingKO.map(m=>{
                  const ko = koKickoffs[m.id];
                  const koDate = new Date(ko);
                  const timeStr = koDate.toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
                  const hoursAway = (ko-now)/3600000;
                  return(
                    <div key={m.id} style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"12px 14px",marginBottom:6,borderRadius:10,
                      background:"rgba(252,185,0,0.03)",
                      border:"1px solid rgba(252,185,0,0.12)",
                    }}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600}}>
                          {FLAGS[m.home]||"🏳️"} {m.home}
                        </div>
                        <div style={{fontSize:12,fontWeight:600,marginTop:4}}>
                          {FLAGS[m.away]||"🏳️"} {m.away}
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:12,color:"#fcb900",fontWeight:700}}>{timeStr}</div>
                        <div style={{fontSize:10,color:hoursAway<3?"#f97316":"#555",marginTop:2}}>
                          {m.round}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {todayMatches.length>0&&(
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:10}}>
                📅 TODAY'S MATCHES
              </div>
              {todayMatches.filter(f=>f.fixture?.status?.short!=="1H"&&
                f.fixture?.status?.short!=="2H"&&f.fixture?.status?.short!=="HT").map(f=>{
                const home = f.teams?.home;
                const away = f.teams?.away;
                const kickoff = f.fixture?.date ? new Date(f.fixture.date) : null;
                const status = f.fixture?.status?.short;
                const finished = ["FT","AET","PEN"].includes(status);
                return(
                  <div key={f.fixture?.id} style={{
                    display:"flex",alignItems:"center",gap:10,
                    padding:"12px 14px",marginBottom:6,borderRadius:10,
                    background:finished?"rgba(34,197,94,0.04)":"rgba(255,255,255,0.03)",
                    border:`1px solid ${finished?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.06)"}`,
                  }}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {FLAGS[home?.name]||FLAGS[TEAM_ALIASES[home?.name]]||"🏳️"} {TEAM_ALIASES[home?.name]||home?.name}
                      </div>
                      <div style={{fontSize:12,fontWeight:600,marginTop:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {FLAGS[away?.name]||FLAGS[TEAM_ALIASES[away?.name]]||"🏳️"} {TEAM_ALIASES[away?.name]||away?.name}
                      </div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      {finished?(
                        <>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,
                            color:"#22c55e",letterSpacing:1}}>
                            {f.goals?.home} – {f.goals?.away}
                          </div>
                          <div style={{fontSize:10,color:"#22c55e"}}>{status}</div>
                        </>
                      ):(
                        <>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#fcb900"}}>
                            {kickoff?.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                          </div>
                          <div style={{fontSize:10,color:"#555"}}>Kickoff</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Next 7 days schedule ── */}
          {(()=>{
            const now = Date.now();
            const weekMs = 7 * 24 * 60 * 60 * 1000;
            const upcoming = ALL_MATCHES
              .filter(m => {
                const ko = KICKOFFS[m.id] || KICKOFFS[`${m.home}||${m.away}`];
                return ko && ko > now && ko < now + weekMs;
              })
              .sort((a,b) => {
                const ka = KICKOFFS[a.id]||KICKOFFS[`${a.home}||${a.away}`]||0;
                const kb = KICKOFFS[b.id]||KICKOFFS[`${b.home}||${b.away}`]||0;
                return ka - kb;
              });
            if (!upcoming.length) return null;

            // Group by day
            const byDay = {};
            upcoming.forEach(m => {
              const ko = KICKOFFS[m.id]||KICKOFFS[`${m.home}||${m.away}`];
              const day = new Date(ko).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});
              if (!byDay[day]) byDay[day] = [];
              byDay[day].push({...m, ko});
            });

            return(
              <div style={{marginTop:16}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,
                  letterSpacing:1,color:"#fcb900",marginBottom:10}}>
                  📅 Next 7 Days
                </div>
                {Object.entries(byDay).map(([day, dayMatches])=>(
                  <div key={day} style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:"#555",fontWeight:700,
                      letterSpacing:0.5,marginBottom:6,textTransform:"uppercase"}}>{day}</div>
                    {dayMatches.map(m=>{
                      const koTime = new Date(m.ko).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
                      const myPred = matches.find(p =>
                        (p.home===m.home&&p.away===m.away)||(p.home===m.away&&p.away===m.home)
                      );
                      const hasPred = myPred?.homeScore!==null && myPred?.homeScore!==undefined;
                      return(
                        <div key={m.id} style={{
                          display:"flex",alignItems:"center",gap:8,
                          padding:"7px 10px",borderRadius:8,marginBottom:4,
                          background:"rgba(255,255,255,0.03)",
                          border:"1px solid rgba(255,255,255,0.06)",
                        }}>
                          <span style={{fontSize:13,flexShrink:0}}>{FLAGS[m.home]||"🏳️"}</span>
                          <span style={{fontSize:11,flex:1,color:"#ccc",fontWeight:500,
                            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {m.home}
                          </span>
                          <div style={{textAlign:"center",flexShrink:0}}>
                            <div style={{fontSize:10,color:"#fcb900",fontWeight:700}}>{koTime}</div>
                            {hasPred&&(
                              <div style={{fontSize:9,color:"#555",marginTop:1}}>
                                {myPred.home===m.home?myPred.homeScore:myPred.awayScore}
                                –
                                {myPred.home===m.home?myPred.awayScore:myPred.homeScore}
                              </div>
                            )}
                          </div>
                          <span style={{fontSize:11,flex:1,color:"#ccc",fontWeight:500,
                            textAlign:"right",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {m.away}
                          </span>
                          <span style={{fontSize:13,flexShrink:0}}>{FLAGS[m.away]||"🏳️"}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })()}

          {!liveLoading&&liveMatches.length===0&&todayMatches.length===0&&(()=>{
            const score = getSimScore(simMinute);
            const simEnded = simMinute >= 90;
            const userPred = matches.find(m=>
              (m.home==="Mexico"&&m.away==="South Africa")||
              (m.home==="South Africa"&&m.away==="Mexico")
            );
            const predScore = userPred?.homeScore!==null
              ? { h: userPred.home==="Mexico"?userPred.homeScore:userPred.awayScore,
                  a: userPred.home==="Mexico"?userPred.awayScore:userPred.homeScore }
              : null;
            const liveResult = predScore && simMinute > 0
              ? calcMatchPoints(
                  { homeScore:predScore.h, awayScore:predScore.a },
                  { homeScore:score.h, awayScore:score.a }
                ) : null;

            return(
              <div>
                {/* Demo banner */}
                <div style={{
                  background:"linear-gradient(135deg,rgba(252,185,0,0.12),rgba(252,185,0,0.06))",
                  border:"1px solid rgba(252,185,0,0.35)",
                  borderRadius:10,padding:"12px 16px",marginBottom:16,
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:16}}>🎮</span>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,
                      letterSpacing:1,color:"#fcb900"}}>Demo Mode — Live Preview</div>
                  </div>
                  <div style={{fontSize:11,color:"#888",lineHeight:1.6}}>
                    This simulates exactly what you'll see during real matches from <strong style={{color:"#fcb900"}}>June 11</strong>. Press ▶ Start to try it — events, stats, formations and AI analysis all update live.
                  </div>
                  <div style={{marginTop:6,fontSize:10,color:"#555"}}>
                    Real data replaces this automatically when matches begin.
                  </div>
                </div>

                {/* Match card */}
                <div style={{
                  padding:"18px 16px",borderRadius:16,marginBottom:12,
                  background: simMinute>0 ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.03)",
                  border:`1px solid ${simMinute>0 ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)"}`,
                }}>
                  {/* Live badge */}
                  {simMinute>0&&!simEnded&&(
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:"#ef4444",
                        animation:"pulse 1s ease infinite"}}/>
                      <span style={{fontSize:10,color:"#ef4444",fontWeight:700,letterSpacing:1}}>LIVE</span>
                      <span style={{fontSize:11,color:"#ef4444",marginLeft:4}}>{simMinute}'</span>
                    </div>
                  )}
                  {simEnded&&(
                    <div style={{fontSize:10,color:"#22c55e",fontWeight:700,letterSpacing:1,marginBottom:10}}>✅ FULL TIME</div>
                  )}

                  {/* Score */}
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                        <span style={{fontSize:20}}>🇲🇽</span>
                        <span style={{fontWeight:700,fontSize:14,color:score.h>score.a?"#fcb900":"#ccc"}}>Mexico</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <span style={{fontSize:20}}>🇿🇦</span>
                        <span style={{fontWeight:700,fontSize:14,color:score.a>score.h?"#fcb900":"#ccc"}}>South Africa</span>
                      </div>
                    </div>
                    <div style={{textAlign:"center",minWidth:80}}>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:42,
                        color:"#fff",lineHeight:1,letterSpacing:3}}>
                        {simMinute>0?score.h:"-"} – {simMinute>0?score.a:"-"}
                      </div>
                      {predScore&&simMinute>0&&(
                        <div style={{fontSize:10,color:"#555",marginTop:2}}>
                          your pred: {predScore.h}–{predScore.a}
                          {liveResult&&liveResult.points>0&&(
                            <span style={{color:liveResult.color,marginLeft:4,fontWeight:700}}>+{liveResult.points}pts</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Controls */}
                  <div style={{display:"flex",gap:8,marginTop:14}}>
                    {!simActive&&!simEnded&&(
                      <button onClick={startSim} style={{
                        flex:1,padding:"10px",background:"#ef4444",border:"none",
                        borderRadius:8,color:"#fff",fontWeight:700,fontSize:13,
                        cursor:"pointer",fontFamily:"inherit",
                      }}>▶ {simMinute===0?"Start Simulation":"Resume"}</button>
                    )}
                    {simActive&&(
                      <button onClick={stopSim} style={{
                        flex:1,padding:"10px",background:"rgba(239,68,68,0.15)",
                        border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,
                        color:"#ef4444",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
                      }}>⏸ Pause</button>
                    )}
                    {(simMinute>0)&&(
                      <button onClick={startSim} style={{
                        padding:"10px 14px",background:"rgba(255,255,255,0.06)",
                        border:"1px solid rgba(255,255,255,0.10)",borderRadius:8,
                        color:"#666",fontSize:12,cursor:"pointer",fontFamily:"inherit",
                      }}>↺ Restart</button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {simMinute>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
                      <div style={{width:`${(simMinute/90)*100}%`,height:"100%",
                        background:"#ef4444",borderRadius:2,transition:"width 0.5s"}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#444",marginTop:2}}>
                      <span>0'</span><span>45' HT</span><span>90'</span>
                    </div>
                  </div>
                )}

                {/* Win probability — updates every minute */}
                {simMinute>0&&(()=>{
                  const score = getSimScore(simMinute);
                  const prob = calcWinProbability(
                    score.h, score.a, simMinute, simEvents,
                    simStats ? { possession:{ home:simStats.possession.home } } : null
                  );
                  return <WinProbBar
                    home={prob.home} away={prob.away} draw={prob.draw}
                    homeName="Mexico" awayName="South Africa"
                    homeFlag="🇲🇽" awayFlag="🇿🇦"
                  />;
                })()}

                {simMinute>0&&(
                  <div style={{display:"flex",gap:10,marginBottom:12}}>

                    {/* Events */}
                    <div style={{flex:1,background:"rgba(255,255,255,0.03)",
                      border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#fcb900",marginBottom:8}}>📋 Events</div>
                      {simEvents.filter(e=>e.type!=="End").length===0&&(
                        <div style={{fontSize:10,color:"#333",textAlign:"center",padding:"8px 0"}}>No events yet</div>
                      )}
                      {simEvents.filter(e=>e.type!=="End").map((ev,i)=>{
                        const icon = ev.type==="Goal"?"⚽":ev.type==="Card"?(ev.detail?.includes("Yellow")?"🟨":"🟥"):"🔄";
                        const isHome = ev.side==="home";
                        return(
                          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:5,
                            padding:"4px 0",borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",
                            animation:"fadeIn 0.4s ease"}}>
                            <span style={{fontSize:10,color:"#555",width:22,flexShrink:0,marginTop:1}}>{ev.min}'</span>
                            <span style={{fontSize:11}}>{icon}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:10,fontWeight:600,
                                color:isHome?"#fcb900":"#60a5fa",
                                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"
                              }}>{ev.player}</div>
                              {ev.assist&&<div style={{fontSize:10,color:"#444"}}>↳ {ev.assist}</div>}
                              {ev.type==="Sub"&&<div style={{fontSize:10,color:"#444"}}>↓ {ev.off}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stats */}
                    {simStats&&(
                      <div style={{flex:1,background:"rgba(255,255,255,0.03)",
                        border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px"}}>
                        <div style={{fontSize:10,fontWeight:700,color:"#60a5fa",marginBottom:8}}>📊 Stats</div>
                        {[
                          {label:"Poss",h:`${simStats.possession.home}%`,a:`${simStats.possession.away}%`,hN:simStats.possession.home,aN:simStats.possession.away},
                          {label:"Shots",h:simStats.shots.home,a:simStats.shots.away,hN:simStats.shots.home,aN:simStats.shots.away},
                          {label:"On tgt",h:simStats.shotsOn.home,a:simStats.shotsOn.away,hN:simStats.shotsOn.home,aN:simStats.shotsOn.away},
                          {label:"Corners",h:simStats.corners.home,a:simStats.corners.away,hN:simStats.corners.home,aN:simStats.corners.away},
                          {label:"Fouls",h:simStats.fouls.home,a:simStats.fouls.away,hN:simStats.fouls.home,aN:simStats.fouls.away},
                        ].map((s,i)=>{
                          const total = s.hN+s.aN||1;
                          return(
                            <div key={i} style={{marginBottom:7}}>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
                                <span style={{color:"#fcb900",fontWeight:700}}>{s.h}</span>
                                <span style={{color:"#444"}}>{s.label}</span>
                                <span style={{color:"#60a5fa",fontWeight:700}}>{s.a}</span>
                              </div>
                              <div style={{display:"flex",height:3,borderRadius:2,overflow:"hidden",background:"rgba(255,255,255,0.06)"}}>
                                <div style={{width:`${(s.hN/total)*100}%`,background:"#fcb900",transition:"width 0.8s"}}/>
                                <div style={{width:`${(s.aN/total)*100}%`,background:"#60a5fa",transition:"width 0.8s"}}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Player Ratings (sim) */}
                {simMinute>=30&&(()=>{
                  const score = getSimScore(simMinute);
                  const hasGoal = e => simEvents.some(ev=>ev.type==="Goal"&&ev.player===e);
                  const hasAssist = e => simEvents.some(ev=>ev.type==="Goal"&&ev.assist===e);
                  const isRedded = e => simEvents.some(ev=>ev.type==="Card"&&ev.detail==="Red Card"&&ev.player===e);
                  const isSubbed = e => simEvents.some(ev=>ev.type==="Sub"&&ev.off===e&&simMinute>=ev.min);

                  const simRatings = [
                    {name:"Lozano",  flag:"🇲🇽", base:7.2, bonus: hasGoal("Lozano")?1.5:0 + hasAssist("Lozano")?0.8:0},
                    {name:"Jimenez", flag:"🇲🇽", base:6.8, bonus: hasGoal("Jimenez")?1.8:0 + hasAssist("Jimenez")?0.5:0},
                    {name:"Herrera", flag:"🇲🇽", base:6.9, bonus:0.3},
                    {name:"Manyama", flag:"🇿🇦", base:6.5, bonus: hasGoal("Manyama")?1.6:0},
                    {name:"Tau",     flag:"🇿🇦", base:5.8, bonus: isRedded("Hlatshwayo")?-0.3:0},
                    {name:"Hlatshwayo",flag:"🇿🇦",base:4.2, bonus: isRedded("Hlatshwayo")?-2.5:0},
                  ].map(p=>({...p, rating:(p.base+p.bonus+(score.h>score.a?0.2:-0.2)).toFixed(1)}))
                   .sort((a,b)=>parseFloat(b.rating)-parseFloat(a.rating));

                  const top = simRatings.slice(0,3);
                  const poor = simRatings.slice(-2).reverse();

                  const SimPlayerRow = ({p, isTop}) => {
                    const r = parseFloat(p.rating);
                    const color = isTop ? (r>=8?"#22c55e":r>=7?"#fcb900":"#60a5fa") : "#ef4444";
                    return(
                      <div style={{display:"flex",alignItems:"center",gap:6,
                        padding:"5px 8px",marginBottom:4,borderRadius:6,
                        background:`${color}08`,border:`1px solid ${color}18`}}>
                        <span style={{fontSize:10}}>{p.flag}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:700}}>{p.name}</div>
                          <div style={{fontSize:10,color:"#555",display:"flex",gap:5,marginTop:1}}>
                            {hasGoal(p.name)&&<span>⚽</span>}
                            {hasAssist(p.name)&&<span>🅰️</span>}
                            {isRedded(p.name)&&<span>🟥</span>}
                            {isSubbed(p.name)&&<span>🔄 subbed off</span>}
                            <span>{simMinute}'</span>
                          </div>
                        </div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color}}>{p.rating}</div>
                      </div>
                    );
                  };

                  return(
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:10,fontWeight:700,color:"#22c55e",marginBottom:6}}>⭐ Top Performers</div>
                          {top.map((p,i)=><SimPlayerRow key={i} p={p} isTop={true}/>)}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:10,fontWeight:700,color:"#ef4444",marginBottom:6}}>📉 Struggling</div>
                          {poor.map((p,i)=><SimPlayerRow key={i} p={p} isTop={false}/>)}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* AI Analysis */}
                {simMinute>=20&&(
                  <div style={{marginBottom:12}}>
                    <button onClick={generateSimAnalysis} disabled={simAnalysisLoading} style={{
                      width:"100%",padding:"10px 14px",
                      background:simAnalysisLoading?"rgba(139,92,246,0.05)":"rgba(139,92,246,0.1)",
                      border:"1px solid rgba(139,92,246,0.25)",borderRadius:8,
                      color:"#a78bfa",fontSize:12,fontWeight:700,
                      cursor:simAnalysisLoading?"wait":"pointer",
                      fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:8,
                    }}>
                      <span>{simAnalysisLoading?"⏳":"🤖"}</span>
                      <span>{simAnalysisLoading?"Analysing match…":simAnalysis?"🔄 Refresh AI Analysis":"AI Match Analysis"}</span>
                      <span style={{marginLeft:"auto",fontSize:10,color:"#6d5a9c",fontWeight:400}}>uses Anthropic API</span>
                    </button>
                    {simAnalysis&&!simAnalysisLoading&&(
                      <div style={{marginTop:8,padding:"12px 14px",
                        background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.15)",
                        borderRadius:8,fontSize:12,color:"#c4b5fd",lineHeight:1.7,fontStyle:"italic"}}>
                        {simAnalysis}
                      </div>
                    )}
                  </div>
                )}

                {/* Formation graphic — updates on subs and red cards */}
                {simMinute>0&&(()=>{
                  // Mexico 4-3-3 starting XI with grid positions (row:col)
                  const mexStart = [
                    {name:"Ochoa",     number:13, grid:"1:1"},
                    {name:"Gallardo",  number:23, grid:"2:1"},
                    {name:"Montes",    number:3,  grid:"2:2"},
                    {name:"Sanchez",   number:4,  grid:"2:3"},
                    {name:"Arteaga",   number:2,  grid:"2:4"},
                    {name:"Guardado",  number:18, grid:"3:1"},
                    {name:"Herrera",   number:16, grid:"3:2"},
                    {name:"Alvarez",   number:14, grid:"3:3"},
                    {name:"Vega",      number:11, grid:"4:1"},
                    {name:"Lozano",    number:22, grid:"4:2"},
                    {name:"Martin",    number:9,  grid:"4:3"},
                  ];
                  // South Africa 4-4-2 starting XI
                  const saStart = [
                    {name:"Williams",   number:1,  grid:"1:1"},
                    {name:"Mokoena",    number:5,  grid:"2:1"},
                    {name:"Hlathi",     number:6,  grid:"2:2"},
                    {name:"Hlatshwayo",number:15, grid:"2:3"},
                    {name:"Mudau",      number:2,  grid:"2:4"},
                    {name:"Tau",        number:10, grid:"3:1"},
                    {name:"Shalulile",  number:8,  grid:"3:2"},
                    {name:"Dolly",      number:11, grid:"3:3"},
                    {name:"Mthembu",    number:7,  grid:"3:4"},
                    {name:"Manyama",    number:9,  grid:"4:1"},
                    {name:"Zwane",      number:17, grid:"4:2"},
                  ];

                  // Map sim events to FormationPitch event format
                  const liveEvents = simEvents.filter(e=>e.type!=="End").map(e=>({
                    type: e.type==="Sub" ? "Substitution" : e.type,
                    detail: e.detail,
                    team:{ name: e.side==="home" ? "Mexico" : "South Africa" },
                    player:{ name: e.type==="Sub" ? e.player : e.player },
                    assist:{ name: e.type==="Sub" ? e.off : null },
                  }));

                  return <FormationPitch
                    homeTeam="Mexico"    awayTeam="South Africa"
                    homeFormation="4-3-3" awayFormation="4-4-2"
                    homePlayers={mexStart} awayPlayers={saStart}
                    events={liveEvents}
                    homeFlag="🇲🇽" awayFlag="🇿🇦"
                  />;
                })()}

                {simMinute===0&&(
                  <div style={{textAlign:"center",padding:"20px",color:"#444",fontSize:12}}>
                    Press ▶ Start Simulation to see how the live tab works on June 11
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{fontSize:10,color:"#333",textAlign:"center",marginTop:16}}>
            Powered by API-Football · Tap 🔄 Refresh to update · Free plan: 100 requests/day
          </div>
        </div>}

        {/* ── CHAT ── */}
        {tab==="chat"&&(()=>{
          const sendMsg = async () => {
            const msg = chatInput.trim();
            if (!msg || chatSending) return;
            setChatSending(true);
            setChatInput("");
            // Optimistically add to UI immediately
            const optimistic = {
              id: `optimistic_${Date.now()}`,
              username: userName,
              message: msg,
              created_at: new Date().toISOString(),
            };
            setChatMessages(prev => [...prev, optimistic]);
            setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:'smooth'}), 50);
            await sbSendMessage(userName, msg, groupCode);
            setChatSending(false);
          };
          const handleKey = e => { if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMsg(); } };
          const formatTime = ts => {
            const d = new Date(ts);
            return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
          };
          const formatDate = ts => {
            const d = new Date(ts);
            const today = new Date();
            if(d.toDateString()===today.toDateString()) return "Today";
            return d.toLocaleDateString([],{month:'short',day:'numeric'});
          };

          // Group messages by date
          let lastDate = null;

          return(
            <div style={{display:"flex",flexDirection:"column",height:"calc(100dvh - 220px)",minHeight:360}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,
                  color:"#fcb900",margin:0}}>💬 Group Chat</h2>
                <div style={{fontSize:10,color:"#444"}}>
                  {leaderboard.length} players
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
                  <button onClick={()=>sbGetMessages(50, groupCode).then(msgs=>{console.log('[Chat reload]',msgs?.length,'msgs'); if(msgs?.length) setChatMessages(msgs);})} style={{
                    padding:"3px 8px",background:"rgba(255,255,255,0.06)",
                    border:"1px solid rgba(255,255,255,0.10)",borderRadius:6,
                    color:"#555",fontSize:10,cursor:"pointer",fontFamily:"inherit",
                  }}>🔄</button>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#22c55e"}}/>
                    <span style={{fontSize:10,color:"#22c55e"}}>Live</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div ref={chatScrollRef}
                style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",
                padding:"4px 0",scrollbarWidth:"thin"}}>
                {chatMessages.length===0&&(
                  <div style={{textAlign:"center",padding:"40px 20px",color:"#333"}}>
                    <div style={{fontSize:32,marginBottom:8}}>💬</div>
                    <div style={{fontSize:13,fontWeight:600,color:"#444"}}>No messages yet</div>
                    <div style={{fontSize:11,marginTop:4}}>Be the first to say something!</div>
                  </div>
                )}
                {chatMessages.map((msg,i)=>{
                  const isMe = msg.username === userName;
                  const isSystem = msg.username === '⚡';
                  const dateLabel = formatDate(msg.created_at);
                  const showDate = dateLabel !== lastDate;
                  lastDate = dateLabel;
                  const prevMsg = chatMessages[i-1];
                  const sameUser = prevMsg?.username===msg.username&&!showDate&&!isSystem;

                  // System messages (reactions echo) — centered, subtle
                  const isAI = msg.username === '🤖 AI';
                  if(isSystem||isAI) return(
                    <div key={msg.id||i} style={{margin:"8px 0"}}>
                      {showDate&&(
                        <div style={{textAlign:"center",margin:"12px 0 8px",
                          fontSize:10,color:"#333",
                          display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.15)"}}/>
                          {dateLabel}
                          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.15)"}}/>
                        </div>
                      )}
                      <div style={{
                        margin:"0 4px",padding:"10px 14px",borderRadius:12,
                        background:isAI
                          ?"rgba(139,92,246,0.08)"
                          :"rgba(252,185,0,0.06)",
                        border:`1px solid ${isAI?"rgba(139,92,246,0.25)":"rgba(252,185,0,0.2)"}`,
                      }}>
                        <div style={{
                          fontSize:10,fontWeight:700,marginBottom:6,
                          color:isAI?"#a78bfa":"#fcb900",
                          display:"flex",alignItems:"center",gap:5,
                        }}>
                          <span>{isAI?"🤖":"⚡"}</span>
                          <span>{isAI?"AI Recap":"Admin"}</span>
                          <span style={{fontWeight:400,color:"#333",marginLeft:"auto"}}>
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                        <div style={{
                          fontSize:12,color:"#ccc",lineHeight:1.6,
                          whiteSpace:"pre-wrap",wordBreak:"break-word",
                          maxHeight:200,overflowY:"auto",
                        }}>
                          {msg.message?.replace(/^🌅 Daily Recap\n/,"")}
                        </div>
                      </div>
                    </div>
                  );

                  return(
                    <div key={msg.id||i}>
                      {showDate&&(
                        <div style={{textAlign:"center",margin:"12px 0 8px",
                          fontSize:10,color:"#333",
                          display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.15)"}}/>
                          {dateLabel}
                          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.15)"}}/>
                        </div>
                      )}
                      <div style={{
                        display:"flex",flexDirection:"column",
                        alignItems:isMe?"flex-end":"flex-start",
                        marginBottom:sameUser?3:10,
                        paddingLeft:isMe?40:0,
                        paddingRight:isMe?0:40,
                      }}>
                        {!sameUser&&(
                          <div style={{fontSize:10,color:"#555",marginBottom:3,
                            paddingLeft:isMe?0:4,paddingRight:isMe?4:0}}>
                            {isMe?"You":msg.username}
                          </div>
                        )}
                        <div style={{display:"flex",alignItems:"flex-end",gap:6,flexDirection:isMe?"row-reverse":"row"}}>
                          <div style={{
                            maxWidth:"85%",padding:"8px 12px",borderRadius:12,
                            borderBottomRightRadius:isMe?2:12,
                            borderBottomLeftRadius:isMe?12:2,
                            background:isMe
                              ?"linear-gradient(135deg,rgba(252,185,0,0.25),rgba(252,185,0,0.15))"
                              :"rgba(255,255,255,0.06)",
                            border:isMe
                              ?"1px solid rgba(252,185,0,0.3)"
                              :"1px solid rgba(255,255,255,0.10)",
                            wordBreak:"break-word",
                          }}>
                            <div style={{fontSize:13,color:isMe?"#fcb900":"#ddd",lineHeight:1.5}}>
                              {msg.message?.startsWith('🎙__VOICE__')
                                ? <VoiceClip url={msg.message.slice('🎙__VOICE__'.length)} />
                                : msg.message}
                            </div>
                            <div style={{fontSize:10,color:"#444",marginTop:3,textAlign:"right"}}>
                              {formatTime(msg.created_at)}
                            </div>
                          </div>
                          {(isMe||adminMode)&&msg.id&&(
                            <button onClick={async(e)=>{
                              e.stopPropagation();
                                              await sbDeleteMessage(msg.id);
                                              setChatMessages(prev=>prev.filter(m=>m.id!==msg.id));
                            }} style={{
                              padding:"3px 6px",background:"transparent",border:"none",
                              color:"#555",fontSize:12,cursor:"pointer",
                              opacity:0.6,flexShrink:0,
                            }}>🗑</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef}/>
              </div>

              {/* Input */}
              <div style={{paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)",
                position:"sticky",bottom:0,background:"#0a0d12",paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
                <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                  <textarea
                    value={chatInput}
                    onChange={e=>setChatInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Say something… (Enter to send)"
                    rows={1}
                    style={{
                      flex:1,padding:"10px 14px",
                      background:"rgba(255,255,255,0.06)",
                      border:"1px solid rgba(255,255,255,0.12)",
                      borderRadius:12,color:"#fff",fontSize:13,
                      fontFamily:"inherit",outline:"none",
                      resize:"none",lineHeight:1.5,maxHeight:100,
                      overflowY:"auto",
                    }}
                  />
                  {/* 🎙 Voice clip button */}
                  <button onClick={async()=>{
                    if(isRecording){
                      mediaRecorder?.stop();
                      setIsRecording(false);
                    } else {
                      try {
                        const stream=await navigator.mediaDevices.getUserMedia({audio:{sampleRate:16000,channelCount:1}});
                        // Pick smallest supported format
                        const mimeType=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4']
                          .find(t=>MediaRecorder.isTypeSupported(t)) || 'audio/webm';
                        const mr=new MediaRecorder(stream,{mimeType, audioBitsPerSecond:16000});
                        audioChunksRef.current=[];
                        mr.ondataavailable=e=>{if(e.data.size>0) audioChunksRef.current.push(e.data);};
                        mr.onstop=async()=>{
                          stream.getTracks().forEach(t=>t.stop());
                          const blob=new Blob(audioChunksRef.current,{type:mimeType});
                          if(blob.size<500){ alert('Recording too short — try again'); return; }
                          if(blob.size>200000){ alert('Recording too long — keep it under 5 seconds'); return; }
                          const reader=new FileReader();
                          reader.onload=async()=>{
                            try {
                              await sbSendMessage(userName,`🎙__VOICE__${reader.result}`,groupCode);
                            } catch(e){ alert('Failed to send voice clip: '+e.message); }
                          };
                          reader.onerror=()=>alert('Failed to read audio');
                          reader.readAsDataURL(blob);
                        };
                        mr.start(100); // collect in 100ms chunks
                        setMediaRecorder(mr);
                        setIsRecording(true);
                        // Auto-stop after 5s
                        setTimeout(()=>{if(mr.state==='recording'){mr.stop();setIsRecording(false);}},5000);
                      } catch(e){
                        if(e.name==='NotAllowedError') alert('Microphone access denied — please allow mic access in your browser settings');
                        else alert('Recording error: '+e.message);
                      }
                    }
                  }} style={{
                    padding:"10px 12px",flexShrink:0,
                    background:isRecording?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.06)",
                    border:`1px solid ${isRecording?"rgba(239,68,68,0.5)":"rgba(255,255,255,0.12)"}`,
                    borderRadius:12,color:isRecording?"#ef4444":"#555",
                    fontSize:16,cursor:"pointer",
                  }} title={isRecording?"Stop (5s max)":"Record voice clip"}>
                    {isRecording?"⏹":"🎙"}
                  </button>
                  <button onClick={sendMsg} disabled={!chatInput.trim()||chatSending} style={{
                    padding:"10px 16px",
                    background:chatInput.trim()?"#fcb900":"rgba(255,255,255,0.06)",
                    border:"none",borderRadius:12,
                    color:chatInput.trim()?"#000":"#333",
                    fontWeight:700,fontSize:13,cursor:chatInput.trim()?"pointer":"default",
                    fontFamily:"inherit",flexShrink:0,transition:"all 0.2s",
                  }}>
                    {chatSending?"…":"Send"}
                  </button>
                </div>
                <div style={{fontSize:10,color:"#333",marginTop:5,textAlign:"center"}}>
                  Messages visible to all players · Enter to send
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── NEWS ── */}
        {tab==="news"&&(()=>{
          const CATEGORY_COLORS = {
            "Injury":"#ef4444", "Team News":"#fcb900", "Match Preview":"#60a5fa",
            "Match Report":"#22c55e", "Analysis":"#a78bfa", "Transfer":"#fb923c",
            "Standings":"#4ade80", "General":"#555",
          };
          const timeAgo = ts => {
            if(!ts) return "";
            const mins = Math.round((Date.now()-new Date(ts))/60000);
            if(mins<1) return "just now";
            if(mins<60) return `${mins}m ago`;
            const hrs = Math.round(mins/60);
            if(hrs<24) return `${hrs}h ago`;
            return `${Math.round(hrs/24)}d ago`;
          };
          const cooldownLabel = newsCooldown>=3600 ? `${Math.floor(newsCooldown/3600)}h ${Math.floor((newsCooldown%3600)/60)}m` : `${Math.ceil(newsCooldown/60)}m`;
          return(
            <div>
              {/* ⚽ Top Scorer Tracker */}
              {(()=>{
                const myPick = podium?.topScorer;
                const normS = s => {
                  if(!s) return '';
                  const cleaned = s.trim().replace(/\b(jr|sr|ii|iii)\.?$/i,'').trim();
                  const last = cleaned.split(/\s+/).pop()||cleaned;
                  return last.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
                };
                const editDist = (a,b) => {
                  const m=a.length,n=b.length;
                  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i||j));
                  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
                    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
                  return dp[m][n];
                };
                const isMyPick = (name) => {
                  if(!myPick) return false;
                  const a = normS(myPick), b = normS(name);
                  return a===b || (a.length>=4&&b.length>=4&&editDist(a,b)<=2);
                };
                return(
                  <div style={{marginBottom:18,borderRadius:10,overflow:"hidden",
                    border:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.02)"}}>
                    <div style={{padding:"10px 12px 8px",borderBottom:"1px solid rgba(255,255,255,0.06)",
                      display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#fcb900",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>
                        ⚽ Top Scorers
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {myPick&&<div style={{fontSize:10,color:"#555"}}>Your pick: <span style={{color:"#60a5fa"}}>{myPick}</span></div>}
                        <button onClick={()=>{
                          setScorersLoading(true);
                          fetch('/api/live?type=topscorers')
                            .then(r=>r.json())
                            .then(d=>{ setTopScorers(d.response||[]); setScorersLoading(false); })
                            .catch(()=>setScorersLoading(false));
                        }} style={{
                          padding:"2px 8px",borderRadius:5,fontSize:10,
                          background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                          color:"#555",cursor:"pointer",fontFamily:"inherit",
                        }}>🔄</button>
                      </div>
                    </div>
                    {scorersLoading&&(
                      <div style={{padding:"12px",fontSize:11,color:"#555",textAlign:"center"}}>Loading…</div>
                    )}
                    {!scorersLoading&&topScorers&&topScorers.length===0&&(
                      <div style={{padding:"12px",fontSize:11,color:"#555",textAlign:"center"}}>
                        No data yet — this endpoint may require a higher API plan. Check back after more matches.
                      </div>
                    )}
                    {!scorersLoading&&topScorers&&topScorers.slice(0,12).map((item,i)=>{
                      const p = item.player;
                      const s = item.statistics?.[0];
                      const goals = s?.goals?.total||0;
                      const assists = s?.goals?.assists||0;
                      const team = s?.team?.name||'';
                      const displayName = p?.name || '';
                      const mine = isMyPick(p?.name||'') || isMyPick(p?.firstname+' '+p?.lastname);
                      return(
                        <div key={p?.id||i} style={{
                          display:"flex",alignItems:"center",gap:10,
                          padding:"8px 12px",
                          borderBottom:i<7?"1px solid rgba(255,255,255,0.04)":"none",
                          background:mine?"rgba(96,165,250,0.06)":"transparent",
                        }}>
                          <div style={{fontSize:11,color:"#555",width:16,textAlign:"center",flexShrink:0}}>
                            {i+1}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:mine?700:500,
                              color:mine?"#60a5fa":"#ddd",
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {mine&&"⭐ "}{p?.name}
                            </div>
                            <div style={{fontSize:10,color:"#555"}}>{FLAGS[team]||""} {team}</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:16,fontWeight:700,color:mine?"#60a5fa":"#fcb900",lineHeight:1}}>{goals}</div>
                            <div style={{fontSize:9,color:"#555"}}>{assists} ast</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Header */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,
                  color:"#fcb900",margin:0}}>📰 WC2026 News</h2>
                <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
                  {newsUpdatedAt&&(
                    <span style={{fontSize:10,color:"#444"}}>
                      {newsUpdatedBy&&`by ${newsUpdatedBy} · `}{timeAgo(newsUpdatedAt)}
                    </span>
                  )}
                  <button onClick={fetchNews}
                    disabled={newsFetching||newsCooldown>0}
                    style={{
                      padding:"6px 14px",borderRadius:8,fontFamily:"inherit",fontWeight:700,
                      fontSize:12,cursor:newsFetching||newsCooldown>0?"not-allowed":"pointer",
                      background:newsFetching||newsCooldown>0?"rgba(255,255,255,0.04)":"rgba(96,165,250,0.12)",
                      border:`1px solid ${newsFetching||newsCooldown>0?"rgba(255,255,255,0.06)":"rgba(96,165,250,0.3)"}`,
                      color:newsFetching||newsCooldown>0?"#444":"#60a5fa",
                    }}>
                    {newsFetching?"⏳ Fetching…":newsCooldown>0?`🔄 ${cooldownLabel}`:"🔄 Refresh"}
                  </button>
                </div>
              </div>

              {/* Error state */}
              {newsError&&(
                <div style={{marginBottom:12,padding:"10px 14px",borderRadius:8,
                  background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",
                  fontSize:11,color:"#fca5a5"}}>
                  ⚠️ {newsError}
                </div>
              )}

              {/* Empty state */}
              {newsStories.length===0&&!newsFetching&&(
                <div style={{textAlign:"center",padding:"48px 20px"}}>
                  <div style={{fontSize:40,marginBottom:12}}>📰</div>
                  <div style={{fontSize:14,fontWeight:600,color:"#555",marginBottom:8}}>
                    No news yet
                  </div>
                  <div style={{fontSize:12,color:"#444",marginBottom:20}}>
                    Tap Refresh to fetch the latest World Cup 2026 news
                  </div>
                  <button onClick={fetchNews} style={{
                    padding:"10px 24px",borderRadius:8,fontFamily:"inherit",fontWeight:700,
                    fontSize:13,cursor:"pointer",
                    background:"rgba(96,165,250,0.12)",border:"1px solid rgba(96,165,250,0.3)",
                    color:"#60a5fa",
                  }}>🔄 Get Latest News</button>
                </div>
              )}

              {/* Loading state */}
              {newsFetching&&newsStories.length===0&&(
                <div style={{textAlign:"center",padding:"48px 20px",color:"#444"}}>
                  <div style={{fontSize:32,marginBottom:12}}>⏳</div>
                  <div style={{fontSize:12}}>Searching for latest WC2026 news…</div>
                </div>
              )}

              {/* News cards */}
              {newsStories.map((story,i)=>{
                const catColor = CATEGORY_COLORS[story.category]||"#555";
                return(
                  <div key={i} style={{
                    marginBottom:10,padding:"12px 14px",borderRadius:10,
                    background:"rgba(255,255,255,0.03)",
                    border:`1px solid rgba(255,255,255,0.06)`,
                    borderLeft:`3px solid ${catColor}`,
                  }}>
                    {/* Category + urgent badge */}
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                      <span style={{fontSize:10,fontWeight:700,color:catColor,
                        background:`${catColor}18`,borderRadius:4,padding:"2px 7px"}}>
                        {story.category}
                      </span>
                      {story.urgent&&(
                        <span style={{fontSize:10,fontWeight:700,color:"#ef4444",
                          background:"rgba(239,68,68,0.12)",borderRadius:4,padding:"2px 7px",
                          animation:"pulse 1.5s infinite"}}>
                          🔴 Breaking
                        </span>
                      )}
                      {story.team&&story.team!=="General"&&(
                        <span style={{fontSize:10,color:"#555",marginLeft:"auto"}}>
                          🏳️ {story.team}
                        </span>
                      )}
                    </div>
                    {/* Headline */}
                    <div style={{fontSize:13,fontWeight:700,color:"#ddd",marginBottom:6,lineHeight:1.4}}>
                      {story.headline}
                    </div>
                    {/* Summary — strip citation tags from AI output */}
                    <div style={{fontSize:11,color:"#666",lineHeight:1.6}}>
                      {(story.summary||'').replace(/<cite[^>]*>(.*?)<\/cite>/gs,'$1').replace(/<[^>]+>/g,'').trim()}
                    </div>
                    {/* Source */}
                    {story.source&&(
                      <div style={{fontSize:10,color:"#444",marginTop:6,fontStyle:"italic"}}>
                        — {story.source}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Attribution */}
              {newsStories.length>0&&(
                <div style={{fontSize:10,color:"#333",textAlign:"center",marginTop:8,paddingTop:8,
                  borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                  Stories fetched by Claude Sonnet via web search · {timeAgo(newsUpdatedAt)}
                  {newsCooldown>0&&` · Next refresh in ${cooldownLabel}`}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── AI ── */}
        {tab==="ai"&&<div>
          <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#a78bfa",marginTop:0}}>
            🤖 AI Features
          </h2>

          {/* ── Feature 1: Tournament Bracket ── */}
          <div style={{marginBottom:28}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:"#a78bfa",letterSpacing:1,marginBottom:4}}>
              🏆 Tournament Bracket Predictor
            </div>
            <div style={{fontSize:11,color:"#555",marginBottom:12,lineHeight:1.6}}>
              Claude predicts the full World Cup 2026 bracket — group winners, knockout rounds, and the champion. Compare with your own picks!
            </div>
            <button onClick={generateBracket} disabled={bracketLoading} style={{
              width:"100%",padding:"12px",
              background:bracketLoading?"rgba(139,92,246,0.05)":"rgba(139,92,246,0.12)",
              border:"1px solid rgba(139,92,246,0.3)",borderRadius:10,
              color:"#a78bfa",fontSize:13,fontWeight:700,
              cursor:bracketLoading?"wait":"pointer",fontFamily:"inherit",
            }}>{bracketLoading?"⏳ Predicting tournament…":bracketPred?"🔄 Regenerate AI Bracket":"🔮 Generate AI Tournament Prediction"}</button>
            {bracketError&&<div style={{fontSize:11,color:"#ef4444",marginTop:6,padding:"6px 10px",background:"rgba(239,68,68,0.08)",borderRadius:6}}>❌ {bracketError}</div>}

            {/* Live update button — always visible, grayed out until matches played */}
            {(()=>{
              const playedCount = actualMatches.filter(m=>m.homeScore!==null).length;
              const hasResults = playedCount > 0;
              return(
                <button
                  onClick={hasResults ? generateBayesianUpdate : undefined}
                  disabled={bayesianLoading || !hasResults}
                  style={{
                    width:"100%",padding:"11px",borderRadius:10,
                    cursor:bayesianLoading?"wait":hasResults?"pointer":"default",
                    background:bayesianLoading
                      ?"rgba(16,185,129,0.15)"
                      :hasResults
                      ?"rgba(16,185,129,0.1)"
                      :"rgba(255,255,255,0.03)",
                    border:`1px solid ${hasResults?"rgba(16,185,129,0.3)":"rgba(255,255,255,0.08)"}`,
                    color:hasResults?"#6ee7b7":"#444",
                    fontWeight:700,fontSize:13,fontFamily:"inherit",marginTop:8,
                    opacity:bayesianLoading?0.7:1,
                  }}>
                  {bayesianLoading
                    ? "⏳ Refreshing predictions…"
                    : hasResults
                    ? `🔁 Refresh Predictions (${playedCount} result${playedCount!==1?'s':''} in)`
                    : "🔁 Refresh Predictions — available after kickoff"}
                </button>
              );
            })()}

            {/* Bayesian results */}
            {bayesianPred&&!bayesianLoading&&(
              <div style={{marginTop:12,padding:"14px",background:"rgba(16,185,129,0.06)",
                border:"1px solid rgba(16,185,129,0.2)",borderRadius:10}}>
                <div style={{fontSize:11,color:"#6ee7b7",fontWeight:700,marginBottom:8}}>
                  🧮 Bayesian Updated Predictions
                  <span style={{color:"#444",fontWeight:400,marginLeft:6}}>{bayesianPred.matchesProcessed} matches processed</span>
                </div>
                {bayesianPred.keyInsight&&(
                  <div style={{fontSize:12,color:"#888",lineHeight:1.6,marginBottom:10,fontStyle:"italic"}}>
                    {bayesianPred.keyInsight}
                  </div>
                )}
                {(bayesianPred.biggestRiser||bayesianPred.biggestFaller)&&(
                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    {bayesianPred.biggestRiser&&(
                      <div style={{flex:1,padding:"8px 10px",background:"rgba(34,197,94,0.1)",
                        border:"1px solid rgba(34,197,94,0.25)",borderRadius:8,fontSize:11}}>
                        <div style={{color:"#22c55e",fontWeight:700,marginBottom:2}}>📈 Biggest riser</div>
                        <div style={{color:"#ddd"}}>{FLAGS[bayesianPred.biggestRiser]||"🏳️"} {bayesianPred.biggestRiser}</div>
                      </div>
                    )}
                    {bayesianPred.biggestFaller&&(
                      <div style={{flex:1,padding:"8px 10px",background:"rgba(239,68,68,0.08)",
                        border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,fontSize:11}}>
                        <div style={{color:"#ef4444",fontWeight:700,marginBottom:2}}>📉 Biggest faller</div>
                        <div style={{color:"#ddd"}}>{FLAGS[bayesianPred.biggestFaller]||"🏳️"} {bayesianPred.biggestFaller}</div>
                      </div>
                    )}
                  </div>
                )}
                {bayesianPred.updatedProbs?.length>0&&(
                  <div>
                    <div style={{fontSize:10,color:"#444",marginBottom:6}}>Updated championship odds vs prior</div>
                    <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,overflow:"hidden"}}>
                      <div style={{display:"grid",gridTemplateColumns:"18px 1fr 44px 44px 40px",gap:4,
                        padding:"5px 10px",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:10,color:"#444"}}>
                        <span>#</span><span>Team</span>
                        <span style={{textAlign:"right"}}>Now</span>
                        <span style={{textAlign:"right"}}>Prior</span>
                        <span style={{textAlign:"right"}}>Elo</span>
                      </div>
                      {bayesianPred.updatedProbs.slice(0,8).map((d,i)=>{
                        const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":"";
                        return(
                          <div key={i} style={{display:"grid",gridTemplateColumns:"18px 1fr 44px 44px 40px",gap:4,
                            padding:"5px 10px",borderBottom:"1px solid rgba(255,255,255,0.03)",
                            background:i===0?"rgba(16,185,129,0.05)":undefined}}>
                            <span style={{fontSize:11}}>{medal||i+1}</span>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <span style={{fontSize:12}}>{FLAGS[d.team]||"🏳️"}</span>
                              <span style={{fontSize:11,color:i===0?"#6ee7b7":"#ddd"}}>{d.team}</span>
                            </div>
                            <span style={{fontSize:11,textAlign:"right",color:i===0?"#6ee7b7":"#888",fontWeight:i===0?700:400}}>{d.prob}%</span>
                            <span style={{fontSize:11,textAlign:"right",color:"#555"}}>{d.priorProb}%</span>
                            <span style={{fontSize:10,textAlign:"right",
                              color:d.eloChange>0?"#22c55e":d.eloChange<0?"#ef4444":"#555"}}>
                              {d.eloChange>0?"+":""}{d.eloChange}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{fontSize:10,color:"#333",marginTop:4}}>
                      Elo Δ = rating change from results · Now vs Prior = probability shift
                    </div>
                  </div>
                )}
              </div>
            )}
            {bracketGeneratedBy&&!bracketLoading&&(
              <div style={{fontSize:10,color:"#444",textAlign:"center",marginTop:5}}>
                Generated by <strong style={{color:"#6d5a9c"}}>{bracketGeneratedBy}</strong> · visible to all players
              </div>
            )}

            {bracketPred&&(
              <div style={{marginTop:14,background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:10,padding:"14px"}}>
                {/* Champion */}
                <div style={{textAlign:"center",marginBottom:16,padding:"14px",
                  background:"rgba(252,185,0,0.08)",border:"1px solid rgba(252,185,0,0.25)",borderRadius:10}}>
                  <div style={{fontSize:10,color:"#555",marginBottom:4}}>🤖 AI Predicts World Cup 2026 Winner</div>
                  <div style={{fontSize:36}}>{FLAGS[bracketPred.champion]||"🏳️"}</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:"#fcb900",letterSpacing:1}}>{bracketPred.champion}</div>
                  <div style={{fontSize:11,color:"#888",marginTop:6,fontStyle:"italic",lineHeight:1.5}}>{bracketPred.reasoning}</div>
                </div>

                {/* Methodology & convergence — collapsible */}
                <BracketMethodology bracketPred={bracketPred} bayesianPred={bayesianPred} />

                {/* Podium */}
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  {[
                    {label:"🥇 Champion",team:bracketPred.champion,color:"#f59e0b"},
                    {label:"🥈 Runner-up",team:bracketPred.runnerUp,color:"#c0c0c0"},
                    {label:"🥉 3rd Place",team:bracketPred.thirdPlace,color:"#cd7f32"},
                  ].map((p,i)=>(
                    <div key={i} style={{flex:1,textAlign:"center",
                      background:`${p.color}10`,border:`1px solid ${p.color}30`,
                      borderRadius:8,padding:"8px 4px"}}>
                      <div style={{fontSize:10,color:p.color,marginBottom:3}}>{p.label}</div>
                      <div style={{fontSize:18}}>{FLAGS[p.team]||"🏳️"}</div>
                      <div style={{fontSize:10,fontWeight:700,marginTop:2}}>{p.team}</div>
                    </div>
                  ))}
                </div>

                {/* Group winners + runners-up */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:"#555",marginBottom:6,fontWeight:700}}>Group Stage Results</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                    {Object.entries(bracketPred.groupWinners||{}).map(([g,t])=>{
                      const ru = bracketPred.groupRunnersUp?.[g];
                      return(
                        <div key={g} style={{padding:"6px 8px",background:"rgba(255,255,255,0.03)",
                          border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,fontSize:11}}>
                          <div style={{color:"#555",fontSize:10,marginBottom:3,letterSpacing:0.5}}>GROUP {g}</div>
                          <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                            <span style={{fontSize:9,color:"#fcb900",fontWeight:700}}>1st</span>
                            <span>{FLAGS[t]||"🏳️"}</span>
                            <span style={{fontWeight:600}}>{t}</span>
                          </div>
                          {ru&&<div style={{display:"flex",alignItems:"center",gap:4}}>
                            <span style={{fontSize:9,color:"#888"}}>2nd</span>
                            <span style={{fontSize:12}}>{FLAGS[ru]||"🏳️"}</span>
                            <span style={{color:"#888"}}>{ru}</span>
                          </div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Semi-finalists */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:"#555",marginBottom:6,fontWeight:700}}>Semi-Finalists</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {(bracketPred.semiFinalists||[]).map((t,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:4,
                        padding:"4px 10px",background:"rgba(255,255,255,0.06)",
                        border:"1px solid rgba(255,255,255,0.10)",borderRadius:6,fontSize:11}}>
                        <span>{FLAGS[t]||"🏳️"}</span><span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top scorer */}
                {bracketPred.topScorer&&(
                  <div style={{marginBottom:12,padding:"8px 12px",
                    background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:8}}>
                    <div style={{fontSize:10,color:"#60a5fa",marginBottom:2}}>⚽ Predicted Top Scorer</div>
                    <div style={{fontSize:13,fontWeight:700,color:"#93c5fd"}}>{bracketPred.topScorer}</div>
                  </div>
                )}

                {/* Full probability table */}
                {bracketPred.simulationData&&bracketPred.simulationData.length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,color:"#555",marginBottom:8,fontWeight:700}}>
                      📊 Championship Probability Table
                      <span style={{fontWeight:400,color:"#333",marginLeft:6}}>5,000 simulations</span>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,overflow:"hidden"}}>
                      {/* Header */}
                      <div style={{display:"grid",gridTemplateColumns:"20px 1fr 52px 52px",gap:6,
                        padding:"6px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",
                        fontSize:10,color:"#444"}}>
                        <span>#</span>
                        <span>Team</span>
                        <span style={{textAlign:"right"}}>Win %</span>
                        <span style={{textAlign:"right"}}>Final %</span>
                      </div>
                      {bracketPred.simulationData.map((d,i)=>{
                        const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":"";
                        const isChamp = d.team===bracketPred.champion;
                        return(
                          <div key={i} style={{display:"grid",gridTemplateColumns:"20px 1fr 52px 52px",gap:6,
                            padding:"5px 10px",
                            borderBottom:i<bracketPred.simulationData.length-1?"1px solid rgba(255,255,255,0.04)":undefined,
                            background:isChamp?"rgba(252,185,0,0.05)":undefined}}>
                            <span style={{fontSize:11,color:"#444"}}>{medal||i+1}</span>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <span style={{fontSize:12}}>{FLAGS[d.team]||"🏳️"}</span>
                              <span style={{fontSize:11,color:isChamp?"#fcb900":"#ddd",fontWeight:isChamp?700:400}}>{d.team}</span>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <span style={{fontSize:11,color:isChamp?"#fcb900":"#888",fontWeight:isChamp?700:400}}>
                                {d.prob}%
                              </span>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <span style={{fontSize:11,color:"#555"}}>{d.finalProb}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{fontSize:10,color:"#333",marginTop:4}}>
                      Win % = champion in X/5000 runs · Final % = reached final
                    </div>
                  </div>
                )}

                {/* How yours compares */}
                {(podium?.first||podium?.second||podium?.third)&&(()=>{
                  const match1 = podium.first===bracketPred.champion;
                  const match2 = podium.second===bracketPred.runnerUp;
                  const match3 = podium.third===bracketPred.thirdPlace;
                  const matches = [match1,match2,match3].filter(Boolean).length;
                  return(
                    <div style={{marginTop:12,padding:"10px 12px",
                      background:matches>0?"rgba(34,197,94,0.06)":"rgba(255,255,255,0.03)",
                      border:`1px solid ${matches>0?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.06)"}`,
                      borderRadius:8,fontSize:11}}>
                      <div style={{fontWeight:700,color:matches>0?"#22c55e":"#555",marginBottom:4}}>
                        {matches===3?"🎯 Perfect match with AI!":matches>0?`✅ ${matches}/3 picks match AI`:"> Your picks differ from AI"}
                      </div>
                      <div style={{color:"#555"}}>
                        🥇 You: {podium.first||"?"} {match1?"✓":"✗"} AI: {bracketPred.champion}<br/>
                        🥈 You: {podium.second||"?"} {match2?"✓":"✗"} AI: {bracketPred.runnerUp}<br/>
                        🥉 You: {podium.third||"?"} {match3?"✓":"✗"} AI: {bracketPred.thirdPlace}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:24}}/>

          {/* ── Feature 2: Leaderboard Commentary ── */}
          <div style={{marginBottom:28}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:"#a78bfa",letterSpacing:1,marginBottom:4}}>
              🎙️ AI Pundit Commentary
            </div>
            <div style={{fontSize:11,color:"#555",marginBottom:12,lineHeight:1.6}}>
              Claude gives its take on the current standings — who's flying, who's struggling, and who picked wisely.
            </div>
            {(()=>{
              const SIX_HOURS = 6 * 60 * 60 * 1000;
              const lastGen = commentaryGeneratedAt ? new Date(commentaryGeneratedAt).getTime() : 0;
              const msSince = Date.now() - lastGen;
              const onCooldown = msSince < SIX_HOURS && lastGen > 0;
              const hoursLeft = onCooldown ? Math.ceil((SIX_HOURS - msSince) / 3600000) : 0;
              const isDisabled = commentaryLoading || leaderboard.length===0 || onCooldown;
              return(
                <button onClick={generateCommentary} disabled={isDisabled} style={{
                  width:"100%",padding:"12px",
                  background:isDisabled?"rgba(139,92,246,0.05)":"rgba(139,92,246,0.12)",
                  border:"1px solid rgba(139,92,246,0.3)",borderRadius:10,
                  color:isDisabled?"#444":"#a78bfa",fontSize:13,fontWeight:700,
                  cursor:isDisabled?"not-allowed":"pointer",fontFamily:"inherit",
                  opacity:leaderboard.length===0?0.4:1,
                }}>
                  {commentaryLoading?"⏳ Writing commentary…":onCooldown?`⏱ ${hoursLeft}h cooldown`:commentary?"🔄 Refresh Commentary":"🎙️ Generate Leaderboard Commentary"}
                </button>
              );
            })()}
            {commentaryGeneratedBy&&!commentaryLoading&&(
              <div style={{fontSize:10,color:"#444",textAlign:"center",marginTop:5}}>
                Generated by <strong style={{color:"#6d5a9c"}}>{commentaryGeneratedBy}</strong> · visible to all players
              </div>
            )}

            {leaderboard.length===0&&(
              <div style={{fontSize:11,color:"#444",marginTop:6,textAlign:"center"}}>
                Needs at least one player on the leaderboard
              </div>
            )}

            {commentary&&(
              <div style={{marginTop:12,padding:"14px 16px",
                background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)",
                borderRadius:10,fontSize:13,color:"#c4b5fd",lineHeight:1.8,fontStyle:"italic"}}>
                "{commentary}"
              </div>
            )}
          </div>

          <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:24}}/>

          {/* ── Feature 3: What-If Calculator ── */}
          <div style={{marginBottom:20}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:"#a78bfa",letterSpacing:1,marginBottom:4}}>
              🔮 What-If Calculator
            </div>
            <div style={{fontSize:11,color:"#555",marginBottom:12,lineHeight:1.6}}>
              See how the leaderboard changes if a specific team wins, finishes 2nd, or 3rd.
            </div>

            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <select value={whatIfTeam} onChange={e=>setWhatIfTeam(e.target.value)} style={{
                flex:2,padding:"10px 12px",background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(139,92,246,0.25)",borderRadius:8,
                color:whatIfTeam?"#fff":"#555",fontSize:12,fontFamily:"inherit",outline:"none",
              }}>
                <option value="">Select a team…</option>
                {Object.values(GROUPS).flat().map(t=>(
                  <option key={t} value={t}>{FLAGS[t]||"🏳️"} {t}</option>
                ))}
              </select>
              <select value={whatIfPlace} onChange={e=>setWhatIfPlace(e.target.value)} style={{
                flex:1,padding:"10px 12px",background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(139,92,246,0.25)",borderRadius:8,
                color:"#fff",fontSize:12,fontFamily:"inherit",outline:"none",
              }}>
                <option value="first">🥇 Wins WC</option>
                <option value="second">🥈 Runner-up</option>
                <option value="third">🥉 3rd Place</option>
              </select>
            </div>

            <button onClick={calculateWhatIf} disabled={!whatIfTeam||whatIfLoading} style={{
              width:"100%",padding:"12px",
              background:!whatIfTeam||whatIfLoading?"rgba(139,92,246,0.05)":"rgba(139,92,246,0.12)",
              border:"1px solid rgba(139,92,246,0.3)",borderRadius:10,
              color:"#a78bfa",fontSize:13,fontWeight:700,
              cursor:!whatIfTeam||whatIfLoading?"not-allowed":"pointer",fontFamily:"inherit",
              opacity:!whatIfTeam?0.4:1,
            }}>{whatIfLoading?"⏳ Calculating…":"🔮 Calculate What-If"}</button>

            {whatIfResult&&(
              <div style={{marginTop:12,background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:10,padding:"14px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#a78bfa",marginBottom:8}}>
                  {whatIfResult.scenario}
                </div>

                {/* Points gained */}
                {(whatIfResult.pointsGained||[]).filter(e=>e.gained>0).length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:"#555",marginBottom:6}}>Who benefits:</div>
                    {(whatIfResult.pointsGained||[]).filter(e=>e.gained>0).sort((a,b)=>b.gained-a.gained).map((e,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                        padding:"6px 10px",marginBottom:4,borderRadius:6,
                        background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.15)"}}>
                        <span style={{fontSize:11,flex:1,fontWeight:600}}>{e.username}</span>
                        <span style={{color:"#22c55e",fontFamily:"'Bebas Neue',sans-serif",fontSize:15}}>+{e.gained}pts</span>
                        <span style={{fontSize:10,color:"#555"}}>→ {e.newTotal}pts (#{e.newRank})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {whatIfResult.biggestWinner&&(
                  <div style={{fontSize:11,color:"#888",lineHeight:1.6,
                    borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:10,marginTop:4}}>
                    🏆 Biggest winner: <strong style={{color:"#22c55e"}}>{whatIfResult.biggestWinner}</strong>
                    {whatIfResult.biggestLoser&&<span> · 📉 Falls: <strong style={{color:"#ef4444"}}>{whatIfResult.biggestLoser}</strong></span>}
                  </div>
                )}

                {whatIfResult.commentary&&(
                  <div style={{fontSize:12,color:"#c4b5fd",fontStyle:"italic",lineHeight:1.6,
                    marginTop:10,padding:"10px 12px",background:"rgba(139,92,246,0.05)",
                    border:"1px solid rgba(139,92,246,0.1)",borderRadius:8}}>
                    "{whatIfResult.commentary}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>}

        {/* ── ADMIN ── */}
        {tab==="admin"&&<div>
          <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#fcb900",marginTop:0}}>
            Admin Panel
          </h2>
          {/* Load prediction counts for all users — only once when admin opens */}
          {adminMode&&(()=>{
            if(leaderboard.length>0 && Object.keys(predCounts).length===0){
              sbGetAllPredictions(groupCode).then(allPreds=>{
                const counts={};
                const data={};
                allPreds.forEach(p=>{
                  counts[p.username]=(p.matches||[]).filter(m=>m.homeScore!==null&&m.awayScore!==null).length;
                  data[p.username]={ matches: p.matches||[], podium: p.podium||null };
                });
                setPredCounts(counts);
                setAllPredData(data);
              });
            }
            return null;
          })()}

          {/* PIN gate */}
          {!adminMode?(
            <div style={{maxWidth:380}}>
              <p style={{color:"#666",fontSize:13,marginTop:0}}>
                Enter the admin PIN to enter match results. Only one person needs to do this — everyone's scores update automatically when you save.
              </p>
              <div style={{display:"flex",gap:9}}>
                <input type="password" placeholder="Admin PIN…" value={adminPinInput}
                  onChange={e=>{setAdminPinInput(e.target.value);setAdminPinError("");}}
                  onKeyDown={e=>e.key==="Enter"&&(adminPinInput===ADMIN_PIN?(setAdminMode(true),setAdminPinInput(""),setAdminPinError("")):(setAdminPinError("Wrong PIN"),setAdminPinInput("")))}
                  style={{flex:1,padding:"11px 14px",background:"rgba(255,255,255,0.06)",
                    border:"1px solid rgba(255,255,255,0.10)",borderRadius:8,
                    color:"#fff",fontSize:14,fontFamily:"inherit",outline:"none"}}/>
                <button onClick={()=>{
                  if(adminPinInput===ADMIN_PIN){setAdminMode(true);setAdminPinInput("");setAdminPinError("");}
                  else{setAdminPinError("Wrong PIN");setAdminPinInput("");}
                }} style={{padding:"11px 20px",background:"#fcb900",border:"none",borderRadius:8,
                  color:"#000",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                  Unlock
                </button>
              </div>
              {adminPinError&&<div style={{color:"#ef4444",fontSize:12,marginTop:8}}>{adminPinError}</div>}
            </div>
          ):(
            <div>
              {/* Action bar */}
              <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:10,marginBottom:10}}>
                <button onClick={adminSaveWithConfirm} style={{
                  padding:"10px 24px",background:adminSaved?"#22c55e":"#fcb900",
                  border:"none",borderRadius:8,color:"#000",fontWeight:700,
                  fontSize:13,cursor:"pointer",fontFamily:"inherit",transition:"all 0.3s",
                }}>{adminSaved?"✓ Saved & scores updated!":"💾 Save Results & Update Scores"}</button>
                <button onClick={syncFromLiveFeed} disabled={syncing} style={{
                  padding:"10px 18px",
                  background:syncing?"rgba(96,165,250,0.08)":"rgba(96,165,250,0.12)",
                  border:"1px solid rgba(96,165,250,0.35)",borderRadius:8,
                  color:"#60a5fa",fontSize:13,fontWeight:700,
                  cursor:syncing?"wait":"pointer",fontFamily:"inherit",
                  opacity:syncing?0.7:1,
                }}>{syncing?"⏳ Syncing…":"🔄 Sync Live Feed"}</button>
                <button onClick={()=>syncFromLiveFeed(true)} disabled={syncing} style={{
                  padding:"10px 18px",
                  background:syncing?"rgba(239,68,68,0.05)":"rgba(239,68,68,0.1)",
                  border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,
                  color:"#ef4444",fontSize:13,fontWeight:700,
                  cursor:syncing?"wait":"pointer",fontFamily:"inherit",
                  opacity:syncing?0.7:1,
                }}>{syncing?"⏳ Syncing…":"⚡ Force Override Sync"}</button>
                <button onClick={forceRefreshNews} disabled={newsFetching} style={{
                  padding:"10px 18px",
                  background:newsFetching?"rgba(252,185,0,0.05)":"rgba(252,185,0,0.1)",
                  border:"1px solid rgba(252,185,0,0.3)",borderRadius:8,
                  color:"#fcb900",fontSize:13,fontWeight:700,
                  cursor:newsFetching?"wait":"pointer",fontFamily:"inherit",
                }}>{newsFetching?"⏳ Fetching…":"📰 Force Refresh News"}</button>
                <button onClick={async()=>{
                  setAnalyticsGeneratedAt(null);
                  await generateGroupAnalytics();
                }} disabled={analyticsLoading} style={{
                  padding:"10px 18px",
                  background:analyticsLoading?"rgba(139,92,246,0.05)":"rgba(139,92,246,0.1)",
                  border:"1px solid rgba(139,92,246,0.3)",borderRadius:8,
                  color:"#a78bfa",fontSize:13,fontWeight:700,
                  cursor:analyticsLoading?"wait":"pointer",fontFamily:"inherit",
                }}>{analyticsLoading?"⏳ Analysing…":"🔍 Force Regenerate Analytics"}</button>
                <button onClick={()=>setShowResetConfirm(true)} style={{
                  padding:"10px 16px",background:"rgba(239,68,68,0.1)",
                  border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,
                  color:"#ef4444",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                }}>🗑 Reset to Blank</button>
                <button onClick={()=>{setAdminMode(false);setAdminPinInput("");}}
                  style={{padding:"10px 16px",background:"transparent",
                    border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,
                    color:"#555",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                  🔒 Lock
                </button>
              </div>

              {/* AI Predictions row */}
              <div style={{marginBottom:8}}>
                <button onClick={generateKOPredictions} disabled={generatingAI} style={{
                  width:"100%",padding:"11px 18px",
                  background:generatingAI?"rgba(167,139,250,0.06)":"rgba(167,139,250,0.08)",
                  border:"1px solid rgba(167,139,250,0.25)",borderRadius:8,
                  color:"#a78bfa",fontSize:13,fontWeight:700,
                  cursor:generatingAI?"wait":"pointer",fontFamily:"inherit",
                  opacity:generatingAI?0.7:1,textAlign:"left",
                }}>
                  {generatingAI?"⏳ Generating KO predictions…":"🤖 Generate KO AI Predictions"}
                  {!generatingAI&&<span style={{fontSize:11,color:"#6d5a9c",marginLeft:8,fontWeight:400}}>
                    — fills 🤖 suggestions for all knockout matches with known teams
                  </span>}
                </button>
              </div>

              {/* Polymarket KO Odds row */}
              <div style={{marginBottom:8}}>
                <button onClick={generateKOPolymarketOdds} disabled={generatingOdds} style={{
                  width:"100%",padding:"11px 18px",
                  background:generatingOdds?"rgba(96,165,250,0.04)":"rgba(96,165,250,0.07)",
                  border:"1px solid rgba(96,165,250,0.2)",borderRadius:8,
                  color:"#60a5fa",fontSize:13,fontWeight:700,
                  cursor:generatingOdds?"wait":"pointer",fontFamily:"inherit",
                  opacity:generatingOdds?0.7:1,textAlign:"left",
                }}>
                  {generatingOdds?"⏳ Fetching Polymarket odds…":"📊 Fetch KO Polymarket Odds"}
                  {!generatingOdds&&<span style={{fontSize:11,color:"#4a7a9b",marginLeft:8,fontWeight:400}}>
                    — saves crowd odds for all KO matches · visible to all players
                  </span>}
                </button>
              </div>

              {/* Expert Predictions KO row */}
              <div style={{marginBottom:syncStatus||aiGenStatus||oddsGenStatus||expertsGenStatus?8:20}}>
                <button onClick={generateKOExpertPredictions} disabled={generatingExperts} style={{
                  width:"100%",padding:"11px 18px",
                  background:generatingExperts?"rgba(34,197,94,0.04)":"rgba(34,197,94,0.07)",
                  border:"1px solid rgba(34,197,94,0.2)",borderRadius:8,
                  color:"#22c55e",fontSize:13,fontWeight:700,
                  cursor:generatingExperts?"wait":"pointer",fontFamily:"inherit",
                  opacity:generatingExperts?0.7:1,textAlign:"left",
                }}>
                  {generatingExperts?"⏳ Fetching expert predictions…":"🔍 Generate KO Expert Predictions"}
                  {!generatingExperts&&<span style={{fontSize:11,color:"#166534",marginLeft:8,fontWeight:400}}>
                    — searches web for tipster picks · saves to Supabase · visible to all players
                  </span>}
                </button>
              </div>

              {/* Experts gen status */}
              {expertsGenStatus&&(
                <div style={{
                  padding:"9px 14px",marginBottom:8,borderRadius:8,fontSize:12,
                  background:expertsGenStatus.ok?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)",
                  border:`1px solid ${expertsGenStatus.ok?"rgba(34,197,94,0.25)":"rgba(239,68,68,0.25)"}`,
                  color:expertsGenStatus.ok?"#22c55e":"#fca5a5",
                }}>{expertsGenStatus.msg}</div>
              )}

              {/* Odds gen status */}
              {oddsGenStatus&&(
                <div style={{
                  padding:"9px 14px",marginBottom:8,borderRadius:8,fontSize:12,
                  background:oddsGenStatus.ok?"rgba(96,165,250,0.08)":"rgba(239,68,68,0.08)",
                  border:`1px solid ${oddsGenStatus.ok?"rgba(96,165,250,0.25)":"rgba(239,68,68,0.25)"}`,
                  color:oddsGenStatus.ok?"#60a5fa":"#fca5a5",
                }}>{oddsGenStatus.msg}</div>
              )}
              {/* Sync status */}
              {aiGenStatus&&(
                <div style={{
                  padding:"9px 14px",marginBottom:8,borderRadius:8,fontSize:12,
                  background:aiGenStatus.ok?"rgba(167,139,250,0.08)":"rgba(239,68,68,0.08)",
                  border:`1px solid ${aiGenStatus.ok?"rgba(167,139,250,0.25)":"rgba(239,68,68,0.25)"}`,
                  color:aiGenStatus.ok?"#a78bfa":"#fca5a5",
                }}>{aiGenStatus.msg}</div>
              )}
              {syncStatus&&(
                <div style={{
                  padding:"9px 14px",marginBottom:16,borderRadius:8,fontSize:12,
                  background:syncStatus.ok?"rgba(96,165,250,0.08)":"rgba(239,68,68,0.08)",
                  border:`1px solid ${syncStatus.ok?"rgba(96,165,250,0.25)":"rgba(239,68,68,0.25)"}`,
                  color:syncStatus.ok?"#60a5fa":"#fca5a5",lineHeight:1.5,
                }}>
                  {syncStatus.msg}
                  {syncStatus.ok&&syncStatus.msg.includes("Synced")&&(
                    <span style={{color:"#888",marginLeft:8,fontSize:11}}>— edit any fields below then 💾 Save</span>
                  )}
                </div>
              )}

              {/* Reset to Blank confirmation */}
              {showResetConfirm&&(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
                  display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
                  <div style={{background:"#1a1f2e",border:"1px solid rgba(239,68,68,0.35)",
                    borderRadius:16,padding:"22px 24px",maxWidth:360,width:"100%"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#ef4444",marginBottom:10}}>
                      Reset All Results?
                    </div>
                    <div style={{fontSize:13,color:"#c0c0c0",marginBottom:8,lineHeight:1.6}}>
                      Clears <strong style={{color:"#fff"}}>all scores</strong>, <strong style={{color:"#fff"}}>knockout teams</strong>, and <strong style={{color:"#fff"}}>podium</strong> back to blank for everyone.
                    </div>
                    <div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",
                      borderRadius:8,padding:"10px 12px",marginBottom:16,fontSize:11,color:"#ef4444"}}>
                      Affects all {leaderboard.length} participant{leaderboard.length!==1?"s":""}. All scores reset to 0. Rollback from history if needed.
                    </div>
                    <div style={{display:"flex",gap:10}}>
                      <button onClick={adminResetToBlank} style={{flex:1,padding:"11px",
                        background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)",
                        borderRadius:8,color:"#ef4444",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                        Yes, Reset Everything
                      </button>
                      <button onClick={()=>setShowResetConfirm(false)} style={{flex:1,padding:"11px",
                        background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
                        borderRadius:8,color:"#888",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Rollback confirmation */}
              {rollbackTarget&&(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",
                  display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
                  <div style={{background:"#1a1f2e",border:"1px solid rgba(239,68,68,0.3)",
                    borderRadius:16,padding:"20px 24px",maxWidth:380,width:"100%"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#ef4444",marginBottom:10}}>
                      Confirm Rollback
                    </div>
                    <div style={{fontSize:13,color:"#c0c0c0",marginBottom:6}}>Restore results from:</div>
                    <div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",
                      borderRadius:8,padding:"10px 14px",marginBottom:8}}>
                      <div style={{fontWeight:700,color:"#fff",fontSize:13}}>{rollbackTarget.label}</div>
                      <div style={{fontSize:11,color:"#555",marginTop:3}}>
                        {rollbackTarget.matches.filter(m=>m.homeScore!==null).length} group results ·{" "}
                        {rollbackTarget.knockout.filter(m=>m.homeScore!==null).length} knockout results
                      </div>
                    </div>
                    <div style={{fontSize:11,color:"#666",marginBottom:16}}>
                      Overwrites current results for all {leaderboard.length} participant{leaderboard.length!==1?"s":""}.
                    </div>
                    <div style={{display:"flex",gap:10}}>
                      <button onClick={adminRollbackConfirmed} style={{flex:1,padding:"11px",
                        background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)",
                        borderRadius:8,color:"#ef4444",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                        Yes, Rollback
                      </button>
                      <button onClick={()=>setRollbackTarget(null)} style={{flex:1,padding:"11px",
                        background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
                        borderRadius:8,color:"#888",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Save confirmation */}
              {showConfirm&&(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",
                  display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
                  <div style={{background:"#1a1f2e",border:"1px solid rgba(252,185,0,0.3)",
                    borderRadius:16,padding:"20px 24px",maxWidth:420,width:"100%",
                    maxHeight:"80vh",overflowY:"auto"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#fcb900",marginBottom:12}}>
                      Confirm Save
                    </div>
                    <div style={{fontSize:12,color:"#888",marginBottom:12}}>
                      Saving for all {leaderboard.length} participant{leaderboard.length!==1?"s":""}:
                    </div>
                    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"10px 12px",
                      marginBottom:16,maxHeight:240,overflowY:"auto"}}>
                      {pendingChanges.map((c,i)=>(
                        <div key={i} style={{fontSize:12,color:"#ccc",padding:"4px 0",
                          borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none"}}>{c}</div>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:10}}>
                      <button onClick={adminSave} style={{flex:1,padding:"11px",
                        background:"#fcb900",border:"none",borderRadius:8,
                        color:"#000",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                        Confirm Save
                      </button>
                      <button onClick={()=>setShowConfirm(false)} style={{flex:1,padding:"11px",
                        background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",
                        borderRadius:8,color:"#ef4444",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {saveHistory.length>0&&(
                <div style={{marginBottom:24}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#555",letterSpacing:1,marginBottom:10}}>
                    Save History (last {saveHistory.length})
                  </div>
                  {saveHistory.map((snap,i)=>(
                    <div key={snap.saved_at||snap.at} style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"9px 12px",borderRadius:8,marginBottom:6,
                      background:i===0?"rgba(34,197,94,0.05)":"rgba(255,255,255,0.03)",
                      border:`1px solid ${i===0?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.06)"}`,
                    }}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,color:i===0?"#22c55e":"#888"}}>
                          {i===0?"Latest save":"Save "+(i+1)} — {snap.label}
                        </div>
                        <div style={{fontSize:10,color:"#444",marginTop:2}}>
                          {snap.matches.filter(m=>m.homeScore!==null).length} group results ·{" "}
                          {snap.knockout.filter(m=>m.homeScore!==null).length} knockout results
                        </div>
                      </div>
                      {i>0&&(
                        <button onClick={()=>adminRollback(snap)} style={{
                          padding:"5px 12px",background:"rgba(239,68,68,0.1)",
                          border:"1px solid rgba(239,68,68,0.25)",borderRadius:6,
                          color:"#ef4444",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0,
                        }}>Rollback</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Participation Report */}
              <div style={{marginBottom:24}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#555",letterSpacing:1,marginBottom:10}}>
                  Participation Report
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                  <div style={{flex:1,minWidth:80,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#fcb900"}}>{leaderboard.length}</div>
                    <div style={{fontSize:10,color:"#555"}}>Total players</div>
                  </div>
                  <div style={{flex:1,minWidth:80,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#22c55e"}}>
                      {leaderboard.filter(e=>(predCounts[e.username]||0)>0).length}
                    </div>
                    <div style={{fontSize:10,color:"#555"}}>With predictions</div>
                  </div>
                  <div style={{flex:1,minWidth:80,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#ef4444"}}>
                      {leaderboard.filter(e=>(predCounts[e.username]||0)===0).length}
                    </div>
                    <div style={{fontSize:10,color:"#555"}}>Not predicted</div>
                  </div>
                </div>
                {leaderboard.filter(e=>(predCounts[e.username]||0)===0).length>0&&(
                  <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:11,color:"#ef4444",fontWeight:700,marginBottom:6}}>⚠️ Haven't predicted yet:</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {leaderboard.filter(e=>(predCounts[e.username]||0)===0).map(e=>(
                        <span key={e.username} style={{fontSize:11,color:"#888",background:"rgba(255,255,255,0.06)",
                          border:"1px solid rgba(255,255,255,0.10)",borderRadius:4,padding:"3px 8px"}}>
                          {e.username}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {leaderboard.filter(e=>(predCounts[e.username]||0)>0 && (predCounts[e.username]||0)<72).length>0&&(
                  <div style={{background:"rgba(252,185,0,0.06)",border:"1px solid rgba(252,185,0,0.15)",borderRadius:8,padding:"10px 12px",marginTop:8}}>
                    <div style={{fontSize:11,color:"#fcb900",fontWeight:700,marginBottom:6}}>⏳ Partially predicted:</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {leaderboard.filter(e=>(predCounts[e.username]||0)>0 && (predCounts[e.username]||0)<72).map(e=>(
                        <span key={e.username} style={{fontSize:11,color:"#888",background:"rgba(255,255,255,0.06)",
                          border:"1px solid rgba(255,255,255,0.10)",borderRadius:4,padding:"3px 8px"}}>
                          {e.username} {predCounts[e.username]}/72
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Daily Recap — manual trigger */}
                <div style={{marginTop:16,padding:"12px 14px",background:"rgba(255,255,255,0.03)",
                  border:"1px solid rgba(255,255,255,0.06)",borderRadius:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#888",marginBottom:6}}>🌅 Daily AI Recap</div>
                  <div style={{fontSize:11,color:"#555",marginBottom:10,lineHeight:1.5}}>
                    Posts an AI-generated match recap to all league chats. Runs automatically at 8:00 UTC daily during the tournament.
                  </div>
                  <RecapButton />
                </div>
                {(()=>{
                  const total = leaderboard.length;
                  const daysToKickoff = Math.max(0, Math.ceil((new Date('2026-06-11T17:00:00Z') - new Date()) / 86400000));
                  const now = Date.now();
                  const fiveDays = now + 5 * 86400000;

                  // Matches kicking off in the next 5 days
                  const upcomingMatchIds = (matches||[]).filter(m => {
                    const key = `${m.home}||${m.away}`;
                    const keyRev = `${m.away}||${m.home}`;
                    const ko = KICKOFFS[key] || KICKOFFS[keyRev];
                    return ko && ko > now && ko <= fiveDays;
                  }).map(m => m.id);

                  const noPreds   = leaderboard.filter(e=>(predCounts[e.username]||0)===0).map(e=>e.username);
                  const partial   = leaderboard.filter(e=>(predCounts[e.username]||0)>0&&(predCounts[e.username]||0)<72);
                  const complete  = leaderboard.filter(e=>(predCounts[e.username]||0)>=72).length;
                  const partialStr = partial.map(e=>`${e.username} ${predCounts[e.username]}/72`).join(', ');

                  // Per-user upcoming unpredicted count
                  const userUpcoming = upcomingMatchIds.length > 0 ? leaderboard.map(e => {
                    const ud = allPredData[e.username];
                    const userMatches = ud?.matches;
                    if (!userMatches) {
                      return (predCounts[e.username]||0) < 72
                        ? `${e.username} (${upcomingMatchIds.length}/${upcomingMatchIds.length} games)`
                        : null;
                    }
                    const predMap = Object.fromEntries(userMatches.map(m=>[m.id, m]));
                    const unpredicted = upcomingMatchIds.filter(id => {
                      const m = predMap[id];
                      return !m || m.homeScore === null || m.awayScore === null;
                    });
                    return unpredicted.length > 0 ? `${e.username} (${unpredicted.length}/${upcomingMatchIds.length} game${unpredicted.length!==1?'s':''})` : null;
                  }).filter(Boolean) : [];

                  // Users missing podium or top scorer
                  const noFirst    = leaderboard.filter(e => !allPredData[e.username]?.podium?.first).map(e=>e.username);
                  const noSecond   = leaderboard.filter(e =>  allPredData[e.username]?.podium?.first && !allPredData[e.username]?.podium?.second).map(e=>e.username);
                  const noThird    = leaderboard.filter(e =>  allPredData[e.username]?.podium?.first && !allPredData[e.username]?.podium?.third).map(e=>e.username);
                  const noPodium   = noFirst; // shorthand for "no picks at all"
                  const noTopScorer = leaderboard
                    .filter(e => {
                      const p = allPredData[e.username]?.podium;
                      return !p?.topScorer || p.topScorer.trim().length < 3;
                    }).map(e=>e.username);

                  const statusLines = [];
                  if(noPreds.length>0)    statusLines.push(`⚠️ Haven't predicted yet: ${noPreds.join(', ')}`);
                  if(partial.length>0)    statusLines.push(`⏳ Partially predicted: ${partialStr}`);
                  if(complete>0)          statusLines.push(`✅ Fully predicted (72/72): ${leaderboard.filter(e=>(predCounts[e.username]||0)>=72).map(e=>e.username).join(', ')}`);
                  if(userUpcoming.length>0)
                    statusLines.push(`🔜 Unpredicted games in next 5 days:\n   ${userUpcoming.join('\n   ')}`);
                  if(noFirst.length>0)    statusLines.push(`👑 No champion pick (🥇): ${noFirst.join(', ')}`);
                  if(noSecond.length>0)   statusLines.push(`🥈 No runner-up pick: ${noSecond.join(', ')}`);
                  if(noThird.length>0)    statusLines.push(`🥉 No 3rd place pick: ${noThird.join(', ')}`);
                  if(noTopScorer.length>0) statusLines.push(`⚽ No top scorer pick: ${noTopScorer.join(', ')}`);

                  const msg = [
                    `⚽ FIFA 2026 Predictions Reminder!`,
                    ``,
                    `📊 ${complete}/${total} players have completed all predictions`,
                    ``,
                    ...statusLines,
                    ``,
                    daysToKickoff > 0
                      ? `⏱ Tournament kicks off in ${daysToKickoff} day${daysToKickoff!==1?'s':''}!`
                      : `🔴 Tournament has started — predictions are locking!`,
                    ``,
                    `👉 Fill yours now: https://toto-app-oqdi.vercel.app`,
                  ].join('\n');

                  const chatMsg = [
                    `📣 Admin Reminder`,
                    `${complete}/${total} players fully predicted.`,
                    noPreds.length>0     ? `⚠️ Haven't predicted: ${noPreds.join(', ')}` : '',
                    partial.length>0     ? `⏳ Partially: ${partialStr}` : '',
                    userUpcoming.length>0 ? `🔜 Unpredicted in next 5 days: ${userUpcoming.join(', ')}` : '',
                    noFirst.length>0     ? `👑 No champion pick: ${noFirst.join(', ')}` : '',
                    noSecond.length>0    ? `🥈 No runner-up: ${noSecond.join(', ')}` : '',
                    noThird.length>0     ? `🥉 No 3rd place: ${noThird.join(', ')}` : '',
                    noTopScorer.length>0 ? `⚽ No top scorer: ${noTopScorer.join(', ')}` : '',
                    daysToKickoff>0 ? `⏱ ${daysToKickoff} day${daysToKickoff!==1?'s':''} to kickoff — fill yours now!` : `🔴 Predictions are locking — fill yours now!`,
                  ].filter(Boolean).join('\n');

                  const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
                  return(
                    <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
                      {upcomingMatchIds.length>0&&(
                        <div style={{fontSize:10,color:"#60a5fa",background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:6,padding:"6px 10px"}}>
                          🔜 {upcomingMatchIds.length} match{upcomingMatchIds.length!==1?'es':''} kick off in the next 5 days
                          {userUpcoming.length>0&&<span style={{color:"#555",marginLeft:4}}>· {userUpcoming.length} player{userUpcoming.length!==1?'s':''} have unpredicted games</span>}
                        </div>
                      )}
                      <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{
                        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                        padding:"11px",borderRadius:8,
                        background:"linear-gradient(135deg,rgba(37,211,102,0.15),rgba(18,140,126,0.15))",
                        border:"1px solid rgba(37,211,102,0.35)",
                        color:"#25d366",fontSize:13,fontWeight:700,
                        textDecoration:"none",
                      }}>
                        <span style={{fontSize:16}}>📱</span>
                        Send WhatsApp Reminder
                        <span style={{fontSize:11,color:"#166534",fontWeight:400}}>
                          ({complete}/{total} complete)
                        </span>
                      </a>
                      <button onClick={async()=>{
                        await sbSendMessage('⚡', chatMsg, groupCode);
                        setChatReminderSent(true);
                        setTimeout(()=>setChatReminderSent(false), 3000);
                      }} style={{
                        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                        padding:"11px",borderRadius:8,
                        background:chatReminderSent?"rgba(34,197,94,0.15)":"rgba(252,185,0,0.08)",
                        border:`1px solid ${chatReminderSent?"rgba(34,197,94,0.4)":"rgba(252,185,0,0.25)"}`,
                        color:chatReminderSent?"#22c55e":"#fcb900",fontSize:13,fontWeight:700,
                        cursor:"pointer",fontFamily:"inherit",transition:"all 0.3s",
                      }}>
                        <span style={{fontSize:16}}>{chatReminderSent?"✓":"💬"}</span>
                        {chatReminderSent?"Reminder sent to chat!":"Send to Group Chat"}
                        {!chatReminderSent&&<span style={{fontSize:11,color:"#92400e",fontWeight:400}}>
                          (visible to all players)
                        </span>}
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* User Management */}
                {adminPinError&&<div style={{
                  position:"sticky",top:0,zIndex:100,
                  padding:"10px 14px",borderRadius:8,marginBottom:10,
                  background:adminPinError.startsWith("✅")?"rgba(34,197,94,0.12)":"rgba(239,68,68,0.12)",
                  border:`1px solid ${adminPinError.startsWith("✅")?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`,
                  fontSize:12,fontWeight:600,
                  color:adminPinError.startsWith("✅")?"#22c55e":"#ef4444",
                }}>{adminPinError}</div>}
              <div style={{marginBottom:24}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#555",letterSpacing:1,marginBottom:10}}>
                  User Management
                </div>

                {/* User list with actions */}
                <div style={{marginBottom:12}}>
                  {leaderboard.map(e=>(
                    <div key={e.username} style={{
                      display:"flex",alignItems:"center",gap:8,
                      padding:"7px 10px",marginBottom:4,borderRadius:6,
                      background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
                    }}>
                      <span style={{flex:1,fontSize:12,color:"#ccc",fontWeight:e.username===userName?700:400}}>
                        {e.username}{e.username===userName?" (you)":""}
                      </span>
                      <span style={{fontSize:10,color:"#555"}}>{e.points}pts</span>
                      {/* Paid toggle */}
                      <button onClick={async()=>{
                        const newPaid = !e.paid;
                        await sbTogglePaid(e.username, newPaid, groupCode);
                        setLeaderboard(prev=>prev.map(x=>x.username===e.username?{...x,paid:newPaid}:x));
                      }} style={{
                        padding:"3px 8px",
                        background:e.paid?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.04)",
                        border:`1px solid ${e.paid?"rgba(34,197,94,0.4)":"rgba(255,255,255,0.10)"}`,
                        borderRadius:4,
                        color:e.paid?"#22c55e":"#555",
                        fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                      }}>
                        {e.paid?"✓ Paid":"Unpaid"}
                      </button>
                      <button onClick={async()=>{
                        const user = await sbGetUser(e.username, groupCode);
                        if(!user){ setAdminPinError(`User "${e.username}" not found.`); return; }
                        await sbClearUser(e.username, groupCode);
                        // Clear their saved session so they're forced to re-login
                        try {
                          const saved = JSON.parse(localStorage.getItem('wc26_session')||'null');
                          if(saved?.username===e.username && saved?.groupCode===groupCode) {
                            localStorage.removeItem('wc26_session');
                          }
                        } catch {}
                        setAdminPinError(`✅ PIN reset for "${e.username}". They must set a new PIN on next login.`);
                        setTimeout(()=>setAdminPinError(""),4000);
                      }} style={{
                        padding:"3px 8px",background:"rgba(96,165,250,0.08)",
                        border:"1px solid rgba(96,165,250,0.2)",borderRadius:4,
                        color:"#60a5fa",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                      }}>Reset PIN</button>
                      {e.username!==userName&&(
                        <button onClick={()=>setDeleteConfirmUser(e.username)} style={{
                          padding:"3px 8px",background:"rgba(239,68,68,0.08)",
                          border:"1px solid rgba(239,68,68,0.2)",borderRadius:4,
                          color:"#ef4444",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                        }}>🗑 Delete</button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Delete confirmation modal — fixed overlay */}
                {deleteConfirmUser&&(
                  <div style={{
                    position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",
                    zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",
                    padding:"20px",
                  }} onClick={()=>setDeleteConfirmUser(null)}>
                    <div onClick={e=>e.stopPropagation()} style={{
                      background:"#1a1f2e",borderRadius:12,padding:"20px",
                      border:"1px solid rgba(239,68,68,0.4)",maxWidth:320,width:"100%",
                    }}>
                      <div style={{fontSize:14,color:"#fca5a5",fontWeight:700,marginBottom:8}}>
                        ⚠️ Delete "{deleteConfirmUser}"?
                      </div>
                      <div style={{fontSize:11,color:"#888",marginBottom:16,lineHeight:1.5}}>
                        This will permanently remove their account, predictions, reactions and chat messages. This cannot be undone.
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={async()=>{
                          await sbDeleteUser(deleteConfirmUser, groupCode);
                          const lb = await sbGetLeaderboard(groupCode);
                          if(lb) setLeaderboard(lb);
                          setAdminPinError(`✅ "${deleteConfirmUser}" deleted.`);
                          setDeleteConfirmUser(null);
                          setTimeout(()=>setAdminPinError(""),3000);
                        }} style={{
                          flex:1,padding:"10px",background:"rgba(239,68,68,0.2)",
                          border:"1px solid rgba(239,68,68,0.4)",borderRadius:8,
                          color:"#ef4444",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                        }}>Yes, delete</button>
                        <button onClick={()=>setDeleteConfirmUser(null)} style={{
                          flex:1,padding:"10px",background:"rgba(255,255,255,0.06)",
                          border:"1px solid rgba(255,255,255,0.10)",borderRadius:8,
                          color:"#888",fontSize:13,cursor:"pointer",fontFamily:"inherit",
                        }}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                {adminPinError&&<div style={{fontSize:11,marginTop:6,color:adminPinError.startsWith("✅")?"#22c55e":"#ef4444"}}>{adminPinError}</div>}
              </div>

              {/* Group Stage Results */}
              <div style={{marginBottom:28}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <h3 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#fcb900",margin:0}}>
                    Group Stage Results
                  </h3>
                  <button onClick={adminFillR32} style={{
                    padding:"7px 14px",background:"rgba(96,165,250,0.12)",
                    border:"1px solid rgba(96,165,250,0.3)",borderRadius:6,
                    color:"#60a5fa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  }}>⚡ Fill R32 from standings</button>
                  <button onClick={()=>{
                    if (!confirmResetKO) {
                      setConfirmResetKO(true);
                      setTimeout(()=>setConfirmResetKO(false), 3000);
                      return;
                    }
                    setConfirmResetKO(false);
                    setActualKO(prev => prev.map(m => ({
                      ...m,
                      home: "TBD", away: "TBD",
                      homeScore: null, awayScore: null,
                    })));
                    setKoKickoffs({});
                    setAdminPinError("✅ All KO matches reset to TBD — hit Save Results");
                    setTimeout(()=>setAdminPinError(""),4000);
                  }} style={{
                    padding:"7px 14px",
                    background:confirmResetKO?"rgba(239,68,68,0.2)":"rgba(239,68,68,0.08)",
                    border:`1px solid ${confirmResetKO?"rgba(239,68,68,0.6)":"rgba(239,68,68,0.25)"}`,
                    borderRadius:6,
                    color:"#ef4444",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  }}>{confirmResetKO?"⚠️ Tap again to confirm":"🗑 Reset All KO"}</button>
                  <button onClick={async()=>{
                    try {
                      const res = await fetch('/api/live?type=fixtures&round=Round%20of%2032');
                      const data = await res.json();
                      const fixtures = data.response || [];
                      if (!fixtures.length) {
                        setAdminPinError("⚠️ No R32 fixtures found in API yet");
                        setTimeout(()=>setAdminPinError(""),3000);
                        return;
                      }
                      // Build normalized matchups with kickoff times
                      const matchups = fixtures.map(f => ({
                        home: TEAM_ALIASES[f.teams?.home?.name] || f.teams?.home?.name || 'TBD',
                        away: TEAM_ALIASES[f.teams?.away?.name] || f.teams?.away?.name || 'TBD',
                        ms: new Date(f.fixture?.date).getTime(),
                      })).filter(m => m.home !== 'TBD' && m.ms);

                      // Fill team names into R32 slots
                      const newKO = [...actualKO];
                      const r32Slots = newKO.filter(m=>m.round==="Round of 32");
                      const newKickoffs = {...koKickoffs};
                      let filled = 0;
                      matchups.forEach(({home,away,ms}) => {
                        const slot = r32Slots.find(m=>m.home==="TBD");
                        if (slot) {
                          slot.home = home;
                          slot.away = away;
                          newKickoffs[slot.id] = ms;
                          filled++;
                        }
                      });
                      setActualKO(newKO);
                      setKoKickoffs(newKickoffs);
                      setAdminPinError(`✅ Loaded ${filled} R32 fixtures with kickoff times — hit Save Results`);
                      setTimeout(()=>setAdminPinError(""),5000);
                    } catch(e) {
                      setAdminPinError(`⚠️ API error: ${e.message}`);
                      setTimeout(()=>setAdminPinError(""),3000);
                    }
                  }} style={{
                    padding:"7px 14px",background:"rgba(34,197,94,0.1)",
                    border:"1px solid rgba(34,197,94,0.3)",borderRadius:6,
                    color:"#22c55e",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  }}>🌐 Load R32 from API</button>
                  <button onClick={async()=>{
                    const res = await fetch('/api/live?type=fixtures&round=Round%20of%2032');
                    const data = await res.json();
                    const teams = (data.response||[]).map(f=>
                      `${f.teams?.home?.name||'?'} vs ${f.teams?.away?.name||'?'}`
                    ).join('\n');
                    alert(teams||'No R32 fixtures found yet in API-Football');
                  }} style={{
                    padding:"7px 14px",background:"rgba(252,185,0,0.08)",
                    border:"1px solid rgba(252,185,0,0.2)",borderRadius:6,
                    color:"#fcb900",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  }}>🔍 Check API R32</button>
                </div>

                {/* Group selector */}
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
                  {Object.keys(GROUPS).map(g=>(
                    <button key={g} onClick={()=>setAdminActiveGroup(g)} style={{
                      padding:"5px 11px",borderRadius:6,border:"1px solid",
                      borderColor:adminActiveGroup===g?"#22c55e":"rgba(255,255,255,0.10)",
                      background:adminActiveGroup===g?"rgba(34,197,94,0.1)":"transparent",
                      color:adminActiveGroup===g?"#22c55e":"#555",
                      fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",
                    }}>Group {g}</button>
                  ))}
                </div>

                {/* Group matches */}
                {actualMatches.filter(m=>m.group===adminActiveGroup).map(m=>(
                  <div key={m.id} style={{
                    display:"flex",alignItems:"center",gap:9,
                    padding:"9px 12px",borderRadius:10,marginBottom:7,
                    background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.12)",
                  }}>
                    <span style={{fontSize:15}}>{FLAGS[m.home]||"🏳️"}</span>
                    <span style={{flex:1,fontWeight:600,fontSize:12}}>{m.home}</span>
                    <ScoreInput value={m.homeScore} onChange={v=>adminUpdateMatch({...m,homeScore:v})}/>
                    <span style={{color:"#444",fontWeight:700}}>–</span>
                    <ScoreInput value={m.awayScore} onChange={v=>adminUpdateMatch({...m,awayScore:v})}/>
                    <span style={{flex:1,textAlign:"right",fontWeight:600,fontSize:12}}>{m.away}</span>
                    <span style={{fontSize:15}}>{FLAGS[m.away]||"🏳️"}</span>
                  </div>
                ))}
              </div>

              {/* Knockout Results */}
              <div>
                <h3 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#fcb900",margin:"0 0 14px"}}>
                  Knockout Results
                </h3>
                <p style={{fontSize:11,color:"#555",marginTop:0,marginBottom:14}}>
                  Enter team names and scores manually, or use <strong style={{color:"#60a5fa"}}>🔄 Sync Live Feed</strong> to auto-populate — then edit any field before saving.
                </p>

                {/* Round selector */}
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
                  {KO_ROUNDS.map(r=>(
                    <button key={r} onClick={()=>setAdminActiveRound(r)} style={{
                      padding:"5px 11px",borderRadius:6,border:"1px solid",
                      borderColor:adminActiveRound===r?"#22c55e":"rgba(255,255,255,0.10)",
                      background:adminActiveRound===r?"rgba(34,197,94,0.1)":"transparent",
                      color:adminActiveRound===r?"#22c55e":"#555",
                      fontWeight:700,fontSize:10,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
                    }}>{r}</button>
                  ))}
                </div>

                {/* KO matches for selected round */}
                {actualKO.filter(m=>m.round===adminActiveRound).map((m,i)=>{
                  const koMs = koKickoffs[m.id];
                  // Format UTC ms as local datetime-local string (YYYY-MM-DDTHH:MM)
                  const koLocal = koMs ? (() => {
                    const d = new Date(koMs);
                    const pad = n => String(n).padStart(2,'0');
                    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  })() : "";
                  return(
                  <div key={m.id} style={{
                    padding:"11px 13px",borderRadius:10,marginBottom:8,
                    background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.12)",
                  }}>
                    {/* Team name row */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <input value={m.home==="TBD"?"":m.home} placeholder="Home team"
                        onChange={e=>adminUpdateKO({...m,home:e.target.value||"TBD"})}
                        style={{flex:1,background:"transparent",border:"none",
                          borderBottom:"1px solid rgba(255,255,255,0.10)",
                          color:"#fff",fontSize:13,fontWeight:700,padding:"3px 0",
                          outline:"none",fontFamily:"inherit"}}/>
                      <span style={{color:"#444",fontSize:12}}>vs</span>
                      <input value={m.away==="TBD"?"":m.away} placeholder="Away team"
                        onChange={e=>adminUpdateKO({...m,away:e.target.value||"TBD"})}
                        style={{flex:1,textAlign:"right",background:"transparent",border:"none",
                          borderBottom:"1px solid rgba(255,255,255,0.10)",
                          color:"#fff",fontSize:13,fontWeight:700,padding:"3px 0",
                          outline:"none",fontFamily:"inherit"}}/>
                    </div>
                    {/* Kickoff time row */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <span style={{fontSize:10,color:"#555",flexShrink:0}}>⏰ Kickoff (local time):</span>
                      <input type="datetime-local" value={koLocal}
                        onChange={e=>{
                          const ms = e.target.value ? new Date(e.target.value).getTime() : null;
                          setKoKickoffs(prev=>ms ? {...prev,[m.id]:ms} : Object.fromEntries(Object.entries(prev).filter(([k])=>k!==m.id)));
                        }}
                        style={{
                          flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",
                          borderRadius:6,color:"#ccc",fontSize:11,padding:"4px 8px",
                          fontFamily:"inherit",outline:"none",colorScheme:"dark",
                        }}/>
                      {koMs&&<span style={{fontSize:10,color:"#22c55e",flexShrink:0}}>🔒 -15min</span>}
                    </div>
                    {/* Score row */}
                    {m.home!=="TBD"&&m.away!=="TBD"&&(
                      <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
                        <span style={{fontSize:11,color:"#555"}}>Score:</span>
                        <ScoreInput value={m.homeScore} onChange={v=>adminUpdateKO({...m,homeScore:v})}/>
                        <span style={{color:"#444",fontWeight:700}}>–</span>
                        <ScoreInput value={m.awayScore} onChange={v=>adminUpdateKO({...m,awayScore:v})}/>
                        {m.homeScore!==null&&m.awayScore!==null&&(
                          <span style={{fontSize:11,color:"#22c55e",marginLeft:8}}>
                            Winner: {m.homeScore>m.awayScore?m.home:m.awayScore>m.homeScore?m.away:"Draw — enter ET/pens"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}

                {/* Podium override */}
                {adminActiveRound==="Final"&&(
                  <div style={{marginTop:16,padding:"14px 16px",
                    background:"rgba(139,92,246,0.07)",border:"1px solid rgba(139,92,246,0.2)",
                    borderRadius:10,marginBottom:12}}>
                    <div style={{fontWeight:700,fontSize:12,color:"#a78bfa",marginBottom:10}}>
                      🤖 AI Predictions Editor
                    </div>
                    <p style={{fontSize:11,color:"#555",marginTop:0,marginBottom:12}}>
                      Add or update AI predictions for knockout matches. Key format: <code style={{color:"#a78bfa"}}>Team1||Team2</code>
                    </p>

                    {/* Podium suggestion editor */}
                    <div style={{marginBottom:14,padding:"10px 12px",background:"rgba(139,92,246,0.05)",
                      border:"1px solid rgba(139,92,246,0.15)",borderRadius:8}}>
                      <div style={{fontSize:11,color:"#a78bfa",fontWeight:700,marginBottom:8}}>🏆 Podium Suggestion</div>
                      {(()=>{
                        const DEFAULT_AI_PODIUM = { first:"Brazil", second:"France", third:"Argentina",
                          reason:"Brazil's squad depth and form make them favourites." };
                        const current = livePredictions["__podium__"] || DEFAULT_AI_PODIUM;
                        return(
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {[
                              {key:"first", label:"🥇 1st"},
                              {key:"second",label:"🥈 2nd"},
                              {key:"third", label:"🥉 3rd"},
                            ].map(p=>(
                              <div key={p.key} style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:11,color:"#777",width:45,flexShrink:0}}>{p.label}</span>
                                <input value={current[p.key]||""} placeholder="Team name…"
                                  onChange={e=>setLivePredictions(prev=>({
                                    ...prev,"__podium__":{...(prev["__podium__"]||DEFAULT_AI_PODIUM),[p.key]:e.target.value}
                                  }))}
                                  style={{flex:1,padding:"5px 8px",background:"rgba(255,255,255,0.06)",
                                    border:"1px solid rgba(139,92,246,0.2)",borderRadius:6,
                                    color:"#fff",fontSize:11,outline:"none"}}/>
                              </div>
                            ))}
                            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2}}>
                              <span style={{fontSize:11,color:"#777",width:45,flexShrink:0}}>Reason</span>
                              <input value={current.reason||""} placeholder="Brief reasoning…"
                                onChange={e=>setLivePredictions(prev=>({
                                  ...prev,"__podium__":{...(prev["__podium__"]||DEFAULT_AI_PODIUM),reason:e.target.value}
                                }))}
                                style={{flex:1,padding:"5px 8px",background:"rgba(255,255,255,0.06)",
                                  border:"1px solid rgba(139,92,246,0.2)",borderRadius:6,
                                  color:"#fff",fontSize:11,outline:"none"}}/>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {/* Show existing live predictions */}
                    {Object.entries(livePredictions).map(([key,pred])=>(
                      <div key={key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,
                        background:"rgba(139,92,246,0.05)",borderRadius:6,padding:"7px 10px",
                        border:"1px solid rgba(139,92,246,0.15)"}}>
                        <span style={{fontSize:10,color:"#7c6db3",flex:1,fontFamily:"monospace"}}>{key}</span>
                        <span style={{fontSize:12,color:"#c4b5fd",fontWeight:700,flexShrink:0}}>{pred.h}–{pred.a}</span>
                        <span style={{fontSize:10,color:"#555",flex:2,textAlign:"right",fontStyle:"italic"}}>{pred.r}</span>
                        <button onClick={()=>setLivePredictions(p=>{const n={...p};delete n[key];return n;})}
                          style={{padding:"2px 7px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",
                            borderRadius:4,color:"#ef4444",fontSize:10,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>✕</button>
                      </div>
                    ))}
                    {/* Add new prediction */}
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                      <input value={newPredKey} onChange={e=>setNewPredKey(e.target.value)}
                        placeholder="Brazil||France"
                        style={{flex:2,minWidth:130,padding:"6px 8px",background:"rgba(255,255,255,0.06)",
                          border:"1px solid rgba(139,92,246,0.2)",borderRadius:6,
                          color:"#fff",fontSize:11,fontFamily:"monospace",outline:"none"}}/>
                      <input type="number" value={newPredH} onChange={e=>setNewPredH(e.target.value)}
                        placeholder="H" min="0" max="20"
                        style={{width:44,padding:"6px 4px",textAlign:"center",background:"rgba(255,255,255,0.06)",
                          border:"1px solid rgba(139,92,246,0.2)",borderRadius:6,
                          color:"#fff",fontSize:11,outline:"none"}}/>
                      <span style={{color:"#555",alignSelf:"center"}}>–</span>
                      <input type="number" value={newPredA} onChange={e=>setNewPredA(e.target.value)}
                        placeholder="A" min="0" max="20"
                        style={{width:44,padding:"6px 4px",textAlign:"center",background:"rgba(255,255,255,0.06)",
                          border:"1px solid rgba(139,92,246,0.2)",borderRadius:6,
                          color:"#fff",fontSize:11,outline:"none"}}/>
                      <input value={newPredR} onChange={e=>setNewPredR(e.target.value)}
                        placeholder="Reason…"
                        style={{flex:3,minWidth:120,padding:"6px 8px",background:"rgba(255,255,255,0.06)",
                          border:"1px solid rgba(139,92,246,0.2)",borderRadius:6,
                          color:"#fff",fontSize:11,outline:"none"}}/>
                      <button onClick={()=>{
                        if(!newPredKey||newPredH===""||newPredA==="") return;
                        setLivePredictions(p=>({...p,[newPredKey]:{h:parseInt(newPredH),a:parseInt(newPredA),r:newPredR}}));
                        setNewPredKey(""); setNewPredH(""); setNewPredA(""); setNewPredR("");
                      }} style={{padding:"6px 12px",background:"rgba(139,92,246,0.2)",
                        border:"1px solid rgba(139,92,246,0.4)",borderRadius:6,
                        color:"#a78bfa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        + Add
                      </button>
                    </div>
                  </div>
                )}

                {adminActiveRound==="Final"&&(
                  <div style={{marginTop:16,padding:"14px 16px",
                    background:"rgba(252,185,0,0.07)",border:"1px solid rgba(252,185,0,0.2)",
                    borderRadius:10,
                  }}>
                    <div style={{fontWeight:700,fontSize:12,color:"#fcb900",marginBottom:10}}>
                      🏆 Manual Podium Override
                    </div>
                    {[
                      {key:"first",     label:"🥇 1st Place"},
                      {key:"second",    label:"🥈 2nd Place"},
                      {key:"third",     label:"🥉 3rd Place"},
                      {key:"topScorer", label:"⚽ Top Scorer"},
                    ].map(p=>(
                      <div key={p.key} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                        <span style={{fontSize:12,color:"#888",width:90,flexShrink:0}}>{p.label}</span>
                        <input value={actualPodium[p.key]||""}
                          placeholder={p.key==="topScorer"?"Player name (e.g. Mbappe)":"Team name…"}
                          onChange={e=>setActualPodium(prev=>({...prev,[p.key]:e.target.value||null}))}
                          style={{flex:1,padding:"6px 10px",background:"rgba(255,255,255,0.06)",
                            border:"1px solid rgba(255,255,255,0.10)",borderRadius:6,
                            color:"#fff",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>}

        {/* ── HELP ── */}
        {tab==="help"&&<div>
          <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#fcb900",marginTop:0}}>Help & FAQ</h2>

          {/* Scoring rules */}
          <div style={{marginBottom:20}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1,color:"#888",marginBottom:10}}>📋 Scoring Rules</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              {[
                {pts:6, label:"Exact Score",   icon:"⭐", color:"#22c55e", ex:"Pred 2-1 / Act 2-1"},
                {pts:4, label:"Correct GD",    icon:"📐", color:"#fcb900", ex:"Pred 3-2 / Act 2-1"},
                {pts:2, label:"Correct Winner",icon:"✓",  color:"#60a5fa", ex:"Pred 3-1 / Act 2-1"},
                {pts:50,label:"1st Place",     icon:"🥇", color:"#f59e0b", ex:"Correct champion"},
                {pts:25,label:"2nd Place",     icon:"🥈", color:"#c0c0c0", ex:"Correct runner-up"},
                {pts:15,label:"3rd Place",     icon:"🥉", color:"#cd7f32", ex:"Correct 3rd place"},
                {pts:10,label:"Podium Overlap",icon:"🔄", color:"#a78bfa", ex:"Right team, wrong rank"},
                {pts:20,label:"Top Scorer",    icon:"⚽", color:"#60a5fa", ex:"Fuzzy name match"},
              ].map((r,i)=>(
                <div key={i} style={{
                  background:`${r.color}0e`,border:`1px solid ${r.color}25`,
                  borderRadius:8,padding:"8px 10px",display:"flex",alignItems:"center",gap:8,
                }}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:r.color,lineHeight:1,minWidth:28,textAlign:"center"}}>{r.pts}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:11}}>{r.icon} {r.label}</div>
                    <div style={{fontSize:10,color:"#555",marginTop:1}}>{r.ex}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{fontSize:10,color:"#555",padding:"6px 10px",background:"rgba(252,185,0,0.05)",borderRadius:6}}>
              🔒 Podium & top scorer lock end of Friday June 19 · Max bonus: 110 pts
            </div>
          </div>

          {[
            {
              icon:"🔐", title:"Getting Started",
              items:[
                ["How do I join?","Go to the app URL, enter your name and choose a PIN (min 4 characters). You'll use this PIN every time you log in."],
                ["Will the app remember me?","Yes — tick 'Remember me for 30 days' when logging in and you'll stay logged in automatically."],
                ["I forgot my PIN","On the login screen, enter your name then tap 'Forgot PIN? Use recovery code'. Enter your WC26-XXXX-XXXX recovery code to set a new PIN."],
                ["I lost my recovery code too","Ask the admin — they can reset your PIN from Admin → User Management. Your predictions are preserved."],
              ]
            },
            {
              icon:"⚽", title:"Making Predictions",
              items:[
                ["When do predictions lock?","15 minutes before each match kicks off. The countdown shows on each match card."],
                ["Do I need to save manually?","Tap Save anytime for an instant save. The app also auto-saves every 30 seconds when you have unsaved changes — you'll see a green '✓ Auto-saved' toast."],
                ["Can I change my predictions?","Yes, any time before the match locks. Edit the score — it auto-saves within 30 seconds."],
                ["What's the podium pick?","In 👑 My Pick, choose who finishes 1st, 2nd and 3rd in the whole tournament, plus the top scorer. All picks lock end of Friday June 12 (midnight UTC June 13)."],
                ["What are the 🤖 🔍 📊 buttons on each match?","🤖 shows an AI-predicted score · 🔍 shows expert tipster consensus from BBC Sport, ESPN etc · 📊 shows Polymarket crowd odds (real money prediction market). All three are optional hints to help you decide."],
              ]
            },
            {
              icon:"📊", title:"Scoring Rules",
              items:[
                ["Exact score","Predicted the precise scoreline → 6 pts"],
                ["Correct goal difference","Right margin, wrong scores (e.g. predicted 3-2, actual 2-1) → 4 pts"],
                ["Correct outcome only","Right winner or draw, wrong everything else → 2 pts"],
                ["Wrong prediction","None of the above → 0 pts"],
                ["Podium bonus","🥇 Champion = 50 pts · 🥈 Runner-up = 25 pts · 🥉 3rd place = 15 pts"],
                ["Top scorer bonus","⚽ Correct top scorer = 20 pts · Fuzzy name matching (\"mbappe\" matches \"Kylian Mbappé\")"],
                ["Max bonus","Get all 3 podium places + top scorer correct = 110 bonus pts"],
                ["Rules are mutually exclusive","For match scoring, you get the highest applicable category only — no stacking."],
              ]
            },
            {
              icon:"💾", title:"Saving & Backup",
              items:[
                ["How are predictions stored?","Everything is saved to the cloud (Supabase) — accessible from any device as long as you log in with the same name and PIN."],
                ["What's 📦 Backup for?","Downloads a JSON file of your predictions as an offline safety copy. Use 📥 Import to restore from it if needed."],
                ["What does the ⚠️ warning mean?","You haven't backed up in 3+ days. Tap 📦 Backup and save the file somewhere safe."],
                ["The 🗑 Reset button","Clears only YOUR predictions — doesn't affect anyone else's."],
              ]
            },
            {
              icon:"🥇", title:"Leaderboard & Stats",
              items:[
                ["When do scores update?","When the admin enters results and taps Save. Everyone's scores update in real time."],
                ["Can I see others' predictions?","Yes — tap 👁 View on any leaderboard entry to compare their picks vs actual results."],
                ["What's the 📈 Stats tab?","Your personal accuracy breakdown — exact scores, correct outcomes, best/worst matches, and your rank history chart showing how your position changed over time."],
                ["What's the 🤖 AI tab?","Three shared AI features: full tournament bracket prediction, leaderboard commentary, and a what-if calculator showing how results affect standings. Any player can generate — results are shared with everyone instantly."],
              ]
            },
            {
              icon:"💬", title:"Chat & Reactions",
              items:[
                ["Where's the group chat?","💬 Chat tab — send messages visible to all players in real time. Press Enter to send."],
                ["What are the emoji buttons on match cards?","React to any match with 🔥😱😂👏💔🎯 — reactions are visible to all players and echo into the chat. Tap ＋ to see all emoji options. Tap again to undo within 2 seconds."],
                ["Are reactions anonymous?","No — your name appears in the chat when you react."],
              ]
            },
            {
              icon:"🔴", title:"Live Tab",
              items:[
                ["What's the Live tab?","Real-time match scores, events, stats, formations, win probability, player ratings and AI match analysis. Updates when you tap 🔄 Refresh (60s cooldown to save API quota)."],
                ["Why do I see a demo?","The tournament hasn't started yet. Press ▶ Start to preview the live experience with a simulated Mexico vs South Africa match. Real data replaces this automatically on June 11."],
                ["What's the win probability bar?","A formula-based estimate using score, time remaining, red cards and possession. Updates every refresh."],
              ]
            },
            {
              icon:"🔧", title:"Admin",
              items:[
                ["Who should be admin?","One person in the group — ideally whoever is watching the games and can enter scores promptly."],
                ["How do I enter results?","Admin tab → Group Stage → select group → enter scores → Save Results."],
                ["How do knockout teams get filled?","After all group scores are in, tap ⚡ Fill R32 from Standings. Then enter scores round by round as matches are played."],
                ["Can I undo a save?","Yes — Save History shows the last 5 saves. Tap Rollback to restore any previous state."],
                ["How do I generate AI knockout predictions?","Admin tab → 🤖 Generate KO AI Predictions. Claude searches for expert picks and saves them for all players to see."],
                ["How do I reset a user's PIN?","Admin → User Management → enter their username → Reset PIN. Predictions are preserved."],
              ]
            },
            {
              icon:"📤", title:"Share Card",
              items:[
                ["How do I share my ranking?","Tap 📤 Share in the header action row. A card shows your rank, points, champion pick and rank history. Tap 'Share to WhatsApp' to send via the native share sheet, or 'Copy text' to paste anywhere."],
              ]
            },
          ].map((section,si)=>(
            <div key={si} style={{marginBottom:24}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,
                paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <span style={{fontSize:18}}>{section.icon}</span>
                <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1,color:"#fcb900"}}>
                  {section.title}
                </span>
              </div>
              {section.items.map(([q,a],qi)=>(
                <div key={qi} style={{marginBottom:12,paddingLeft:12,
                  borderLeft:"2px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#ccc",marginBottom:3}}>{q}</div>
                  {a&&<div style={{fontSize:12,color:"#555",lineHeight:1.6}}>{a}</div>}
                </div>
              ))}
            </div>
          ))}

          <div style={{marginTop:8,padding:"14px 16px",background:"rgba(96,165,250,0.07)",
            border:"1px solid rgba(96,165,250,0.2)",borderRadius:10,fontSize:12,color:"#60a5fa",lineHeight:1.7}}>
            Still stuck? Ask the group organiser or try refreshing the page. The app auto-saves your predictions every 30 seconds so you won't lose anything.
          </div>
        </div>}

      </div>
    </div>
  );
}

