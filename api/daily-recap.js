// api/daily-recap.js — Daily AI recap posted to group chat
// Called by Vercel cron (vercel.json) every morning at 8:00 UTC

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Allow both cron calls and manual POST from admin
  const isAuthorized = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
    || req.method === 'POST';
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey || !anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 });
  }

  try {
    // Fetch recent match results
    const resultsRes = await fetch(`${supabaseUrl}/rest/v1/actual_results?select=matches,knockout,actual_podium&order=id.desc&limit=1`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const [results] = await resultsRes.json();
    const allMatches = results?.matches || [];

    // Find yesterday's matches (last 24h)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    const recentMatches = allMatches.filter(m => m.homeScore !== null);

    // Fetch leaderboard (default group)
    const lbRes = await fetch(`${supabaseUrl}/rest/v1/leaderboard?select=username,points,champion&order=points.desc&group_code=eq.default`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const leaderboard = await lbRes.json();

    if (!recentMatches.length && !leaderboard.length) {
      return new Response(JSON.stringify({ skipped: 'No data yet' }), { status: 200 });
    }

    const top3 = leaderboard.slice(0,3).map((e,i)=>`${['🥇','🥈','🥉'][i]} ${e.username} ${e.points}pts`).join(' · ');
    const recentStr = recentMatches.slice(-6).map(m=>`${m.home} ${m.homeScore}–${m.awayScore} ${m.away}`).join(', ');

    // Generate recap with Claude
    const prompt = `You are writing a fun, punchy daily World Cup 2026 recap for a friends prediction group.

Recent results: ${recentStr || 'Tournament about to start!'}
Current top 3: ${top3 || 'No points yet'}
Total matches played: ${recentMatches.length}/72

Write a morning recap message (max 4 sentences). Be fun and specific. Reference actual results. Include an emoji. End with a hype line about today's games or the overall race.`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const claudeData = await claudeRes.json();
    const recap = claudeData.content?.[0]?.text?.trim() || "⚽ Good morning! Check the leaderboard and stay sharp!";

    // Fetch all group codes
    const gcRes = await fetch(`${supabaseUrl}/rest/v1/leaderboard?select=group_code`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const gcData = await gcRes.json();
    const groupCodes = [...new Set(gcData.map(r=>r.group_code).filter(Boolean))];

    // Post to chat in all groups
    const recapMsg = `🌅 Daily Recap\n${recap}`;
    for (const gc of groupCodes) {
      await fetch(`${supabaseUrl}/rest/v1/chat`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ username: '🤖 AI', message: recapMsg, group_code: gc })
      });
    }

    return new Response(JSON.stringify({ ok: true, recap, groups: groupCodes.length }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
