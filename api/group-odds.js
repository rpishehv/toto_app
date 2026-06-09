// api/group-odds.js — Polymarket group winner odds
// Tries gamma API, falls back to cached odds updated June 9 2026

export const config = { runtime: 'edge' };

// Confirmed from Polymarket June 9 2026 (group winner odds)
const FALLBACK_ODDS = {
  A: [{label:'Mexico',prob:56},{label:'Czechia',prob:22},{label:'South Korea',prob:22},{label:'South Africa',prob:0}],
  B: [{label:'Switzerland',prob:55},{label:'Canada',prob:30},{label:'Bosnia-Herzegovina',prob:12},{label:'Qatar',prob:3}],
  C: [{label:'Brazil',prob:67},{label:'Morocco',prob:23},{label:'Scotland',prob:7},{label:'Haiti',prob:3}],
  D: [{label:'USA',prob:44},{label:'Turkey',prob:28},{label:'Paraguay',prob:17},{label:'Australia',prob:11}],
  E: [{label:'Germany',prob:67},{label:'Ecuador',prob:18},{label:'Ivory Coast',prob:13},{label:'Curacao',prob:2}],
  F: [{label:'Netherlands',prob:52},{label:'Japan',prob:26},{label:'Sweden',prob:18},{label:'Tunisia',prob:4}],
  G: [{label:'Belgium',prob:54},{label:'Iran',prob:22},{label:'Egypt',prob:18},{label:'New Zealand',prob:6}],
  H: [{label:'Spain',prob:72},{label:'Uruguay',prob:16},{label:'Saudi Arabia',prob:9},{label:'Cape Verde',prob:3}],
  I: [{label:'France',prob:67},{label:'Norway',prob:24},{label:'Senegal',prob:11},{label:'Iraq',prob:1}],
  J: [{label:'Argentina',prob:66},{label:'Austria',prob:18},{label:'Algeria',prob:12},{label:'Jordan',prob:4}],
  K: [{label:'Portugal',prob:62},{label:'Colombia',prob:30},{label:'Uzbekistan',prob:5},{label:'DR Congo',prob:3}],
  L: [{label:'England',prob:68},{label:'Croatia',prob:18},{label:'Ghana',prob:10},{label:'Panama',prob:4}],
};

const GROUP_SLUGS = {
  A:'world-cup-group-a-winner', B:'world-cup-group-b-winner',
  C:'world-cup-group-c-winner', D:'world-cup-group-d-winner',
  E:'world-cup-group-e-winner', F:'world-cup-group-f-winner',
  G:'world-cup-group-g-winner', H:'world-cup-group-h-winner',
  I:'world-cup-group-i-winner', J:'world-cup-group-j-winner',
  K:'world-cup-group-k-winner', L:'fifa-world-cup-group-l-winner',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const group = url.searchParams.get('group')?.toUpperCase();
  if (!group || !FALLBACK_ODDS[group]) {
    return new Response(JSON.stringify({ error: 'Invalid group' }), { status: 400 });
  }

  const slug = GROUP_SLUGS[group];
  const BASE = 'https://gamma-api.polymarket.com';
  const headers = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' };

  // Try gamma API — query param format (more reliable than /events/slug/)
  const attempts = [
    `${BASE}/events?slug=${slug}&limit=1`,
    `${BASE}/events/slug/${slug}`,
  ];

  for (const apiUrl of attempts) {
    try {
      const r = await fetch(apiUrl, { headers });
      if (!r.ok) continue;
      const data = await r.json();
      // Handle both array and single object responses
      const event = Array.isArray(data) ? data[0] : data;
      const markets = event?.markets || [];
      if (markets.length >= 2) {
        const outcomes = markets.map(m => ({
          label: m.groupItemTitle || m.question?.replace(/Will\s+/i,'').replace(/\s+win.*/i,'').trim() || '?',
          prob: Math.round(parseFloat(m.outcomePrices?.[0] ?? m.lastTradePrice ?? 0) * 100),
        })).filter(o => o.prob > 0 && o.label.length < 30)
          .sort((a,b) => b.prob - a.prob);

        if (outcomes.length >= 2) {
          return new Response(JSON.stringify({
            found: true, group, source: 'live',
            url: `https://polymarket.com/event/${slug}`,
            outcomes,
          }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } });
        }
      }
    } catch {}
  }

  // Fallback to cached odds
  return new Response(JSON.stringify({
    found: true, group, source: 'cached',
    url: `https://polymarket.com/event/${slug}`,
    outcomes: FALLBACK_ODDS[group],
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } });
}
