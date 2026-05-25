// api/predict.js — Vercel serverless function
// Generates AI score predictions for knockout matches using Claude API
// ANTHROPIC_API_KEY is stored securely in Vercel env vars (server-side only)

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
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { home, away, round } = body;
  if (!home || !away) {
    return new Response(JSON.stringify({ error: 'Missing home or away team' }), { status: 400 });
  }

  const prompt = `You are a World Cup 2026 football analyst. Predict the score for this knockout match:

${home} vs ${away} (${round})

Respond with ONLY a JSON object in this exact format, no other text:
{"h": <home_goals>, "a": <away_goals>, "r": "<one sentence reason, max 80 chars>"}

Rules:
- Goals must be integers 0-5
- In knockout rounds there must be a winner (no draws unless you expect extra time to be needed — in that case pick a draw)
- Reason should be specific to these two teams`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
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

    // Parse JSON from response
    const match = text.match(/\{[^}]+\}/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Could not parse prediction', raw: text }), { status: 500 });
    }

    const prediction = JSON.parse(match[0]);
    if (typeof prediction.h !== 'number' || typeof prediction.a !== 'number') {
      return new Response(JSON.stringify({ error: 'Invalid prediction format' }), { status: 500 });
    }

    return new Response(JSON.stringify(prediction), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
