// api/news.js — Vercel serverless function (Node.js runtime for longer timeout)
// Fetches latest World Cup 2026 news using Claude web search

// Node.js runtime allows up to 60s — needed for web search
export const config = { maxDuration: 60, api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `Search the web for the latest FIFA World Cup 2026 news from the last 48 hours.

After searching, return ONLY a JSON array. No intro text, no markdown fences, no explanation. Start your response with [ and end with ].

Return 5-6 stories in this exact format:
[{"headline":"...","summary":"...","category":"...","team":"...","source":"...","urgent":false}]

category must be one of: Injury, Team News, Match Preview, Match Report, Analysis, Transfer, Standings
urgent is true only for breaking news from the last few hours
headline max 80 chars, summary 2-3 sentences plain text only — no HTML, no <cite> tags, no markdown`;

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `API error: ${err.slice(0, 200)}` });
    }

    const data = await response.json();

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    if (!text) {
      const blockTypes = (data.content || []).map(b => b.type).join(', ');
      return res.status(500).json({ error: `No text block. Block types: ${blockTypes}` });
    }

    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');

    if (start === -1 || end === -1 || end <= start) {
      return res.status(500).json({ error: 'No JSON array found', raw: text.slice(0, 300) });
    }

    let stories;
    try {
      stories = JSON.parse(cleaned.slice(start, end + 1));
    } catch(e) {
      return res.status(500).json({ error: `Parse failed: ${e.message}`, raw: cleaned.slice(start, start+300) });
    }

    if (!Array.isArray(stories) || stories.length === 0) {
      return res.status(500).json({ error: 'Empty stories array' });
    }

    const safe = stories.map(s => ({
      headline: String(s.headline || '').slice(0, 100),
      summary:  String(s.summary  || '').replace(/<cite[^>]*>(.*?)<\/cite>/gs,'$1').replace(/<[^>]+>/g,'').trim(),
      category: String(s.category || 'General'),
      team:     String(s.team     || 'General'),
      source:   String(s.source   || ''),
      urgent:   Boolean(s.urgent),
    }));

    return res.status(200).json({ stories: safe, fetchedAt: new Date().toISOString() });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

module.exports = handler;
