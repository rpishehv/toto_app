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

  const prompt = `Search the web for the latest FIFA World Cup 2026 news from the last 48 hours.

After searching, return ONLY a JSON array. No intro text, no markdown fences, no explanation. Start your response with [ and end with ].

Return 6-8 stories in this exact format:
[{"headline":"...","summary":"...","category":"...","team":"...","source":"...","urgent":false}]

category must be one of: Injury, Team News, Match Preview, Match Report, Analysis, Transfer, Standings
urgent is true only for breaking news from the last few hours
headline max 80 chars, summary 2-3 sentences`;

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
      return new Response(JSON.stringify({ error: `API error: ${err.slice(0,200)}` }), { status: 500 });
    }

    const data = await response.json();

    // Collect all text from text blocks
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    if (!text) {
      const blockTypes = (data.content || []).map(b => b.type).join(', ');
      return new Response(JSON.stringify({
        error: `No text block in response. Block types: ${blockTypes}`,
      }), { status: 500 });
    }

    // Strip markdown fences if present
    let cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Find the JSON array — from first [ to last ]
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');

    if (start === -1 || end === -1 || end <= start) {
      return new Response(JSON.stringify({
        error: 'No JSON array found in response',
        raw: text.slice(0, 300),
      }), { status: 500 });
    }

    const jsonStr = cleaned.slice(start, end + 1);

    let stories;
    try {
      stories = JSON.parse(jsonStr);
    } catch(parseErr) {
      return new Response(JSON.stringify({
        error: `JSON parse failed: ${parseErr.message}`,
        raw: jsonStr.slice(0, 300),
      }), { status: 500 });
    }

    if (!Array.isArray(stories) || stories.length === 0) {
      return new Response(JSON.stringify({ error: 'Empty stories array' }), { status: 500 });
    }

    // Sanitise each story
    const safe = stories.map(s => ({
      headline: String(s.headline || '').slice(0, 100),
      summary:  String(s.summary  || ''),
      category: String(s.category || 'General'),
      team:     String(s.team     || 'General'),
      source:   String(s.source   || ''),
      urgent:   Boolean(s.urgent),
    }));

    return new Response(JSON.stringify({ stories: safe, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
