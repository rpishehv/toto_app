// api/analytics.js — Group analytics agent (edge runtime)

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Tournament ended July 20 — block all API calls after that
  const TOURNAMENT_END = new Date('2026-07-20T00:00:00-04:00').getTime();
  if (Date.now() > TOURNAMENT_END) {
    return new Response(JSON.stringify({ error: 'Tournament has ended', closed: true }), {
      status: 410, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'No API key' }), { status: 500 });

  let body;
  try { body = await req.json(); } catch(e) { return new Response(JSON.stringify({ error: 'Bad JSON' }), { status: 400 }); }

  const { players, actualResults } = body || {};
  if (!players?.length || !actualResults?.length) {
    return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400 });
  }

  const played = actualResults.filter(m => m.homeScore !== null);
  if (played.length === 0) {
    return new Response(JSON.stringify({ error: 'No results yet' }), { status: 400 });
  }

  // Compact stats per player
  const stats = players.map(p => {
    const preds = p.predictions || [];
    let e=0, g=0, o=0, w=0;
    for (const actual of played) {
      const pred = preds.find(x => x.id === actual.id);
      if (!pred || pred.homeScore == null) continue;
      const isExact = pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore;
      const isGD = (pred.homeScore - pred.awayScore) === (actual.homeScore - actual.awayScore);
      const predOut = pred.homeScore > pred.awayScore ? 'W' : pred.homeScore < pred.awayScore ? 'L' : 'D';
      const actOut  = actual.homeScore > actual.awayScore ? 'W' : actual.homeScore < actual.awayScore ? 'L' : 'D';
      if (isExact) e++;
      else if (isGD) g++;
      else if (predOut === actOut) o++;
      else w++;
    }
    return `${p.rank}.${p.username}:${p.points}pts E${e}G${g}O${o}W${w}`;
  }).join(', ');

  const prompt = `WC2026 prediction league stats after ${played.length} matches: ${stats}

Reply with ONLY this JSON (all values single-line strings, no newlines inside values):
{"headline":"summary","leader_analysis":"why leader is winning","most_skillful":"username","luckiest":"username","biggest_weakness":"weakness","player_profiles":[{"username":"name","style":"label","insight":"observation","tip":"advice"}],"prediction":"winner prediction","banter":"funny roast"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:800, messages:[{role:'user',content:prompt}] }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: `Claude: ${err.slice(0,200)}` }), { status: 500 });
    }

    const data = await response.json();
    const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    if (!text) return new Response(JSON.stringify({ error: 'No text from Claude' }), { status: 500 });

    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return new Response(JSON.stringify({ error: 'No JSON', raw: text.slice(0,200) }), { status: 500 });
    }

    const jsonStr = text.slice(start, end+1)
      .replace(/\n/g,' ').replace(/\r/g,' ')
      .replace(/[\x00-\x1F\x7F]/g,' ')
      .replace(/,\s*}/g,'}').replace(/,\s*]/g,']');

    let analysis;
    try { analysis = JSON.parse(jsonStr); }
    catch(e) { return new Response(JSON.stringify({ error: `Parse: ${e.message}`, raw: jsonStr.slice(0,300) }), { status: 500 }); }

    return new Response(JSON.stringify({ analysis, generatedAt: new Date().toISOString() }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
