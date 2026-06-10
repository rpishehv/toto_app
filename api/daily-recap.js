// api/daily-recap.js — Daily AI recap posted to group chat
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey || !anthropicKey) {
    return new Response(JSON.stringify({ error: `Missing env vars: ${!supabaseUrl?'SUPABASE_URL ':''} ${!supabaseKey?'SUPABASE_KEY ':''} ${!anthropicKey?'ANTHROPIC_KEY':''}` }), { status: 500 });
  }

  const sbHeaders = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

  try {
    // Fetch match results
    const resultsRes = await fetch(`${supabaseUrl}/rest/v1/actual_results?select=matches&order=id.desc&limit=1`, { headers: sbHeaders });
    const resultsData = await resultsRes.json();
    const allMatches = resultsData?.[0]?.matches || [];
    const recentMatches = allMatches.filter(m => m.homeScore !== null);

    // Fetch leaderboard (all groups)
    const lbRes = await fetch(`${supabaseUrl}/rest/v1/leaderboard?select=username,points,group_code&order=points.desc&limit=50`, { headers: sbHeaders });
    const leaderboard = await lbRes.json() || [];

    // Default group top 3
    const defaultLb = leaderboard.filter(e => e.group_code === 'default');
    const top3 = defaultLb.slice(0,3).map((e,i) => `${['🥇','🥈','🥉'][i]} ${e.username} ${e.points}pts`).join(' · ') || 'No points yet';
    const recentStr = recentMatches.slice(-5).map(m => `${m.home} ${m.homeScore}–${m.awayScore} ${m.away}`).join(', ') || 'Tournament about to kick off!';

    // Generate recap with Claude
    const prompt = `You are writing a fun, punchy daily World Cup 2026 morning recap for a friends prediction league chat.

Recent results: ${recentStr}
Leaderboard top 3: ${top3}
Matches played so far: ${recentMatches.length}/72

Write a recap (3-4 sentences max). Be fun, specific, and a little trash-talky. Reference actual scores. Include one emoji. End with hype about what's coming today.`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 250, messages: [{ role: 'user', content: prompt }] })
    });

    const claudeData = await claudeRes.json();
    const recap = claudeData.content?.[0]?.text?.trim() || "⚽ Good morning! The World Cup is here — check the leaderboard and stay sharp!";

    // Get all group codes
    const groupCodes = [...new Set(leaderboard.map(r => r.group_code).filter(Boolean))];
    if (!groupCodes.length) groupCodes.push('default');

    const recapMsg = `🌅 Daily Recap\n${recap}`;
    const insertErrors = [];

    // Post to chat in all groups
    for (const gc of groupCodes) {
      const r = await fetch(`${supabaseUrl}/rest/v1/chat`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ username: '🤖 AI', message: recapMsg, group_code: gc })
      });
      if (!r.ok) {
        const err = await r.text();
        insertErrors.push(`${gc}: ${err}`);
      }
    }

    if (insertErrors.length) {
      return new Response(JSON.stringify({ ok: false, error: `Insert failed: ${insertErrors.join(' | ')}`, recap }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: true, recap, groups: groupCodes.length, groupCodes }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch(e) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack?.slice(0,200) }), { status: 500 });
  }
}
