// api/matchquery.js — Answer live match questions using Claude + web search

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'No API key' }), { status: 500 });

  const { question, home, away, homeScore, awayScore, elapsed, stats, events, venue, city, attendance, referee } = await req.json();
  if (!question) return new Response(JSON.stringify({ error: 'No question' }), { status: 400 });

  const matchContext = `
Current match: ${home} ${homeScore ?? '-'} – ${awayScore ?? '-'} ${away} (${elapsed ? elapsed + "'" : 'Not started'})
Venue: ${venue || 'Unknown'}${city ? ', ' + city : ''}
Attendance: ${attendance ? attendance.toLocaleString() : 'Not yet available'}
Referee: ${referee || 'Unknown'}
Recent events: ${(events||[]).slice(-5).map(e=>`${e.time?.elapsed}' ${e.type} - ${e.player?.name}`).join(', ') || 'None'}
Stats available: ${stats?.length ? 'Yes' : 'No'}
`.trim();

  const prompt = `You are a football analyst assistant for a live World Cup 2026 match.

Match context:
${matchContext}

User question: "${question}"

Answer the question concisely (2-4 sentences). If it's about stadium attendance, TV viewers, or other facts not in the match context, use your web search tool to find accurate information. If it's about the current match, use the provided context.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (data.error) {
      return new Response(JSON.stringify({ answer: `API error: ${data.error.message}` }), { status: 200 });
    }
    const answer = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim() || 'Could not generate an answer.';

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
