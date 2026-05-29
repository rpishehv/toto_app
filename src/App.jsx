import { useState, useEffect, useCallback } from "react";
import React from "react";
import { supabase } from './supabase.js';
import {
  sbGetUser, sbCreateUser, sbResetPin, sbVerifyRecovery, sbClearUser,
  sbGetPrediction, sbSavePrediction,
  sbGetActualResults, sbSaveActualResults,
  sbGetLeaderboard, sbUpsertLeaderboard,
  sbGetSaveHistory, sbAddSaveHistory,
  sbGetAIContent, sbSaveAIContent,
  sbGetMessages, sbSendMessage, sbDeleteMessage,
  sbUpdateRankHistory, sbGetRankHistory,
  sbGetReactions, sbToggleReaction,
  saveSession, getSession, clearSession,
  generateRecoveryCode,
  lsGet, lsSet, lsDel, stGet, stSet, detectStorage,
} from './storage.js';
import { fetchLiveFeed, parseFeed, applyFeedToState } from './liveFeed.js';
import GROUP_INSIGHTS from './insights.js';
import EXPERT_PREDICTIONS from './experts.js';


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
function isMatchLocked(match, kickoffs) {
  const key = `${match.home}||${match.away}`;
  const ko = kickoffs[key];
  if (!ko) return false; // unknown kickoff = not locked
  const LOCK_BEFORE_MS = 15 * 60 * 1000;
  return Date.now() >= (ko - LOCK_BEFORE_MS);
}

// Format time until predictions lock (15 min before kickoff)
function timeUntilLock(match, kickoffs) {
  const key = `${match.home}||${match.away}`;
  const ko = kickoffs[key];
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
const CHAMPION_LOCK_DATE = new Date("2026-06-11T17:00:00Z").getTime();
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
  if (correctGD)  return {points:3,label:"Correct goal diff 📐",color:"#fcb900"};
  if (correctOut) return {points:2,label:"Correct outcome ✓",  color:"#60a5fa"};
  return            {points:0,label:"No points",               color:"#ef4444"};
}

function calcTotal(pM,aM,pK,aK,predPodium,actualPodium){
  let t=0;
  for(const p of pM){const a=aM.find(m=>m.id===p.id);if(a){const r=calcMatchPoints(p,a);if(r)t+=r.points;}}
  for(const p of pK){const a=aK.find(m=>m.id===p.id);if(a){const r=calcMatchPoints(p,a);if(r)t+=r.points;}}
  if(actualPodium&&predPodium){
    if(predPodium.first  && predPodium.first ===actualPodium.first)  t+=100;
    if(predPodium.second && predPodium.second===actualPodium.second) t+=50;
    if(predPodium.third  && predPodium.third ===actualPodium.third)  t+=25;
  }
  return t;
}

