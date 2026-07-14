// api/matchquery.js — Answer live match questions using Claude + web search + API-Football

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Tournament ended July 20 — block all API calls after that
  const TOURNAMENT_END = new Date('2026-07-20T00:00:00-04:00').getTime();
  if (Date.now() > TOURNAMENT_END) {
    return new Response(JSON.stringify({ error: 'Tournament has ended', closed: true }), {
      status: 410, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'No API key' }), { status: 500 });

  const { question, home, away, homeScore, awayScore, elapsed, stats, events, fixtureId } = await req.json();
  if (!question) return new Response(JSON.stringify({ error: 'No question' }), { status: 400 });

  // Fetch fresh fixture details from API-Football
  let venue = 'Unknown', city = '', attendance = null, referee = 'Unknown';
  if (fixtureId) {
    try {
      const footballKey = process.env.RAPIDAPI_KEY;
      if (footballKey) {
        const fRes = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
          headers: { 'x-apisports-key': footballKey },
        });
        const fData = await fRes.json();
        const fix = fData.response?.[0]?.fixture;
        if (fix) {
          venue = fix.venue?.name || venue;
          city = fix.venue?.city || city;
          attendance = fix.attendance || null;
          referee = fix.referee || referee;
        }
      }
    } catch(e) { /* non-critical */ }
  }

  const matchContext = `
Current match: ${home} ${homeScore ?? '-'} – ${awayScore ?? '-'} ${away} (${elapsed ? elapsed + "'" : 'Not started'})
Venue: ${venue}${city ? ', ' + city : ''}
Attendance: ${attendance ? parseInt(attendance).toLocaleString() + ' fans' : 'Not yet released'}
Referee: ${referee}
Recent events: ${(events||[]).slice(-5).map(e=>`${e.time?.elapsed}' ${e.type} - ${e.player?.name}`).join(', ') || 'None'}
`.trim();

  const prompt = `You are a football analyst assistant for a live World Cup 2026 match.

Match context:
${matchContext}

User question: "${question}"

Answer concisely in 2-3 sentences using the match context above. Only use web search if the question cannot be answered from the context provided.`;

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
        max_tokens: 512,
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

    return new Response(JSON.stringify({ answer, venue, attendance, referee }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
