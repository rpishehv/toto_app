// api/odds.js — Polymarket odds for WC2026 matches via CLOB API + Gamma API

export const config = { runtime: 'edge' };

const FIFA_CODES = {
  'mexico':'mex','south africa':'rsa','canada':'can','switzerland':'che',
  'brazil':'bra','morocco':'mar','usa':'usa','united states':'usa','paraguay':'par',
  'australia':'aus','germany':'ger','ivory coast':'civ','netherlands':'nld',
  'japan':'jpn','sweden':'swe','belgium':'bel','egypt':'egy','france':'fra',
  'senegal':'sen','norway':'nor','argentina':'arg','algeria':'alg','austria':'aut',
  'portugal':'por','dr congo':'cod','colombia':'col','england':'eng','croatia':'hrv',
  'ghana':'gha','spain':'esp','cape verde':'cpv','cabo verde':'cpv',
  'bosnia-herzegovina':'bih','bosnia herzegovina':'bih','ecuador':'ecu',
  'ivory coast':'civ','cote d\'ivoire':'civ','norway':'nor','switzerland':'che',
};

const MATCH_DATES = {
  // Group stage
  'mexico||south africa':'2026-06-11','canada||bosnia-herzegovina':'2026-06-12',
  'qatar||switzerland':'2026-06-12','brazil||morocco':'2026-06-13','usa||paraguay':'2026-06-13',
  'germany||curacao':'2026-06-14','ivory coast||ecuador':'2026-06-14','netherlands||japan':'2026-06-15',
  'sweden||tunisia':'2026-06-15','belgium||egypt':'2026-06-15','spain||cape verde':'2026-06-16',
  'france||senegal':'2026-06-17','norway||iraq':'2026-06-17','iraq||norway':'2026-06-17',
  'argentina||algeria':'2026-06-17','austria||jordan':'2026-06-18','portugal||dr congo':'2026-06-18',
  'uzbekistan||colombia':'2026-06-18','england||croatia':'2026-06-17','ghana||panama':'2026-06-17',
  'mexico||south korea':'2026-06-18','switzerland||bosnia-herzegovina':'2026-06-19',
  'canada||qatar':'2026-06-19','brazil||scotland':'2026-06-19','morocco||haiti':'2026-06-19',
  'usa||australia':'2026-06-19','germany||ivory coast':'2026-06-20','netherlands||sweden':'2026-06-20',
  'belgium||iran':'2026-06-21','spain||saudi arabia':'2026-06-21','france||iraq':'2026-06-22',
  'senegal||norway':'2026-06-22','argentina||austria':'2026-06-22','portugal||uzbekistan':'2026-06-23',
  'dr congo||colombia':'2026-06-23','england||ghana':'2026-06-23','croatia||panama':'2026-06-23',
  'mexico||czechia':'2026-06-25','switzerland||canada':'2026-06-25',
  // Round of 32
  'south africa||canada':'2026-06-28',
  'germany||paraguay':'2026-06-29','netherlands||morocco':'2026-06-29','brazil||japan':'2026-06-29',
  'france||sweden':'2026-06-30','ivory coast||norway':'2026-06-30','mexico||ecuador':'2026-06-30',
  'england||dr congo':'2026-07-01','belgium||senegal':'2026-07-01','usa||bosnia-herzegovina':'2026-07-01',
  'portugal||croatia':'2026-07-02','spain||austria':'2026-07-02','switzerland||algeria':'2026-07-02',
  'australia||egypt':'2026-07-03','argentina||cape verde':'2026-07-03','colombia||ghana':'2026-07-03',
  // Round of 16
  'canada||morocco':'2026-07-04','paraguay||france':'2026-07-04',
  'brazil||norway':'2026-07-05','mexico||england':'2026-07-05',
  'portugal||spain':'2026-07-06','usa||belgium':'2026-07-06',
  'argentina||egypt':'2026-07-07','switzerland||colombia':'2026-07-07',
};