function calcStandings(teams,matches){
  const tbl=Object.fromEntries(teams.map(t=>[t,{p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}]));
  for(const m of matches){
    if(m.homeScore===null||m.awayScore===null)continue;
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
        background:readOnly?"rgba(255,255,255,0.03)":"rgba(255,255,255,0.09)",
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
          border:"1px solid rgba(255,255,255,0.13)",borderRadius:9,padding:"9px 13px",
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
  // Check group stage insights first
  const insightKey = `${home}||${away}`;
  const insightKeyRev = `${away}||${home}`;
  const groupInsight = GROUP_INSIGHTS[insightKey] || (GROUP_INSIGHTS[insightKeyRev] ? {
    ...GROUP_INSIGHTS[insightKeyRev], h: GROUP_INSIGHTS[insightKeyRev].a, a: GROUP_INSIGHTS[insightKeyRev].h
  } : null);
  if (groupInsight) return groupInsight;

  // Fall back to live predictions (KO or admin-generated)
  const merged = { ...DEFAULT_AI_PREDICTIONS, ...(livePreds||{}) };
  if (merged[insightKey]) return merged[insightKey];
  if (merged[insightKeyRev]) {
    const p = merged[insightKeyRev];
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
      background:locked?"rgba(239,68,68,0.04)":done?"rgba(252,185,0,0.05)":"rgba(255,255,255,0.025)",
      border:`1px solid ${locked?"rgba(239,68,68,0.2)":done?"rgba(252,185,0,0.2)":"rgba(255,255,255,0.07)"}`,
      borderRadius:11,padding:"10px 10px",marginBottom:8,
    }}>
      {/* Main match row — no buttons, full width for teams */}
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        <span style={{fontSize:16,flexShrink:0}}>{FLAGS[match.home]||"🏳️"}</span>
        <span style={{flex:1,fontWeight:600,fontSize:11,color:winner===match.home?"#fcb900":locked?"#888":"#ddd",
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{match.home}</span>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:3}}>
            <ScoreInput value={match.homeScore} onChange={v=>onUpdate({...match,homeScore:v})} readOnly={locked}/>
            <span style={{color:"#444",fontWeight:700,fontSize:11}}>–</span>
            <ScoreInput value={match.awayScore} onChange={v=>onUpdate({...match,awayScore:v})} readOnly={locked}/>
          </div>
          {actDone&&<div style={{fontSize:9,color:"#555",fontFamily:"monospace"}}>{actual.homeScore}–{actual.awayScore}</div>}
          {!locked&&countdown&&<div style={{fontSize:9,color:"#60a5fa"}}>⏱ {countdown}</div>}
        </div>
        <span style={{flex:1,textAlign:"right",fontWeight:600,fontSize:11,color:winner===match.away?"#fcb900":locked?"#888":"#ddd",
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{match.away}</span>
        <span style={{fontSize:16,flexShrink:0}}>{FLAGS[match.away]||"🏳️"}</span>
        {locked&&!result&&<span style={{fontSize:11,flexShrink:0}}>🔒</span>}
        {result&&<PointsBadge result={result}/>}
      </div>

      {/* Tool buttons row */}
      {(aiPred&&!locked)||expertData||true?(
        <div style={{display:"flex",gap:6,marginTop:6,paddingTop:5,
          borderTop:"1px solid rgba(255,255,255,0.04)"}}>
          {aiPred&&!locked&&(
            <button onClick={()=>setShowAI(p=>!p)} style={{
              padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              background:showAI?"rgba(139,92,246,0.2)":"rgba(139,92,246,0.08)",
              border:"1px solid rgba(139,92,246,0.25)",borderRadius:5,color:"#a78bfa",
            }}>🤖 AI prediction</button>
          )}
          {expertData&&(
            <button onClick={()=>setShowExperts(p=>!p)} style={{
              padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              background:showExperts?"rgba(34,197,94,0.2)":"rgba(34,197,94,0.06)",
              border:"1px solid rgba(34,197,94,0.2)",borderRadius:5,color:"#22c55e",
            }}>🔍 Experts</button>
          )}
          <button onClick={fetchOdds} style={{
            padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            background:showOdds?"rgba(96,165,250,0.2)":"rgba(96,165,250,0.05)",
            border:"1px solid rgba(96,165,250,0.2)",borderRadius:5,color:"#60a5fa",
          }}>📊 Market odds</button>
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
                {matchOdds.volume&&<span style={{fontSize:9,color:"#444",marginLeft:"auto"}}>{matchOdds.volume} vol</span>}
                <button onClick={()=>setShowOdds(false)} style={{padding:"1px 6px",background:"rgba(255,255,255,0.05)",
                  border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,color:"#555",
                  fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
              </div>
              {(matchOdds.outcomes?.length>0?matchOdds.outcomes:[
                {label:match.home,prob:matchOdds.homeProb},
                {label:"Draw",prob:matchOdds.drawProb},
                {label:match.away,prob:matchOdds.awayProb},
              ].filter(o=>o.prob!=null)).map((o,i)=>(
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
              ))}
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                <span style={{fontSize:9,color:"#444"}}>Price in ¢ = % probability</span>
                {matchOdds.url&&<a href={matchOdds.url} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:9,color:"#60a5fa",textDecoration:"none"}}>View ↗</a>}
              </div>
            </>
          ):(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:11,color:"#444"}}>
                📊 {matchOdds?.message||"Markets open closer to June 11"}
              </span>
              <button onClick={()=>setShowOdds(false)} style={{padding:"1px 6px",background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,color:"#555",
                fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
            </div>
          )}
        </div>
      )}
      {showAI&&aiPred&&(
        <div style={{marginTop:8,padding:"10px 12px",borderRadius:8,background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:11,color:"#a78bfa",fontWeight:700}}>🤖 AI Prediction:</span>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#c4b5fd",letterSpacing:1}}>{aiPred.h} – {aiPred.a}</span>
            {aiPred.confidence&&(
              <span style={{fontSize:9,color:"#6d5a9c",
                background:"rgba(139,92,246,0.15)",borderRadius:4,padding:"2px 6px"}}>
                {aiPred.confidence} confidence
              </span>
            )}
            <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
              {!locked&&<button onClick={()=>{onUpdate({...match,homeScore:aiPred.h,awayScore:aiPred.a});setShowAI(false);}} style={{padding:"3px 10px",background:"rgba(139,92,246,0.2)",border:"1px solid rgba(139,92,246,0.4)",borderRadius:5,color:"#c4b5fd",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Use</button>}
              <button onClick={()=>setShowAI(false)} style={{padding:"3px 8px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:5,color:"#555",fontSize:11,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>✕</button>
            </div>
          </div>
          {aiPred.insight&&(
            <div style={{fontSize:11,color:"#8b7dbf",lineHeight:1.6,marginBottom:6}}>{aiPred.insight}</div>
          )}
          {aiPred.key&&(
            <div style={{fontSize:10,color:"#6d5a9c",fontStyle:"italic",borderTop:"1px solid rgba(139,92,246,0.15)",paddingTop:6}}>
              🔑 Key factor: {aiPred.key}
            </div>
          )}
          {!aiPred.insight&&aiPred.r&&(
            <div style={{fontSize:10,color:"#7c6db3",fontStyle:"italic"}}>{aiPred.r}</div>
          )}
        </div>
      )}
      {showExperts&&<ExpertPanel home={match.home} away={match.away} data={expertData}/>}
      <ReactionsBar matchId={match.id} userName={userName} home={match.home} away={match.away}/>
    </div>
  );
}

function ReactionsBar({matchId, userName, home, away}) {
  const EMOJIS = ["🔥","😱","😂","👏","💔","🎯"];
  const [counts, setCounts] = useState({});
  const [mine, setMine] = useState(new Set());

  const loadReactions = async () => {
    const rows = await sbGetReactions(matchId);
    const c={}, m=new Set();
    rows.forEach(r=>{ c[r.emoji]=(c[r.emoji]||0)+1; if(r.username===userName) m.add(r.emoji); });
    setCounts(c); setMine(m);
  };

  useEffect(()=>{
    if(!matchId) return;
    loadReactions();
    const sub = supabase.channel(`reactions_${matchId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'reactions',
        filter:`match_id=eq.${matchId}`}, loadReactions)
      .subscribe();
    return ()=>supabase.removeChannel(sub);
  },[matchId]);

  const toggle = async(emoji) => {
    const added = await sbToggleReaction(matchId, userName, emoji);
    // Echo to chat when adding (not removing) a reaction
    if(added && home && away) {
      await sbSendMessage('⚡', `${emoji} ${userName} reacted to ${home} vs ${away}`);
    }
  };

  return(
    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
      {EMOJIS.map(e=>(
        <button key={e} onClick={()=>toggle(e)} style={{
          padding:"2px 7px",borderRadius:12,fontSize:12,cursor:"pointer",fontFamily:"inherit",
          background:mine.has(e)?"rgba(252,185,0,0.15)":"rgba(255,255,255,0.04)",
          border:`1px solid ${mine.has(e)?"rgba(252,185,0,0.4)":"rgba(255,255,255,0.08)"}`,
          color:mine.has(e)?"#fcb900":"#666",
          display:"flex",alignItems:"center",gap:3,
        }}>
          <span>{e}</span>
          {counts[e]>0&&<span style={{fontSize:9,fontWeight:700}}>{counts[e]}</span>}
        </button>
      ))}
    </div>
  );
}

function StandingsTable({teams,matches}){
  const rows=calcStandings(teams,matches);
  const [compact,setCompact]=useState(false);
  return(
    <div style={{marginTop:6}}>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:4}}>
        <button onClick={()=>setCompact(p=>!p)} style={{
          padding:"2px 8px",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
          background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:4,color:"#555",
        }}>{compact?"📋 Full table":"📱 Compact"}</button>
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
                borderTop:"1px solid rgba(255,255,255,0.04)"}}>
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
                <tr key={r.team} style={{background:i<2?"rgba(252,185,0,0.07)":"transparent",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
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
    <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:11,padding:"11px 15px",marginBottom:20,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <span style={{fontSize:11,fontWeight:700,color:"#fcb900",marginRight:2}}>📋 Scoring:</span>
      {[
        {pts:100,text:"1st place",color:"#f59e0b",icon:"🥇"},
        {pts:50,text:"2nd place",color:"#aaa",icon:"🥈"},
        {pts:25,text:"3rd place",color:"#cd7f32",icon:"🥉"},
        {pts:6,text:"Exact score",color:"#22c55e",icon:"⭐"},
        {pts:3,text:"Correct GD",color:"#fcb900",icon:"📐"},
        {pts:2,text:"Correct outcome",color:"#60a5fa",icon:"✓"},
      ].map((r,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:5,background:`${r.color}12`,border:`1px solid ${r.color}30`,borderRadius:7,padding:"5px 11px"}}>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:r.color,lineHeight:1}}>{r.pts}</span>
          <span style={{fontSize:11,color:"#777"}}>{r.icon} {r.text}</span>
        </div>
      ))}
      <span style={{fontSize:10,color:"#444",marginLeft:"auto"}}>Rules are mutually exclusive</span>
    </div>
  );
}

function ExpertPanel({ home, away, data, loading }) {
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
      </div>
      {data.sources?.map((s,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,
          padding:"4px 0",borderTop:i>0?"1px solid rgba(255,255,255,0.04)":"none",fontSize:10}}>
          <span style={{color:"#555",width:80,flexShrink:0,fontWeight:600}}>{s.name}</span>
          <span style={{flex:1,color:"#ccc"}}>{s.pick}</span>
          {s.pct!=null&&(
            <span style={{color:"#22c55e",fontWeight:700,flexShrink:0}}>{s.pct}%</span>
          )}
          {s.confidence&&(
            <span style={{fontSize:9,color:
              s.confidence==="High"?"#22c55e":s.confidence==="Medium"?"#fcb900":"#555",
              flexShrink:0}}>{s.confidence}</span>
          )}
        </div>
      ))}
      {data.summary&&(
        <div style={{marginTop:8,fontSize:11,color:"#555",lineHeight:1.6,
          borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:7,fontStyle:"italic"}}>
          {data.summary}
        </div>
      )}
    </div>
  );
}

function KOMatchButtons({liveHome, liveAway, aiP}) {
  const [showAI, setShowAI] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  const [showExperts, setShowExperts] = useState(false);
  const [odds, setOdds] = useState(aiP?.polymarket||null);
  const [oddsLoading, setOddsLoading] = useState(false);
  // Use stored expert data if admin generated it, otherwise fetch fresh
  const [expertData, setExpertData] = useState(aiP?.experts||null);
  const [expertLoading, setExpertLoading] = useState(false);

  // Update if admin pushes new data via Supabase real-time
  React.useEffect(()=>{
    if (aiP?.experts && !expertData) setExpertData(aiP.experts);
  }, [aiP?.experts]);

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
      <div style={{display:"flex",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
        {aiP&&<button onClick={()=>setShowAI(p=>!p)} style={{
          padding:"3px 10px",background:"rgba(139,92,246,0.12)",
          border:"1px solid rgba(139,92,246,0.3)",borderRadius:5,
          color:"#a78bfa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
        }}>🤖 AI</button>}
        <button onClick={fetchExperts} style={{
          padding:"3px 10px",
          background:showExperts?"rgba(34,197,94,0.2)":"rgba(34,197,94,0.06)",
          border:"1px solid rgba(34,197,94,0.2)",borderRadius:5,
          color:"#22c55e",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
        }}>🔍 Experts</button>
        <button onClick={fetchOdds} style={{
          padding:"3px 10px",
          background:showOdds?"rgba(96,165,250,0.18)":"rgba(96,165,250,0.08)",
          border:"1px solid rgba(96,165,250,0.25)",borderRadius:5,
          color:"#60a5fa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
        }}>📊 Odds</button>
      </div>
      {showAI&&aiP&&(
        <div style={{marginTop:8,padding:"10px 12px",borderRadius:8,
          background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:11,color:"#a78bfa",fontWeight:700}}>🤖 AI:</span>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#c4b5fd",letterSpacing:1}}>{aiP.h} – {aiP.a}</span>
            {aiP.confidence&&<span style={{fontSize:9,color:"#6d5a9c",background:"rgba(139,92,246,0.15)",borderRadius:4,padding:"2px 6px"}}>{aiP.confidence}</span>}
            <button onClick={()=>setShowAI(false)} style={{marginLeft:"auto",padding:"1px 6px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,color:"#555",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
          </div>
          {aiP.insight&&<div style={{fontSize:11,color:"#8b7dbf",lineHeight:1.6,marginBottom:4}}>{aiP.insight}</div>}
          {aiP.key&&<div style={{fontSize:10,color:"#6d5a9c",fontStyle:"italic"}}>🔑 {aiP.key}</div>}
          {!aiP.insight&&aiP.r&&<div style={{fontSize:10,color:"#7c6db3",fontStyle:"italic"}}>{aiP.r}</div>}
        </div>
      )}
      {(showExperts||expertLoading)&&(
        <ExpertPanel home={liveHome} away={liveAway} data={expertData} loading={expertLoading}/>
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
                {odds.volume&&<span style={{fontSize:9,color:"#444",marginLeft:"auto"}}>{odds.volume}</span>}
                <button onClick={()=>setShowOdds(false)} style={{padding:"1px 6px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,color:"#555",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
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
                <span style={{fontSize:9,color:"#444"}}>¢ = % probability</span>
                {odds.url&&<a href={odds.url} target="_blank" rel="noopener noreferrer" style={{fontSize:9,color:"#60a5fa",textDecoration:"none"}}>View ↗</a>}
              </div>
            </>
          ):(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:11,color:"#444"}}>📊 {odds?.message||"Markets not open yet"}</span>
              <button onClick={()=>setShowOdds(false)} style={{padding:"1px 6px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,color:"#555",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
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
      setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:'smooth'}), 100);
    }
  };

  // Poll chat messages every 10s while on chat tab
  useEffect(()=>{
    if(tab!=="chat") return;
    const poll = setInterval(()=>{
      sbGetMessages(50).then(msgs=>{
        setChatMessages(prev=>{
          // Merge — keep optimistic ones, add any new real ones
          const realIds = new Set(msgs.map(m=>m.id));
          const optimistic = prev.filter(m=>m.id?.startsWith('optimistic_'));
          return [...msgs, ...optimistic.filter(o=>
            !msgs.some(m=>m.username===o.username&&m.message===o.message)
          )];
        });
      });
    }, 10000);
    return ()=>clearInterval(poll);
  },[tab]);
  const [userName,setUserName]=useState("");
  const [appError,setAppError]=useState(null);
  const [recentPoints,setRecentPoints]=useState(null); // points earned notification
  const [predictionCount,setPredictionCount]=useState({done:0,total:0}); // completion indicator
  const [showPredReminder,setShowPredReminder]=useState(false);
  const [liveMatches,setLiveMatches]=useState([]);
  const [liveLoading,setLiveLoading]=useState(false);
  const [liveError,setLiveError]=useState(null);
  const [selectedFixture,setSelectedFixture]=useState(null);
  const [fixtureStats,setFixtureStats]=useState(null);
  const [fixtureEvents,setFixtureEvents]=useState([]);
  const [fixtureLineups,setFixtureLineups]=useState([]);
  const [fixturePlayers,setFixturePlayers]=useState([]);
  const [marketOdds,setMarketOdds]=useState({}); // "Home||Away" → odds data
  const [liveLastUpdated,setLiveLastUpdated]=useState(null);
  const [todayMatches,setTodayMatches]=useState([]);
  const [refreshCooldown,setRefreshCooldown]=useState(0); // seconds remaining
  const [matchAnalysis,setMatchAnalysis]=useState({});
  const [simActive,setSimActive]=useState(false);
  const [simMinute,setSimMinute]=useState(0);
  const [simEvents,setSimEvents]=useState([]);
  const [simStats,setSimStats]=useState(null);
  const [simAnalysis,setSimAnalysis]=useState(null);
  const [simAnalysisLoading,setSimAnalysisLoading]=useState(false);
  const [bracketPred,setBracketPred]=useState(null);
  const [bracketLoading,setBracketLoading]=useState(false);
  const [bracketGeneratedBy,setBracketGeneratedBy]=useState(null);
  const [commentary,setCommentary]=useState(null);
  const [commentaryLoading,setCommentaryLoading]=useState(false);
  const [commentaryGeneratedBy,setCommentaryGeneratedBy]=useState(null);
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
  const [chatSending,setChatSending]=useState(false);
  const [chatUnread,setChatUnread]=useState(0);
  const chatBottomRef=React.useRef(null);
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
  const [podium,setPodium]=useState({first:null,second:null,third:null});
  const [actualPodium,setActualPodium]=useState({first:null,second:null,third:null});
  const [now,setNow]=useState(Date.now());
  const [adminMode,setAdminMode]=useState(false);
  const [adminPinInput,setAdminPinInput]=useState("");
  const [adminPinError,setAdminPinError]=useState("");
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
  const KICKOFFS = {"Mexico||South Africa":1781204400000,"South Africa||Mexico":1781204400000,"South Korea||Czechia":1781229600000,"Czechia||South Korea":1781229600000,"Czechia||South Africa":1781798400000,"South Africa||Czechia":1781798400000,"Mexico||South Korea":1781830800000,"South Korea||Mexico":1781830800000,"Czechia||Mexico":1782349200000,"Mexico||Czechia":1782349200000,"South Africa||South Korea":1782349200000,"South Korea||South Africa":1782349200000,"Canada||Bosnia-Herzegovina":1781290800000,"Bosnia-Herzegovina||Canada":1781290800000,"Qatar||Switzerland":1781377200000,"Switzerland||Qatar":1781377200000,"Switzerland||Bosnia-Herzegovina":1781809200000,"Bosnia-Herzegovina||Switzerland":1781809200000,"Canada||Qatar":1781820000000,"Qatar||Canada":1781820000000,"Switzerland||Canada":1782327600000,"Canada||Switzerland":1782327600000,"Bosnia-Herzegovina||Qatar":1782327600000,"Qatar||Bosnia-Herzegovina":1782327600000,"Brazil||Morocco":1781388000000,"Morocco||Brazil":1781388000000,"Haiti||Scotland":1781398800000,"Scotland||Haiti":1781398800000,"Scotland||Morocco":1781906400000,"Morocco||Scotland":1781906400000,"Brazil||Haiti":1781915400000,"Haiti||Brazil":1781915400000,"Scotland||Brazil":1782338400000,"Brazil||Scotland":1782338400000,"Morocco||Haiti":1782338400000,"Haiti||Morocco":1782338400000,"USA||Paraguay":1781312400000,"Paraguay||USA":1781312400000,"Australia||Turkey":1781409600000,"Turkey||Australia":1781409600000,"USA||Australia":1781895600000,"Australia||USA":1781895600000,"Turkey||Paraguay":1781924400000,"Paraguay||Turkey":1781924400000,"Turkey||USA":1782439200000,"USA||Turkey":1782439200000,"Paraguay||Australia":1782439200000,"Australia||Paraguay":1782439200000,"Germany||Curacao":1781456400000,"Curacao||Germany":1781456400000,"Ivory Coast||Ecuador":1781478000000,"Ecuador||Ivory Coast":1781478000000,"Germany||Ivory Coast":1781985600000,"Ivory Coast||Germany":1781985600000,"Ecuador||Curacao":1782000000000,"Curacao||Ecuador":1782000000000,"Curacao||Ivory Coast":1782417600000,"Ivory Coast||Curacao":1782417600000,"Ecuador||Germany":1782417600000,"Germany||Ecuador":1782417600000,"Netherlands||Japan":1781467200000,"Japan||Netherlands":1781467200000,"Sweden||Tunisia":1781488800000,"Tunisia||Sweden":1781488800000,"Netherlands||Sweden":1781974800000,"Sweden||Netherlands":1781974800000,"Tunisia||Japan":1782014400000,"Japan||Tunisia":1782014400000,"Japan||Sweden":1782428400000,"Sweden||Japan":1782428400000,"Tunisia||Netherlands":1782428400000,"Netherlands||Tunisia":1782428400000,"Belgium||Egypt":1781550000000,"Egypt||Belgium":1781550000000,"Iran||New Zealand":1781571600000,"New Zealand||Iran":1781571600000,"Belgium||Iran":1782068400000,"Iran||Belgium":1782068400000,"New Zealand||Egypt":1782090000000,"Egypt||New Zealand":1782090000000,"Egypt||Iran":1782529200000,"Iran||Egypt":1782529200000,"New Zealand||Belgium":1782529200000,"Belgium||New Zealand":1782529200000,"Spain||Cape Verde":1781539200000,"Cape Verde||Spain":1781539200000,"Saudi Arabia||Uruguay":1781560800000,"Uruguay||Saudi Arabia":1781560800000,"Spain||Saudi Arabia":1782057600000,"Saudi Arabia||Spain":1782057600000,"Uruguay||Cape Verde":1782079200000,"Cape Verde||Uruguay":1782079200000,"Cape Verde||Saudi Arabia":1782518400000,"Saudi Arabia||Cape Verde":1782518400000,"Uruguay||Spain":1782518400000,"Spain||Uruguay":1782518400000,"France||Senegal":1781636400000,"Senegal||France":1781636400000,"Iraq||Norway":1781647200000,"Norway||Iraq":1781647200000,"France||Iraq":1782162000000,"Iraq||France":1782162000000,"Norway||Senegal":1782172800000,"Senegal||Norway":1782172800000,"Norway||France":1782500400000,"France||Norway":1782500400000,"Senegal||Iraq":1782500400000,"Iraq||Senegal":1782500400000,"Argentina||Algeria":1781658000000,"Algeria||Argentina":1781658000000,"Austria||Jordan":1781668800000,"Jordan||Austria":1781668800000,"Argentina||Austria":1782147600000,"Austria||Argentina":1782147600000,"Jordan||Algeria":1782183600000,"Algeria||Jordan":1782183600000,"Algeria||Austria":1782612000000,"Austria||Algeria":1782612000000,"Jordan||Argentina":1782612000000,"Argentina||Jordan":1782612000000,"Portugal||DR Congo":1781715600000,"DR Congo||Portugal":1781715600000,"Uzbekistan||Colombia":1781748000000,"Colombia||Uzbekistan":1781748000000,"Portugal||Uzbekistan":1782234000000,"Uzbekistan||Portugal":1782234000000,"Colombia||DR Congo":1782266400000,"DR Congo||Colombia":1782266400000,"Colombia||Portugal":1782603000000,"Portugal||Colombia":1782603000000,"DR Congo||Uzbekistan":1782603000000,"Uzbekistan||DR Congo":1782603000000,"England||Croatia":1781726400000,"Croatia||England":1781726400000,"Ghana||Panama":1781737200000,"Panama||Ghana":1781737200000,"England||Ghana":1782244800000,"Ghana||England":1782244800000,"Panama||Croatia":1782255600000,"Croatia||Panama":1782255600000,"Panama||England":1782594000000,"England||Panama":1782594000000,"Croatia||Ghana":1782594000000,"Ghana||Croatia":1782594000000};

  // Initial load — detect storage then check session and load data
  useEffect(()=>{
    (async()=>{
      try {
        await detectStorage();
        const session = await stGet("wc26_session");
        if (session?.username && session?.expiry > Date.now()) {
          setUserName(session.username);
        }
        const lb=await sbGetLeaderboard(); if(lb) setLeaderboard(lb);
        const actual=await sbGetActualResults();
        if(actual?.matches?.length)       setActualMatches(actual.matches);
        if(actual?.knockout?.length)       setActualKO(actual.knockout);
        if(actual?.actual_podium)    setActualPodium(p=>({...p,...actual.actual_podium}));
        if(actual?.ko_kickoffs)      setKoKickoffs(actual.ko_kickoffs);
        if(actual?.live_predictions) setLivePredictions(actual.live_predictions);
        if(actual)                   setAdminHasSaved(true);
        const hist = await sbGetSaveHistory();
        if(hist) setSaveHistory(hist);
        // Load shared AI content
        const aiContent = await sbGetAIContent();
        if(aiContent?.bracket)   { setBracketPred(aiContent.bracket); setBracketGeneratedBy(aiContent.bracket_generated_by); }
        if(aiContent?.commentary){ setCommentary(aiContent.commentary); setCommentaryGeneratedBy(aiContent.commentary_generated_by); }
        // Load rank history
        if(session?.username) {
          const rh = await sbGetRankHistory(session.username);
          if(rh?.length) setRankHistory(rh);
        }
      } catch(e) {
        console.error('Initial load error:', e);
        setAppError(`Load failed: ${e.message}`);
      }
    })();
    const nowInterval=setInterval(()=>setNow(Date.now()),60*1000);
    return ()=>clearInterval(nowInterval);
  },[]);

  // ── Real-time subscriptions ─────────────────────────────────────────────────
  useEffect(()=>{
    // Subscribe to actual_results changes (admin saves scores)
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

    // Subscribe to ai_content changes (any user generates bracket/commentary)
    const aiSub = supabase
      .channel('ai_content_changes')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'ai_content' }, payload=>{
        const d = payload.new;
        if(d.bracket)    { setBracketPred(d.bracket);   setBracketGeneratedBy(d.bracket_generated_by); }
        if(d.commentary) { setCommentary(d.commentary); setCommentaryGeneratedBy(d.commentary_generated_by); }
      })
      .subscribe();

    // Load chat + subscribe to new messages
    sbGetMessages(50).then(msgs => setChatMessages(msgs));
    const chatSub = supabase
      .channel('chat_realtime')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'chat_messages' }, payload=>{
        setChatMessages(prev => {
          const filtered = prev.filter(m =>
            !(m.id?.startsWith('optimistic_') &&
              m.username === payload.new.username &&
              m.message === payload.new.message)
          );
          if (filtered.some(m => m.id === payload.new.id)) return filtered;
          return [...filtered, payload.new];
        });
        setChatUnread(u => u + 1);
        setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:'smooth'}), 100);
      })
      .subscribe(status => console.log('Chat sub:', status));

    // Subscribe to leaderboard changes
    const lbSub = supabase
      .channel('leaderboard_changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'leaderboard' }, async ()=>{
        const lb = await sbGetLeaderboard();
        if(lb) setLeaderboard(lb);
      })
      .subscribe();

    return ()=>{
      supabase.removeChannel(resultsSub);
      supabase.removeChannel(lbSub);
      supabase.removeChannel(aiSub);
      supabase.removeChannel(chatSub);
    };
  },[]);

  // ── Prediction completion counter ───────────────────────────────────────────
  useEffect(()=>{
    const total = ALL_MATCHES.length + KNOCKOUT_TEMPLATE.length;
    const donePreds = [
      ...matches.filter(m=>m.homeScore!==null&&m.awayScore!==null),
      ...knockout.filter(m=>m.homeScore!==null&&m.awayScore!==null&&m.home!=="TBD"),
    ].length;
    setPredictionCount({done:donePreds, total});
  },[matches,knockout]);

  useEffect(()=>{
    if(!userName)return;
    (async()=>{
      try {
        const p=await sbGetPrediction(userName);
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

          // Check completion — show reminder if less than 50% predicted
          const totalPreds = ALL_MATCHES.length;
          const donePreds = (p.matches||[]).filter(m=>m.homeScore!==null&&m.awayScore!==null).length;
          if(donePreds < totalPreds * 0.5) setShowPredReminder(true);
        } else {
          // New user with no predictions — always show reminder
          setShowPredReminder(true);
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
    await stSet(`wc26_backup_${userName}`, data);
    await stSet(`wc26_backup_meta_${userName}`, { at });
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
    await sbSaveActualResults(blankMatches, blankKO, blankPodium, koKickoffs);
    const lb=await sbGetLeaderboard();
    for(const e of lb){
      const p=await sbGetPrediction(e.username);
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
    // Only fill if we actually have some results — don't fill from empty standings
    const hasResults = actualMatches.some(m=>m.homeScore!==null);
    if (!hasResults) {
      setAdminPinError("Enter some group stage results first!");setTimeout(()=>setAdminPinError(""),3000);
      return;
    }
    setActualKO(prev=>fillLiveBracket(prev, liveQuals, null));
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
    await sbSaveActualResults(actualMatches, actualKO, actualPodium, koKickoffs, newPreds);
    setOddsGenStatus({
      ok: done > 0,
      msg: done > 0
        ? `✅ Found ${done} Polymarket markets${notFound>0?`, ${notFound} not listed yet`:""}.`
        : `⏳ No Polymarket markets found yet — try again closer to June 11.`
    });
    setGeneratingOdds(false);
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
    await sbSaveActualResults(actualMatches, actualKO, actualPodium, koKickoffs, newPreds);
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
    await sbSaveActualResults(actualMatches, actualKO, actualPodium, koKickoffs, newPreds);
    setAiGenStatus({
      ok: failed === 0,
      msg: `✅ Generated ${done} KO insights${failed > 0 ? ` (${failed} failed)` : ""}. Tap 🤖 on any KO match to see the analysis.`
    });
    setGeneratingAI(false);
  };

  const syncFromLiveFeed = async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const data = await fetchLiveFeed();
      const parsed = parseFeed(data, actualMatches, actualKO);
      const applied = applyFeedToState(parsed, actualMatches, actualKO, actualPodium, koKickoffs);

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
  const fetchLiveMatches = async () => {
    if (refreshCooldown > 0) return;
    setLiveLoading(true);
    setLiveError(null);
    try {
      const [liveRes, todayRes] = await Promise.all([
        fetch('/api/live?type=live'),
        fetch('/api/live?type=today'),
      ]);
      const [liveData, todayData] = await Promise.all([liveRes.json(), todayRes.json()]);
      if (liveData.error) {
        // "internal error" from API = season not available yet — treat as no matches
        const isSeasonError = liveData.error.toLowerCase().includes('internal') ||
          liveData.error.toLowerCase().includes('season') ||
          liveData.error.toLowerCase().includes('2026');
        if (isSeasonError) {
          setLiveMatches([]);
          setTodayMatches([]);
          setLiveLastUpdated(new Date());
          setRefreshCooldown(60);
          setLiveLoading(false);
          return;
        }
        throw new Error(liveData.tip ? `${liveData.error} — ${liveData.tip}` : liveData.error);
      }
      setLiveMatches(liveData.response || []);
      setTodayMatches(todayData.response || []);
      setLiveLastUpdated(new Date());
      // Start 60s cooldown
      setRefreshCooldown(60);
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

  const fetchFixtureDetails = async (fixtureId) => {
    setFixtureStats(null);
    setFixtureEvents([]);
    setFixtureLineups([]);
    setFixturePlayers([]);
    try {
      const [statsRes, eventsRes, lineupsRes, playersRes] = await Promise.all([
        fetch(`/api/live?type=stats&fixtureId=${fixtureId}`),
        fetch(`/api/live?type=events&fixtureId=${fixtureId}`),
        fetch(`/api/live?type=lineups&fixtureId=${fixtureId}`),
        fetch(`/api/live?type=players&fixtureId=${fixtureId}`),
      ]);
      const [stats, events, lineups, players] = await Promise.all([
        statsRes.json(), eventsRes.json(), lineupsRes.json(), playersRes.json()
      ]);
      setFixtureStats(stats.response || []);
      setFixtureEvents(events.response || []);
      setFixtureLineups(lineups.response || []);
      setFixturePlayers(players.response || []);
    } catch(e) {
      console.error('Fixture details error:', e);
    }
  };

  const analyseMatch = async (fixture) => {
    const id = fixture.fixture?.id;
    if (!id) return;
    setMatchAnalysis(prev => ({...prev, [id]: {text:null, loading:true}}));
    const homeName = fixture.teams?.home?.name;
    const awayName = fixture.teams?.away?.name;
    const pred = matches.find(m =>
      (m.home===homeName&&m.away===awayName)||(m.home===awayName&&m.away===homeName)
    );
    const userPred = pred?.homeScore!==null ? {
      home: pred.home===homeName ? pred.homeScore : pred.awayScore,
      away: pred.home===homeName ? pred.awayScore : pred.homeScore,
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
      setMatchAnalysis(prev => ({...prev, [id]: {text: data.analysis||data.error, loading:false}}));
    } catch(e) {
      setMatchAnalysis(prev => ({...prev, [id]: {text:`Error: ${e.message}`, loading:false}}));
    }
  };

  // ── AI Tournament Features ─────────────────────────────────────────────────
  const generateBracket = async () => {
    setBracketLoading(true);
    try {
      const res = await fetch('/api/tournament', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ type:'bracket' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBracketPred(data);
      setBracketGeneratedBy(userName);
      // Save to Supabase with who generated it — real-time pushes to all users
      await sbSaveAIContent(data, commentary, userName, commentaryGeneratedBy);
    } catch(e) { console.error('Bracket error:', e); }
    setBracketLoading(false);
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
      await sbSaveAIContent(bracketPred, data.commentary, bracketGeneratedBy, userName);
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
          const p = await sbGetPrediction(e.username);
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
        e.type === "Card" && e.detail === "Red Card" &&
        e.team?.name === teamName
      );
      // Apply subs
      subs.forEach(sub => {
        const outName = sub.player?.name || sub.assist?.name;
        const inName  = sub.assist?.name || sub.player?.name;
        const idx = current.findIndex(p => p.name === outName || p.player?.name === outName);
        if (idx >= 0) {
          current[idx] = { ...current[idx], name: inName, subbed: true };
        }
      });
      // Apply red cards
      reds.forEach(red => {
        const name = red.player?.name;
        const idx = current.findIndex(p => p.name === name || p.player?.name === name);
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
          <span style={{fontSize:9,color:"#444"}}>🟥 = red card</span>
          <span style={{fontSize:9,color:"#444"}}>🟢 = subbed on</span>
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
        background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:11}}>
        <div style={{fontSize:10,color:"#555",fontWeight:700,marginBottom:8,letterSpacing:1}}>WIN PROBABILITY</div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{textAlign:"center",width:50}}>
            <div style={{fontSize:18}}>{homeFlag}</div>
            <div style={{fontSize:9,color:"#888",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",
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
            <div style={{fontSize:9,color:"#888",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",
              textOverflow:"ellipsis",maxWidth:50}}>{awayName?.split(" ")[0]}</div>
          </div>
        </div>
        <div style={{fontSize:9,color:"#444",textAlign:"center"}}>
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

  // Load live data when tab is opened — manual refresh only (saves API quota)
  useEffect(()=>{
    if(tab!=="live") return;
    fetchLiveMatches();
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
      const prev = await sbGetActualResults() || {};
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
      await sbSaveActualResults(actualMatches, actualKO, newPodium, koKickoffs, livePredictions);
      // livePredictions saved with actual results

      const lb=await sbGetLeaderboard();
      for(const e of lb){
        const p=await sbGetPrediction(e.username);
        if(p){
          e.points=calcTotal(p.matches||[],actualMatches,p.knockout||[],actualKO,p.podium,newPodium);
          e.champion=p.podium?.first||"?";
        }
      }
      lb.sort((a,b)=>b.points-a.points);
      // leaderboard updated via sbUpsertLeaderboard
      setLeaderboard(lb);
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
    await sbSaveActualResults(snapshot.matches, snapshot.knockout, snapshot.actual_podium || snapshot.actualPodium || {}, snapshot.ko_kickoffs || snapshot.koKickoffs || {}, livePredictions);
    const lb=await sbGetLeaderboard();
    for(const e of lb){
      const p=await sbGetPrediction(e.username);
      if(p){
        e.points=calcTotal(p.matches||[],snapshot.matches,p.knockout||[],snapshot.knockout,p.podium,snapshot.actual_podium||snapshot.actualPodium||{});
        e.champion=p.podium?.first||"?";
      }
    }
    lb.sort((a,b)=>b.points-a.points);
    // leaderboard updated via sbUpsertLeaderboard
    setLeaderboard(lb);
    setAdminHasSaved(true); setAdminSaved(true); setTimeout(()=>setAdminSaved(false),2500);
  };

  const myPts=calcTotal(matches,actualMatches,knockout,actualKO,podium,actualPodium);

  // Recalc and update own leaderboard entry whenever actual results change
  useEffect(()=>{
    if(!userName) return;
    const prevPts = predictionCount._prevPts || 0;
    const newPts = calcTotal(matches,actualMatches,knockout,actualKO,podium,actualPodium);
    if(prevPts > 0 && newPts > prevPts) {
      setRecentPoints(newPts - prevPts);
      setTimeout(()=>setRecentPoints(null), 5000);
    }
    sbUpsertLeaderboard(userName,podium,newPts)
      .then(lb=>{ if(lb) setLeaderboard(lb); })
      .catch(e=>console.error('Leaderboard update error:', e));
  },[actualMatches,actualKO,actualPodium]);


  // Step 1: check if name exists in storage
  const submitName=async()=>{
    const n=nameInput.trim();if(!n)return;
    setPinError("Checking…");
    const user=await sbGetUser(n);
    if(user){ setPinStep("pin-existing"); setPinError(""); }
    else    { setPinStep("pin-new");      setPinError(""); }
  };

  // Step 2a: new user — create account in storage
  const SESSION_DAYS = 30;
  const _saveSession = async (username) => {
    await stSet("wc26_session", {
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
      await sbCreateUser(n, pinInput, code);
      setRecoveryCode(code);
      setPinStep("show-recovery");
    } catch(e) {
      setPinError(`Error creating account: ${e.message}`);
    }
  };

  // Confirm recovery code seen — proceed to app
  const confirmRecoverySeen=async()=>{
    const n=nameInput.trim();
    try {
      if (rememberMe) await saveSession(n);
      setUserName(n);
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
      const user=await sbGetUser(n);
      if(user && pinInput===user.pin){
        if (rememberMe) await saveSession(n);
        setUserName(n);
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
    await sbResetPin(n, newPinInput);
    if(rememberMe) await saveSession(n);
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
    await sbSavePrediction(userName, blankMatches, blankKO, blankPodium);
    const lb = await sbUpsertLeaderboard(userName, blankPodium, 0);
    setLeaderboard(lb);
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  const savePreds=async()=>{
    if(!userName)return;
    await sbSavePrediction(userName, matches, knockout, podium);
    const lb = await sbUpsertLeaderboard(userName, podium, myPts);
    setLeaderboard(lb);
    await saveBackup(matches, knockout, podium); // Options 1+3: auto-backup on every save
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  const saveActualResults=async(newMatches, newKO)=>{
    await sbSaveActualResults(newMatches||actualMatches, newKO||actualKO, actualPodium);
    const lb=await sbGetLeaderboard();
    for(const e of lb){
      const p=await sbGetPrediction(e.username);
      if(p){
        e.points=calcTotal(p.matches||[],newMatches||actualMatches,p.knockout||[],newKO||actualKO,p.podium,actualPodium);
        e.champion=p.podium?.first||"?";
      }
    }
    lb.sort((a,b)=>b.points-a.points);
    setLeaderboard(lb);
    // Update rank history for each user
    for(const [i,e] of lb.entries()){
      await sbUpdateRankHistory(e.username, i+1, e.points);
    }
    // Refresh own rank history
    const rh = await sbGetRankHistory(userName);
    if(rh?.length) setRankHistory(rh);
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

  // LOGIN (multi-step: name → PIN)
  if(!userName) {
    const inputStyle={
      width:"100%",padding:"13px 16px",background:"rgba(255,255,255,0.06)",
      border:"1px solid rgba(255,255,255,0.13)",borderRadius:10,
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
                onKeyDown={e=>e.key==="Enter"&&submitName()}
                style={inputStyle}/>
              <button onClick={submitName} style={btnStyle}>CONTINUE →</button>
            </div>
          )}

          {/* Step 2a: new user — set PIN */}
          {pinStep==="pin-new" && (
            <div style={{textAlign:"left"}}>
              <div style={{
                background:"rgba(252,185,0,0.08)",border:"1px solid rgba(252,185,0,0.2)",
                borderRadius:9,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#999",
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
                  border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#555",
                  fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
            </div>
          )}

          {/* Step 2b: returning user — verify PIN */}
          {pinStep==="pin-existing" && (
            <div style={{textAlign:"left"}}>
              <div style={{
                background:"rgba(34,197,94,0.07)",border:"1px solid rgba(34,197,94,0.2)",
                borderRadius:9,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#999",
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
                  border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#555",
                  fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Different name</button>
            </div>
          )}

          {/* Step: show recovery code after account creation */}
          {pinStep==="show-recovery" && (
            <div style={{textAlign:"left"}}>
              <div style={{
                background:"rgba(252,185,0,0.08)",border:"1px solid rgba(252,185,0,0.3)",
                borderRadius:9,padding:"14px",marginBottom:16,
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
                borderRadius:9,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#999",
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
                  border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#555",
                  fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Back to PIN</button>
            </div>
          )}

          {/* Step: reset PIN after recovery code verified */}
          {pinStep==="reset-pin" && (
            <div style={{textAlign:"left"}}>
              <div style={{
                background:"rgba(34,197,94,0.07)",border:"1px solid rgba(34,197,94,0.2)",
                borderRadius:9,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#999",
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

  const TABS_ROW1=[
    {id:"groups",      label:"⚽", full:"⚽ Groups"},
    {id:"knockout",    label:"🏆", full:"🏆 Knockout"},
    {id:"champion",    label:"👑", full:"👑 My Pick"},
    {id:"scoring",     label:"📊", full:"📊 Scoring"},
    {id:"leaderboard", label:"🥇", full:"🥇 Board"},
  ];
  const TABS_ROW2=[
    {id:"stats",  label:"📈", full:"📈 Stats"},
    {id:"live",   label:"🔴", full:"🔴 Live"},
    {id:"chat",   label:"💬", full:"💬 Chat"},
    {id:"ai",     label:"🤖", full:"🤖 AI"},
    {id:"admin",  label:"🔧", full:"🔧 Admin"},
    {id:"help",   label:"❓", full:"❓ Help"},
  ];
  const TABS=[...TABS_ROW1,...TABS_ROW2];

  return(
    <div style={{minHeight:"100vh",background:"#0a0d12",
      backgroundImage:"radial-gradient(ellipse 70% 38% at 50% 0%,rgba(0,90,48,0.3) 0%,transparent 65%)",
      fontFamily:"'DM Sans',sans-serif",color:"#e8e8e8"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700&display=swap');
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
            <div style={{fontSize:13,color:"#aaa",lineHeight:1.7,marginBottom:8,textAlign:"center"}}>
              You've predicted{" "}
              <strong style={{color:"#fff"}}>
                {matches.filter(m=>m.homeScore!==null).length}/{ALL_MATCHES.length}
              </strong>{" "}
              group matches.
            </div>
            <div style={{
              background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",
              borderRadius:9,padding:"10px 14px",marginBottom:18,fontSize:12,color:"#fca5a5",
              textAlign:"center",lineHeight:1.6,
            }}>
              🔒 Predictions lock <strong>15 minutes before kickoff</strong>.<br/>
              First match kicks off <strong>June 11, 2026</strong> — don't miss it!
            </div>
            {/* Progress bar */}
            <div style={{marginBottom:18}}>
              <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden",marginBottom:4}}>
                <div style={{
                  width:`${Math.round(matches.filter(m=>m.homeScore!==null).length/ALL_MATCHES.length*100)}%`,
                  height:"100%",background:"#fcb900",borderRadius:3,transition:"width 0.5s",
                }}/>
              </div>
              <div style={{fontSize:10,color:"#555",textAlign:"right"}}>
                {Math.round(matches.filter(m=>m.homeScore!==null).length/ALL_MATCHES.length*100)}% complete
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setShowPredReminder(false);setTab("groups");}} style={{
                flex:2,padding:"12px",background:"#fcb900",border:"none",borderRadius:9,
                color:"#000",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
              }}>⚽ Go to Predictions</button>
              <button onClick={()=>setShowPredReminder(false)} style={{
                flex:1,padding:"12px",background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,
                color:"#666",fontSize:13,cursor:"pointer",fontFamily:"inherit",
              }}>Later</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:"rgba(0,0,0,0.4)",backdropFilter:"blur(14px)",
        position:"sticky",top:0,zIndex:100,borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        {/* Main header row */}
        <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>⚽</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:"#fcb900",lineHeight:1}}>FIFA 2026</div>
            <div style={{fontSize:9,color:"#444"}}>Prediction Challenge</div>
          </div>
          {myPts>0&&<div style={{background:"rgba(252,185,0,0.12)",border:"1px solid rgba(252,185,0,0.28)",
            borderRadius:7,padding:"3px 9px",fontSize:11,fontWeight:700,color:"#fcb900",flexShrink:0}}>🏅 {myPts}pts</div>}
          <span style={{fontSize:10,color:"#444",flexShrink:0,maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>👤 {userName}</span>
          <button onClick={savePreds} style={{padding:"6px 14px",background:saved?"#22c55e":"#fcb900",
            border:"none",borderRadius:7,color:"#000",fontWeight:700,fontSize:12,cursor:"pointer",
            transition:"all 0.3s",fontFamily:"inherit",flexShrink:0}}>{saved?"✓":"Save"}</button>
        </div>

        {/* Mini leaderboard — top 3 */}
        {leaderboard.length>0&&(
          <div style={{padding:"0 14px 8px",display:"flex",gap:4,overflowX:"auto"}}>
            {leaderboard.slice(0,3).map((e,i)=>{
              const medals=["🥇","🥈","🥉"];
              const isMe=e.username===userName;
              return(
                <div key={e.username} style={{
                  display:"flex",alignItems:"center",gap:5,
                  padding:"3px 8px",borderRadius:6,flexShrink:0,
                  background:isMe?"rgba(252,185,0,0.12)":"rgba(255,255,255,0.04)",
                  border:`1px solid ${isMe?"rgba(252,185,0,0.3)":"rgba(255,255,255,0.07)"}`,
                }}>
                  <span style={{fontSize:12}}>{medals[i]}</span>
                  <span style={{fontSize:10,fontWeight:isMe?700:400,
                    color:isMe?"#fcb900":"#888",maxWidth:60,overflow:"hidden",
                    textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.username}</span>
                  <span style={{fontSize:10,color:"#555",fontWeight:700}}>{e.points}pts</span>
                </div>
              );
            })}
            {/* My rank if not in top 3 */}
            {(()=>{
              const myRank=leaderboard.findIndex(e=>e.username===userName);
              if(myRank>=3) return(
                <div style={{display:"flex",alignItems:"center",gap:5,
                  padding:"3px 8px",borderRadius:6,flexShrink:0,
                  background:"rgba(252,185,0,0.12)",border:"1px solid rgba(252,185,0,0.3)"}}>
                  <span style={{fontSize:10,color:"#fcb900",fontWeight:700}}>#{myRank+1}</span>
                  <span style={{fontSize:10,color:"#fcb900",fontWeight:700}}>{userName}</span>
                  <span style={{fontSize:10,color:"#555"}}>{myPts}pts</span>
                </div>
              );
            })()}
            <button onClick={()=>setShowShareCard(true)} style={{
              marginLeft:"auto",padding:"3px 9px",flexShrink:0,
              background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:6,color:"#555",fontSize:10,cursor:"pointer",fontFamily:"inherit",
            }}>📤 Share</button>
          </div>
        )}

        {/* Action row */}
        <div style={{padding:"0 14px 8px",display:"flex",gap:6}}>
          <button onClick={exportPredictions} style={{
            padding:"4px 9px",background:"transparent",border:"1px solid rgba(96,165,250,0.3)",
            borderRadius:6,color:"#60a5fa",fontSize:10,cursor:"pointer",fontFamily:"inherit",
          }}>📤 Export</button>
          <button onClick={()=>setShowImport(p=>!p)} style={{
            padding:"4px 9px",background:"transparent",border:"1px solid rgba(252,185,0,0.3)",
            borderRadius:6,color:"#fcb900",fontSize:10,cursor:"pointer",fontFamily:"inherit",
          }}>📥 Import</button>
          <button onClick={()=>setShowUserResetConfirm(true)} style={{
            padding:"4px 9px",background:"transparent",border:"1px solid rgba(239,68,68,0.3)",
            borderRadius:6,color:"#ef4444",fontSize:10,cursor:"pointer",fontFamily:"inherit",
          }}>🗑 Reset</button>
          <button onClick={()=>{clearSession();setUserName("");setNameInput("");setPinInput("");setPinConfirm("");setPinStep("name");setPinError("");}} style={{
            padding:"4px 9px",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:6,color:"#555",fontSize:10,cursor:"pointer",fontFamily:"inherit",marginLeft:"auto",
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
            borderRadius:14,padding:"22px 24px",maxWidth:360,width:"100%"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#ef4444",marginBottom:10}}>
              Reset My Predictions?
            </div>
            <div style={{fontSize:13,color:"#aaa",marginBottom:8,lineHeight:1.6}}>
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
                background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",
                borderRadius:8,color:"#888",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Option 2: backup reminder banner */}
      {userName && (() => {
        const daysSince = lastBackupAt ? (Date.now()-lastBackupAt)/(1000*60*60*24) : null;
        const noBackup = lastBackupAt===null;
        const stale = daysSince!==null && daysSince >= BACKUP_WARN_DAYS;
        if (!noBackup && !stale) return null;
        return(
          <div style={{
            background:"rgba(239,68,68,0.08)",borderBottom:"1px solid rgba(239,68,68,0.2)",
            padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,
          }}>
            <span style={{fontSize:11,color:"#fca5a5"}}>
              ⚠️ {noBackup
                ? "No backup yet — tap Export after saving your predictions"
                : `Last backup ${Math.floor(daysSince)} day${Math.floor(daysSince)!==1?"s":""} ago — consider exporting`}
            </span>
            <button onClick={exportPredictions} style={{
              padding:"4px 12px",background:"rgba(239,68,68,0.15)",
              border:"1px solid rgba(239,68,68,0.3)",borderRadius:6,
              color:"#fca5a5",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0,
            }}>📤 Backup now</button>
          </div>
        );
      })()}

      {/* Import/export panel */}
      {showImport&&(
        <div style={{
          background:"rgba(252,185,0,0.07)",borderBottom:"1px solid rgba(252,185,0,0.2)",
          padding:"12px 16px",
        }}>
          <div style={{fontSize:12,color:"#fcb900",fontWeight:700,marginBottom:4}}>
            📤 Export: Copy the text below and save it somewhere safe.<br/>
            📥 Import: Paste previously exported text here, then tap Import.
            {lastBackupAt&&<span style={{color:"#22c55e",fontWeight:400,fontSize:11}}> · Last backup: {new Date(lastBackupAt).toLocaleDateString()} {new Date(lastBackupAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>}
          </div>
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <textarea value={importText} onChange={e=>setImportText(e.target.value)}
              placeholder='Tap Export above to see your predictions, or paste exported JSON here to import…'
              style={{flex:1,height:80,padding:"8px",background:"rgba(0,0,0,0.3)",
                border:"1px solid rgba(255,255,255,0.15)",borderRadius:7,
                color:"#fff",fontSize:11,fontFamily:"monospace",resize:"none",outline:"none"}}/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={importPredictions} style={{
                padding:"8px 14px",background:"#fcb900",border:"none",borderRadius:7,
                color:"#000",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",
              }}>Import</button>
              <button onClick={async()=>{
                const backup=await stGet(`wc26_backup_${userName}`);
                if(backup){setImportText(JSON.stringify(backup));}
                else{setImportText("No backup found in storage yet.");}
              }} style={{
                padding:"8px 14px",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",
                borderRadius:7,color:"#22c55e",fontSize:11,cursor:"pointer",fontFamily:"inherit",
              }}>♻️ Restore</button>
              <button onClick={()=>{setShowImport(false);setImportText("");}} style={{
                padding:"8px 14px",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:7,color:"#555",fontSize:12,cursor:"pointer",fontFamily:"inherit",
              }}>Close</button>
            </div>
          </div>
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
                    <div key={i} style={{background:"rgba(255,255,255,0.04)",
                      border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:9,color:"#444",marginBottom:4}}>{s.label}</div>
                      <div style={{fontSize:15,fontWeight:700,color:s.color}}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {/* Rank chart sparkline */}
                {rankHistory.length>1&&(
                  <div style={{marginBottom:16,padding:"10px 12px",
                    background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
                    borderRadius:10}}>
                    <div style={{fontSize:9,color:"#444",marginBottom:6}}>📈 Rank History</div>
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
                        background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
                        borderRadius:8,fontSize:10}}>
                        <div style={{fontSize:14}}>{p.e}</div>
                        <div style={{color:"#888",marginTop:2,fontSize:9}}>{p.t}</div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={handleShare} style={{
                  width:"100%",padding:"13px",
                  background:"linear-gradient(135deg,#fcb900,#f59e0b)",
                  border:"none",borderRadius:10,color:"#000",
                  fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,
                  cursor:"pointer",
                }}>📤 Share to WhatsApp</button>
                <button onClick={()=>setShowShareCard(false)} style={{
                  width:"100%",padding:"8px",marginTop:8,
                  background:"transparent",border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:8,color:"#555",fontSize:11,cursor:"pointer",fontFamily:"inherit",
                }}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TABS */}
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",
        background:"rgba(0,0,0,0.22)",overflowX:"auto",
        WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>handleTabChange(t.id)} style={{
            flexShrink:0,
            padding: tab===t.id ? "10px 12px" : "10px 8px",
            background:"transparent",border:"none",
            borderBottom:`2px solid ${tab===t.id?"#fcb900":"transparent"}`,
            color:tab===t.id?"#fcb900":"#555",
            fontSize: tab===t.id ? 11 : 16,
            fontWeight:600,
            cursor:"pointer",transition:"all 0.2s",fontFamily:"inherit",whiteSpace:"nowrap",
            position:"relative",
          }}>
            {tab===t.id ? t.full : t.label}
            {t.id==="chat"&&chatUnread>0&&tab!=="chat"&&(
              <span style={{
                position:"absolute",top:4,right:-2,
                background:"#ef4444",color:"#fff",borderRadius:"50%",
                width:14,height:14,fontSize:8,fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>{chatUnread>9?"9+":chatUnread}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{maxWidth:820,margin:"0 auto",padding:"16px 12px"}}>

        {/* ── GROUPS ── */}
        {tab==="groups"&&<div>
          <ScoringBar/>
          {/* Live sync status */}
          <div style={{marginBottom:12}}><AdminPill/></div>

          {/* Lock info banner */}
          <div style={{
            background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",
            borderRadius:10,padding:"9px 14px",marginBottom:18,
            fontSize:11,color:"#aaa",display:"flex",alignItems:"center",gap:8,
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
                padding:"6px 12px",borderRadius:7,border:"1px solid",
                borderColor:activeGroup===g?"#fcb900":"rgba(255,255,255,0.08)",
                background:activeGroup===g?"rgba(252,185,0,0.12)":"transparent",
                color:activeGroup===g?"#fcb900":"#666",
                fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",
              }}>Group {g}</button>
            ))}
          </div>
          <div style={{position:"relative"}}>
            {/* Floating standings button */}
            <button onClick={()=>setShowStandings(p=>!p)} style={{
              position:"sticky",top:4,zIndex:50,float:"right",
              padding:"5px 12px",marginBottom:8,
              background:showStandings?"rgba(252,185,0,0.2)":"rgba(252,185,0,0.08)",
              border:`1px solid ${showStandings?"rgba(252,185,0,0.5)":"rgba(252,185,0,0.2)"}`,
              borderRadius:7,color:"#fcb900",fontSize:11,fontWeight:700,
              cursor:"pointer",fontFamily:"inherit",
            }}>
              {showStandings?"✕ Hide":"📊 Standings"}
            </button>

            <h3 style={{margin:"0 0 10px",fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1,color:"#fcb900"}}>
              Group {activeGroup} — My Predictions
            </h3>

            {/* Standings panel — appears inline above matches */}
            {showStandings&&(
              <div style={{
                background:"rgba(255,255,255,0.03)",border:"1px solid rgba(252,185,0,0.2)",
                borderRadius:11,padding:11,marginBottom:14,
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
          <ScoringBar/>
          <div style={{marginBottom:18}}><AdminPill/></div>
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
            background:"rgba(255,255,255,0.025)",borderRadius:8,padding:"10px 14px",
            border:"1px solid rgba(255,255,255,0.06)",lineHeight:1.8,
          }}>
            <div style={{marginBottom:4}}>
              <span style={{color:"#fcb900",fontWeight:700}}>How it works:</span>
            </div>
            <div>🔧 <strong style={{color:"#aaa"}}>Admin fills team names</strong> — after the group stage, the admin uses ⚡ Fill R32 to populate teams from actual standings, then enters scores round by round.</div>
            <div style={{marginTop:4}}>✏️ <strong style={{color:"#aaa"}}>You predict the scores</strong> for each match once teams are known. You can also type any team name manually to override.</div>
            <div style={{marginTop:4}}>↺ <strong style={{color:"#aaa"}}>Reset to TBD</strong> clears all team names so the admin can repopulate cleanly.</div>
          </div>
          {KO_ROUNDS.map(round=>{
            const rM=knockout.filter(m=>m.round===round);
            const rA=actualKO.filter(m=>m.round===round);
            return(
              <div key={round} style={{marginBottom:24}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{height:1,flex:1,background:"rgba(255,255,255,0.06)"}}/>
                  <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2,color:"#555",whiteSpace:"nowrap"}}>{round}</span>
                  <div style={{height:1,flex:1,background:"rgba(255,255,255,0.06)"}}/>
                </div>
                {rM.map(m=>{
                  const act=rA.find(a=>a.id===m.id);
                  const res=act?calcMatchPoints(m,act):null;
                  const liveHome=act?.home||"TBD";
                  const liveAway=act?.away||"TBD";
                  const teamsKnown=liveHome!=="TBD"&&liveAway!=="TBD";
                  // Merge group kickoffs with admin-set KO kickoffs
                  const allKickoffs={...KICKOFFS,...Object.fromEntries(
                    Object.entries(koKickoffs).map(([id,ms])=>{
                      const ko=actualKO.find(x=>x.id===id);
                      return ko?[[`${ko.home}||${ko.away}`,ms],[`${ko.away}||${ko.home}`,ms]]:[];
                    }).flat().filter(e=>e.length)
                  )};
                  const locked=isMatchLocked({...m,home:liveHome,away:liveAway},allKickoffs);
                  const countdown=!locked?timeUntilLock({...m,home:liveHome,away:liveAway},allKickoffs):null;
                  return(
                    <div key={m.id} style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${locked?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.07)"}`,
                      borderRadius:11,padding:"11px 13px",marginBottom:8}}>
                      {/* Live team names from feed */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:teamsKnown?8:0}}>
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
                        {countdown&&<span style={{fontSize:10,color:"#60a5fa",flexShrink:0}}>⏱{countdown}</span>}
                      </div>
                      {/* Score prediction — only when teams known and not locked */}
                      {teamsKnown&&(
                        <div style={{display:"flex",alignItems:"center",gap:8,
                          paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
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
                              borderBottom:"1px solid rgba(255,255,255,0.08)",
                              color:"#aaa",fontSize:11,padding:"4px 0",outline:"none",fontFamily:"inherit"}}/>
                          <span style={{color:"#333",fontSize:10}}>vs</span>
                          <input value={m.away==="TBD"?"":m.away} placeholder="✏️ Team 2…"
                            onChange={e=>upKO({...m,away:e.target.value||"TBD"})}
                            style={{flex:1,textAlign:"right",background:"transparent",border:"none",
                              borderBottom:"1px solid rgba(255,255,255,0.08)",
                              color:"#aaa",fontSize:11,padding:"4px 0",outline:"none",fontFamily:"inherit"}}/>
                        </div>
                      )}
                      {/* AI + Polymarket buttons for KO matches */}
                      {teamsKnown&&<KOMatchButtons
                        liveHome={liveHome} liveAway={liveAway}
                        aiP={livePredictions[`${liveHome}||${liveAway}`]}
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
            {key:"first",  label:"1st Place 🥇", pts:100, color:"#f59e0b", actual:actualPodium?.first},
            {key:"second", label:"2nd Place 🥈", pts:50,  color:"#aaa",    actual:actualPodium?.second},
            {key:"third",  label:"3rd Place 🥉", pts:25,  color:"#cd7f32", actual:actualPodium?.third},
          ];

          // AI podium suggestion — default or admin-updated
          const DEFAULT_AI_PODIUM = { first:"Brazil", second:"France", third:"Argentina",
            reason:"Brazil's squad depth and form make them favourites. France runners-up from their European base. Argentina defending champions but aging squad." };
          const aiPodium = livePredictions["__podium__"] || DEFAULT_AI_PODIUM;

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
                      setPodium({first:aiPodium.first,second:aiPodium.second,third:aiPodium.third});
                      setSaved(false);
                    }} style={{
                      marginLeft:"auto",padding:"4px 12px",background:"rgba(139,92,246,0.2)",
                      border:"1px solid rgba(139,92,246,0.4)",borderRadius:6,
                      color:"#c4b5fd",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                    }}>Use all</button>
                  </div>
                  <div style={{display:"flex",gap:10,marginBottom:8}}>
                    {[
                      {place:"first", label:"🥇", color:"#f59e0b"},
                      {place:"second",label:"🥈", color:"#aaa"},
                      {place:"third", label:"🥉", color:"#cd7f32"},
                    ].map(p=>(
                      <div key={p.place} style={{
                        flex:1,background:`${p.color}10`,border:`1px solid ${p.color}30`,
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
                            color:"#a78bfa",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                          }}>Use</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:10,color:"#6b5fa0",fontStyle:"italic"}}>{aiPodium.reason}</div>
                </div>
              )}

              {/* Lock banner */}
              <div style={{textAlign:"center",marginBottom:18}}>
                {!champLocked && champCountdown && (
                  <div style={{display:"inline-flex",alignItems:"center",gap:8,
                    background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.3)",
                    borderRadius:9,padding:"8px 16px",fontSize:12,color:"#60a5fa"}}>
                    ⏱ Locks in <strong>{champCountdown}</strong> — June 11 at tournament kickoff
                  </div>
                )}
                {champLocked && (
                  <div style={{display:"inline-flex",alignItems:"center",gap:8,
                    background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",
                    borderRadius:9,padding:"8px 16px",fontSize:12,color:"#ef4444"}}>
                    🔒 Podium picks locked — tournament has started
                  </div>
                )}
              </div>

              {/* Points reminder */}
              <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:24}}>
                {places.map(p=>(
                  <div key={p.key} style={{
                    background:`${p.color}15`,border:`1px solid ${p.color}40`,
                    borderRadius:9,padding:"8px 16px",textAlign:"center",
                  }}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:p.color}}>{p.pts}</div>
                    <div style={{fontSize:10,color:"#666"}}>pts</div>
                    <div style={{fontSize:11,color:"#888",marginTop:2}}>{p.label}</div>
                  </div>
                ))}
              </div>

              {/* One picker per place */}
              {places.map(place=>(
                <div key={place.key} style={{marginBottom:24}}>
                  <div style={{
                    display:"flex",alignItems:"center",gap:10,marginBottom:10,
                  }}>
                    <div style={{height:1,flex:1,background:"rgba(255,255,255,0.07)"}}/>
                    <span style={{
                      fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:2,
                      color:place.color,whiteSpace:"nowrap",
                    }}>{place.label} — {place.pts} pts</span>
                    <div style={{height:1,flex:1,background:"rgba(255,255,255,0.07)"}}/>
                  </div>

                  {/* Current pick card */}
                  {podium[place.key] && (
                    <div style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"10px 14px",marginBottom:10,borderRadius:10,
                      background:place.actual&&podium[place.key]===place.actual
                        ?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.04)",
                      border:`1px solid ${place.actual&&podium[place.key]===place.actual
                        ?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.1)"}`,
                    }}>
                      <span style={{fontSize:22}}>{FLAGS[podium[place.key]]}</span>
                      <span style={{fontWeight:700,fontSize:14,flex:1,
                        color:place.actual&&podium[place.key]===place.actual?"#22c55e":"#fff"}}>
                        {podium[place.key]}
                      </span>
                      {place.actual && podium[place.key]===place.actual && (
                        <span style={{color:"#22c55e",fontWeight:700,fontSize:13}}>🎉 +{place.pts} pts</span>
                      )}
                      {place.actual && podium[place.key]!==place.actual && (
                        <span style={{color:"#555",fontSize:11}}>
                          Actual: {FLAGS[place.actual]} {place.actual}
                        </span>
                      )}
                      {!champLocked && (
                        <button onClick={()=>{setPodium(p=>({...p,[place.key]:null}));setSaved(false);}}
                          style={{padding:"3px 8px",background:"rgba(239,68,68,0.1)",
                            border:"1px solid rgba(239,68,68,0.25)",borderRadius:5,
                            color:"#ef4444",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                      )}
                    </div>
                  )}

                  {/* Searchable team picker */}
                  {!champLocked && (()=>{
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
                            background:"rgba(255,255,255,0.05)",
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
                            const usedElsewhere = !selected && Object.entries(podium)
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
                                  padding:"6px 11px",borderRadius:7,
                                  border:`1px solid ${selected?place.color:"rgba(255,255,255,0.07)"}`,
                                  background:selected?`${place.color}18`:"rgba(255,255,255,0.02)",
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
            </div>
          );
        })()}

        {/* ── SCORING ── */}
        {tab==="scoring"&&<div>
          <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#fcb900",marginTop:0}}>Scoring System</h2>

          {/* Match scoring rules */}
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:1,color:"#888",marginBottom:10}}>⚽ MATCH PREDICTIONS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
            {[
              {pts:6, label:"Exact Score (win)", icon:"⭐",desc:"Correct scoreline, non-draw",   color:"#22c55e",ex:"Pred 2-1 / Actual 2-1"},
              {pts:6, label:"Exact Score (draw)",icon:"⭐",desc:"Correct draw scoreline",         color:"#22c55e",ex:"Pred 1-1 / Actual 1-1"},
              {pts:3, label:"Correct GD",        icon:"📐",desc:"Right goal difference, wrong score",color:"#fcb900",ex:"Pred 3-2 / Actual 2-1"},
              {pts:2, label:"Correct Winner",    icon:"✓", desc:"Right outcome, wrong score/GD", color:"#60a5fa",ex:"Pred 3-1 / Actual 2-1"},
              {pts:2, label:"Draw Predicted",    icon:"✓", desc:"Draw correct, wrong score",     color:"#60a5fa",ex:"Pred 2-2 / Actual 1-1"},
            ].map((r,i)=>(
              <div key={i} style={{
                background:`${r.color}0e`,border:`1px solid ${r.color}30`,
                borderRadius:11,padding:"12px 14px",
                display:"flex",alignItems:"center",gap:12,
              }}>
                <div style={{textAlign:"center",flexShrink:0,width:52}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,color:r.color,lineHeight:1}}>{r.pts}</div>
                  <div style={{fontSize:9,color:"#555"}}>pts</div>
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:2}}>{r.icon} {r.label}</div>
                  <div style={{fontSize:11,color:"#555"}}>{r.desc}</div>
                  <div style={{fontSize:10,color:"#444",fontFamily:"monospace",marginTop:3}}>{r.ex}</div>
                </div>
              </div>
            ))}
            {/* Max per match */}
            <div style={{
              background:"rgba(252,185,0,0.06)",border:"1px solid rgba(252,185,0,0.15)",
              borderRadius:11,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,
            }}>
              <div style={{textAlign:"center",flexShrink:0,width:52}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,color:"#fcb900",lineHeight:1}}>6</div>
                <div style={{fontSize:9,color:"#555"}}>max</div>
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:12,marginBottom:2}}>🏆 Max per match</div>
                <div style={{fontSize:11,color:"#555"}}>Exact score = 6 pts</div>
                <div style={{fontSize:10,color:"#444",fontFamily:"monospace",marginTop:3}}>Rules are mutually exclusive</div>
              </div>
            </div>
          </div>

          {/* Podium rules */}
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:1,color:"#888",margin:"20px 0 10px"}}>👑 PODIUM PREDICTIONS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
            {[
              {pts:100,label:"1st Place",icon:"🥇",desc:"Correct champion",         color:"#f59e0b"},
              {pts:50, label:"2nd Place",icon:"🥈",desc:"Correct runner-up",        color:"#aaa"},
              {pts:25, label:"3rd Place",icon:"🥉",desc:"Correct 3rd place playoff",color:"#cd7f32"},
            ].map(r=>(
              <div key={r.pts} style={{
                background:`${r.color}0e`,border:`1px solid ${r.color}30`,
                borderRadius:11,padding:"14px",textAlign:"center",
              }}>
                <div style={{fontSize:26,marginBottom:4}}>{r.icon}</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:34,color:r.color,lineHeight:1}}>{r.pts}</div>
                <div style={{fontSize:10,color:"#555",marginBottom:6}}>points</div>
                <div style={{fontWeight:700,fontSize:12,marginBottom:2}}>{r.label}</div>
                <div style={{fontSize:11,color:"#555"}}>{r.desc}</div>
              </div>
            ))}
          </div>
          <div style={{
            background:"rgba(252,185,0,0.06)",border:"1px solid rgba(252,185,0,0.15)",
            borderRadius:10,padding:"10px 14px",marginBottom:20,fontSize:11,color:"#777",lineHeight:1.7,
          }}>
            🔒 Podium picks lock at <strong style={{color:"#fcb900"}}>June 11, 2026 17:00 UTC</strong> (first kickoff).
            Max podium bonus: <strong style={{color:"#f59e0b"}}>175 pts</strong> if all 3 correct.
          </div>

          {/* My score */}
          <div style={{background:"rgba(252,185,0,0.08)",border:"1px solid rgba(252,185,0,0.22)",
            borderRadius:13,padding:"16px 20px",marginBottom:16,
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
            background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:11,padding:"12px 16px",marginBottom:20,
          }}>
            <div style={{fontSize:11,color:"#555",marginBottom:10}}>🏆 Podium Picks</div>
            {[
              {key:"first", label:"🥇 1st Place", pts:100, color:"#f59e0b"},
              {key:"second",label:"🥈 2nd Place", pts:50,  color:"#aaa"},
              {key:"third", label:"🥉 3rd Place", pts:25,  color:"#cd7f32"},
            ].map(place=>{
              const myPick   = podium?.[place.key];
              const actual   = actualPodium?.[place.key];
              const correct  = myPick && actual && myPick===actual;
              return(
                <div key={place.key} style={{
                  display:"flex",alignItems:"center",gap:10,
                  padding:"7px 0",borderTop:"1px solid rgba(255,255,255,0.05)",
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
                    padding:"8px 12px",borderRadius:9,marginBottom:6,
                    background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",fontSize:11}}>
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
                    background:isMe?"rgba(252,185,0,0.07)":"rgba(255,255,255,0.025)",
                    border:`1px solid ${isMe?"rgba(252,185,0,0.25)":"rgba(255,255,255,0.06)"}`}}>
                    <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,width:28,textAlign:"center",
                      color:i===0?"#fcb900":i===1?"#aaa":i===2?"#cd7f32":"#333"}}>{medal||i+1}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13}}>
                        {entry.username}{isMe&&<span style={{color:"#fcb900",fontSize:10,marginLeft:6}}>(you)</span>}
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
                      color:i===0?"#fcb900":i===1?"#aaa":i===2?"#cd7f32":"#555"}}>
                      {entry.points||0} <span style={{fontSize:12,color:"#333"}}>pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{marginTop:24,padding:"14px 17px",background:"rgba(255,255,255,0.025)",
            borderRadius:11,border:"1px solid rgba(255,255,255,0.06)"}}>
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
            <div style={{marginTop:20,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"14px"}}>
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
                  }} style={{flex:1,padding:"8px 10px",background:"rgba(255,255,255,0.05)",
                    border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,
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
                          <div style={{fontSize:9,color:"#333",marginTop:2}}>
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
                        padding:"6px 8px",marginBottom:4,borderRadius:7,
                        background:!r1||!r2?"rgba(255,255,255,0.01)":"rgba(255,255,255,0.02)",
                        opacity:!r1||!r2?0.4:1}}>
                        <div style={{
                          width:28,textAlign:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:13,
                          color:r1&&r2?(r1.points>r2.points?"#fcb900":r1.points===r2.points?"#888":"#333"):"#333"
                        }}>{r1?`+${r1.points}`:"—"}</div>
                        <div style={{flex:1,fontSize:10,color:"#666",textAlign:"center"}}>
                          {FLAGS[actual.home]||"🏳️"} {actual.homeScore}–{actual.awayScore} {FLAGS[actual.away]||"🏳️"}
                          {(!r1||!r2)&&<div style={{fontSize:9,color:"#333"}}>no prediction</div>}
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
                <div style={{background:"#141922",border:"1px solid rgba(255,255,255,0.1)",
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
                      border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,
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
                          {key:"first", label:"🥇",pts:100,color:"#f59e0b",actual:actualPodium?.first},
                          {key:"second",label:"🥈",pts:50, color:"#aaa",   actual:actualPodium?.second},
                          {key:"third", label:"🥉",pts:25, color:"#cd7f32",actual:actualPodium?.third},
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
                            padding:"8px 10px",marginBottom:5,borderRadius:9,
                            background:`${result?.color||"#333"}10`,
                            border:`1px solid ${result?.color||"#333"}25`,
                          }}>
                            <span style={{fontSize:13}}>{FLAGS[actual.home]}</span>
                            <span style={{fontSize:11,flex:1,fontWeight:600}}>{actual.home}</span>
                            {/* Predicted */}
                            <div style={{textAlign:"center",minWidth:50}}>
                              <div style={{fontSize:10,color:"#444",marginBottom:1}}>pred</div>
                              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#aaa",letterSpacing:1}}>
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
                                padding:"8px 10px",marginBottom:5,borderRadius:9,
                                background:`${result?.color||"#333"}10`,
                                border:`1px solid ${result?.color||"#333"}25`,
                              }}>
                                <span style={{fontSize:13}}>{FLAGS[actual.home]}</span>
                                <span style={{fontSize:11,flex:1,fontWeight:600}}>{actual.home}</span>
                                <div style={{textAlign:"center",minWidth:50}}>
                                  <div style={{fontSize:10,color:"#444",marginBottom:1}}>pred</div>
                                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#aaa",letterSpacing:1}}>
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
          const playedMatches = actualMatches.filter(m=>m.homeScore!==null);
          const playedKO = actualKO.filter(m=>m.homeScore!==null&&m.home!=="TBD");
          const allPlayed = [...playedMatches, ...playedKO];

          const myResults = allPlayed.map(actual=>{
            const pred = [...matches,...knockout].find(m=>m.id===actual.id);
            return pred ? calcMatchPoints(pred,actual) : null;
          }).filter(Boolean);

          const exact   = myResults.filter(r=>r.points===6).length;
          const gd      = myResults.filter(r=>r.points===3).length;
          const outcome = myResults.filter(r=>r.points===2).length;
          const wrong   = myResults.filter(r=>r.points===0).length;
          const total   = myResults.length;
          const myPts   = myResults.reduce((s,r)=>s+r.points,0);
          const accuracy = total>0 ? Math.round(((exact+gd+outcome)/total)*100) : 0;

          // Best/worst matches
          const matchDetails = allPlayed.map(actual=>{
            const pred = [...matches,...knockout].find(m=>m.id===actual.id);
            const result = pred ? calcMatchPoints(pred,actual) : null;
            return result ? { actual, pred, result } : null;
          }).filter(Boolean);
          const best  = matchDetails.filter(m=>m.result.points===6).slice(0,3);
          const worst = matchDetails.filter(m=>m.result.points===0).slice(0,3);

          // ── Group analytics ─────────────────────────────────────────────
          // Per-match: how many players got it right
          const groupAnalytics = playedMatches.map(actual=>{
            let exactCount=0, anyPointsCount=0, totalPreds=0;
            leaderboard.forEach(e=>{
              // We can only use what's on the leaderboard — points already calc'd
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
            <div style={{flex:1,minWidth:80,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:11,padding:"12px 10px",textAlign:"center"}}>
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
                <div style={{textAlign:"center",color:"#444",padding:"40px 20px",fontSize:13}}>
                  Stats will appear here once matches kick off and results are entered.
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
                    <StatBox value={`#${myRank}`} label="Rank" color={myRank===1?"#fcb900":myRank===2?"#aaa":myRank===3?"#cd7f32":"#60a5fa"}/>
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

                  {/* Best predictions */}
                  {best.length>0&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#22c55e",marginBottom:8}}>⭐ Best Predictions</div>
                      {best.map(({actual,pred},i)=>(
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

                  {/* Worst predictions */}
                  {worst.length>0&&(
                    <div style={{marginBottom:24}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#ef4444",marginBottom:8}}>❌ Missed Predictions</div>
                      {worst.slice(0,3).map(({actual,pred},i)=>(
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
                      background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",
                      borderRadius:11}}>
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
                                stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
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
                  <div style={{marginBottom:16,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:11,padding:"14px"}}>
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
                        <div style={{flex:1,height:6,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}>
                          <div style={{width:leaderboard.length>0?`${(b.count/leaderboard.length)*100}%`:"0%",
                            height:"100%",background:b.color,borderRadius:3,transition:"width 0.5s"}}/>
                        </div>
                        <div style={{fontSize:11,color:"#555",width:20,textAlign:"right"}}>{b.count}</div>
                      </div>
                    ))}
                  </div>

                  {/* Podium picks breakdown */}
                  {leaderboard.length>0&&(()=>{
                    // Build counts for each place from leaderboard podium field
                    const placeCounts = { first:{}, second:{}, third:{} };
                    leaderboard.forEach(e=>{
                      const p = e.podium || {};
                      ['first','second','third'].forEach(place=>{
                        const t = p[place] || (place==='first' ? (e.champion||'?') : '?');
                        placeCounts[place][t] = (placeCounts[place][t]||0)+1;
                      });
                    });

                    const places = [
                      {key:'first',  label:'🥇 1st Place', color:'#f59e0b', pts:100},
                      {key:'second', label:'🥈 2nd Place', color:'#aaa',    pts:50},
                      {key:'third',  label:'🥉 3rd Place', color:'#cd7f32', pts:25},
                    ];

                    return(
                      <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:11,padding:"14px"}}>
                        <div style={{fontSize:12,fontWeight:700,marginBottom:14}}>👑 Podium Picks</div>
                        {places.map(place=>{
                          const counts = placeCounts[place.key];
                          const sorted = Object.entries(counts)
                            .filter(([t])=>t!=='?')
                            .sort((a,b)=>b[1]-a[1]).slice(0,5);
                          const unknown = counts['?']||0;
                          return(
                            <div key={place.key} style={{marginBottom:16}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                                <span style={{fontSize:12,fontWeight:700,color:place.color}}>{place.label}</span>
                                <span style={{fontSize:10,color:"#444"}}>+{place.pts}pts if correct</span>
                              </div>
                              {sorted.map(([team,count],i)=>(
                                <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                                  <span style={{fontSize:13}}>{FLAGS[team]||"🏳️"}</span>
                                  <span style={{fontSize:11,flex:1,fontWeight:600}}>{team}</span>
                                  <div style={{flex:2,height:5,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}>
                                    <div style={{width:`${(count/leaderboard.length)*100}%`,
                                      height:"100%",background:place.color,borderRadius:3}}/>
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
                              {place.key!=='third'&&<div style={{height:1,background:"rgba(255,255,255,0.05)",marginTop:10}}/>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          );
        })()}

        {/* ── LIVE ── */}
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
            <button onClick={fetchLiveMatches} disabled={liveLoading||refreshCooldown>0} style={{
              marginLeft:"auto",padding:"6px 14px",
              background:refreshCooldown>0?"rgba(255,255,255,0.03)":"rgba(239,68,68,0.1)",
              border:`1px solid ${refreshCooldown>0?"rgba(255,255,255,0.07)":"rgba(239,68,68,0.25)"}`,
              borderRadius:7,color:refreshCooldown>0?"#444":"#ef4444",fontSize:12,fontWeight:700,
              cursor:liveLoading||refreshCooldown>0?"not-allowed":"pointer",fontFamily:"inherit",
              minWidth:90,textAlign:"center",
            }}>
              {liveLoading?"⏳ Loading…":refreshCooldown>0?`⏱ ${refreshCooldown}s`:"🔄 Refresh"}
            </button>
          </div>

          {liveError&&!liveError.toLowerCase().includes('internal')&&(
            <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",
              borderRadius:9,padding:"12px 14px",marginBottom:16,fontSize:12,color:"#fca5a5"}}>
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
                        {isSelected&&<span style={{fontSize:9,color:"#555"}}>tap to close</span>}
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
              {selectedFixture&&(()=>{
                const f=selectedFixture;
                const home=f.teams?.home, away=f.teams?.away;
                const score=f.goals, status=f.fixture?.status, id=f.fixture?.id;
                const analysis=matchAnalysis[id];
                return(
                  <div style={{marginBottom:12,padding:"14px",
                    background:"rgba(255,255,255,0.025)",borderRadius:12,
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

                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#fcb900",marginBottom:8}}>📋 Match Events</div>
                        {fixtureEvents.map((ev,i)=>{
                          const isHome=ev.team?.id===home?.id;
                          const icon=ev.type==="Goal"?"⚽":ev.type==="Card"?(ev.detail==="Yellow Card"?"🟨":"🟥"):"🔄";
                          return(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",
                              borderTop:i>0?"1px solid rgba(255,255,255,0.04)":"none"}}>
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
                      </div>
                    )}
                    {fixtureStats?.length>=2&&(()=>{
                      const hs=fixtureStats[0]?.statistics||[], as_=fixtureStats[1]?.statistics||[];
                      const keys=["Ball Possession","Total Shots","Shots on Goal","Corner Kicks","Fouls","Yellow Cards"];
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
                                  <span style={{color:"#555",fontSize:9}}>{k}</span>
                                  <span style={{color:"#60a5fa",fontWeight:700}}>{av}</span>
                                </div>
                                <div style={{display:"flex",height:4,borderRadius:2,overflow:"hidden",background:"rgba(255,255,255,0.05)"}}>
                                  <div style={{width:`${(hn/tot)*100}%`,background:"#fcb900",borderRadius:"2px 0 0 2px"}}/>
                                  <div style={{width:`${(an/tot)*100}%`,background:"#60a5fa",borderRadius:"0 2px 2px 0"}}/>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {fixturePlayers.length>=2&&(()=>{
                      const all=fixturePlayers.flatMap(team=>(team.players||[]).map(p=>({
                        ...p.player,...p.statistics?.[0],teamFlag:FLAGS[team.team?.name]||"🏳️"
                      }))).filter(p=>p.games?.rating&&p.games?.minutes>0);
                      if(!all.length) return null;
                      const sorted=[...all].sort((a,b)=>parseFloat(b.games?.rating||0)-parseFloat(a.games?.rating||0));
                      const top=sorted.slice(0,3), poor=sorted.slice(-2).reverse();
                      const PR=({p,rank,isTop})=>{
                        const r=parseFloat(p.games?.rating||0).toFixed(1);
                        const c=isTop?(r>=8?"#22c55e":r>=7?"#fcb900":"#60a5fa"):"#ef4444";
                        return(
                          <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",marginBottom:4,
                            borderRadius:7,background:`${c}08`,border:`1px solid ${c}18`}}>
                            <span style={{fontSize:9,color:"#555",width:14,flexShrink:0}}>{isTop?`#${rank}`:"▼"}</span>
                            <span style={{fontSize:11,flexShrink:0}}>{p.teamFlag}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                              <div style={{fontSize:9,color:"#555",display:"flex",gap:6,marginTop:1}}>
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
                    {(()=>{
                      const nm=home?.name, am=away?.name;
                      const pred=matches.find(m=>(m.home===nm&&m.away===am)||(m.home===am&&m.away===nm));
                      if(!pred||pred.homeScore===null) return null;
                      const result=score?.home!==null?calcMatchPoints(pred,{homeScore:score?.home,awayScore:score?.away}):null;
                      return(
                        <div style={{marginBottom:12,padding:"10px 12px",
                          background:`${result?.color||"rgba(255,255,255,0.03)"}10`,
                          border:`1px solid ${result?.color||"rgba(255,255,255,0.07)"}25`,borderRadius:8}}>
                          <div style={{fontSize:10,color:"#555",marginBottom:4}}>Your prediction</div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#aaa"}}>{pred.homeScore}–{pred.awayScore}</span>
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
                          marginLeft:"auto",padding:"2px 8px",background:"rgba(255,255,255,0.05)",
                          border:"1px solid rgba(255,255,255,0.1)",borderRadius:5,
                          color:"#555",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                      </button>
                      {analysis?.text&&!analysis?.loading&&(
                        <div style={{marginTop:8,padding:"12px 14px",
                          background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.15)",
                          borderRadius:8,fontSize:12,color:"#c4b5fd",lineHeight:1.7,fontStyle:"italic"}}>
                          {analysis.text}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Today's matches */}
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
                    background:finished?"rgba(34,197,94,0.04)":"rgba(255,255,255,0.025)",
                    border:`1px solid ${finished?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.07)"}`,
                  }}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600}}>
                        {FLAGS[home?.name]||"🏳️"} {home?.name}
                      </div>
                      <div style={{fontSize:12,fontWeight:600,marginTop:4}}>
                        {FLAGS[away?.name]||"🏳️"} {away?.name}
                      </div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      {finished?(
                        <>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,
                            color:"#22c55e",letterSpacing:1}}>
                            {f.goals?.home} – {f.goals?.away}
                          </div>
                          <div style={{fontSize:9,color:"#22c55e"}}>{status}</div>
                        </>
                      ):(
                        <>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"#fcb900"}}>
                            {kickoff?.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                          </div>
                          <div style={{fontSize:9,color:"#555"}}>KO</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
                  background:"rgba(252,185,0,0.08)",border:"1px solid rgba(252,185,0,0.2)",
                  borderRadius:9,padding:"8px 14px",marginBottom:16,
                  display:"flex",alignItems:"center",gap:8,
                }}>
                  <span style={{fontSize:13}}>🎮</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#fcb900"}}>Demo Mode</div>
                    <div style={{fontSize:10,color:"#555"}}>Simulating Mexico vs South Africa · June 11 live experience</div>
                  </div>
                  <div style={{fontSize:10,color:"#444"}}>Real data from June 11</div>
                </div>

                {/* Match card */}
                <div style={{
                  padding:"18px 16px",borderRadius:14,marginBottom:12,
                  background: simMinute>0 ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.025)",
                  border:`1px solid ${simMinute>0 ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}`,
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
                        padding:"10px 14px",background:"rgba(255,255,255,0.05)",
                        border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,
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
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#444",marginTop:2}}>
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
                    <div style={{flex:1,background:"rgba(255,255,255,0.025)",
                      border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"10px"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#fcb900",marginBottom:8}}>📋 Events</div>
                      {simEvents.filter(e=>e.type!=="End").length===0&&(
                        <div style={{fontSize:10,color:"#333",textAlign:"center",padding:"8px 0"}}>No events yet</div>
                      )}
                      {simEvents.filter(e=>e.type!=="End").map((ev,i)=>{
                        const icon = ev.type==="Goal"?"⚽":ev.type==="Card"?(ev.detail?.includes("Yellow")?"🟨":"🟥"):"🔄";
                        const isHome = ev.side==="home";
                        return(
                          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:5,
                            padding:"4px 0",borderTop:i>0?"1px solid rgba(255,255,255,0.04)":"none",
                            animation:"fadeIn 0.4s ease"}}>
                            <span style={{fontSize:9,color:"#555",width:22,flexShrink:0,marginTop:1}}>{ev.min}'</span>
                            <span style={{fontSize:11}}>{icon}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:10,fontWeight:600,
                                color:isHome?"#fcb900":"#60a5fa",
                                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"
                              }}>{ev.player}</div>
                              {ev.assist&&<div style={{fontSize:9,color:"#444"}}>↳ {ev.assist}</div>}
                              {ev.type==="Sub"&&<div style={{fontSize:9,color:"#444"}}>↓ {ev.off}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stats */}
                    {simStats&&(
                      <div style={{flex:1,background:"rgba(255,255,255,0.025)",
                        border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"10px"}}>
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
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:2}}>
                                <span style={{color:"#fcb900",fontWeight:700}}>{s.h}</span>
                                <span style={{color:"#444"}}>{s.label}</span>
                                <span style={{color:"#60a5fa",fontWeight:700}}>{s.a}</span>
                              </div>
                              <div style={{display:"flex",height:3,borderRadius:2,overflow:"hidden",background:"rgba(255,255,255,0.05)"}}>
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
                        padding:"5px 8px",marginBottom:4,borderRadius:7,
                        background:`${color}08`,border:`1px solid ${color}18`}}>
                        <span style={{fontSize:10}}>{p.flag}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:700}}>{p.name}</div>
                          <div style={{fontSize:9,color:"#555",display:"flex",gap:5,marginTop:1}}>
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
            await sbSendMessage(userName, msg);
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
            <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 220px)",minHeight:400}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,
                  color:"#fcb900",margin:0}}>💬 Group Chat</h2>
                <div style={{fontSize:10,color:"#444"}}>
                  {leaderboard.length} players
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
                  <button onClick={()=>sbGetMessages(50).then(msgs=>setChatMessages(msgs))} style={{
                    padding:"3px 8px",background:"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,
                    color:"#555",fontSize:10,cursor:"pointer",fontFamily:"inherit",
                  }}>🔄</button>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#22c55e"}}/>
                    <span style={{fontSize:10,color:"#22c55e"}}>Live</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",
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
                  if(isSystem) return(
                    <div key={msg.id||i}>
                      {showDate&&(
                        <div style={{textAlign:"center",margin:"12px 0 8px",
                          fontSize:10,color:"#333",
                          display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.05)"}}/>
                          {dateLabel}
                          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.05)"}}/>
                        </div>
                      )}
                      <div style={{textAlign:"center",margin:"4px 0",fontSize:11,color:"#444"}}>
                        {msg.message}
                      </div>
                    </div>
                  );

                  return(
                    <div key={msg.id||i}>
                      {showDate&&(
                        <div style={{textAlign:"center",margin:"12px 0 8px",
                          fontSize:10,color:"#333",
                          display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.05)"}}/>
                          {dateLabel}
                          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.05)"}}/>
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
                          <div style={{fontSize:9,color:"#555",marginBottom:3,
                            paddingLeft:isMe?0:4,paddingRight:isMe?4:0}}>
                            {isMe?"You":msg.username}
                          </div>
                        )}
                        <div style={{
                          maxWidth:"85%",padding:"8px 12px",borderRadius:12,
                          borderBottomRightRadius:isMe?2:12,
                          borderBottomLeftRadius:isMe?12:2,
                          background:isMe
                            ?"linear-gradient(135deg,rgba(252,185,0,0.25),rgba(252,185,0,0.15))"
                            :"rgba(255,255,255,0.06)",
                          border:isMe
                            ?"1px solid rgba(252,185,0,0.3)"
                            :"1px solid rgba(255,255,255,0.08)",
                          wordBreak:"break-word",
                        }}>
                          <div style={{fontSize:13,color:isMe?"#fcb900":"#ddd",lineHeight:1.5}}>
                            {msg.message}
                          </div>
                          <div style={{fontSize:9,color:"#444",marginTop:3,textAlign:"right"}}>
                            {formatTime(msg.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef}/>
              </div>

              {/* Input */}
              <div style={{paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                  <textarea
                    value={chatInput}
                    onChange={e=>setChatInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Say something… (Enter to send)"
                    rows={1}
                    style={{
                      flex:1,padding:"10px 14px",
                      background:"rgba(255,255,255,0.05)",
                      border:"1px solid rgba(255,255,255,0.12)",
                      borderRadius:12,color:"#fff",fontSize:13,
                      fontFamily:"inherit",outline:"none",
                      resize:"none",lineHeight:1.5,maxHeight:100,
                      overflowY:"auto",
                    }}
                  />
                  <button onClick={sendMsg} disabled={!chatInput.trim()||chatSending} style={{
                    padding:"10px 16px",
                    background:chatInput.trim()?"#fcb900":"rgba(255,255,255,0.05)",
                    border:"none",borderRadius:12,
                    color:chatInput.trim()?"#000":"#333",
                    fontWeight:700,fontSize:13,cursor:chatInput.trim()?"pointer":"default",
                    fontFamily:"inherit",flexShrink:0,transition:"all 0.2s",
                  }}>
                    {chatSending?"…":"Send"}
                  </button>
                </div>
                <div style={{fontSize:9,color:"#333",marginTop:5,textAlign:"center"}}>
                  Messages visible to all players · Enter to send
                </div>
              </div>
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
              border:"1px solid rgba(139,92,246,0.3)",borderRadius:9,
              color:"#a78bfa",fontSize:13,fontWeight:700,
              cursor:bracketLoading?"wait":"pointer",fontFamily:"inherit",
            }}>{bracketLoading?"⏳ Predicting tournament…":bracketPred?"🔄 Regenerate AI Bracket":"🔮 Generate AI Tournament Prediction"}</button>
            {bracketGeneratedBy&&!bracketLoading&&(
              <div style={{fontSize:10,color:"#444",textAlign:"center",marginTop:5}}>
                Generated by <strong style={{color:"#6d5a9c"}}>{bracketGeneratedBy}</strong> · visible to all players
              </div>
            )}

            {bracketPred&&(
              <div style={{marginTop:14,background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:11,padding:"14px"}}>
                {/* Champion */}
                <div style={{textAlign:"center",marginBottom:16,padding:"14px",
                  background:"rgba(252,185,0,0.08)",border:"1px solid rgba(252,185,0,0.25)",borderRadius:10}}>
                  <div style={{fontSize:10,color:"#555",marginBottom:4}}>🤖 AI Predicts World Cup 2026 Winner</div>
                  <div style={{fontSize:36}}>{FLAGS[bracketPred.champion]||"🏳️"}</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:"#fcb900",letterSpacing:1}}>{bracketPred.champion}</div>
                  <div style={{fontSize:11,color:"#888",marginTop:6,fontStyle:"italic",lineHeight:1.5}}>{bracketPred.reasoning}</div>
                </div>

                {/* Podium */}
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  {[
                    {label:"🥇 Champion",team:bracketPred.champion,color:"#f59e0b"},
                    {label:"🥈 Runner-up",team:bracketPred.runnerUp,color:"#aaa"},
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

                {/* Semi-finalists */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:"#555",marginBottom:6,fontWeight:700}}>Semi-Finalists</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {(bracketPred.semiFinalists||[]).map((t,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:4,
                        padding:"4px 10px",background:"rgba(255,255,255,0.04)",
                        border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,fontSize:11}}>
                        <span>{FLAGS[t]||"🏳️"}</span><span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group winners */}
                <div>
                  <div style={{fontSize:11,color:"#555",marginBottom:6,fontWeight:700}}>Group Winners</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                    {Object.entries(bracketPred.groupWinners||{}).map(([g,t])=>(
                      <div key={g} style={{display:"flex",alignItems:"center",gap:6,
                        padding:"4px 8px",background:"rgba(255,255,255,0.025)",
                        border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,fontSize:11}}>
                        <span style={{color:"#555",width:12}}>G{g}</span>
                        <span>{FLAGS[t]||"🏳️"}</span>
                        <span style={{fontWeight:600}}>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* How yours compares */}
                {(podium?.first||podium?.second||podium?.third)&&(()=>{
                  const match1 = podium.first===bracketPred.champion;
                  const match2 = podium.second===bracketPred.runnerUp;
                  const match3 = podium.third===bracketPred.thirdPlace;
                  const matches = [match1,match2,match3].filter(Boolean).length;
                  return(
                    <div style={{marginTop:12,padding:"10px 12px",
                      background:matches>0?"rgba(34,197,94,0.06)":"rgba(255,255,255,0.025)",
                      border:`1px solid ${matches>0?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.07)"}`,
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
            <button onClick={generateCommentary} disabled={commentaryLoading||leaderboard.length===0} style={{
              width:"100%",padding:"12px",
              background:commentaryLoading?"rgba(139,92,246,0.05)":"rgba(139,92,246,0.12)",
              border:"1px solid rgba(139,92,246,0.3)",borderRadius:9,
              color:"#a78bfa",fontSize:13,fontWeight:700,
              cursor:commentaryLoading||leaderboard.length===0?"wait":"pointer",fontFamily:"inherit",
              opacity:leaderboard.length===0?0.4:1,
            }}>{commentaryLoading?"⏳ Writing commentary…":commentary?"🔄 Refresh Commentary":"🎙️ Generate Leaderboard Commentary"}</button>
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
                flex:2,padding:"10px 12px",background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(139,92,246,0.25)",borderRadius:8,
                color:whatIfTeam?"#fff":"#555",fontSize:12,fontFamily:"inherit",outline:"none",
              }}>
                <option value="">Select a team…</option>
                {Object.values(GROUPS).flat().map(t=>(
                  <option key={t} value={t}>{FLAGS[t]||"🏳️"} {t}</option>
                ))}
              </select>
              <select value={whatIfPlace} onChange={e=>setWhatIfPlace(e.target.value)} style={{
                flex:1,padding:"10px 12px",background:"rgba(255,255,255,0.05)",
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
              border:"1px solid rgba(139,92,246,0.3)",borderRadius:9,
              color:"#a78bfa",fontSize:13,fontWeight:700,
              cursor:!whatIfTeam||whatIfLoading?"not-allowed":"pointer",fontFamily:"inherit",
              opacity:!whatIfTeam?0.4:1,
            }}>{whatIfLoading?"⏳ Calculating…":"🔮 Calculate What-If"}</button>

            {whatIfResult&&(
              <div style={{marginTop:12,background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:11,padding:"14px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#a78bfa",marginBottom:8}}>
                  {whatIfResult.scenario}
                </div>

                {/* Points gained */}
                {(whatIfResult.pointsGained||[]).filter(e=>e.gained>0).length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:"#555",marginBottom:6}}>Who benefits:</div>
                    {(whatIfResult.pointsGained||[]).filter(e=>e.gained>0).sort((a,b)=>b.gained-a.gained).map((e,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                        padding:"6px 10px",marginBottom:4,borderRadius:7,
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
                  style={{flex:1,padding:"11px 14px",background:"rgba(255,255,255,0.05)",
                    border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,
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
                    borderRadius:14,padding:"22px 24px",maxWidth:360,width:"100%"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#ef4444",marginBottom:10}}>
                      Reset All Results?
                    </div>
                    <div style={{fontSize:13,color:"#aaa",marginBottom:8,lineHeight:1.6}}>
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
                        background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",
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
                    borderRadius:14,padding:"20px 24px",maxWidth:380,width:"100%"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#ef4444",marginBottom:10}}>
                      Confirm Rollback
                    </div>
                    <div style={{fontSize:13,color:"#aaa",marginBottom:6}}>Restore results from:</div>
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
                        background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",
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
                    borderRadius:14,padding:"20px 24px",maxWidth:420,width:"100%",
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
                          borderTop:i>0?"1px solid rgba(255,255,255,0.05)":"none"}}>{c}</div>
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
                      background:i===0?"rgba(34,197,94,0.05)":"rgba(255,255,255,0.02)",
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
                  <div style={{flex:1,minWidth:80,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"10px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#fcb900"}}>{leaderboard.length}</div>
                    <div style={{fontSize:10,color:"#555"}}>Total players</div>
                  </div>
                  <div style={{flex:1,minWidth:80,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"10px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#22c55e"}}>
                      {leaderboard.filter(e=>e.points>0).length}
                    </div>
                    <div style={{fontSize:10,color:"#555"}}>With predictions</div>
                  </div>
                  <div style={{flex:1,minWidth:80,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"10px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#ef4444"}}>
                      {leaderboard.filter(e=>e.points===0).length}
                    </div>
                    <div style={{fontSize:10,color:"#555"}}>Not predicted</div>
                  </div>
                </div>
                {leaderboard.filter(e=>e.points===0).length>0&&(
                  <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:11,color:"#ef4444",fontWeight:700,marginBottom:6}}>⚠️ Haven't predicted yet:</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {leaderboard.filter(e=>e.points===0).map(e=>(
                        <span key={e.username} style={{fontSize:11,color:"#888",background:"rgba(255,255,255,0.04)",
                          border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,padding:"3px 8px"}}>
                          {e.username}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* User Management — PIN Reset */}
              <div style={{marginBottom:24}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:"#555",letterSpacing:1,marginBottom:10}}>
                  User Management
                </div>
                <p style={{fontSize:11,color:"#555",marginTop:0,marginBottom:12}}>
                  Reset a user's PIN if they've lost access. They'll need to set a new PIN on next login.
                </p>
                <div style={{display:"flex",gap:8}}>
                  <input
                    placeholder="Username to reset…"
                    id="adminPinResetUser"
                    style={{flex:1,padding:"8px 12px",background:"rgba(255,255,255,0.05)",
                      border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,
                      color:"#fff",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                  <button onClick={async()=>{
                    const el = document.getElementById("adminPinResetUser");
                    const name = el?.value?.trim();
                    if(!name){ setAdminPinError("Enter a username first."); setTimeout(()=>setAdminPinError(""),3000); return; }
                    const user = await sbGetUser(name);
                    if(!user){ setAdminPinError(`User "${name}" not found.`); setTimeout(()=>setAdminPinError(""),3000); return; }
                    // Clear PIN and recovery code — forces new PIN creation
                    lsDel(`wc26_pin_${name}`);
                    lsDel(`wc26_recovery_${name}`);



                    if(el) el.value="";
                    setAdminPinError(`✅ PIN cleared for "${name}". They can create a new account.`);
                    setTimeout(()=>setAdminPinError(""),4000);
                  }} style={{
                    padding:"8px 16px",background:"rgba(239,68,68,0.12)",
                    border:"1px solid rgba(239,68,68,0.3)",borderRadius:7,
                    color:"#ef4444",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0,
                  }}>Reset PIN</button>
                </div>
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
                    border:"1px solid rgba(96,165,250,0.3)",borderRadius:7,
                    color:"#60a5fa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  }}>⚡ Fill R32 from standings</button>
                </div>

                {/* Group selector */}
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
                  {Object.keys(GROUPS).map(g=>(
                    <button key={g} onClick={()=>setAdminActiveGroup(g)} style={{
                      padding:"5px 11px",borderRadius:6,border:"1px solid",
                      borderColor:adminActiveGroup===g?"#22c55e":"rgba(255,255,255,0.08)",
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
                    padding:"9px 12px",borderRadius:9,marginBottom:7,
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
                      borderColor:adminActiveRound===r?"#22c55e":"rgba(255,255,255,0.08)",
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
                          borderBottom:"1px solid rgba(255,255,255,0.1)",
                          color:"#fff",fontSize:13,fontWeight:700,padding:"3px 0",
                          outline:"none",fontFamily:"inherit"}}/>
                      <span style={{color:"#444",fontSize:12}}>vs</span>
                      <input value={m.away==="TBD"?"":m.away} placeholder="Away team"
                        onChange={e=>adminUpdateKO({...m,away:e.target.value||"TBD"})}
                        style={{flex:1,textAlign:"right",background:"transparent",border:"none",
                          borderBottom:"1px solid rgba(255,255,255,0.1)",
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
                          flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
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
                                  style={{flex:1,padding:"5px 8px",background:"rgba(255,255,255,0.05)",
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
                                style={{flex:1,padding:"5px 8px",background:"rgba(255,255,255,0.05)",
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
                        background:"rgba(139,92,246,0.05)",borderRadius:7,padding:"7px 10px",
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
                        style={{flex:2,minWidth:130,padding:"6px 8px",background:"rgba(255,255,255,0.05)",
                          border:"1px solid rgba(139,92,246,0.2)",borderRadius:6,
                          color:"#fff",fontSize:11,fontFamily:"monospace",outline:"none"}}/>
                      <input type="number" value={newPredH} onChange={e=>setNewPredH(e.target.value)}
                        placeholder="H" min="0" max="20"
                        style={{width:44,padding:"6px 4px",textAlign:"center",background:"rgba(255,255,255,0.05)",
                          border:"1px solid rgba(139,92,246,0.2)",borderRadius:6,
                          color:"#fff",fontSize:11,outline:"none"}}/>
                      <span style={{color:"#555",alignSelf:"center"}}>–</span>
                      <input type="number" value={newPredA} onChange={e=>setNewPredA(e.target.value)}
                        placeholder="A" min="0" max="20"
                        style={{width:44,padding:"6px 4px",textAlign:"center",background:"rgba(255,255,255,0.05)",
                          border:"1px solid rgba(139,92,246,0.2)",borderRadius:6,
                          color:"#fff",fontSize:11,outline:"none"}}/>
                      <input value={newPredR} onChange={e=>setNewPredR(e.target.value)}
                        placeholder="Reason…"
                        style={{flex:3,minWidth:120,padding:"6px 8px",background:"rgba(255,255,255,0.05)",
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
                      {key:"first",label:"🥇 1st Place"},
                      {key:"second",label:"🥈 2nd Place"},
                      {key:"third",label:"🥉 3rd Place"},
                    ].map(p=>(
                      <div key={p.key} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                        <span style={{fontSize:12,color:"#888",width:90,flexShrink:0}}>{p.label}</span>
                        <input value={actualPodium[p.key]||""}
                          placeholder="Team name…"
                          onChange={e=>setActualPodium(prev=>({...prev,[p.key]:e.target.value||null}))}
                          style={{flex:1,padding:"6px 10px",background:"rgba(255,255,255,0.05)",
                            border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,
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

          {[
            {
              icon:"🔐", title:"Getting Started",
              items:[
                ["How do I join?","Open the artifact, enter your name and choose a PIN (min 4 characters). You'll use this PIN every time you log in."],
                ["Will the app remember me?","Yes — tick 'Remember me for 30 days' when logging in. You'll be logged in automatically next time."],
                ["I forgot my PIN — what do I do?","Use your recovery code. When you created your account, a code like WC26-XXXX-XXXX was shown. On the login screen enter your name, tap 'Forgot PIN? Use recovery code', enter your code, and set a new PIN."],
                ["I lost my recovery code too","Contact the admin — they can reset your PIN from the Admin panel under User Management. Your predictions will be preserved."],
                ["Where is my recovery code?","It was shown once when you first created your account. If you saved it somewhere (notes app, screenshot) use it via the 'Forgot PIN?' link. Otherwise ask the admin to reset your PIN."],
                ["Can I use this without a Claude account?","You need a free Claude.ai account to open the artifact. Sign up at claude.ai — it's free."],
              ]
            },
            {
              icon:"⚽", title:"Making Predictions",
              items:[
                ["When do predictions lock?","15 minutes before each match kicks off. After that you can't change your score for that game."],
                ["What happens if I don't predict a match?","You get 0 points for that match. Try to fill in all predictions before they lock!"],
                ["Can I change my predictions?","Yes, any time before the match locks. Just edit the score and tap Save."],
                ["What's the podium pick?","Pick who finishes 1st, 2nd, and 3rd in the tournament. These lock on June 11, 2026 at 17:00 UTC (first kickoff)."],
              ]
            },
            {
              icon:"📊", title:"Scoring Rules",
              items:[
                ["Exact score","You predicted the precise scoreline (e.g. 2-1) → 6 pts"],
                ["Correct goal difference","Right margin, wrong scores (e.g. predicted 3-2, actual 2-1) → 3 pts"],
                ["Correct outcome only","Right winner or draw, wrong everything else → 2 pts"],
                ["Wrong prediction","None of the above → 0 pts"],
                ["Podium","🥇 1st place correct = 100 pts · 🥈 2nd = 50 pts · 🥉 3rd = 25 pts"],
                ["Max per match","6 pts (exact score). Rules are mutually exclusive — no stacking."],
              ]
            },
            {
              icon:"💾", title:"Saving & Backup",
              items:[
                ["How do I save my predictions?","Tap the Save button in the header after entering your scores."],
                ["Will my predictions survive if I open a new version?","Yes — predictions are stored in your browser's localStorage and persist across app versions."],
                ["What's the Export/Import for?","Use Export to save a JSON backup of your predictions. Use Import to restore them if something goes wrong."],
                ["What does the ⚠️ backup warning mean?","You haven't exported a backup in 3+ days. Tap 📤 Export and save the JSON somewhere safe."],
                ["The 🗑 Reset button in the header clears MY predictions only — it doesn't affect anyone else.",""],
              ]
            },
            {
              icon:"🏆", title:"Leaderboard & Results",
              items:[
                ["When do scores update?","When the admin enters results and taps Save. Everyone's scores update instantly."],
                ["Can I see what others predicted?","Yes! After matches kick off, tap 👁 View on any leaderboard entry to see their predictions vs actual results."],
                ["Why is my score 0?","Either no results have been entered by the admin yet, or your predictions all had wrong outcomes."],
                ["How is the leaderboard ordered?","By total points, highest first. Ties show in the order predictions were saved."],
              ]
            },
            {
              icon:"🔧", title:"Admin",
              items:[
                ["What's the admin PIN?","2026"],
                ["Who should be admin?","One person in the group — ideally whoever is watching the games and can enter scores promptly."],
                ["How do I enter results?","Admin tab → Group Stage → select group → enter scores → Save Results & Update Scores."],
                ["How do knockout teams get filled?","After entering all group scores, tap ⚡ Fill R32 from standings. Then enter knockout scores round by round."],
                ["I made a mistake — can I undo?","Yes! The Save History section in Admin shows the last 5 saves. Tap Rollback to restore any previous state."],
                ["What does Reset to Blank do?","Clears ALL match scores, knockout teams and podium for everyone. Use with caution — but it's reversible via Rollback."],
                ["How do I reset a user's PIN?","Admin tab → User Management section → enter their username → tap Reset PIN. Their predictions are preserved, but they'll need to create a new PIN on next login."],
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
            Still stuck? The app was built by Claude AI. If something isn't working, try refreshing or switching to a newer version.
          </div>
        </div>}

      </div>
    </div>
  );
}

