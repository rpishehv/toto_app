// api/analytics.js — Group analytics agent
// Analyses all predictions vs results and generates group insights

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  let body;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const { players, actualResults } = body;
  // players: [{username, predictions:[{id,homeScore,awayScore}], points, rank}]
  // actualResults: [{id,home,away,homeScore,awayScore}]

  if (!players?.length || !actualResults?.length) {
    return res.status(400).json({ error: 'Missing players or results data' });
  }

  const played = actualResults.filter(m => m.homeScore !== null);
  if (played.length === 0) {
    return res.status(400).json({ error: 'No results yet — play some matches first!' });
  }

  // Pre-compute stats for each player to send to Claude
  const playerStats = players.map(p => {
    const preds = p.predictions || [];
    let exact=0, gd=0, outcome=0, wrong=0, totalGoalsPredicted=0, totalGoalsActual=0, predCount=0;
    const missedDraws = [];
    const nailedExact = [];

    for(const actual of played) {
      const pred = preds.find(x => x.id === actual.id);
      if(!pred || pred.homeScore===null) continue;
      predCount++;
      totalGoalsPredicted += pred.homeScore + pred.awayScore;
      totalGoalsActual += actual.homeScore + actual.awayScore;

      const isExact = pred.homeScore===actual.homeScore && pred.awayScore===actual.awayScore;
      const isGD = (pred.homeScore-pred.awayScore)===(actual.homeScore-actual.awayScore);
      const predOut = pred.homeScore>pred.awayScore?'W':pred.homeScore<pred.awayScore?'L':'D';
      const actOut = actual.homeScore>actual.awayScore?'W':actual.homeScore<actual.awayScore?'L':'D';
      const isOutcome = predOut===actOut;

      if(isExact){ exact++; nailedExact.push(`${actual.home} vs ${actual.away} (${actual.homeScore}-${actual.awayScore})`); }
      else if(isGD) gd++;
      else if(isOutcome) outcome++;
      else {
        wrong++;
        if(actOut==='D') missedDraws.push(`${actual.home} vs ${actual.away}`);
      }
    }

    const avgPredGoals = predCount>0?(totalGoalsPredicted/predCount).toFixed(1):0;
    const avgActualGoals = predCount>0?(totalGoalsActual/predCount).toFixed(1):0;

    return {
      username: p.username,
      rank: p.rank,
      points: p.points,
      exact, gd, outcome, wrong, predCount,
      avgPredGoals, avgActualGoals,
      missedDraws: missedDraws.slice(0,3),
      nailedExact: nailedExact.slice(0,3),
      accuracy: predCount>0?Math.round((exact+gd+outcome)/predCount*100):0,
    };
  });

  const prompt = `You are a sharp, witty football analytics pundit analysing a World Cup 2026 prediction league among friends.

Here is the group data after ${played.length} matches played:

LEADERBOARD & STATS:
${playerStats.map(p => `
${p.rank}. ${p.username} — ${p.points}pts
   Exact: ${p.exact} | Correct GD: ${p.gd} | Correct outcome: ${p.outcome} | Wrong: ${p.wrong}
   Avg goals predicted: ${p.avgPredGoals} vs actual avg: ${p.avgActualGoals}
   Accuracy: ${p.accuracy}%
   ${p.nailedExact.length>0?`Best calls: ${p.nailedExact.join(', ')}`:''}
   ${p.missedDraws.length>0?`Missed draws: ${p.missedDraws.join(', ')}`:''}
`).join('')}

Write a group analytics report that is:
- Specific and data-driven — reference actual numbers and match names
- Entertaining and pundit-like — use football banter, be witty but fair
- Insightful — identify real patterns (who over-predicts goals, who's best at draws, who's been lucky vs skillful)
- Comparative — compare players against each other, not just generic observations

Structure your response as JSON with these exact fields:
{
  "headline": "punchy one-liner summarising the group situation, max 80 chars",
  "leader_analysis": "2-3 sentences on the current leader — why they're winning, is it skill or luck?",
  "most_skillful": "username of the most technically accurate predictor and why",
  "luckiest": "username who's gotten points they probably shouldn't have and why",
  "biggest_weakness": "the one pattern that's costing the group most points overall",
  "player_profiles": [
    {
      "username": "...",
      "style": "one word style label e.g. The Optimist, The Conservative, The Gambler, The Analyst",
      "insight": "1-2 sentences specific to this player's prediction pattern",
      "tip": "one concrete tip for remaining matches"
    }
  ],
  "prediction": "who is most likely to win the whole competition based on current trajectory and why",
  "banter": "one funny observation about the group — a gentle roast of someone's worst prediction"
}

Return ONLY valid JSON, no other text.`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `API error: ${err.slice(0,200)}` });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'No JSON in response', raw: text.slice(0,300) });
    }

    const analysis = JSON.parse(text.slice(start, end + 1));
    return res.status(200).json({ analysis, generatedAt: new Date().toISOString() });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
