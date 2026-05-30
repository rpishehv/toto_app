// api/predict.js — Vercel serverless function
// Generates rich AI predictions for knockout matches using Claude Sonnet 4.6

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
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }

  const { home, away, round } = body;
  if (!home || !away) {
    return new Response(JSON.stringify({ error: 'Missing home or away team' }), { status: 400 });
  }

  const prompt = `You are an expert World Cup 2026 football analyst with deep knowledge of all 48 teams, their squads, form, tactics and key players heading into the tournament.

Predict the outcome of this knockout match:
${home} vs ${away} (${round || 'Knockout'})

Consider:
- Current FIFA rankings and recent form (last 6 months)
- Key players and their current fitness/form
- Tactical matchups and how each team's style suits this fixture
- Tournament momentum and pressure
- Historical head-to-head record if relevant
- Home advantage if a host nation is involved

Respond with ONLY valid JSON in this exact format, no other text:
{
  "h": <home_goals_integer_0_to_5>,
  "a": <away_goals_integer_0_to_5>,
  "confidence": "<High|Medium|Low>",
  "r": "<one punchy sentence reason, max 90 chars>",
  "insight": "<2-3 sentences of deeper tactical/form analysis — specific to these teams>",
  "key": "<the single most important factor that will decide this match, max 60 chars>"
}

Rules:
- Goals must be integers 0-5
- Knockout matches must have a winner (no draws) — if you expect extra time, pick the eventual winner with a 1-goal margin
- insight must be specific to these two teams, not generic
- key should name specific players or tactical elements`;

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
        max_tokens: 400,
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

    const match = text.match(/\{[\s\S]*?\}/);
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
