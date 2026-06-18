// api/odds.js — Polymarket odds for WC2026 matches
// Uses the sports endpoint: polymarket.com/sports/fifa-world-cup/fifwc-{h3}-{a3}-{date}

export const config = { runtime: 'edge' };

// 3-letter FIFA codes for team names — must match Polymarket slug codes
const FIFA_CODES = {
  'mexico': 'mex', 'south africa': 'rsa', 'south korea': 'kor', 'korea republic': 'kor',
  'czechia': 'cze', 'czech republic': 'cze', 'canada': 'can', 'bosnia-herzegovina': 'bih',
  'bosnia herzegovina': 'bih', 'qatar': 'qat',
  'switzerland': 'che', // Polymarket uses CHE not SUI
  'brazil': 'bra', 'morocco': 'mar', 'haiti': 'hai', 'scotland': 'sco',
  'usa': 'usa', 'united states': 'usa', 'paraguay': 'par',
  'australia': 'aus', 'turkey': 'tur', 'türkiye': 'tur',
  'germany': 'ger', 'curacao': 'cuw',
  'ivory coast': 'civ', 'cote d\'ivoire': 'civ',
  'ecuador': 'ecu',
  'netherlands': 'nld', // Polymarket uses NLD not NED
  'japan': 'jpn', 'sweden': 'swe', 'tunisia': 'tun', 'belgium': 'bel', 'egypt': 'egy',
  'iran': 'irn', 'ir iran': 'irn', 'new zealand': 'nzl', 'spain': 'esp',
  'cape verde': 'cpv', 'cabo verde': 'cpv', 'cape verde islands': 'cpv',
  'saudi arabia': 'ksa', 'uruguay': 'uru', 'france': 'fra',
  'senegal': 'sen', 'iraq': 'irq', 'norway': 'nor', 'argentina': 'arg', 'algeria': 'alg',
  'austria': 'aut', 'jordan': 'jor', 'portugal': 'por', 'dr congo': 'cod', 'uzbekistan': 'uzb',
  'colombia': 'col', 'england': 'eng',
  'croatia': 'hrv', // Polymarket uses HRV not CRO
  'ghana': 'gha', 'panama': 'pan',
};

// Match kickoff dates — Polymarket URL dates (UTC)
const MATCH_DATES = {
  // Matchday 1
  'mexico||south africa': '2026-06-11',
  'south korea||czechia': '2026-06-11',
  'canada||bosnia-herzegovina': '2026-06-12',
  'qatar||switzerland': '2026-06-12',
  'brazil||morocco': '2026-06-13',
  'haiti||scotland': '2026-06-13',
  'usa||paraguay': '2026-06-13',
  'australia||turkey': '2026-06-14',
  'germany||curacao': '2026-06-14',
  'ivory coast||ecuador': '2026-06-14',
  'netherlands||japan': '2026-06-15',
  'sweden||tunisia': '2026-06-15',
  'belgium||egypt': '2026-06-15',
  'iran||new zealand': '2026-06-16',
  'spain||cape verde': '2026-06-16',
  'saudi arabia||uruguay': '2026-06-16',
  'france||senegal': '2026-06-17',
  'iraq||norway': '2026-06-17',
  'argentina||algeria': '2026-06-17',
  'austria||jordan': '2026-06-18',
  'portugal||dr congo': '2026-06-18',
  'uzbekistan||colombia': '2026-06-18',
  'england||croatia': '2026-06-17', // England vs Croatia was June 17
  'ghana||panama': '2026-06-17',
  // Matchday 2
  'mexico||south korea': '2026-06-18',
  'south africa||czechia': '2026-06-18',
  'switzerland||bosnia-herzegovina': '2026-06-19',
  'canada||qatar': '2026-06-19',
  'brazil||scotland': '2026-06-19',
  'morocco||haiti': '2026-06-19',
  'usa||australia': '2026-06-19',
  'turkey||paraguay': '2026-06-19',
  'germany||ivory coast': '2026-06-20',
  'ecuador||curacao': '2026-06-20',
  'netherlands||sweden': '2026-06-20',
  'japan||tunisia': '2026-06-20',
  'belgium||iran': '2026-06-21',
  'egypt||new zealand': '2026-06-21',
  'spain||saudi arabia': '2026-06-21',
  'cape verde||uruguay': '2026-06-21',
  'france||iraq': '2026-06-22',
  'senegal||norway': '2026-06-22',
  'argentina||austria': '2026-06-22',
  'algeria||jordan': '2026-06-22',
  'portugal||uzbekistan': '2026-06-23',
  'dr congo||colombia': '2026-06-23',
  'england||ghana': '2026-06-23',
  'croatia||panama': '2026-06-23',
  // Matchday 3 (simultaneous)
  'mexico||czechia': '2026-06-25',
  'south africa||south korea': '2026-06-25',
  'switzerland||canada': '2026-06-25',
  'bosnia-herzegovina||qatar': '2026-06-25',
};

