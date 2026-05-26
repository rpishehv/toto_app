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
  if (type === 'live') {
    endpoint = `${BASE}/fixtures?live=all&league=${LEAGUE}&season=${SEASON}`;
  } else if (type === 'today') {
    const today = new Date().toISOString().split('T')[0];
    endpoint = `${BASE}/fixtures?date=${today}&league=${LEAGUE}&season=${SEASON}`;
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
    if (data.errors && Object.keys(data.errors).length > 0) {
      const msg = Object.values(data.errors).join(', ');
      return new Response(JSON.stringify({ error: msg }), { status: 400 });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
