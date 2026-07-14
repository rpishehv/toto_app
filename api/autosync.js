// api/autosync.js — Auto-sync match results from API-Football to Supabase
// Called by GitHub Actions cron every 2 hours between noon-midnight PT

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const SYNC_SECRET  = process.env.SYNC_SECRET; // set in Vercel + GitHub secrets

const LEAGUE = 1, SEASON = 2026;
const FINISHED = ['FT','AET','PEN'];

const ALIASES = {
  'Czech Republic':'Czechia','Korea Republic':'South Korea',
  'Bosnia and Herzegovina':'Bosnia-Herzegovina',
  'Bosnia & Herzegovina':'Bosnia-Herzegovina',
  "Côte d'Ivoire":'Ivory Coast',"Cote d'Ivoire":'Ivory Coast',
  'IR Iran':'Iran','Congo DR':'DR Congo','Türkiye':'Turkey',
  "Curaçao":'Curacao',
  'Cape Verde Islands':'Cape Verde','Cabo Verde':'Cape Verde',
};
const norm = n => ALIASES[n] || n;

async function sb(path, method='GET', body=null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method==='GET' ? 'return=representation' : 'return=representation',
    },
    body: body ? JSON.stringify(body) : null,
  });
  return res.json();
}

export default async function handler(req) {
  // Tournament ended July 20 — block all API calls after that
  const TOURNAMENT_END = new Date('2026-07-20T00:00:00-04:00').getTime();
  if (Date.now() > TOURNAMENT_END) {
    return new Response(JSON.stringify({ error: 'Tournament has ended', closed: true }), {
      status: 410, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Auth check
  const secret = req.headers.get('x-sync-secret') || new URL(req.url).searchParams.get('secret');
  if (!secret || secret !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    // 1. Fetch today's fixtures from API-Football
    const today = new Date().toISOString().slice(0, 10);
    const afRes = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}&league=${LEAGUE}&season=${SEASON}`,
      { headers: { 'x-apisports-key': RAPIDAPI_KEY } }
    );
    const afData = await afRes.json();
    const fixtures = afData.response || [];
    const finished = fixtures.filter(f => FINISHED.includes(f.fixture?.status?.short));

    if (!finished.length) {
      return new Response(JSON.stringify({ ok: true, msg: 'No finished matches today', synced: 0 }), { status: 200 });
    }

    // 2. Load current actual_results from Supabase
    const [arRow] = await sb('actual_results?id=eq.1&select=*');
    const currentMatches = arRow?.matches || [];
    const currentKO      = arRow?.knockout || [];

    // 3. Apply finished match scores
    let synced = 0;
    const newMatches = currentMatches.map(m => {
      const fix = finished.find(f => {
        const h = norm(f.teams?.home?.name || '');
        const a = norm(f.teams?.away?.name || '');
        return (m.home === h && m.away === a) || (m.home === a && m.away === h);
      });
      if (!fix) return m;
      if (m.homeScore !== null) return m; // already scored — don't overwrite
      const flipped = norm(fix.teams?.home?.name) !== m.home;
      synced++;
      return {
        ...m,
        homeScore: flipped ? fix.goals?.away : fix.goals?.home,
        awayScore: flipped ? fix.goals?.home : fix.goals?.away,
      };
    });

    if (!synced) {
      return new Response(JSON.stringify({ ok: true, msg: 'All matches already scored', synced: 0 }), { status: 200 });
    }

    // 4. Save back to Supabase
    await sb('actual_results?id=eq.1', 'PATCH', {
      matches: newMatches,
      updated_at: new Date().toISOString(),
    });

    // 5. Recalculate leaderboard for all groups
    // Load all predictions
    const preds = await sb('predictions?group_code=eq.default&select=username,matches,knockout,podium');
    const lbEntries = preds.map(p => {
      let pts = 0;
      (p.matches || []).forEach(pred => {
        const actual = newMatches.find(m => m.id === pred.id);
        if (!actual || actual.homeScore === null) return;
        if (pred.homeScore === null || pred.awayScore === null) return;
        if (pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore) pts += 6;
        else if ((pred.homeScore - pred.awayScore) === (actual.homeScore - actual.awayScore)) pts += 4;
        else {
          const po = pred.homeScore > pred.awayScore ? 'W' : pred.homeScore < pred.awayScore ? 'L' : 'D';
          const ao = actual.homeScore > actual.awayScore ? 'W' : actual.homeScore < actual.awayScore ? 'L' : 'D';
          if (po === ao) pts += 2;
        }
      });
      return { username: p.username, group_code: 'default', total_points: pts, champion: p.podium?.first || null };
    });

    // Upsert leaderboard
    for (const entry of lbEntries) {
      await sb('leaderboard?on_conflict=username,group_code', 'POST', entry);
    }

    return new Response(JSON.stringify({
      ok: true,
      msg: `Synced ${synced} match${synced!==1?'es':''}, updated ${lbEntries.length} leaderboard entries`,
      synced,
      date: today,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