function getCode(name) {
  return FIFA_CODES[(name || '').toLowerCase().trim()] || name.slice(0,3).toLowerCase();
}

function getDate(home, away) {
  const key = `${home.toLowerCase()}||${away.toLowerCase()}`;
  const keyRev = `${away.toLowerCase()}||${home.toLowerCase()}`;
  return MATCH_DATES[key] || MATCH_DATES[keyRev] || null;
}

function teamMatch(str, name) {
  const s = (str || '').toLowerCase();
  const n = (name || '').toLowerCase();
  return s.includes(n) || s.includes(n.split(' ')[0]);
}

export default async function handler(req) {
  const url = new URL(req.url);
  const home = url.searchParams.get('home');
  const away = url.searchParams.get('away');
  if (!home || !away) {
    return new Response(JSON.stringify({ error: 'Missing teams' }), { status: 400 });
  }

  // If group_slug provided, fetch group winner market directly
  const groupSlug = url.searchParams.get('group_slug');
  if (groupSlug) {
    try {
      const BASE = 'https://gamma-api.polymarket.com';
      const headers = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' };

      // Extract group letter from slug (e.g. 'world-cup-group-a-winner' -> 'A')
      const grpMatch = groupSlug.match(/group-([a-l])-winner/i);
      const grpLetter = grpMatch?.[1]?.toUpperCase();

      // Search markets for this group winner event
      const searchTerms = grpLetter
        ? [`World Cup Group ${grpLetter} Winner`, `Group ${grpLetter} Winner 2026`]
        : [groupSlug];

      for (const term of searchTerms) {
        const r = await fetch(
          `${BASE}/markets?search=${encodeURIComponent(term)}&active=true&closed=false&limit=20`,
          { headers }
        );
        if (!r.ok) continue;
        const markets = await r.json();
        const arr = Array.isArray(markets) ? markets : (markets.markets || []);

        // Group winner markets are multi-outcome — find the parent event
        const matching = arr.filter(m => {
          const q = (m.question || m.groupItemTitle || '').toLowerCase();
          return q.includes('group') && grpLetter && q.includes(grpLetter.toLowerCase());
        });

        if (matching.length >= 2) {
          const outcomes = matching.map(m => ({
            label: m.groupItemTitle || m.question?.replace(/Will\s+/i,'').replace(/\s+win.*/i,'') || '?',
            prob: Math.round(parseFloat(m.outcomePrices?.[0] ?? m.lastTradePrice ?? 0) * 100),
          })).filter(o => o.prob > 0 && o.label.length < 30)
            .sort((a,b) => b.prob - a.prob);

          if (outcomes.length > 0) {
            return new Response(JSON.stringify({
              found: true, type: 'group_winner',
              url: `https://polymarket.com/event/${groupSlug}`,
              outcomes,
            }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } });
          }
        }
      }

      // Last resort: try event slug directly
      const slugsToTry = [groupSlug, `fifa-${groupSlug}`, groupSlug.replace('fifa-','')];
      for (const slug of slugsToTry) {
        const r = await fetch(`${BASE}/events/slug/${slug}`, { headers });
        if (!r.ok) continue;
        const event = await r.json();
        const eventMarkets = event?.markets || [];
        if (eventMarkets.length >= 2) {
          const outcomes = eventMarkets.map(m => ({
            label: m.groupItemTitle || m.question?.replace(/Will\s+/i,'').replace(/\s+win.*/i,'') || '?',
            prob: Math.round(parseFloat(m.outcomePrices?.[0] ?? m.lastTradePrice ?? 0) * 100),
          })).filter(o => o.prob > 0).sort((a,b) => b.prob - a.prob);
          if (outcomes.length > 0) {
            return new Response(JSON.stringify({
              found: true, type: 'group_winner',
              title: event.title,
              url: `https://polymarket.com/event/${slug}`,
              outcomes,
            }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } });
          }
        }
      }

      return new Response(JSON.stringify({ found: false, message: 'Group market not found' }), { status: 200 });
    } catch(e) {
      return new Response(JSON.stringify({ found: false, message: e.message }), { status: 200 });
    }
  }

  const headers = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' };
  const BASE = 'https://gamma-api.polymarket.com';

  try {
    // Strategy 1: Sports endpoint with FIFA match code
    const hCode = getCode(home);
    const aCode = getCode(away);
    const date = getDate(home, away);
    const sportsSlugs = date ? [
      `fifwc-${hCode}-${aCode}-${date}`,
      `fifwc-${aCode}-${hCode}-${date}`,
    ] : [];

    for (const slug of sportsSlugs) {
      try {
        const r = await fetch(`https://polymarket.com/sports/fifa-world-cup/${slug}`, { headers });
        if (r.ok) {
          const text = await r.text();
          // Parse odds from the page meta/JSON
          const priceMatch = text.match(/"outcomePrices":\s*\[([^\]]+)\]/);
          const outcomeMatch = text.match(/"outcomes":\s*\[([^\]]+)\]/);
          if (priceMatch && outcomeMatch) {
            const prices = priceMatch[1].match(/[\d.]+/g)?.map(Number) || [];
            const outcomes = outcomeMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g,'')) || [];
            return buildFromArrays(outcomes, prices, home, away, slug);
          }
        }
      } catch {}
    }

    // Strategy 2: Gamma events by tag
    try {
      const r = await fetch(
        `${BASE}/events?tag_slug=fifa-world-cup-2026&active=true&closed=false&limit=200&order=volume&ascending=false`,
        { headers }
      );
      if (r.ok) {
        const data = await r.json();
        const arr = Array.isArray(data) ? data : (data.data || data.events || []);
        const match = arr.find(e => {
          const t = ((e.title || '') + ' ' + (e.slug || '')).toLowerCase();
          return teamMatch(t, home) && teamMatch(t, away);
        });
        if (match) return buildEventResponse(match, home, away);
      }
    } catch {}

    // Strategy 3: Gamma events slug directly
    const slugVariants = [
      `${hCode}-vs-${aCode}`, `${aCode}-vs-${hCode}`,
      `mexico-vs-south-africa`, // hardcode the opener as fallback
    ].filter((s, i, arr) => arr.indexOf(s) === i);

    for (const slug of slugVariants) {
      try {
        const r = await fetch(`${BASE}/events/slug/${slug}`, { headers });
        if (r.ok) {
          const event = await r.json();
          if (event?.markets?.length > 0) return buildEventResponse(event, home, away);
        }
      } catch {}
    }

    // Strategy 4: markets search
    for (const term of [`${home} vs ${away}`, `${home} ${away}`]) {
      try {
        const r = await fetch(`${BASE}/markets?search=${encodeURIComponent(term)}&active=true&limit=20`, { headers });
        if (!r.ok) continue;
        const data = await r.json();
        const markets = Array.isArray(data) ? data : (data.markets || []);
        const m = markets.find(m => {
          const q = (m.question || '').toLowerCase();
          return teamMatch(q, home) && teamMatch(q, away);
        });
        if (m) return buildMarketResponse(m, home, away);
      } catch {}
    }

    return new Response(JSON.stringify({
      found: false,
      message: `No Polymarket market open yet for ${home} vs ${away}`,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch(e) {
    return new Response(JSON.stringify({ found: false, message: e.message }), { status: 200 });
  }
}

function buildFromArrays(outcomes, prices, home, away, slug) {
  // Outcomes may be Yes/No binary or team name labels
  const isYesNo = outcomes.length <= 2 && outcomes.some(o => /^yes$/i.test(o.trim()));
  let homeProb = null, awayProb = null, drawProb = null;
  let displayOutcomes = [];

  if (isYesNo) {
    // Single Yes/No market — "Yes" = home team wins
    const yesIdx = outcomes.findIndex(o => /^yes$/i.test(o.trim()));
    const yesProb = yesIdx >= 0 ? Math.round((prices[yesIdx] || 0) * 100) : null;
    const noProb  = yesProb != null ? 100 - yesProb : null;
    homeProb = yesProb;
    awayProb = noProb;
    displayOutcomes = [
      { label: home,   prob: yesProb },
      { label: away,   prob: noProb  },
    ].filter(o => o.prob != null);
  } else {
    outcomes.forEach((o, i) => {
      const l = o.toLowerCase();
      const p = Math.round((prices[i] || 0) * 100);
      if (l.includes('draw') || l.includes('tie')) drawProb = p;
      else if (teamMatch(l, home)) homeProb = p;
      else if (teamMatch(l, away)) awayProb = p;
    });
    displayOutcomes = outcomes.map((o,i) => ({ label: o, prob: Math.round((prices[i]||0)*100) }));
  }

  return new Response(JSON.stringify({
    found: true, title: `${home} vs ${away}`,
    url: `https://polymarket.com/sports/fifa-world-cup/${slug}`,
    homeProb, awayProb, drawProb,
    outcomes: displayOutcomes,
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' } });
}

function buildEventResponse(event, home, away) {
  const markets = event.markets || [];
  let homeProb = null, awayProb = null, drawProb = null;

  // Check if markets are Yes/No binary (single market about home team winning)
  if (markets.length === 1) {
    const m = markets[0];
    const outcomes = m.outcomes || [];
    const prices = m.outcomePrices || [];
    const isYesNo = outcomes.some(o => /^yes$/i.test(String(o).trim()));
    if (isYesNo) {
      const yesIdx = outcomes.findIndex(o => /^yes$/i.test(String(o).trim()));
      homeProb = yesIdx >= 0 ? Math.round(parseFloat(prices[yesIdx] ?? 0) * 100) : null;
      awayProb = homeProb != null ? 100 - homeProb : null;
    } else {
      homeProb = Math.round(parseFloat(prices[0] ?? 0) * 100);
      awayProb = Math.round(parseFloat(prices[1] ?? 0) * 100);
    }
  } else {
    markets.forEach(m => {
      const q = ((m.question || '') + ' ' + (m.groupItemTitle || '')).toLowerCase();
      const p = Math.round(parseFloat(m.outcomePrices?.[0] ?? m.lastTradePrice ?? 0) * 100);
      if (q.includes('draw') || q.includes('tie')) drawProb = p;
      else if (teamMatch(q, home)) homeProb = p;
      else if (teamMatch(q, away)) awayProb = p;
    });
    if (homeProb === null && markets.length === 3) {
      homeProb = Math.round(parseFloat(markets[0]?.outcomePrices?.[0] ?? 0) * 100);
      drawProb  = Math.round(parseFloat(markets[1]?.outcomePrices?.[0] ?? 0) * 100);
      awayProb  = Math.round(parseFloat(markets[2]?.outcomePrices?.[0] ?? 0) * 100);
    } else if (homeProb === null && markets.length === 2) {
      homeProb = Math.round(parseFloat(markets[0]?.outcomePrices?.[0] ?? 0) * 100);
      awayProb  = Math.round(parseFloat(markets[1]?.outcomePrices?.[0] ?? 0) * 100);
    }
  }
  return new Response(JSON.stringify({
    found: true, title: event.title || `${home} vs ${away}`,
    url: `https://polymarket.com/event/${event.slug || event.id}`,
    homeProb, awayProb, drawProb,
    volume: event.volume ? `$${Number(parseFloat(event.volume).toFixed(0)).toLocaleString()}` : null,
    outcomes: markets.map(m => ({ label: m.groupItemTitle || m.question || '?', prob: Math.round(parseFloat(m.outcomePrices?.[0] ?? 0) * 100) })).filter(o => o.prob > 0),
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' } });
}

function buildMarketResponse(market, home, away) {
  const outcomes = (market.outcomes || []);
  const prices = (market.outcomePrices || []);
  const parsed = outcomes.map((o,i) => ({ label: o, prob: Math.round(parseFloat(prices[i]??0)*100) }));
  let homeProb = null, awayProb = null, drawProb = null;
  parsed.forEach(o => {
    const l = o.label.toLowerCase();
    if (l.includes('draw')||l.includes('tie')) drawProb = o.prob;
    else if (teamMatch(l, home)) homeProb = o.prob;
    else if (teamMatch(l, away)) awayProb = o.prob;
  });
  return new Response(JSON.stringify({
    found: true, title: market.question || market.title,
    url: `https://polymarket.com/event/${market.slug || market.id}`,
    homeProb, awayProb, drawProb,
    volume: market.volume ? `$${Number(parseFloat(market.volume).toFixed(0)).toLocaleString()}` : null,
    outcomes: parsed,
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' } });
}
