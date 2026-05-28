// api/odds.js — Vercel serverless function
// Fetches prediction market odds from Polymarket (public API, no key needed)

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const home = url.searchParams.get('home');
  const away = url.searchParams.get('away');

  if (!home || !away) {
    return new Response(JSON.stringify({ error: 'Missing home or away team' }), { status: 400 });
  }

  try {
    // Search Polymarket gamma API for soccer/football markets
    const searchTerms = [
      `${home} ${away}`,
      `${away} ${home}`,
      `${home.split(' ')[0]} ${away.split(' ')[0]}`,
      'FIFA World Cup 2026',
      'World Cup soccer',
    ];

    let market = null;

    for (const term of searchTerms.slice(0, 2)) {
      const res = await fetch(
        `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(term)}&active=true&closed=false&limit=10`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!res.ok) continue;
      const data = await res.json();
      const markets = Array.isArray(data) ? data : data.markets || [];

      // Find a match market — look for both team names in the title
      const homeLower = home.toLowerCase();
      const awayLower = away.toLowerCase();
      const homeShort = home.split(' ')[0].toLowerCase();
      const awayShort = away.split(' ')[0].toLowerCase();

      market = markets.find(m => {
        const title = (m.question || m.title || '').toLowerCase();
        return (title.includes(homeLower) || title.includes(homeShort)) &&
               (title.includes(awayLower) || title.includes(awayShort));
      });

      if (market) break;
    }

    if (!market) {
      // Try broader World Cup search
      const res = await fetch(
        `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent('World Cup 2026')}&active=true&limit=20`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        const markets = Array.isArray(data) ? data : data.markets || [];
        const homeLower = home.toLowerCase();
        const awayLower = away.toLowerCase();
        market = markets.find(m => {
          const title = (m.question || m.title || '').toLowerCase();
          return title.includes(homeLower) && title.includes(awayLower);
        });
      }
    }

    if (!market) {
      return new Response(JSON.stringify({
        found: false,
        message: 'No Polymarket market found for this match yet. Markets typically open closer to kickoff.'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Parse outcomes and prices
    // Polymarket markets have outcomes array with prices (0-1 = probability)
    const outcomes = market.outcomes || [];
    const outcomePrices = market.outcomePrices || [];

    let homeProb = null, awayProb = null, drawProb = null;

    if (outcomes.length > 0 && outcomePrices.length > 0) {
      outcomes.forEach((outcome, i) => {
        const price = parseFloat(outcomePrices[i] || 0);
        const label = outcome.toLowerCase();
        if (label.includes(home.toLowerCase().split(' ')[0]) ||
            label.includes('home') || label === 'yes') {
          homeProb = Math.round(price * 100);
        } else if (label.includes(away.toLowerCase().split(' ')[0]) ||
                   label.includes('away')) {
          awayProb = Math.round(price * 100);
        } else if (label.includes('draw') || label.includes('tie')) {
          drawProb = Math.round(price * 100);
        }
      });
    }

    // Fallback: binary market (home wins yes/no)
    if (homeProb === null && market.lastTradePrice) {
      homeProb = Math.round(parseFloat(market.lastTradePrice) * 100);
      awayProb = 100 - homeProb;
    }

    return new Response(JSON.stringify({
      found: true,
      title: market.question || market.title,
      url: `https://polymarket.com/event/${market.slug || market.id}`,
      homeProb,
      awayProb,
      drawProb,
      volume: market.volume ? `$${Math.round(parseFloat(market.volume)).toLocaleString()}` : null,
      liquidity: market.liquidity ? `$${Math.round(parseFloat(market.liquidity)).toLocaleString()}` : null,
      outcomes: outcomes.map((o, i) => ({
        label: o,
        prob: Math.round(parseFloat(outcomePrices[i] || 0) * 100),
      })),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