function getCode(name) {
  return FIFA_CODES[(name||'').toLowerCase().trim()] || name.slice(0,3).toLowerCase();
}
function getDate(home, away) {
  const k = `${home.toLowerCase()}||${away.toLowerCase()}`;
  const r = `${away.toLowerCase()}||${home.toLowerCase()}`;
  return MATCH_DATES[k] || MATCH_DATES[r] || null;
}
function teamMatch(str, name) {
  const s=(str||'').toLowerCase(), n=(name||'').toLowerCase();
  return s.includes(n)||s.includes(n.split(' ')[0]);
}

export default async function handler(req) {
  // Tournament ended July 20 — block all API calls after that
  const TOURNAMENT_END = new Date('2026-07-20T00:00:00-04:00').getTime();
  if (Date.now() > TOURNAMENT_END) {
    return new Response(JSON.stringify({ error: 'Tournament has ended', closed: true }), {
      status: 410, headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(req.url);
  const home = url.searchParams.get('home');
  const away = url.searchParams.get('away');
  if (!home || !away) return new Response(JSON.stringify({error:'Missing teams'}),{status:400});

  const headers = {'Accept':'application/json','User-Agent':'Mozilla/5.0'};
  const hCode = getCode(home), aCode = getCode(away);
  const date = getDate(home, away);

  // Strategy 1: Gamma API events by sports slug
  if (date) {
    const slugs = [
      `fifwc-${hCode}-${aCode}-${date}`,
      `fifwc-${aCode}-${hCode}-${date}`,
    ];
    for (const slug of slugs) {
      try {
        const r = await fetch(`https://gamma-api.polymarket.com/events/slug/${slug}`, {headers});
        if (!r.ok) continue;
        const event = await r.json();
        if (event?.markets?.length > 0) {
          const result = extractOdds(event, home, away);
          if (result) return result;
        }
      } catch {}
    }
  }

  // Strategy 2: Gamma API search by team names
  for (const term of [`${home} vs ${away}`, `${hCode.toUpperCase()} ${aCode.toUpperCase()}`]) {
    try {
      const r = await fetch(
        `https://gamma-api.polymarket.com/events?search=${encodeURIComponent(term)}&tag_slug=fifa-world-cup-2026&limit=10`,
        {headers}
      );
      if (!r.ok) continue;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : (data.events||data.data||[]);
      const match = arr.find(e=>{
        const t=((e.title||'')+(e.slug||'')).toLowerCase();
        return teamMatch(t,home)&&teamMatch(t,away);
      });
      if (match) {
        const result = extractOdds(match, home, away);
        if (result) return result;
      }
    } catch {}
  }

  // Strategy 3: Gamma markets search
  try {
    const r = await fetch(
      `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(`${home} ${away}`)}&limit=20`,
      {headers}
    );
    if (r.ok) {
      const data = await r.json();
      const markets = Array.isArray(data)?data:(data.markets||[]);
      const m = markets.find(m=>{
        const q=(m.question||'').toLowerCase();
        return teamMatch(q,home)&&teamMatch(q,away)&&
          (q.includes('win')||q.includes('moneyline')||q.includes('advance'));
      });
      if (m) return buildMarketResponse(m, home, away);
    }
  } catch {}

  return new Response(JSON.stringify({
    found:false, message:`No Polymarket market found for ${home} vs ${away}`,
  }),{status:200,headers:{'Content-Type':'application/json'}});
}

function extractOdds(event, home, away) {
  const markets = event.markets||[];
  if (!markets.length) return null;

  // Look for moneyline/win market first
  const moneyline = markets.find(m=>{
    const q=(m.question||m.groupItemTitle||'').toLowerCase();
    return q.includes('moneyline')||q.includes('winner')||q.includes('advance')||
           (q.includes('win')&&!q.includes('half')&&!q.includes('corner')&&!q.includes('score')&&!q.includes('goal'));
  }) || markets[0];

  let homeProb=null, awayProb=null, drawProb=null;
  const outcomes = moneyline.outcomes||[];
  const prices = moneyline.outcomePrices||[];

  if (outcomes.length===2 && outcomes.some(o=>/^yes$/i.test(String(o).trim()))) {
    // Yes/No binary
    const yesIdx = outcomes.findIndex(o=>/^yes$/i.test(String(o).trim()));
    homeProb = yesIdx>=0 ? Math.round(parseFloat(prices[yesIdx]||0)*100) : null;
    awayProb = homeProb!=null ? 100-homeProb : null;
  } else if (outcomes.length>=2) {
    outcomes.forEach((o,i)=>{
      const l=(o||'').toString().toLowerCase();
      const p=Math.round(parseFloat(prices[i]||0)*100);
      if (l.includes('draw')||l.includes('tie')) drawProb=p;
      else if (teamMatch(l,home)) homeProb=p;
      else if (teamMatch(l,away)) awayProb=p;
    });
    // Fallback positional
    if (homeProb===null&&awayProb===null) {
      if (outcomes.length===3) {
        homeProb=Math.round(parseFloat(prices[0]||0)*100);
        drawProb=Math.round(parseFloat(prices[1]||0)*100);
        awayProb=Math.round(parseFloat(prices[2]||0)*100);
      } else if (outcomes.length===2) {
        homeProb=Math.round(parseFloat(prices[0]||0)*100);
        awayProb=Math.round(parseFloat(prices[1]||0)*100);
      }
    }
  }

  // Also look for "Team to Advance" market for KO games
  const advanceMarket = markets.find(m=>{
    const q=(m.question||m.groupItemTitle||'').toLowerCase();
    return q.includes('advance');
  });
  const advanceOutcomes = [];
  if (advanceMarket) {
    (advanceMarket.outcomes||[]).forEach((o,i)=>{
      advanceOutcomes.push({
        label: String(o),
        prob: Math.round(parseFloat((advanceMarket.outcomePrices||[])[i]||0)*100),
      });
    });
  }

  const vol = event.volume
    ? `$${Number(parseFloat(event.volume).toFixed(0)).toLocaleString()}`
    : null;

  return new Response(JSON.stringify({
    found:true, title:event.title||`${home} vs ${away}`,
    url:`https://polymarket.com/sports/world-cup/fifwc-${getCode(home)}-${getCode(away)}-${getDate(home,away)||''}`,
    homeProb, awayProb, drawProb, volume:vol,
    advanceOutcomes: advanceOutcomes.length ? advanceOutcomes : null,
    outcomes:[{label:home,prob:homeProb},{label:'Draw',prob:drawProb},{label:away,prob:awayProb}]
      .filter(o=>o.prob!=null),
  }),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'max-age=60'}});
}

function buildMarketResponse(market, home, away) {
  const outcomes=(market.outcomes||[]);
  const prices=(market.outcomePrices||[]);
  const parsed=outcomes.map((o,i)=>({label:o,prob:Math.round(parseFloat(prices[i]||0)*100)}));
  let homeProb=null,awayProb=null,drawProb=null;
  parsed.forEach(o=>{
    const l=o.label.toLowerCase();
    if(l.includes('draw')||l.includes('tie')) drawProb=o.prob;
    else if(teamMatch(l,home)) homeProb=o.prob;
    else if(teamMatch(l,away)) awayProb=o.prob;
  });
  return new Response(JSON.stringify({
    found:true,title:market.question||`${home} vs ${away}`,
    url:`https://polymarket.com/event/${market.slug||market.id}`,
    homeProb,awayProb,drawProb,
    volume:market.volume?`$${Number(parseFloat(market.volume).toFixed(0)).toLocaleString()}`:null,
    outcomes:parsed,
  }),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'max-age=60'}});
}


// 3-letter FIFA codes for team names — must match Polymarket slug codes
