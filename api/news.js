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

Find 6-8 of the most important stories covering injuries, team news, match previews, results, and player updates.

You MUST respond with ONLY a valid JSON array — no introduction, no explanation, no markdown, just the raw JSON array starting with [ and ending with ]:
[
  {
    "headline": "punchy headline under 80 chars",
    "summary": "2-3 sentence summary of the story",
    "category": "Injury",
    "team": "team name or General",
    "source": "BBC Sport",
    "urgent": false
  }
]

Category must be one of: Injury, Team News, Match Preview, Match Report, Analysis, Transfer, Standings
urgent is true only for breaking news from the last few hours.`;

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
      return new Response(JSON.stringify({ error: `API error: ${err}` }), { status: 500 });
    }

    const data = await response.json();

    // Extract all text blocks (web search returns tool_use + text blocks)
    const textBlocks = data.content?.filter(b => b.type === 'text') || [];
    const text = textBlocks.map(b => b.text).join('');

    if (!text) {
      return new Response(JSON.stringify({
        error: 'No text in response',
        blockTypes: data.content?.map(b => b.type),
      }), { status: 500 });
    }

    // Try to extract JSON array - handle ```json fences and bare arrays
    let jsonStr = null;

    // Try fenced code block first
    const fenced = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (fenced) jsonStr = fenced[1];

    // Try bare array
    if (!jsonStr) {
      const bare = text.match(/\[[\s\S]*\]/);
      if (bare) jsonStr = bare[0];
    }

    if (!jsonStr) {
      return new Response(JSON.stringify({
        error: 'No JSON array found',
        raw: text.slice(0, 500),
      }), { status: 500 });
    }

    const stories = JSON.parse(jsonStr);

    if (!Array.isArray(stories) || stories.length === 0) {
      return new Response(JSON.stringify({ error: 'Empty or invalid stories array' }), { status: 500 });
    }

    return new Response(JSON.stringify({ stories, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
