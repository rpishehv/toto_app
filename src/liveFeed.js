// ─── LIVE FEED SYNC ──────────────────────────────────────────────────────────
// Fetches from openfootball/worldcup.json and maps to app data structures.
// Used by admin "Sync from Live Feed" button.

const FEED_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

// Team name aliases: feed name → app name
const ALIASES = {
  'Czech Republic':        'Czechia',
  'Bosnia & Herzegovina':  'Bosnia-Herzegovina',
  'Bosnia and Herzegovina':'Bosnia-Herzegovina',
  'Côte d\'Ivoire':        'Ivory Coast',
  'Cote d\'Ivoire':        'Ivory Coast',
  'IR Iran':               'Iran',
  'Korea Republic':        'South Korea',
  'Congo DR':              'DR Congo',
  'Türkiye':               'Turkey',
  'Curaçao':               'Curacao',
}

function normalise(name) {
  return ALIASES[name] || name
}

// Parse UTC timestamp from OFB time string e.g. "13:00 UTC-6" and date "2026-06-11"
function parseKickoffUTC(date, timeStr) {
  if (!date || !timeStr) return null
  const m = timeStr.match(/(\d{2}):(\d{2})\s*UTC([+-]\d+)/)
  if (!m) return null
  const [, hh, mm, offsetStr] = m
  const offset = parseInt(offsetStr)
  // Convert local time to UTC: subtract offset
  const localMs = new Date(`${date}T${hh}:${mm}:00Z`).getTime()
  return localMs - offset * 3600000
}

// Round name mapping: feed round → app round id
function mapKORound(roundStr) {
  const r = roundStr?.toLowerCase() || ''
  if (r.includes('round of 32') || r.includes('round of 16') && r.includes('first')) return 'Round of 32'
  if (r.includes('round of 16')) return 'Round of 16'
  if (r.includes('quarter')) return 'Quarter-Finals'
  if (r.includes('semi')) return 'Semi-Finals'
  if (r.includes('third') || r.includes('3rd')) return '3rd Place'
  if (r.includes('final')) return 'Final'
  return null
}

// Get winner of a KO match (handles ET and penalties)
function getMatchWinner(feedMatch) {
  const s = feedMatch.score
  if (!s) return null
  // Penalties
  if (s.p) return s.p[0] > s.p[1] ? normalise(feedMatch.team1) : normalise(feedMatch.team2)
  // Extra time
  if (s.et) return s.et[0] > s.et[1] ? normalise(feedMatch.team1) : s.et[0] < s.et[1] ? normalise(feedMatch.team2) : null
  // Full time
  if (s.ft) return s.ft[0] > s.ft[1] ? normalise(feedMatch.team1) : s.ft[0] < s.ft[1] ? normalise(feedMatch.team2) : null
  return null
}

