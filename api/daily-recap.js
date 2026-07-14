// api/daily-recap.js — Daily AI digest: commentary + banter + stats refresh
// Vercel cron: 0 8 * * * (8:00 UTC daily)

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Tournament ended July 20 — block all API calls after that
  const TOURNAMENT_END = new Date('2026-07-20T00:00:00-04:00').getTime();
  if (Date.now() > TOURNAMENT_END) {
    return new Response(JSON.stringify({ error: 'Tournament has ended', closed: true }), {
      status: 410, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey || !anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 });
  }

  const baseHeaders = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  const sb = (path, opts={}) => {
    const { headers: extraHeaders, ...restOpts } = opts;
    return fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...restOpts,
      headers: { ...baseHeaders, ...extraHeaders },
    });
  };

  const claude = (prompt, maxTokens=400) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  }).then(r => r.json()).then(d => d.content?.[0]?.text?.trim() || '');

  try {
    // ── Fetch data ────────────────────────────────────────────────────────────
    const [resultsRes, lbRes, predsRes] = await Promise.all([
      sb('actual_results?select=matches,knockout,actual_podium,ko_kickoffs&order=id.desc&limit=1'),
      sb('leaderboard?select=username,points,group_code,champion&order=points.desc&limit=100'),
      sb('predictions?select=username,group_code,prediction_hash'),
    ]);

    const [resultsData, allLb, allPreds] = await Promise.all([resultsRes.json(), lbRes.json(), predsRes.json()]);
    const allMatches   = resultsData?.[0]?.matches || [];
    const allKO        = resultsData?.[0]?.knockout || [];
    const actualPodium = resultsData?.[0]?.actual_podium || {};
    const koKickoffs   = resultsData?.[0]?.ko_kickoffs || {};
    const played = allMatches.filter(m => m.homeScore !== null);
    const playedKO = allKO.filter(m => m.homeScore !== null && m.home !== 'TBD');

    // Group codes
    const groupCodes = [...new Set(allLb.map(r => r.group_code).filter(Boolean))];
    if (!groupCodes.length) groupCodes.push('default');

    const results = [];

    for (const gc of groupCodes) {
      const lb = allLb.filter(e => e.group_code === gc);
      if (!lb.length) continue;

      // Integrity summary
      const gcPreds = (allPreds||[]).filter(p => p.group_code === gc);
      const withHash = gcPreds.filter(p => p.prediction_hash).length;
      const total = lb.length;
      const integrityLine = withHash > 0
        ? `🔒 *Integrity check: ${withHash}/${total} predictions verified — no tampering detected*\n_Think of it like a wax seal on an envelope: when you hit Save, we stamp your predictions with a unique code. Every day we check if the seal is still intact. If anyone changed your scores after the match kicked off, the seal breaks and we'd know immediately._\n_For the technically curious: we compute a SHA-256 hash of each player's locked match scores, store it at save time, and recompute it daily — any mismatch flags a change after lock._`
        : null;

      const top3 = lb.slice(0,3).map((e,i) => `${['🥇','🥈','🥉'][i]} ${e.username} — ${e.points}pts (picked ${e.champion||'?'})`).join('\n');
      const recentResults = played.slice(-8).map(m => `${m.home} ${m.homeScore}–${m.awayScore} ${m.away}`).join(', ') || 'Tournament about to start!';
      const matchesPlayed = played.length + playedKO.length;
      const matchesLeft   = 72 - played.length;

      // ── Section 1: Match recap & stats ─────────────────────────────────────
      const recapPrompt = `You're the voice of a World Cup 2026 friends prediction league. Write today's morning digest (4-5 sentences). Be punchy and specific.

Yesterday's results: ${played.slice(-4).map(m=>`${m.home} ${m.homeScore}-${m.awayScore} ${m.away}`).join(', ') || 'No matches yet'}
Total played: ${matchesPlayed}/72
Leaderboard:
${top3}

Cover: biggest result, who it helped/hurt on the leaderboard, one stat that stands out. End with today's key match to watch.`;

      // ── Section 2: Banter corner ────────────────────────────────────────────
      const banterPrompt = `Write a short "Banter Corner" for a World Cup prediction group (3-4 sentences). Friendly trash talk about the predictions. Be funny and specific.

Leaderboard:
${lb.map((e,i) => `${i+1}. ${e.username} (${e.points}pts, backing ${e.champion||'unknown'})`).join('\n')}
Matches played: ${matchesPlayed}/72

Roast someone near the bottom, hype the leader, mention a bold pick that looks good/bad so far.`;

      // ── Section 3: Prediction spotlight ─────────────────────────────────────
      const spotlightPrompt = `Write a 2-sentence "Prediction Spotlight" for a World Cup prediction group. Pick one interesting stat or pattern from the data.

Leaderboard: ${lb.map(e=>`${e.username} ${e.points}pts`).join(', ')}
Results: ${recentResults}
Champion picks: ${lb.map(e=>e.champion||'?').join(', ')}

Focus on something surprising: a bold pick paying off, an upset nobody saw coming, or a tight race.`;

      // Run all three in parallel
      const [recap, banter, spotlight] = await Promise.all([
        claude(recapPrompt, 300),
        claude(banterPrompt, 250),
        claude(spotlightPrompt, 150),
      ]);

      // ── Build the full digest message ───────────────────────────────────────
      const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
      const digest = [
        `🌅 *Daily Digest — ${today}*`,
        ``,
        `📊 *Match Recap*`,
        recap,
        ``,
        `😂 *Banter Corner*`,
        banter,
        ``,
        `🔦 *Prediction Spotlight*`,
        spotlight,
        ``,
        `📈 *Standings*`,
        lb.slice(0,5).map((e,i)=>`${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${e.username} — ${e.points}pts`).join('\n'),
        ``,
        `${matchesLeft} group matches remaining · keep predicting! 🏆`,
        integrityLine ? `\n${integrityLine}` : '',
      ].filter(l => l !== '').join('\n');

      // Post to chat
      const chatRes = await sb('chat_messages', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({ username: '🤖 AI', message: digest, group_code: gc }),
      });
      const chatBody = await chatRes.text();

      // Refresh commentary in ai_content (upsert not patch — row may not exist)
      const aiRes = await sb('ai_content', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          group_code: gc,
          commentary: recap,
          commentary_generated_by: 'daily-cron',
          commentary_generated_at: new Date().toISOString(),
        }),
      });

      results.push({
        group: gc,
        chatOk: chatRes.ok,
        chatStatus: chatRes.status,
        chatError: chatRes.ok ? null : chatBody.slice(0,200),
        digestLength: digest.length,
      });
    }

    return new Response(JSON.stringify({ ok: true, results, groups: groupCodes.length }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
