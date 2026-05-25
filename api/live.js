// api/live.js — Vercel serverless function
// Fetches live World Cup match data from API-Football via RapidAPI
// RAPIDAPI_KEY stored securely in Vercel env vars

export const config = { runtime: 'edge' };

const WC_2026_LEAGUE_ID = 1; // FIFA World Cup league ID in API-Football

export default async function handler(req) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'live';
  const fixtureId = url.searchParams.get('fixtureId');

  try {
    let endpoint = '';
    if (type === 'live') {
      endpoint = `https://api-football-v1.p.rapidapi.com/v3/fixtures?live=all&league=${WC_2026_LEAGUE_ID}&season=2026`;
    } else if (type === 'today') {
      const today = new Date().toISOString().split('T')[0];
      endpoint = `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}&league=${WC_2026_LEAGUE_ID}&season=2026`;
    } else if (type === 'stats' && fixtureId) {
      endpoint = `https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${fixtureId}`;
    } else if (type === 'events' && fixtureId) {
      endpoint = `https://api-football-v1.p.rapidapi.com/v3/fixtures/events?fixture=${fixtureId}`;
    } else if (type === 'odds' && fixtureId) {
      endpoint = `https://api-football-v1.p.rapidapi.com/v3/odds/live?fixture=${fixtureId}`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type parameter' }), { status: 400 });
    }

    const response = await fetch(endpoint, {
      headers: {
        'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
        'x-rapidapi-key': apiKey,
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `API error: ${response.status}` }), { status: 500 });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache', // always fresh for live data
      },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
