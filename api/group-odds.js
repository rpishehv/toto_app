// api/group-odds.js — Polymarket group winner odds via gamma markets API

export const config = { runtime: 'edge' };

const GROUP_TEAMS = {
  A: ['Mexico','South Korea','Czechia','South Africa'],
  B: ['Switzerland','Canada','Bosnia-Herzegovina','Qatar'],
  C: ['Brazil','Morocco','Scotland','Haiti'],
  D: ['USA','Turkey','Paraguay','Australia'],
  E: ['Germany','Ecuador','Ivory Coast','Curacao'],
  F: ['Netherlands','Japan','Sweden','Tunisia'],
  G: ['Belgium','Egypt','Iran','New Zealand'],
  H: ['Spain','Cape Verde','Saudi Arabia','Uruguay'],
  I: ['France','Senegal','Norway','Iraq'],
  J: ['Argentina','Algeria','Austria','Jordan'],
  K: ['Portugal','DR Congo','Uzbekistan','Colombia'],
  L: ['England','Croatia','Ghana','Panama'],
};

// Team name to slug fragment mapping
const TEAM_SLUG = {
  'Mexico':'mexico','South Korea':'south-korea','Czechia':'czechia',
  'South Africa':'south-africa','Switzerland':'switzerland','Canada':'canada',
  'Bosnia-Herzegovina':'bosnia-and-herzegovina','Qatar':'qatar',
  'Brazil':'brazil','Morocco':'morocco','Scotland':'scotland','Haiti':'haiti',
  'USA':'usa','Turkey':'turkey','Paraguay':'paraguay','Australia':'australia',
  'Germany':'germany','Ecuador':'ecuador','Ivory Coast':'ivory-coast','Curacao':'curacao',
  'Netherlands':'netherlands','Japan':'japan','Sweden':'sweden','Tunisia':'tunisia',
  'Belgium':'belgium','Egypt':'egypt','Iran':'iran','New Zealand':'new-zealand',
  'Spain':'spain','Cape Verde':'cape-verde','Saudi Arabia':'saudi-arabia','Uruguay':'uruguay',
  'France':'france','Senegal':'senegal','Norway':'norway','Iraq':'iraq',
  'Argentina':'argentina','Algeria':'algeria','Austria':'austria','Jordan':'jordan',
  'Portugal':'portugal','DR Congo':'dr-congo','Uzbekistan':'uzbekistan','Colombia':'colombia',
  'England':'england','Croatia':'croatia','Ghana':'ghana','Panama':'panama',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const group = url.searchParams.get('group')?.toUpperCase();
  if (!group || !GROUP_TEAMS[group]) {
    return new Response(JSON.stringify({ error: 'Invalid group' }), { status: 400 });
  }

  const teams = GROUP_TEAMS[group];
  const grpLower = group.toLowerCase();
  const headers = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' };
  const BASE = 'https://gamma-api.polymarket.com';

  try {
    // Strategy 1: fetch each team's individual market by slug
    // Pattern: "will-mexico-win-world-cup-group-a"
    const results = await Promise.all(teams.map(async (team) => {
      const teamSlug = TEAM_SLUG[team] || team.toLowerCase().replace(/\s+/g,'-');
      const slugVariants = [
        `will-${teamSlug}-win-world-cup-group-${grpLower}`,
        `will-${teamSlug}-win-group-${grpLower}-2026`,
        `${teamSlug}-win-group-${grpLower}`,
      ];
      for (const slug of slugVariants) {
        try {
          const r = await fetch(`${BASE}/markets/slug/${slug}`, { headers });
          if (r.ok) {
            const m = await r.json();
            if (m?.outcomePrices?.length > 0) {
              const yesPrice = parseFloat(m.outcomePrices[0]);
              return { label: team, prob: Math.round(yesPrice * 100), found: true };
            }
          }
        } catch {}
      }
      return { label: team, prob: null, found: false };
    }));

    const found = results.filter(r => r.found && r.prob > 0);
    if (found.length >= 2) {
      return new Response(JSON.stringify({
        found: true, group,
        url: `https://polymarket.com/event/world-cup-group-${grpLower}-winner`,
        outcomes: found.sort((a,b) => b.prob - a.prob),
      }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } });
    }

    // Strategy 2: search markets for this group
    const r = await fetch(
      `${BASE}/markets?search=${encodeURIComponent(`Group ${group} Winner 2026`)}&active=true&limit=20`,
      { headers }
    );
    if (r.ok) {
      const data = await r.json();
      const markets = Array.isArray(data) ? data : [];
      const relevant = markets.filter(m => {
        const q = (m.question || m.groupItemTitle || '').toLowerCase();
        return q.includes(`group ${grpLower}`);
      });
      if (relevant.length >= 2) {
        const outcomes = relevant.map(m => ({
          label: (m.groupItemTitle || m.question || '?')
            .replace(/Will\s+/i,'').replace(/\s+win.*/i,'').trim(),
          prob: Math.round(parseFloat(m.outcomePrices?.[0] ?? m.lastTradePrice ?? 0) * 100),
        })).filter(o => o.prob > 0).sort((a,b) => b.prob - a.prob);
        if (outcomes.length >= 2) {
          return new Response(JSON.stringify({
            found: true, group,
            url: `https://polymarket.com/event/world-cup-group-${grpLower}-winner`,
            outcomes,
          }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } });
        }
      }
    }

    return new Response(JSON.stringify({ found: false, group, message: 'No markets found' }), { status: 200 });
  } catch(e) {
    return new Response(JSON.stringify({ found: false, error: e.message }), { status: 200 });
  }
}
