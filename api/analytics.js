// api/analytics.js — Group analytics agent (CommonJS for Node.js runtime)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { players, actualResults } = req.body || {};

  if (!players?.length || !actualResults?.length) {
    return res.status(400).json({ error: 'Missing players or results data' });
  }

  const played = actualResults.filter(m => m.homeScore !== null);
  if (played.length === 0) {
    return res.status(400).json({ error: 'No match results yet — admin needs to save scores first!' });
  }

  // Pre-compute stats per player
  const playerStats = players.map(p => {
    const preds = p.predictions || [];
    let exact=0, gd=0, outcome=0, wrong=0, totalPred=0, totalActual=0, count=0;
    const missedDraws = [], nailedExact = [];

    for (const actual of played) {
      const pred = preds.find(x => x.id === actual.id);
      if (!pred || pred.homeScore == null) continue;
      count++;
      totalPred += pred.homeScore + pred.awayScore;
      totalActual += actual.homeScore + actual.awayScore;
      const isExact = pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore;
      const isGD = (pred.homeScore - pred.awayScore) === (actual.homeScore - actual.awayScore);
      const predOut = pred.homeScore > pred.awayScore ? 'W' : pred.homeScore < pred.awayScore ? 'L' : 'D';
      const actOut  = actual.homeScore > actual.awayScore ? 'W' : actual.homeScore < actual.awayScore ? 'L' : 'D';
      if (isExact) { exact++; nailedExact.push(`${actual.home}-${actual.away}(${actual.homeScore}-${actual.awayScore})`); }
      else if (isGD) gd++;
      else if (predOut === actOut) outcome++;
      else { wrong++; if (actOut === 'D') missedDraws.push(`${actual.home}-${actual.away}`); }
    }

    return {
      username: p.username, rank: p.rank, points: p.points,
      exact, gd, outcome, wrong, count,
      avgPred: count > 0 ? (totalPred/count).toFixed(1) : '0',
      accuracy: count > 0 ? Math.round((exact+gd+outcome)/count*100) : 0,
      nailedExact: nailedExact.slice(0,2).join(';') || 'none',
      missedDraws: missedDraws.slice(0,2).join(';') || 'none',
    };
  });

  const statsLine = playerStats.map(p =>
    `${p.rank}.${p.username}:${p.points}pts,E${p.exact}G${p.gd}O${p.outcome}W${p.wrong},acc${p.accuracy}%,avgGoals${p.avgPred},best:${p.nailedExact},missedDraws:${p.missedDraws}`
  ).join(' | ');

  const prompt = `Analyse this WC2026 prediction league (${played.length} matches played): ${statsLine}

Return ONLY this JSON object with short single-line string values (no newlines in values):
{"headline":"short punchy summary","leader_analysis":"why they lead","most_skillful":"username","luckiest":"username","biggest_weakness":"main weakness","player_profiles":[{"username":"name","style":"3 words","insight":"1 sentence","tip":"1 sentence"}],"prediction":"who will win and why","banter":"funny 1-liner roast"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:1000, messages:[{role:'user',content:prompt}] }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Claude error: ${err.slice(0,200)}` });
    }

    const data = await response.json();
    const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    if (!text) return res.status(500).json({ error: 'No text from Claude' });

    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start === -1 || end === -1) return res.status(500).json({ error: 'No JSON found', raw: text.slice(0,300) });

    const jsonStr = text.slice(start, end+1)
      .replace(/\n/g,' ').replace(/\r/g,' ').replace(/\t/g,' ')
      .replace(/[\x00-\x1F\x7F]/g,' ')
      .replace(/,\s*}/g,'}').replace(/,\s*]/g,']');

    let analysis;
    try { analysis = JSON.parse(jsonStr); }
    catch(e) { return res.status(500).json({ error: `Parse failed: ${e.message}`, raw: jsonStr.slice(0,400) }); }

    return res.status(200).json({ analysis, generatedAt: new Date().toISOString() });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
