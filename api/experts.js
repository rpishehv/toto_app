// api/experts.js — Vercel serverless function
// Uses Claude with web search to fetch live expert predictions for KO matches

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
    return new Response(JSON.stringify({ error: 'Missing home or away' }), { status: 400 });
  }

  const prompt = `Search the web for expert predictions and tipster consensus for the FIFA World Cup 2026 ${round||'knockout'} match: ${home} vs ${away}.

Find predictions from sources like BBC Sport, ESPN, Sky Sports, WhoScored, Oddschecker, and major football tipsters.

Respond ONLY with a JSON object in this exact format:
{
  "sources": [
    { "name": "BBC Sport", "pick": "Team X 2-1", "confidence": "High" },
    { "name": "ESPN FC", "pick": "Team X 2-0", "confidence": "Medium" },
    { "name": "Sky Sports", "pick": "Team X win", "confidence": "High" },
    { "name": "Oddschecker", "pick": "Team X win", "pct": 65 }
  ],
  "consensus": "Team X win",
  "likelyScore": "2-1",
  "summary": "2-3 sentence summary of why experts back this outcome"
}

Use actual team names from the match. If you cannot find specific predictions, use your knowledge of expert opinion and current form. Always return valid JSON.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }

    const data = await response.json();

    // Extract text from response (may include tool_use blocks)
    const text = data.content
      ?.filter(b => b.type === 'text')
      ?.map(b => b.text)
      ?.join('') || '';

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'No JSON in response', raw: text }), { status: 500 });
    }

    const result = JSON.parse(match[0]);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
