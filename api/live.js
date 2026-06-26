// api/live.js — Vercel serverless function
// Uses API-Football (api-football.com / api-sports.io)

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured.' }), { status: 500 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'live';
  const fixtureId = url.searchParams.get('fixtureId');

  const BASE = 'https://v3.football.api-sports.io';
  const headers = { 'x-apisports-key': apiKey };

  const LEAGUE = 1;    // FIFA World Cup
  const SEASON = 2026;

  let endpoint = '';
  if (type === 'status') {
    endpoint = `${BASE}/status`;
  } else if (type === 'live') {
    endpoint = `${BASE}/fixtures?live=all&league=${LEAGUE}&season=${SEASON}`;
  } else if (type === 'today') {
    // Use PT timezone (UTC-7 PDT / UTC-8 PST) — WC2026 games in North America
    const nowPT = new Date(Date.now() - 7 * 60 * 60 * 1000); // PDT offset
    const today = nowPT.toISOString().split('T')[0];
    // Also fetch tomorrow in case late PT games cross UTC midnight
    const tomorrowPT = new Date(Date.now() - 7 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
    const tomorrow = tomorrowPT.toISOString().split('T')[0];
    // Fetch both dates and merge
    const [todayRes, tomorrowRes] = await Promise.all([
      fetch(`${BASE}/fixtures?date=${today}&league=${LEAGUE}&season=${SEASON}`, { headers }),
      fetch(`${BASE}/fixtures?date=${tomorrow}&league=${LEAGUE}&season=${SEASON}`, { headers }),
    ]);
    const [todayData, tomorrowData] = await Promise.all([todayRes.json(), tomorrowRes.json()]);
    const combined = [...(todayData.response||[]), ...(tomorrowData.response||[])];
    // Filter to PT day window: midnight PT to midnight PT
    const ptDayStart = new Date(today + 'T07:00:00Z').getTime(); // midnight PT = 07:00 UTC
    const ptDayEnd = ptDayStart + 24 * 60 * 60 * 1000;
    const filtered = combined.filter(f => {
      const ko = new Date(f.fixture?.date).getTime();
      return ko >= ptDayStart && ko < ptDayEnd;
    });
    return new Response(JSON.stringify({ response: filtered, results: filtered.length }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } else if (type === 'fixture' && fixtureId) {
    // Batch all fixture details in one call — saves 3 API requests
    const [statsRes, eventsRes, lineupsRes, playersRes] = await Promise.all([
      fetch(`${BASE}/fixtures/statistics?fixture=${fixtureId}`, { headers }),
      fetch(`${BASE}/fixtures/events?fixture=${fixtureId}`, { headers }),
      fetch(`${BASE}/fixtures/lineups?fixture=${fixtureId}`, { headers }),
      fetch(`${BASE}/fixtures/players?fixture=${fixtureId}`, { headers }),
    ]);
    const [stats, events, lineups, players] = await Promise.all([
      statsRes.json(), eventsRes.json(), lineupsRes.json(), playersRes.json()
    ]);
    return new Response(JSON.stringify({
      stats: stats.response || [],
      events: events.response || [],
      lineups: lineups.response || [],
      players: players.response || [],
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
  } else if (type === 'fixtures') {
    const round = url.searchParams.get('round');
    endpoint = `${BASE}/fixtures?league=${LEAGUE}&season=${SEASON}${round?`&round=${encodeURIComponent(round)}`:''}`;
  } else if (type === 'topscorers') {
    endpoint = `${BASE}/players/topscorers?league=${LEAGUE}&season=${SEASON}`;
  } else if (type === 'players' && fixtureId) {
    endpoint = `${BASE}/fixtures/players?fixture=${fixtureId}`;
  } else if (type === 'lineups' && fixtureId) {
    endpoint = `${BASE}/fixtures/lineups?fixture=${fixtureId}`;
  } else if (type === 'stats' && fixtureId) {
    endpoint = `${BASE}/fixtures/statistics?fixture=${fixtureId}`;
  } else if (type === 'events' && fixtureId) {
    endpoint = `${BASE}/fixtures/events?fixture=${fixtureId}`;
  } else {
    return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400 });
  }

  try {
    const response = await fetch(endpoint, { headers });

    if (response.status === 403) {
      return new Response(JSON.stringify({
        error: '403 Forbidden — check your API key.',
        tip: 'Make sure RAPIDAPI_KEY in Vercel matches your api-football.com key.'
      }), { status: 403 });
    }
    if (response.status === 429) {
      return new Response(JSON.stringify({
        error: '429 Rate limit — daily quota reached.',
        tip: 'Free plan allows 100 requests/day. Try again tomorrow.'
      }), { status: 429 });
    }
    if (!response.ok) {
      const text = await response.text();
      return new Response(JSON.stringify({ error: `API error ${response.status}`, tip: text.slice(0,200) }), { status: response.status });
    }

    const data = await response.json();
    // Log errors but return raw for debugging
    if (data.errors && Object.keys(data.errors).length > 0) {
      const msg = Object.values(data.errors).join(', ');
      return new Response(JSON.stringify({ response: [], results: 0, _unavailable: true, _error: msg }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
