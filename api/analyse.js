// api/analyse.js — Vercel serverless function
// Generates live match AI analysis using Claude

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { home, away, homeScore, awayScore, elapsed, events, stats, userPred, winProb } = body;

  const winProbText = winProb
    ? `Current win probability: ${home} ${winProb.home}%, Draw ${winProb.draw}%, ${away} ${winProb.away}%`
    : '';

  // Build context from match data
  const eventsText = events?.length > 0
    ? events.slice(-8).map(e => {
        const icon = e.type === 'Goal' ? '⚽' : e.type === 'Card' ? (e.detail?.includes('Yellow') ? '🟨' : '🟥') : '🔄';
        return `${e.time?.elapsed}' ${icon} ${e.player?.name} (${e.team?.name})${e.assist?.name ? ` - Assist: ${e.assist.name}` : ''}`;
      }).join('\n')
    : 'No events yet';

  const statsText = stats?.length >= 2
    ? (() => {
        const h = stats[0]?.statistics || [];
        const a = stats[1]?.statistics || [];
        const keys = ['Ball Possession', 'Total Shots', 'Shots on Goal', 'Corner Kicks', 'Fouls'];
        return keys.map(k => {
          const hv = h.find(s => s.type === k)?.value || '0';
          const av = a.find(s => s.type === k)?.value || '0';
          return `${k}: ${hv} vs ${av}`;
        }).join('\n');
      })()
    : 'Stats not available';

  const userPredText = userPred
    ? `User predicted: ${home} ${userPred.home} - ${userPred.away} ${away}`
    : 'No prediction made';

  const prompt = `You are a live football analyst covering the FIFA World Cup 2026.

Match: ${home} ${homeScore} - ${awayScore} ${away}
Minute: ${elapsed || '?'}'
${winProbText}

Recent Events:
${eventsText}

Match Stats (${home} vs ${away}):
${statsText}

${userPredText}

Write a sharp, exciting live match analysis in exactly 3 sentences:
1. What's happening tactically right now and who looks more likely to win
2. The key factor/moment that's defining the match and affecting win probability
3. What to expect in the remaining minutes, the most likely outcome, AND whether the user's prediction is on track

Keep it punchy, specific to THIS match, reference win likelihood naturally (e.g. "Mexico look odds-on to hold on", "South Africa need a miracle"), and under 90 words total. No headers, just flowing analysis.`;

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
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      let errData;
      try { errData = JSON.parse(err); } catch { errData = { raw: err }; }
      return new Response(JSON.stringify({ error: errData?.error?.message || err }), { status: 500 });
    }

    const data = await response.json();
    const analysis = data.content?.[0]?.text || '';
    return new Response(JSON.stringify({ analysis }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
