// api/tournament.js — Vercel serverless function
// Generates AI tournament bracket prediction and what-if scenarios

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

  const { type, groups, leaderboard, actualResults, whatIfTeam, whatIfPlace } = body;

  let prompt = '';

  if (type === 'bracket') {
    // Full tournament prediction
    prompt = `You are a World Cup 2026 expert analyst. Predict the complete FIFA World Cup 2026 tournament.

The 12 groups are:
Group A: Mexico, South Korea, South Africa, Czechia
Group B: Canada, Switzerland, Qatar, Bosnia-Herzegovina
Group C: Brazil, Morocco, Scotland, Haiti
Group D: USA, Paraguay, Australia, Turkey
Group E: Germany, Ecuador, Ivory Coast, Curacao
Group F: Netherlands, Japan, Tunisia, Sweden
Group G: Belgium, Iran, Egypt, New Zealand
Group H: Spain, Uruguay, Saudi Arabia, Cape Verde
Group I: France, Senegal, Norway, Iraq
Group J: Argentina, Austria, Algeria, Jordan
Group K: Portugal, Colombia, Uzbekistan, DR Congo
Group L: England, Croatia, Panama, Ghana

Respond ONLY with a JSON object in this exact format:
{
  "groupWinners": {
    "A": "team", "B": "team", "C": "team", "D": "team",
    "E": "team", "F": "team", "G": "team", "H": "team",
    "I": "team", "J": "team", "K": "team", "L": "team"
  },
  "groupRunnersUp": {
    "A": "team", "B": "team", "C": "team", "D": "team",
    "E": "team", "F": "team", "G": "team", "H": "team",
    "I": "team", "J": "team", "K": "team", "L": "team"
  },
  "quarterFinalists": ["team1","team2","team3","team4","team5","team6","team7","team8"],
  "semiFinalists": ["team1","team2","team3","team4"],
  "thirdPlace": "team",
  "runnerUp": "team",
  "champion": "team",
  "topScorer": "Full player name (e.g. Kylian Mbappe)",
  "reasoning": "2-3 sentence summary of why this team wins"
}

Base predictions on current form, squad quality, history, and tournament experience.`;

  } else if (type === 'commentary') {
    // Leaderboard commentary
    const top3 = (leaderboard || []).slice(0, 3);
    const bottom = (leaderboard || []).slice(-2);
    const total = leaderboard?.length || 0;
    const avgPts = total > 0
      ? Math.round(leaderboard.reduce((s, e) => s + e.points, 0) / total)
      : 0;

    prompt = `You are a witty football pundit writing leaderboard commentary for a friends World Cup prediction league.

Current standings:
${(leaderboard || []).map((e, i) => `${i+1}. ${e.username} — ${e.points}pts (picked ${e.champion} to win)`).join('\n')}

Average points: ${avgPts}
Matches played so far: ${actualResults?.matchesPlayed || 0} of 72 group games

Write a SHORT, punchy, funny commentary (3-4 sentences max) about the current standings.
- Mention the leader by name and why they're winning
- Take a gentle dig at someone near the bottom
- Reference who people picked to win and whether it's going well
- Keep it friendly and fun, not mean

Respond with ONLY the commentary text, no JSON, no headers.`;

  } else if (type === 'whatif') {
    // What-if scenario
    prompt = `You are analyzing a World Cup prediction league what-if scenario.

Current leaderboard:
${(leaderboard || []).map((e, i) => `${i+1}. ${e.username} — ${e.points}pts, picked: 🥇${e.podium?.first||'?'} 🥈${e.podium?.second||'?'} 🥉${e.podium?.third||'?'}`).join('\n')}

Scoring: 1st place correct = 100pts, 2nd = 50pts, 3rd = 25pts
Per match: Exact score = 6pts, Correct GD = 3pts, Correct outcome = 2pts

What-if scenario: ${whatIfTeam} wins ${whatIfPlace === 'first' ? 'the World Cup (1st place)' : whatIfPlace === 'second' ? 'the runner-up (2nd place)' : '3rd place'}

Calculate who gains points from this scenario and how the leaderboard would change.

Respond ONLY with a JSON object:
{
  "scenario": "one sentence describing the what-if",
  "pointsGained": [
    {"username": "name", "gained": 100, "newTotal": 263, "newRank": 1}
  ],
  "commentary": "2 sentence fun commentary about how this changes things",
  "biggestWinner": "username who benefits most",
  "biggestLoser": "username who falls furthest relatively"
}`;
  } else {
    return new Response(JSON.stringify({ error: 'Invalid type. Use bracket, commentary, or whatif' }), { status: 400 });
  }

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
        max_tokens: type === 'bracket' ? 800 : 400,
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
    const text = data.content?.[0]?.text || '';

    // For bracket and whatif, parse JSON; for commentary return raw text
    if (type === 'commentary') {
      return new Response(JSON.stringify({ commentary: text.trim() }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Could not parse response', raw: text }), { status: 500 });
    }
    const result = JSON.parse(match[0]);
    return new Response(JSON.stringify(result), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
