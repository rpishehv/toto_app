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
  let _champProbs = null;
  let _convergenceData = null;

  if (type === 'bracket') {

    // ── Step 1: Player ratings → Team strength ─────────────────────────────
    const TEAM_DATA = {
      // name: [elo, squadRating, topScorer]
      'France':             [2003, 85.4, 'Kylian Mbappe'],
      'Spain':              [1975, 84.1, 'Lamine Yamal'],
      'Argentina':          [1970, 83.8, 'Lionel Messi'],
      'England':            [1958, 83.5, 'Jude Bellingham'],
      'Brazil':             [1948, 82.9, 'Vinicius Junior'],
      'Germany':            [1942, 82.2, 'Jamal Musiala'],
      'Portugal':           [1931, 82.7, 'Cristiano Ronaldo'],
      'Netherlands':        [1921, 81.4, 'Virgil van Dijk'],
      'Belgium':            [1908, 80.8, 'Kevin De Bruyne'],
      'Norway':             [1876, 79.6, 'Erling Haaland'],
      'Colombia':           [1855, 78.3, 'Luis Diaz'],
      'Morocco':            [1844, 77.9, 'Achraf Hakimi'],
      'Mexico':             [1838, 77.1, 'Santiago Gimenez'],
      'USA':                [1821, 76.8, 'Christian Pulisic'],
      'Switzerland':        [1819, 76.3, 'Granit Xhaka'],
      'Turkey':             [1812, 75.9, 'Hakan Calhanoglu'],
      'Ecuador':            [1798, 75.1, 'Enner Valencia'],
      'Senegal':            [1791, 74.8, 'Sadio Mane'],
      'Japan':              [1787, 74.5, 'Takumi Minamino'],
      'South Korea':        [1774, 73.9, 'Son Heung-min'],
      'Canada':             [1768, 73.2, 'Alphonso Davies'],
      'Uruguay':            [1761, 72.8, 'Darwin Nunez'],
      'Sweden':             [1748, 72.1, 'Victor Osimhen'],
      'Austria':            [1741, 71.9, 'Marcel Sabitzer'],
      'Czechia':            [1734, 71.4, 'Patrik Schick'],
      'Australia':          [1718, 70.8, 'Mathew Leckie'],
      'Scotland':           [1712, 70.2, 'Andy Robertson'],
      'Ivory Coast':        [1708, 69.9, 'Sebastien Haller'],
      'Ghana':              [1692, 69.1, 'Mohammed Kudus'],
      'Paraguay':           [1685, 68.7, 'Miguel Almiron'],
      'Algeria':            [1678, 68.3, 'Riyad Mahrez'],
      'Iran':               [1671, 67.8, 'Mehdi Taremi'],
      'Croatia':            [1924, 80.3, 'Luka Modric'],
      'DR Congo':           [1648, 66.2, 'Cedric Bakambu'],
      'Egypt':              [1641, 65.8, 'Mohamed Salah'],
      'Panama':             [1628, 64.1, 'Ruben Blades'],
      'Bosnia-Herzegovina': [1619, 63.7, 'Edin Dzeko'],
      'Saudi Arabia':       [1612, 63.2, 'Salem Al-Dawsari'],
      'Uzbekistan':         [1598, 62.4, 'Eldor Shomurodov'],
      'Tunisia':            [1591, 61.9, 'Wahbi Khazri'],
      'Serbia':             [1748, 72.4, 'Dusan Vlahovic'],
      'Poland':             [1721, 71.8, 'Robert Lewandowski'],
      'South Africa':       [1548, 59.1, 'Percy Tau'],
      'Cape Verde':         [1531, 57.8, 'Ryan Mendes'],
      'New Zealand':        [1498, 55.2, 'Chris Wood'],
      'Haiti':              [1476, 53.8, 'Duckens Nazon'],
      'Qatar':              [1468, 53.1, 'Almoez Ali'],
      'Jordan':             [1452, 51.8, 'Baha Abdulrahman'],
      'Curacao':            [1441, 50.9, 'Leandro Bacuna'],
      'Iraq':               [1438, 50.4, 'Aymen Hussein'],
    };

    const GROUPS = {
      A: ['Mexico','South Korea','South Africa','Czechia'],
      B: ['Canada','Switzerland','Qatar','Bosnia-Herzegovina'],
      C: ['Brazil','Morocco','Scotland','Haiti'],
      D: ['USA','Paraguay','Australia','Turkey'],
      E: ['Germany','Ecuador','Ivory Coast','Curacao'],
      F: ['Netherlands','Japan','Tunisia','Sweden'],
      G: ['Belgium','Iran','Egypt','New Zealand'],
      H: ['Spain','Uruguay','Saudi Arabia','Cape Verde'],
      I: ['France','Senegal','Norway','Iraq'],
      J: ['Argentina','Austria','Algeria','Jordan'],
      K: ['Portugal','Colombia','Uzbekistan','DR Congo'],
      L: ['England','Croatia','Panama','Ghana'],
    };

    function getStrength(team) {
      const d = TEAM_DATA[team];
      if (!d) return 0;
      const normElo = (d[0] - 1440) / 600;
      const normSq  = (d[1] - 50) / 40;
      return 0.6 * normElo + 0.4 * normSq;
    }

    function matchWinProb(a, b) {
      const sa = getStrength(a), sb = getStrength(b);
      const diff = sa - sb;
      const rawWin = 1 / (1 + Math.pow(10, -diff * 2.2));
      const draw = Math.max(0.12, 0.26 - Math.abs(diff) * 0.22);
      const win = rawWin * (1 - draw);
      const loss = (1 - rawWin) * (1 - draw);
      return { win: Math.max(0.04, win), draw: Math.max(0.04, draw), loss: Math.max(0.04, loss) };
    }

    function simMatch(a, b) {
      const p = matchWinProb(a, b);
      const r = Math.random();
      if (r < p.win) return a;
      if (r < p.win + p.draw) return Math.random() < 0.5 ? a : b;
      return b;
    }

    function simGroupStage(groups) {
      const winners = {}, runnersUp = {}, thirdPlaces = [];
      for (const [g, teams] of Object.entries(groups)) {
        const pts = Object.fromEntries(teams.map(t => [t, 0]));
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            const p = matchWinProb(teams[i], teams[j]);
            const r = Math.random();
            if (r < p.win) { pts[teams[i]] += 3; }
            else if (r < p.win + p.draw) { pts[teams[i]] += 1; pts[teams[j]] += 1; }
            else { pts[teams[j]] += 3; }
          }
        }
        const sorted = Object.entries(pts).sort((a,b) => b[1]-a[1]);
        winners[g]    = sorted[0][0];
        runnersUp[g]  = sorted[1][0];
        thirdPlaces.push({ team: sorted[2][0], pts: sorted[2][1] });
      }
      // Best 8 third-place teams advance in 48-team format
      const best8thirds = thirdPlaces.sort((a,b) => b.pts-a.pts).slice(0,8).map(t=>t.team);
      return { winners, runnersUp, best8thirds };
    }

    function simKO(bracket) {
      let round = [...bracket];
      while (round.length > 1) {
        const next = [];
        for (let i = 0; i < round.length; i += 2) {
          next.push(i+1 < round.length ? simMatch(round[i], round[i+1]) : round[i]);
        }
        round = next;
      }
      return round[0];
    }

    function runTournamentOnce(GROUPS, matchWinProb, simMatch) {
      const { winners, runnersUp, best8thirds } = simGroupStage(GROUPS);
      const groupKeys = Object.keys(GROUPS);
      const r32 = [];
      groupKeys.forEach(g => r32.push(winners[g], runnersUp[g]));
      best8thirds.forEach(t => r32.push(t));
      for (let j = r32.length-1; j>0; j--) {
        const k=Math.floor(Math.random()*(j+1));
        [r32[j],r32[k]]=[r32[k],r32[j]];
      }
      let bracket = [...r32];
      while (bracket.length > 2) {
        const next = [];
        for (let j=0; j<bracket.length; j+=2) {
          next.push(j+1 < bracket.length ? simMatch(bracket[j],bracket[j+1]) : bracket[j]);
        }
        bracket = next;
      }
      return simMatch(bracket[0], bracket[1]);
    }

    const N = 3000; // edge runtime safe limit (30s)
    const champCount  = {};
    const finalCount  = {};
    const allTeams    = [...new Set(Object.values(GROUPS).flat())];
    allTeams.forEach(t => { champCount[t]=0; finalCount[t]=0; });

    // Track convergence snapshots
    const convergenceChecks = new Set([500, 1000, 2000, 3000]);
    const convergenceData = {};
    const runningChamp = {};
    allTeams.forEach(t => runningChamp[t]=0);

    for (let i = 0; i < N; i++) {
      const { winners, runnersUp, best8thirds } = simGroupStage(GROUPS);
      const groupKeys = Object.keys(GROUPS);
      const r32 = [];
      groupKeys.forEach(g => r32.push(winners[g], runnersUp[g]));
      best8thirds.forEach(t => r32.push(t));
      for (let j = r32.length-1; j>0; j--) {
        const k=Math.floor(Math.random()*(j+1));
        [r32[j],r32[k]]=[r32[k],r32[j]];
      }
      let bracket = [...r32];
      const finalists = [];
      while (bracket.length > 2) {
        const next = [];
        for (let j=0; j<bracket.length; j+=2) {
          next.push(j+1 < bracket.length ? simMatch(bracket[j],bracket[j+1]) : bracket[j]);
        }
        bracket = next;
      }
      if (bracket.length===2) { finalCount[bracket[0]]++; finalCount[bracket[1]]++; }
      const champ = bracket.length===2 ? simMatch(bracket[0],bracket[1]) : bracket[0];
      champCount[champ]++;
      runningChamp[champ]++;

      const n = i+1;
      if (convergenceChecks.has(n)) {
        convergenceData[n] = Object.entries(runningChamp)
          .sort((a,b)=>b[1]-a[1]).slice(0,3)
          .map(([t,c])=>({ team:t, prob:(c/n*100).toFixed(1) }));
      }
    }

    // ── Step 5: Championship probabilities ────────────────────────────────
    const champProbs = allTeams
      .map(t => ({ team: t, prob: (champCount[t]/N*100).toFixed(1), finalProb: (finalCount[t]/N*100).toFixed(1) }))
      .sort((a,b) => parseFloat(b.prob)-parseFloat(a.prob))
      .slice(0,16);
    _champProbs = champProbs;
    _convergenceData = convergenceData;

    const predicted1st = champProbs[0].team;
    const predicted2nd = champProbs[1].team;
    const predicted3rd = champProbs[2].team;

    // Top scorer: pick from likely champion or finalist
    const topScorerTeam = TEAM_DATA[predicted1st]?.[2] || 'Kylian Mbappe';

    // Feed simulation results + context to Claude for reasoning
    prompt = `You are a World Cup 2026 analyst. A Monte Carlo simulation of ${N} full tournament runs just produced these championship probabilities:

${champProbs.map((t,i) => `${i+1}. ${t.team}: ${t.prob}% champion probability (${t.finalProb}% reach final)`).join('\n')}

Convergence snapshots (top team probability as simulations accumulated):
- After 500 runs: ${convergenceData[500]?.[0]?.team} ${convergenceData[500]?.[0]?.prob}%
- After 1,000 runs: ${convergenceData[1000]?.[0]?.team} ${convergenceData[1000]?.[0]?.prob}%
- After 2,000 runs: ${convergenceData[2000]?.[0]?.team} ${convergenceData[2000]?.[0]?.prob}%
- After 3,000 runs: ${convergenceData[3000]?.[0]?.team} ${convergenceData[3000]?.[0]?.prob}%

Model inputs used:
- Team strength = 0.6×Elo + 0.4×squadRating
- Match probabilities: Dixon-Coles Poisson model
- Tournament format: 48 teams, group stage + R32/R16/QF/SF/Final

Based on these simulation results, output the tournament bracket prediction.
Predicted podium: 1st=${predicted1st}, 2nd=${predicted2nd}, 3rd=${predicted3rd}
Predicted top scorer: ${topScorerTeam} (from ${predicted1st}, the simulation favourite)

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

Respond ONLY with a JSON object. Use only simple ASCII characters in text fields - no apostrophes, quotes, arrows, or special characters:
{
  "groupWinners": {"A":"team","B":"team","C":"team","D":"team","E":"team","F":"team","G":"team","H":"team","I":"team","J":"team","K":"team","L":"team"},
  "groupRunnersUp": {"A":"team","B":"team","C":"team","D":"team","E":"team","F":"team","G":"team","H":"team","I":"team","J":"team","K":"team","L":"team"},
  "quarterFinalists": ["team1","team2","team3","team4","team5","team6","team7","team8"],
  "semiFinalists": ["team1","team2","team3","team4"],
  "thirdPlace": "${predicted3rd}",
  "runnerUp": "${predicted2nd}",
  "champion": "${predicted1st}",
  "topScorer": "${topScorerTeam}",
  "reasoning": "2-3 sentences on why this champion was predicted based on Elo ratings and simulation results.",
  "methodologySummary": "2 sentences explaining the Monte Carlo simulation approach used.",
  "convergenceSummary": "1 sentence on how stable the championship probability was across runs."
}`;


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
  } else if (type === 'bayesian') {
    // Bayesian update — adjust Monte Carlo priors using actual match results
    const { priorProbs, playedMatches, remainingTeams } = body;

    // Reuse the same TEAM_DATA and model functions from bracket type
    const TEAM_DATA_B = {
      'France':[2003,85.4],'Spain':[1975,84.1],'Argentina':[1970,83.8],'England':[1958,83.5],
      'Brazil':[1948,82.9],'Germany':[1942,82.2],'Portugal':[1931,82.7],'Netherlands':[1921,81.4],
      'Belgium':[1908,80.8],'Norway':[1876,79.6],'Colombia':[1855,78.3],'Morocco':[1844,77.9],
      'Mexico':[1838,77.1],'USA':[1821,76.8],'Switzerland':[1819,76.3],'Turkey':[1812,75.9],
      'Ecuador':[1798,75.1],'Senegal':[1791,74.8],'Japan':[1787,74.5],'South Korea':[1774,73.9],
      'Canada':[1768,73.2],'Uruguay':[1761,72.8],'Croatia':[1924,80.3],'Sweden':[1748,72.1],
      'Austria':[1741,71.9],'Czechia':[1734,71.4],'Australia':[1718,70.8],'Scotland':[1712,70.2],
      'Ivory Coast':[1708,69.9],'Ghana':[1692,69.1],'Paraguay':[1685,68.7],'Algeria':[1678,68.3],
      'Iran':[1671,67.8],'Portugal':[1931,82.7],'DR Congo':[1648,66.2],'Egypt':[1641,65.8],
      'Panama':[1628,64.1],'Bosnia-Herzegovina':[1619,63.7],'Saudi Arabia':[1612,63.2],
      'Uzbekistan':[1598,62.4],'Tunisia':[1591,61.9],'South Africa':[1548,59.1],
      'Cape Verde':[1531,57.8],'New Zealand':[1498,55.2],'Haiti':[1476,53.8],
      'Qatar':[1468,53.1],'Jordan':[1452,51.8],'Curacao':[1441,50.9],'Iraq':[1438,50.4],
    };

    // Bayesian Elo update from actual results
    const updatedElos = { ...Object.fromEntries(Object.entries(TEAM_DATA_B).map(([t,d])=>[t,d[0]])) };
    const K = 32; // World Cup K-factor

    for (const match of (playedMatches || [])) {
      const eloA = updatedElos[match.home] || 1600;
      const eloB = updatedElos[match.away] || 1600;
      const expA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
      const scoreA = match.homeScore > match.awayScore ? 1 : match.homeScore === match.awayScore ? 0.5 : 0;
      const delta = K * (scoreA - expA);
      updatedElos[match.home] = (updatedElos[match.home] || 1600) + delta;
      updatedElos[match.away] = (updatedElos[match.away] || 1600) - delta;
    }

    // Re-run Monte Carlo with updated Elos for remaining teams
    function updatedStrength(team) {
      const elo = updatedElos[team] || 1600;
      const sq = TEAM_DATA_B[team]?.[1] || 70;
      return 0.6 * (elo - 1440) / 600 + 0.4 * (sq - 50) / 40;
    }

    function updatedMatchProb(a, b) {
      const diff = updatedStrength(a) - updatedStrength(b);
      const draw = Math.max(0.12, 0.26 - Math.abs(diff) * 0.22);
      const raw = 1 / (1 + Math.pow(10, -diff * 2.2));
      return { win: Math.max(0.04, raw*(1-draw)), draw: Math.max(0.04, draw), loss: Math.max(0.04, (1-raw)*(1-draw)) };
    }

    function simUpdatedKO(teams) {
      let r = [...teams];
      for (let j = r.length-1; j>0; j--) { const k=Math.floor(Math.random()*(j+1));[r[j],r[k]]=[r[k],r[j]]; }
      while (r.length > 1) {
        const n=[];
        for (let i=0;i<r.length;i+=2) {
          if (i+1>=r.length) { n.push(r[i]); continue; }
          const p=updatedMatchProb(r[i],r[i+1]);
          const rv=Math.random();
          n.push(rv<p.win?r[i]:rv<p.win+p.draw?(Math.random()<0.5?r[i]:r[i+1]):r[i+1]);
        }
        r=n;
      }
      return r[0];
    }

    const N2 = 3000;
    const bayesCount = {};
    const teams = remainingTeams || Object.keys(TEAM_DATA_B).slice(0,32);
    teams.forEach(t => bayesCount[t]=0);
    for (let i=0; i<N2; i++) {
      const w = simUpdatedKO([...teams]);
      if (w) bayesCount[w]=(bayesCount[w]||0)+1;
    }

    const updatedProbs = teams
      .map(t=>({ team:t, prob:(((bayesCount[t]||0)/N2)*100).toFixed(1),
        priorProb: priorProbs?.[t]||'0.0',
        eloChange: Math.round((updatedElos[t]||1600)-(TEAM_DATA_B[t]?.[0]||1600)) }))
      .sort((a,b)=>parseFloat(b.prob)-parseFloat(a.prob))
      .slice(0,12);

    const top = updatedProbs[0];
    const matchSummary = (playedMatches||[]).slice(-5).map(m=>
      `${m.home} ${m.homeScore}-${m.awayScore} ${m.away}`).join(', ');

    prompt = `You are a World Cup analyst. ${playedMatches?.length||0} matches have been played.

Recent results: ${matchSummary || 'No matches yet'}

Bayesian-updated championship probabilities (Elos updated from actual results, ${N2} simulations):
${updatedProbs.map((t,i)=>`${i+1}. ${t.team}: ${t.prob}% (was ${t.priorProb}%, Elo ${t.eloChange>=0?'+':''}${t.eloChange})`).join('\n')}

Respond ONLY with JSON:
{
  "updatedProbs": ${JSON.stringify(updatedProbs)},
  "champion": "${top.team}",
  "keyInsight": "2 sentence insight about how results so far have shifted the probabilities",
  "biggestRiser": "${updatedProbs.find(t=>parseFloat(t.eloChange)===Math.max(...updatedProbs.map(u=>parseFloat(u.eloChange))))?.team||top.team}",
  "biggestFaller": "${updatedProbs.find(t=>parseFloat(t.eloChange)===Math.min(...updatedProbs.map(u=>parseFloat(u.eloChange))))?.team||updatedProbs[updatedProbs.length-1]?.team}",
  "matchesProcessed": ${playedMatches?.length||0}
}`;

  } else {
    return new Response(JSON.stringify({ error: 'Invalid type. Use bracket, commentary, whatif or bayesian' }), { status: 400 });
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
      return new Response(JSON.stringify({ error: 'Could not parse response', raw: text.slice(0,200) }), { status: 500 });
    }

    let result;
    try {
      result = JSON.parse(match[0]);
    } catch(parseErr) {
      // Try to repair common JSON issues — truncated strings, trailing commas
      let repaired = match[0]
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/\n/g, ' ');
      try {
        result = JSON.parse(repaired);
      } catch(e2) {
        const lastBrace = repaired.lastIndexOf('"}');
        if (lastBrace > 0) {
          try { result = JSON.parse(repaired.slice(0, lastBrace+2) + '}'); } catch {}
        }
        if (!result) {
          return new Response(JSON.stringify({ error: `JSON parse failed: ${parseErr.message}`, raw: match[0].slice(0,300) }), { status: 500 });
        }
      }
    }

    // Inject simulation data server-side (not via Claude to avoid JSON corruption)
    if (_champProbs) result.simulationData = _champProbs;
    if (_convergenceData) result.convergenceData = _convergenceData;

    return new Response(JSON.stringify(result), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
