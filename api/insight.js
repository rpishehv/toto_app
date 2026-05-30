// api/insight.js — Vercel serverless function
// Generates rich match insights for knockout rounds using Claude API

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { home, away, round } = body;
  if (!home || !away) {
    return new Response(JSON.stringify({ error: 'Missing home or away team' }), { status: 400 });
  }

  const prompt = `You are a World Cup 2026 football analyst writing a match preview for ${home} vs ${away} in the ${round}.

Write a concise match insight (2-3 sentences max) covering:
- Each team's key strength/weakness
- The decisive tactical factor
- Your predicted score and one-sentence reason

Respond ONLY with a JSON object in this exact format, no other text:
{
  "h": <home_goals_integer>,
  "a": <away_goals_integer>,
  "insight": "<2-3 sentence match preview>",
  "key": "<one key tactical factor, max 15 words>",
  "confidence": "<High|Medium|Low>"
}

Rules:
- Goals must be integers 0-5
- Knockout rounds must have a winner (no 0-0 draws)
- insight must be specific to these two teams' strengths and styles
- Keep insight under 60 words`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      let errData;
      try { errData = JSON.parse(err); } catch { errData = { raw: err }; }
      const msg = errData?.error?.message || errData?.raw || err;
      return new Response(JSON.stringify({ error: `Claude API error: ${msg}` }), { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Could not parse insight', raw: text }), { status: 500 });
    }

    const result = JSON.parse(match[0]);
    if (typeof result.h !== 'number' || typeof result.a !== 'number') {
      return new Response(JSON.stringify({ error: 'Invalid insight format' }), { status: 500 });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