export async function fetchLiveFeed() {
  const res = await fetch(FEED_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Feed returned ${res.status}`)
  return res.json()
}

export function parseFeed(data, appMatches, appKO) {
  const feedMatches = data.matches || []

  const results = {
    groupScores: {},      // matchId → { homeScore, awayScore }
    kickoffs: {},         // "Home||Away" → UTC ms
    koScores: {},         // matchId → { homeScore, awayScore }
    koTeams: {},          // matchId → { home, away }
    podium: null,         // { first, second, third }
  }

  // ── Group stage ────────────────────────────────────────────────────────────
  for (const fm of feedMatches) {
    if (!fm.group) continue
    const home = normalise(fm.team1)
    const away = normalise(fm.team2)

    // Kickoff time
    const ko = parseKickoffUTC(fm.date, fm.time)
    if (ko) {
      results.kickoffs[`${home}||${away}`] = ko
      results.kickoffs[`${away}||${home}`] = ko
    }

    // Score
    if (fm.score?.ft) {
      const appMatch = appMatches.find(m => m.home === home && m.away === away)
      if (appMatch) {
        results.groupScores[appMatch.id] = {
          homeScore: fm.score.ft[0],
          awayScore: fm.score.ft[1],
        }
      }
    }
  }

  // ── Knockout stage ─────────────────────────────────────────────────────────
  const koMatches = feedMatches.filter(m => !m.group)
  const finalMatch = koMatches.find(m => m.round?.toLowerCase() === 'final')
  const thirdMatch = koMatches.find(m => m.round?.toLowerCase().includes('third') || m.round?.toLowerCase().includes('3rd'))

  for (const fm of koMatches) {
    const round = mapKORound(fm.round)
    if (!round) continue

    const home = normalise(fm.team1)
    const away = normalise(fm.team2)

    // Find matching app KO slot by round
    const appSlot = appKO.find(m =>
      m.round === round &&
      (m.home === 'TBD' || m.home === home) &&
      (m.away === 'TBD' || m.away === away)
    )
    if (!appSlot) continue

    // Teams
    if (home && away && home !== 'TBD' && away !== 'TBD') {
      results.koTeams[appSlot.id] = { home, away }
    }

    // Kickoff
    const ko = parseKickoffUTC(fm.date, fm.time)
    if (ko) results.kickoffs[appSlot.id + '_ko'] = ko

    // Score
    if (fm.score?.ft) {
      results.koScores[appSlot.id] = {
        homeScore: fm.score.ft[0],
        awayScore: fm.score.ft[1],
      }
    }
  }

  // ── Podium from Final + 3rd place ─────────────────────────────────────────
  if (finalMatch?.score?.ft) {
    const [h, a] = finalMatch.score.ft
    const winner = getMatchWinner(finalMatch)
    if (winner) {
      const loser = winner === normalise(finalMatch.team1)
        ? normalise(finalMatch.team2)
        : normalise(finalMatch.team1)
      results.podium = { first: winner, second: loser, third: null }
    }
  }
  if (thirdMatch?.score) {
    const third = getMatchWinner(thirdMatch)
    if (third) {
      results.podium = { ...(results.podium || {}), third }
    }
  }

  return results
}

// Apply parsed feed results to current app state
export function applyFeedToState(parsed, appMatches, appKO, appPodium, koKickoffs) {
  // Apply group scores — only fill if not already manually entered
  const newMatches = appMatches.map(m => {
    const score = parsed.groupScores[m.id]
    if (!score) return m
    // Don't overwrite manually entered scores
    const homeScore = m.homeScore !== null ? m.homeScore : score.homeScore
    const awayScore = m.awayScore !== null ? m.awayScore : score.awayScore
    return { ...m, homeScore, awayScore }
  })

  // Apply KO teams + scores — only fill empty fields
  const newKO = appKO.map(m => {
    const teams = parsed.koTeams[m.id]
    const score = parsed.koScores[m.id]
    let updated = { ...m }
    if (teams) {
      // Only fill TBD team names, don't overwrite manually entered names
      if (!updated.home || updated.home === 'TBD') updated.home = teams.home
      if (!updated.away || updated.away === 'TBD') updated.away = teams.away
    }
    if (score) {
      // Don't overwrite manually entered scores
      if (updated.homeScore === null) updated.homeScore = score.homeScore
      if (updated.awayScore === null) updated.awayScore = score.awayScore
    }
    return updated
  })

  // Merge kickoffs (KO kickoffs stored by matchId)
  const newKoKickoffs = { ...koKickoffs }
  for (const [key, ms] of Object.entries(parsed.kickoffs)) {
    if (key.endsWith('_ko')) {
      const id = key.replace('_ko', '')
      newKoKickoffs[id] = ms
    }
  }

  // Podium
  const newPodium = parsed.podium
    ? { ...appPodium, ...parsed.podium }
    : appPodium

  // Group kickoffs (embedded in KICKOFFS constant in App — no change needed)
  const groupKickoffs = {}
  for (const [key, ms] of Object.entries(parsed.kickoffs)) {
    if (!key.endsWith('_ko')) groupKickoffs[key] = ms
  }

  return {
    matches: newMatches,
    ko: newKO,
    podium: newPodium,
    koKickoffs: newKoKickoffs,
    groupKickoffs,
    stats: {
      groupScores: Object.keys(parsed.groupScores).length,
      koScores: Object.keys(parsed.koScores).length,
      koTeams: Object.keys(parsed.koTeams).length,
      hasPodium: !!parsed.podium?.first,
    }
  }
}
