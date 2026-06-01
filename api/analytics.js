// api/analytics.js — Group analytics agent
// Analyses all predictions vs results and generates group insights

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '2mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { players, actualResults } = req.body || {};

  if (!players?.length || !actualResults?.length) {
    return res.status(400).json({ error: 'Missing players or results data' });
  }

  const played = actualResults.filter(m => m.homeScore !== null);
  if (played.length === 0) {
    return res.status(400).json({ error: 'No results yet — play some matches first!' });
  }

  // Pre-compute stats for each player
  const playerStats = players.map(p => {
    const preds = p.predictions || [];
    let exact=0, gd=0, outcome=0, wrong=0, totalPred=0, totalActual=0, count=0;
    const missedDraws = [];
    const nailedExact = [];

    for (const actual of played) {
      const pred = preds.find(x => x.id === actual.id);
      if (!pred || pred.homeScore == null) continue;
      count++;
      totalPred += pred.homeScore + pred.awayScore;
      totalActual += actual.homeScore + actual.awayScore;

      const isExact = pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore;
      const isGD = (pred.homeScore - pred.awayScore) === (actual.homeScore - actual.awayScore);
      const predOut = pred.homeScore > pred.awayScore ? 'W' : pred.homeScore < pred.awayScore ? 'L' : 'D';
      const actOut = actual.homeScore > actual.awayScore ? 'W' : actual.homeScore < actual.awayScore ? 'L' : 'D';

      if (isExact) { exact++; nailedExact.push(`${actual.home} vs ${actual.away} (${actual.homeScore}-${actual.awayScore})`); }
      else if (isGD) gd++;
      else if (predOut === actOut) outcome++;
      else { wrong++; if (actOut === 'D') missedDraws.push(`${actual.home} vs ${actual.away}`); }
    }

    return {
      username: p.username,
      rank: p.rank,
      points: p.points,
      exact, gd, outcome, wrong,
      avgPredGoals: count > 0 ? (totalPred / count).toFixed(1) : '0',
      avgActualGoals: count > 0 ? (totalActual / count).toFixed(1) : '0',
      accuracy: count > 0 ? Math.round((exact + gd + outcome) / count * 100) : 0,
      nailedExact: nailedExact.slice(0, 3),
      missedDraws: missedDraws.slice(0, 3),
    };
  });

  const statsText = playerStats.map(p => `${p.rank}. ${p.username}: ${p.points}pts, Exact:${p.exact}, GD:${p.gd}, Outcome:${p.outcome}, Wrong:${p.wrong}, AvgPredGoals:${p.avgPredGoals}, Accuracy:${p.accuracy}%, BestCalls:[${p.nailedExact.join(',')||'none'}], MissedDraws:[${p.missedDraws.join(',')||'none'}]`).join(' | ');

  const prompt = `Analyse this World Cup 2026 prediction league after ${played.length} matches. Data: ${statsText}

Respond with ONLY this JSON (no markdown, no explanation, keep all string values SHORT and on ONE line):
{"headline":"<60 char summary>","leader_analysis":"<who leads and why, 1 sentence>","most_skillful":"<username>","luckiest":"<username>","biggest_weakness":"<1 sentence>","player_profiles":[{"username":"<name>","style":"<3 words>","insight":"<1 sentence>","tip":"<1 sentence>"}],"prediction":"<1 sentence>","banter":"<1 funny sentence>"}\`;

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
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `API error: ${err.slice(0, 200)}` });
    }

    const data = await response.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

    if (!text) {
      return res.status(500).json({ error: 'No text in response' });
    }

    // Clean and extract JSON
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'No JSON found', raw: text.slice(0, 300) });
    }

    let analysis;
    try {
      // Aggressively clean the JSON string
      let jsonStr = cleaned.slice(start, end + 1);
      // Replace actual newlines/tabs inside strings with spaces
      jsonStr = jsonStr.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\t/g, ' ');
      // Remove control characters
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');
      // Fix trailing commas
      jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      // Collapse multiple spaces
      jsonStr = jsonStr.replace(/  +/g, ' ');
      analysis = JSON.parse(jsonStr);
    } catch(e) {
      return res.status(500).json({ error: `Parse failed: ${e.message}`, raw: cleaned.slice(start, start + 400) });
    }

    return res.status(200).json({ analysis, generatedAt: new Date().toISOString() });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
