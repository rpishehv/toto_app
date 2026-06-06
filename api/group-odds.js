// api/group-odds.js — Polymarket group stage advance probabilities
// Uses the sports standings endpoint

export const config = { runtime: 'edge' };

// Hardcoded group compositions matching the app
const GROUPS = {
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

export default async function handler(req) {
  const url = new URL(req.url);
  const group = url.searchParams.get('group')?.toUpperCase();
  if (!group || !GROUPS[group]) {
    return new Response(JSON.stringify({ error: 'Invalid group' }), { status: 400 });
  }

  const headers = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' };
  const BASE = 'https://gamma-api.polymarket.com';

  try {
    // Try fetching by event tag and group name search
    const terms = [`World Cup Group ${group} Winner`, `Group ${group} Winner`];

    for (const term of terms) {
      const r = await fetch(
        `${BASE}/markets?search=${encodeURIComponent(term)}&active=true&closed=false&limit=50`,
        { headers }
      );
      if (!r.ok) continue;
      const data = await r.json();
      const markets = Array.isArray(data) ? data : [];

      // Filter to markets that mention one of the group's teams
      const groupTeams = GROUPS[group].map(t => t.toLowerCase());
      const relevant = markets.filter(m => {
        const q = (m.question || m.groupItemTitle || '').toLowerCase();
        return q.includes(`group ${group.toLowerCase()}`) ||
               groupTeams.some(t => q.includes(t.split(' ')[0]));
      });

      if (relevant.length >= 2) {
        const outcomes = relevant.map(m => ({
          label: (m.groupItemTitle || m.question || '?')
            .replace(/Will\s+/i,'').replace(/\s+win.*/i,'').trim(),
          prob: Math.round(parseFloat(m.outcomePrices?.[0] ?? m.lastTradePrice ?? 0) * 100),
        })).filter(o => o.prob > 0 && o.label.length < 25)
          .sort((a,b) => b.prob - a.prob);

        if (outcomes.length >= 2) {
          return new Response(JSON.stringify({
            found: true,
            group,
            url: `https://polymarket.com/event/world-cup-group-${group.toLowerCase()}-winner`,
            outcomes,
          }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } });
        }
      }
    }

    // Fallback: try event slug
    const slugs = [
      `world-cup-group-${group.toLowerCase()}-winner`,
      `fifa-world-cup-group-${group.toLowerCase()}-winner`,
    ];
    for (const slug of slugs) {
      const r = await fetch(`${BASE}/events/slug/${slug}`, { headers });
      if (!r.ok) continue;
      const event = await r.json();
      const markets = event?.markets || [];
      if (markets.length >= 2) {
        const outcomes = markets.map(m => ({
          label: (m.groupItemTitle || m.question || '?')
            .replace(/Will\s+/i,'').replace(/\s+win.*/i,'').trim(),
          prob: Math.round(parseFloat(m.outcomePrices?.[0] ?? m.lastTradePrice ?? 0) * 100),
        })).filter(o => o.prob > 0).sort((a,b) => b.prob - a.prob);
        if (outcomes.length >= 2) {
          return new Response(JSON.stringify({
            found: true, group,
            url: `https://polymarket.com/event/${slug}`,
            outcomes,
          }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } });
        }
      }
    }

    return new Response(JSON.stringify({ found: false, group }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch(e) {
    return new Response(JSON.stringify({ found: false, error: e.message }), { status: 200 });
  }
}
