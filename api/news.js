// api/news.js — Vercel serverless function
// Fetches latest World Cup 2026 news using Claude web search

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
  }

  const prompt = `Search the web for the latest FIFA World Cup 2026 news from today or the last 48 hours.

Find 6-8 of the most important and interesting stories covering:
- Team news, injuries, suspensions, lineup leaks
- Match previews and predictions
- Post-match reactions and analysis
- Surprise results or upsets
- Key player updates (form, fitness, controversy)
- Tournament standings and qualification battles

Respond ONLY with a valid JSON array, no other text:
[
  {
    "headline": "<punchy headline, max 80 chars>",
    "summary": "<2-3 sentence summary of the story>",
    "category": "<one of: Injury | Team News | Match Preview | Match Report | Analysis | Transfer | Standings>",
    "team": "<main team involved, or 'General' if multiple>",
    "source": "<publication name e.g. BBC Sport, ESPN, Sky Sports>",
    "urgent": <true if breaking/very recent, false otherwise>
  }
]

Focus on stories that would help someone making match predictions. Be specific — name players, scores, dates.`;

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
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }

    const data = await response.json();
    const text = data.content
      ?.filter(b => b.type === 'text')
      ?.map(b => b.text)
      ?.join('') || '';

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'No JSON array in response', raw: text }), { status: 500 });
    }

    const stories = JSON.parse(match[0]);
    return new Response(JSON.stringify({ stories, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
