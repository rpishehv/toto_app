// api/group-odds.js — Polymarket group winner odds
// Fetches from Polymarket event page which has odds in JSON-LD / meta

export const config = { runtime: 'edge' };

const GROUP_EVENT_URLS = {
  A: 'https://polymarket.com/event/world-cup-group-a-winner',
  B: 'https://polymarket.com/event/world-cup-group-b-winner',
  C: 'https://polymarket.com/event/world-cup-group-c-winner',
  D: 'https://polymarket.com/event/world-cup-group-d-winner',
  E: 'https://polymarket.com/event/world-cup-group-e-winner',
  F: 'https://polymarket.com/event/world-cup-group-f-winner',
  G: 'https://polymarket.com/event/world-cup-group-g-winner',
  H: 'https://polymarket.com/event/world-cup-group-h-winner',
  I: 'https://polymarket.com/event/world-cup-group-i-winner',
  J: 'https://polymarket.com/event/world-cup-group-j-winner',
  K: 'https://polymarket.com/event/world-cup-group-k-winner',
  L: 'https://polymarket.com/event/fifa-world-cup-group-l-winner',
};

// Hardcoded fallback odds from Polymarket as of June 6 2026
// These will be used if the API fetch fails
const FALLBACK_ODDS = {
  A: [{label:'Mexico',prob:51},{label:'Czechia',prob:24},{label:'South Korea',prob:22},{label:'South Africa',prob:3}],
  B: [{label:'Switzerland',prob:55},{label:'Canada',prob:30},{label:'Bosnia-Herzegovina',prob:12},{label:'Qatar',prob:3}],
  C: [{label:'Brazil',prob:67},{label:'Morocco',prob:23},{label:'Scotland',prob:9},{label:'Haiti',prob:1}],
  D: [{label:'USA',prob:45},{label:'Turkey',prob:28},{label:'Paraguay',prob:17},{label:'Australia',prob:10}],
  E: [{label:'Germany',prob:67},{label:'Ecuador',prob:18},{label:'Ivory Coast',prob:13},{label:'Curacao',prob:2}],
  F: [{label:'Netherlands',prob:52},{label:'Japan',prob:26},{label:'Sweden',prob:18},{label:'Tunisia',prob:4}],
  G: [{label:'Belgium',prob:54},{label:'Iran',prob:20},{label:'Egypt',prob:18},{label:'New Zealand',prob:8}],
  H: [{label:'Spain',prob:72},{label:'Uruguay',prob:16},{label:'Saudi Arabia',prob:9},{label:'Cape Verde',prob:3}],
  I: [{label:'France',prob:67},{label:'Norway',prob:24},{label:'Senegal',prob:8},{label:'Iraq',prob:1}],
  J: [{label:'Argentina',prob:65},{label:'Austria',prob:18},{label:'Algeria',prob:13},{label:'Jordan',prob:4}],
  K: [{label:'Portugal',prob:62},{label:'Colombia',prob:30},{label:'Uzbekistan',prob:5},{label:'DR Congo',prob:3}],
  L: [{label:'England',prob:68},{label:'Croatia',prob:18},{label:'Ghana',prob:10},{label:'Panama',prob:4}],
};

export default async function handler(req) {
  const url = new URL(req.url);
  const group = url.searchParams.get('group')?.toUpperCase();
  if (!group || !GROUP_EVENT_URLS[group]) {
    return new Response(JSON.stringify({ error: 'Invalid group' }), { status: 400 });
  }

  const headers = {
    'Accept': 'text/html,application/xhtml+xml',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const r = await fetch(GROUP_EVENT_URLS[group], { headers });
    if (r.ok) {
      const html = await r.text();

      // Try to extract outcomes from JSON embedded in the page
      // Polymarket embeds market data in window.__NEXT_DATA__ or similar
      const nextDataMatch = html.match(/"outcomePrices":\s*\[([^\]]+)\]/g);
      const outcomeMatch  = html.match(/"outcomes":\s*\["([^"]+)","([^"]+)","([^"]+)","([^"]+)"\]/);
      const titleMatches  = html.match(/"groupItemTitle":"([^"]+)"/g);
      const priceMatches  = html.match(/"outcomePrices":\["([\d.]+)"/g);

      if (titleMatches && priceMatches && titleMatches.length >= 2 && priceMatches.length >= 2) {
        const outcomes = titleMatches.slice(0, 4).map((t, i) => {
          const label = t.match(/"groupItemTitle":"([^"]+)"/)?.[1] || '?';
          const priceStr = priceMatches[i]?.match(/"outcomePrices":\["([\d.]+)"/)?.[1] || '0';
          return { label, prob: Math.round(parseFloat(priceStr) * 100) };
        }).filter(o => o.prob > 0 && o.label !== '?')
          .sort((a,b) => b.prob - a.prob);

        if (outcomes.length >= 2) {
          return new Response(JSON.stringify({
            found: true, group, source: 'live',
            url: GROUP_EVENT_URLS[group],
            outcomes,
          }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } });
        }
      }
    }
  } catch(e) {}

  // Return hardcoded fallback
  const fallback = FALLBACK_ODDS[group];
  if (fallback) {
    return new Response(JSON.stringify({
      found: true, group, source: 'cached',
      url: GROUP_EVENT_URLS[group],
      outcomes: fallback,
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } });
  }

  return new Response(JSON.stringify({ found: false, group }), { status: 200 });
}
