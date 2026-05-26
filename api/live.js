// api/live.js — Vercel serverless function
// Fetches live World Cup match data from API-Football
// Supports both RapidAPI and direct api-sports.io

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const directApiKey = process.env.APISPORTS_KEY; // alternative direct key

  if (!rapidApiKey && !directApiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured. Add RAPIDAPI_KEY or APISPORTS_KEY to Vercel env vars.' }), { status: 500 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'live';
  const fixtureId = url.searchParams.get('fixtureId');

  // WC 2026 league ID — 1 on RapidAPI, same on direct
  const LEAGUE_ID = 1;
  const SEASON = 2026;

  // Try RapidAPI format first, then direct API-Sports format
  // RapidAPI keys start differently from direct API-Sports keys
  // Direct curl working = likely direct API-Sports key, stored as RAPIDAPI_KEY
  const apiKey = rapidApiKey || directApiKey;

  // Direct API-Football endpoint (dashboard.api-football.com key)
  const baseUrl = 'https://v3.football.api-sports.io';
  const headers = {
    'x-apisports-key': apiKey,
  };

  let endpoint = '';
  if (type === 'live') {
    endpoint = `${baseUrl}/fixtures?live=all&league=${LEAGUE_ID}&season=${SEASON}`;
  } else if (type === 'today') {
    const today = new Date().toISOString().split('T')[0];
    endpoint = `${baseUrl}/fixtures?date=${today}&league=${LEAGUE_ID}&season=${SEASON}`;
  } else if (type === 'stats' && fixtureId) {
    endpoint = `${baseUrl}/fixtures/statistics?fixture=${fixtureId}`;
  } else if (type === 'events' && fixtureId) {
    endpoint = `${baseUrl}/fixtures/events?fixture=${fixtureId}`;
  } else {
    return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400 });
  }

  try {
    const response = await fetch(endpoint, { headers });

    if (response.status === 403) {
      return new Response(JSON.stringify({
        error: '403 Forbidden — check your API key is correct and has access to the World Cup endpoint.',
        tip: 'On RapidAPI free plan, make sure you subscribed to API-Football and copied the correct key.'
      }), { status: 403 });
    }

    if (response.status === 429) {
      return new Response(JSON.stringify({
        error: '429 Rate limit reached — you\'ve used your daily quota of 100 requests.',
        tip: 'The free plan allows 100 requests/day. Try again tomorrow or upgrade your plan.'
      }), { status: 429 });
    }

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: `API error ${response.status}`,
        tip: 'Check your API key and plan limits at rapidapi.com'
      }), { status: response.status });
    }

    const data = await response.json();

    // Check for API-level errors
    if (data.errors && Object.keys(data.errors).length > 0) {
      return new Response(JSON.stringify({
        error: Object.values(data.errors).join(', '),
        tip: 'API returned an error response'
      }), { status: 400 });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
