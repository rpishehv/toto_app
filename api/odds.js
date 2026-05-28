// api/odds.js — Vercel serverless function
// Fetches prediction market odds from Polymarket (public, no key)
// Falls back to a "coming soon" message if markets not open yet

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const home = url.searchParams.get('home');
  const away = url.searchParams.get('away');

  if (!home || !away) {
    return new Response(JSON.stringify({ error: 'Missing home or away team' }), { status: 400 });
  }

  try {
    // Try Polymarket gamma API
    const searches = [
      `${home} vs ${away}`,
      `${home} ${away}`,
      `FIFA World Cup 2026`,
    ];

    let market = null;

    for (const term of searches) {
      try {
        const res = await fetch(
          `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(term)}&active=true&closed=false&limit=20`,
          { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) continue;
        const data = await res.json();
        const markets = Array.isArray(data) ? data : (data.markets || []);
        const hl = home.toLowerCase(), al = away.toLowerCase();
        const hs = home.split(' ')[0].toLowerCase(), as_ = away.split(' ')[0].toLowerCase();
        market = markets.find(m => {
          const t = (m.question || m.title || '').toLowerCase();
          return (t.includes(hl)||t.includes(hs)) && (t.includes(al)||t.includes(as_));
        });
        if (market) break;
      } catch { continue; }
    }

    if (!market) {
      // Check if any WC2026 markets exist at all
      let wcMarketsExist = false;
      try {
        const res = await fetch(
          `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent('World Cup 2026')}&limit=5`,
          { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
        );
        if (res.ok) {
          const data = await res.json();
          const markets = Array.isArray(data) ? data : (data.markets || []);
          wcMarketsExist = markets.length > 0;
        }
      } catch { /* ignore */ }

      return new Response(JSON.stringify({
        found: false,
        wcMarketsExist,
        message: wcMarketsExist
          ? `No specific market found for ${home} vs ${away} yet`
          : 'Polymarket World Cup 2026 markets not open yet — check back closer to June 11',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Parse outcomes
    const outcomes = (market.outcomes || []);
    const prices = (market.outcomePrices || []);
    const parsedOutcomes = outcomes.map((o, i) => ({
      label: o,
      prob: Math.round(parseFloat(prices[i] || 0) * 100),
    }));

    // Try to identify home/away/draw
    let homeProb = null, awayProb = null, drawProb = null;
    parsedOutcomes.forEach(o => {
      const l = o.label.toLowerCase();
      const hs = home.split(' ')[0].toLowerCase();
      const as_ = away.split(' ')[0].toLowerCase();
      if (l.includes(hs) || l.includes('home')) homeProb = o.prob;
      else if (l.includes(as_) || l.includes('away')) awayProb = o.prob;
      else if (l.includes('draw') || l.includes('tie')) drawProb = o.prob;
    });

    return new Response(JSON.stringify({
      found: true,
      title: market.question || market.title,
      url: `https://polymarket.com/event/${market.slug || market.id}`,
      homeProb, awayProb, drawProb,
      volume: market.volume
        ? `$${Number(parseFloat(market.volume).toFixed(0)).toLocaleString()}`
        : null,
      outcomes: parsedOutcomes,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120' },
    });

  } catch (e) {
    return new Response(JSON.stringify({
      found: false,
      message: 'Could not reach Polymarket — try again later',
      error: e.message,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
