// api/odds.js — Polymarket odds for WC2026 matches
// Uses the sports games endpoint which has match-level win probabilities

export const config = { runtime: 'edge' };

// Team name normalisation for matching
function normalise(name) {
  return (name || '').toLowerCase()
    .replace('ir iran', 'iran')
    .replace('cape verde', 'cabo verde')
    .replace('usa', 'united states')
    .replace('united states', 'usa')
    .trim();
}

function teamMatch(polyName, appName) {
  const p = normalise(polyName);
  const a = normalise(appName);
  const aWords = a.split(' ');
  return p.includes(a) || a.includes(p) || aWords.some(w => w.length > 3 && p.includes(w));
}

export default async function handler(req) {
  const url = new URL(req.url);
  const home = url.searchParams.get('home');
  const away = url.searchParams.get('away');

  if (!home || !away) {
    return new Response(JSON.stringify({ error: 'Missing teams' }), { status: 400 });
  }

  try {
    // Polymarket sports games endpoint — returns all upcoming/live WC matches
    const res = await fetch(
      'https://polymarket.com/api/sports/games?sport=soccer&league=world-cup&limit=200',
      { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000) }
    );

    if (res.ok) {
      const data = await res.json();
      const games = Array.isArray(data) ? data : (data.games || data.data || []);
      const match = games.find(g => {
        const t1 = g.homeTeam?.name || g.team1 || g.home || '';
        const t2 = g.awayTeam?.name || g.team2 || g.away || '';
        return (teamMatch(t1, home) && teamMatch(t2, away)) ||
               (teamMatch(t1, away) && teamMatch(t2, home));
      });
      if (match) {
        return buildResponse(match, home, away);
      }
    }

    // Fallback: gamma API with broader search terms
    const searches = [`${home} ${away}`, home, away];
    for (const term of searches) {
      try {
        const gRes = await fetch(
          `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(term)}&active=true&closed=false&limit=50&tag_id=100668`,
          { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
        );
        if (!gRes.ok) continue;
        const gData = await gRes.json();
        const markets = Array.isArray(gData) ? gData : (gData.markets || []);
        const market = markets.find(m => {
          const q = (m.question || m.title || '').toLowerCase();
          const hl = home.toLowerCase(), al = away.toLowerCase();
          const hw = home.split(' ')[0].toLowerCase(), aw = away.split(' ')[0].toLowerCase();
          return (q.includes(hl) || q.includes(hw)) && (q.includes(al) || q.includes(aw));
        });
        if (market) return buildGammaResponse(market, home, away);
      } catch { continue; }
    }

    // Last resort: search with "vs"
    try {
      const vsRes = await fetch(
        `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(home + ' vs ' + away)}&active=true&limit=10`,
        { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
      );
      if (vsRes.ok) {
        const vsData = await vsRes.json();
        const markets = Array.isArray(vsData) ? vsData : (vsData.markets || []);
        if (markets.length > 0) return buildGammaResponse(markets[0], home, away);
      }
    } catch {}

    return new Response(JSON.stringify({
      found: false,
      message: `No Polymarket market found yet for ${home} vs ${away} — markets open close to kickoff`,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch(e) {
    return new Response(JSON.stringify({
      found: false, message: 'Could not reach Polymarket', error: e.message,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}

function buildResponse(game, home, away) {
  // Sports API format
  const homeProb = Math.round((game.homeOdds || game.homeWinProbability || 0) * 100);
  const awayProb = Math.round((game.awayOdds || game.awayWinProbability || 0) * 100);
  const drawProb = Math.round((game.drawOdds || game.drawProbability || 0) * 100);
  return new Response(JSON.stringify({
    found: true,
    title: `${home} vs ${away}`,
    homeProb: homeProb || null,
    awayProb: awayProb || null,
    drawProb: drawProb || null,
    volume: game.volume ? `$${Number(parseFloat(game.volume).toFixed(0)).toLocaleString()}` : null,
    url: game.url || `https://polymarket.com/sports/world-cup/games`,
    outcomes: [
      { label: home, prob: homeProb },
      ...(drawProb ? [{ label: 'Draw', prob: drawProb }] : []),
      { label: away, prob: awayProb },
    ].filter(o => o.prob > 0),
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120' } });
}

function buildGammaResponse(market, home, away) {
  const outcomes = (market.outcomes || []);
  const prices = (market.outcomePrices || []);
  const parsedOutcomes = outcomes.map((o, i) => ({
    label: o, prob: Math.round(parseFloat(prices[i] || 0) * 100),
  }));
  let homeProb = null, awayProb = null, drawProb = null;
  parsedOutcomes.forEach(o => {
    const l = o.label.toLowerCase();
    if (l.includes(home.split(' ')[0].toLowerCase()) || l.includes('home')) homeProb = o.prob;
    else if (l.includes(away.split(' ')[0].toLowerCase()) || l.includes('away')) awayProb = o.prob;
    else if (l.includes('draw') || l.includes('tie')) drawProb = o.prob;
  });
  return new Response(JSON.stringify({
    found: true,
    title: market.question || market.title,
    url: `https://polymarket.com/event/${market.slug || market.id}`,
    homeProb, awayProb, drawProb,
    volume: market.volume ? `$${Number(parseFloat(market.volume).toFixed(0)).toLocaleString()}` : null,
    outcomes: parsedOutcomes,
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120' } });
}
