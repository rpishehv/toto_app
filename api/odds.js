// api/odds.js — Polymarket odds for WC2026 matches
// Uses gamma events API with correct team name mappings

export const config = { runtime: 'edge' };

// Polymarket uses different team names than FIFA/app
const TEAM_ALIASES = {
  'south korea': 'korea republic',
  'korea republic': 'korea republic',
  'usa': 'united states',
  'united states': 'united states',
  'cape verde': 'cabo verde',
  'czechia': 'czech republic',
  'dr congo': 'dr congo',
  'ivory coast': 'cote d\'ivoire',
};

function normaliseTeam(name) {
  const lower = (name || '').toLowerCase().trim();
  return TEAM_ALIASES[lower] || lower;
}

function slugify(name) {
  return normaliseTeam(name)
    .replace(/'/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

function teamMatch(str, teamName) {
  const s = (str || '').toLowerCase();
  const t = normaliseTeam(teamName);
  const words = t.split(' ').filter(w => w.length > 2);
  return s.includes(t) || words.some(w => s.includes(w));
}

export default async function handler(req) {
  const url = new URL(req.url);
  const home = url.searchParams.get('home');
  const away = url.searchParams.get('away');
  if (!home || !away) {
    return new Response(JSON.stringify({ error: 'Missing teams' }), { status: 400 });
  }

  const BASE = 'https://gamma-api.polymarket.com';
  const headers = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' };

  try {
    // Strategy 1: Try direct event slug variants
    const h = slugify(home);
    const a = slugify(away);
    const slugVariants = [
      `${h}-vs-${a}`,
      `${a}-vs-${h}`,
      `wc-2026-${h}-vs-${a}`,
      `world-cup-${h}-vs-${a}`,
      `2026-world-cup-${h}-vs-${a}`,
      `fifa-world-cup-${h}-vs-${a}`,
    ];

    for (const slug of slugVariants) {
      try {
        const r = await fetch(`${BASE}/events/slug/${slug}`, { headers });
        if (r.ok) {
          const event = await r.json();
          if (event?.markets?.length > 0 || event?.title) {
            return buildEventResponse(event, home, away);
          }
        }
      } catch {}
    }

    // Strategy 2: Search events by tag_slug
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

    // Strategy 3: Search markets directly
    const searchTerms = [
      `${home} vs ${away}`,
      `${normaliseTeam(home)} vs ${normaliseTeam(away)}`,
    ];
    for (const term of searchTerms) {
      try {
        const r = await fetch(
          `${BASE}/markets?search=${encodeURIComponent(term)}&active=true&closed=false&limit=20`,
          { headers }
        );
        if (!r.ok) continue;
        const data = await r.json();
        const markets = Array.isArray(data) ? data : (data.markets || []);
        const market = markets.find(m => {
          const q = (m.question || m.title || '').toLowerCase();
          return teamMatch(q, home) && teamMatch(q, away);
        });
        if (market) return buildMarketResponse(market, home, away);
      } catch {}
    }

    // Not found
    return new Response(JSON.stringify({
      found: false,
      message: `No Polymarket market found for ${home} vs ${away} — opens 1-3 days before kickoff`,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch(e) {
    return new Response(JSON.stringify({
      found: false,
      message: `Polymarket error: ${e.message}`,
      error: e.message,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}

function buildEventResponse(event, home, away) {
  const markets = event.markets || [];
  let homeProb = null, awayProb = null, drawProb = null;

  markets.forEach(m => {
    const q = ((m.question || '') + ' ' + (m.groupItemTitle || '')).toLowerCase();
    const price = parseFloat(m.outcomePrices?.[0] ?? m.lastTradePrice ?? 0);
    const prob = Math.round(price * 100);
    if (q.includes('draw') || q.includes('tie')) drawProb = prob;
    else if (teamMatch(q, home)) homeProb = prob;
    else if (teamMatch(q, away)) awayProb = prob;
  });

  // Fallback: if 3 markets, assume home/draw/away order
  if (homeProb === null && markets.length === 3) {
    homeProb = Math.round(parseFloat(markets[0]?.outcomePrices?.[0] ?? 0) * 100);
    drawProb = Math.round(parseFloat(markets[1]?.outcomePrices?.[0] ?? 0) * 100);
    awayProb = Math.round(parseFloat(markets[2]?.outcomePrices?.[0] ?? 0) * 100);
  } else if (homeProb === null && markets.length === 2) {
    homeProb = Math.round(parseFloat(markets[0]?.outcomePrices?.[0] ?? 0) * 100);
    awayProb = Math.round(parseFloat(markets[1]?.outcomePrices?.[0] ?? 0) * 100);
  }

  const volume = event.volume
    ? `$${Number(parseFloat(event.volume).toFixed(0)).toLocaleString()}`
    : null;

  return new Response(JSON.stringify({
    found: true,
    title: event.title || `${home} vs ${away}`,
    url: `https://polymarket.com/event/${event.slug || event.id}`,
    homeProb, awayProb, drawProb, volume,
    outcomes: markets.map(m => ({
      label: m.groupItemTitle || m.question || '?',
      prob: Math.round(parseFloat(m.outcomePrices?.[0] ?? 0) * 100),
    })).filter(o => o.prob > 0),
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120' } });
}

function buildMarketResponse(market, home, away) {
  const outcomes = (market.outcomes || []);
  const prices = (market.outcomePrices || []);
  const parsed = outcomes.map((o, i) => ({
    label: o, prob: Math.round(parseFloat(prices[i] ?? 0) * 100),
  }));
  let homeProb = null, awayProb = null, drawProb = null;
  parsed.forEach(o => {
    const l = o.label.toLowerCase();
    if (l.includes('draw') || l.includes('tie')) drawProb = o.prob;
    else if (teamMatch(l, home)) homeProb = o.prob;
    else if (teamMatch(l, away)) awayProb = o.prob;
  });
  return new Response(JSON.stringify({
    found: true,
    title: market.question || market.title,
    url: `https://polymarket.com/event/${market.slug || market.id}`,
    homeProb, awayProb, drawProb,
    volume: market.volume ? `$${Number(parseFloat(market.volume).toFixed(0)).toLocaleString()}` : null,
    outcomes: parsed,
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120' } });
}
