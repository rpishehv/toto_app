// ─── LIVE FEED SYNC ──────────────────────────────────────────────────────────
// Fetches completed fixtures from API-Football and maps to app data structures.
// Used by admin "Sync Live Feed" button.

// Team name aliases: API-Football name → app name
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
  'South Africa':          'South Africa',
  'Cape Verde Islands':    'Cape Verde',
  'Cabo Verde':            'Cape Verde',
}

function normalise(name) {
  return ALIASES[name] || name
}

export async function fetchLiveFeed() {
  // Fetch today's WC fixtures from our API endpoint
  const res = await fetch('/api/live?type=today', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Feed returned ${res.status}`)
  const todayData = await res.json()

  // Also fetch live matches
  const liveRes = await fetch('/api/live?type=live', { cache: 'no-store' })
  const liveData = liveRes.ok ? await liveRes.json() : { response: [] }

  // Combine live + today's finished matches
  const allFixtures = [
    ...(liveData.response || []),
    ...(todayData.response || []),
  ]

  // Deduplicate by fixture id
  const seen = new Set()
  const fixtures = allFixtures.filter(f => {
    const id = f.fixture?.id
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  return { fixtures }
}

export function parseFeed(data, appMatches, appKO) {
  const fixtures = data.fixtures || []
  const FINISHED = ['FT','AET','PEN']

  const results = {
    groupScores: {},
    kickoffs: {},
    koScores: {},
    koTeams: {},
    podium: null,
  }

  for (const f of fixtures) {
    const home = normalise(f.teams?.home?.name || '')
    const away = normalise(f.teams?.away?.name || '')
    const status = f.fixture?.status?.short
    const goals = f.goals
    const isFinished = FINISHED.includes(status)
    const isLive = ['1H','2H','HT','ET','BT','P'].includes(status)

    // Kickoff time
    if (f.fixture?.date) {
      const ko = new Date(f.fixture.date).getTime()
      results.kickoffs[`${home}||${away}`] = ko
      results.kickoffs[`${away}||${home}`] = ko
    }

    // Group stage match
    const appMatch = appMatches.find(m =>
      (m.home === home && m.away === away) ||
      (m.home === away && m.away === home)
    )

    if (appMatch && (isFinished || isLive) && goals?.home !== null && goals?.home !== undefined) {
      const flipped = appMatch.home === away
      results.groupScores[appMatch.id] = {
        homeScore: flipped ? goals.away : goals.home,
        awayScore: flipped ? goals.home : goals.away,
      }
    }
  }

  return results
}

// Apply parsed feed results to current app state
export function applyFeedToState(parsed, appMatches, appKO, appPodium, koKickoffs, override=false) {
  const newMatches = appMatches.map(m => {
    const score = parsed.groupScores[m.id]
    if (!score) return m
    const homeScore = (override || m.homeScore === null) ? score.homeScore : m.homeScore
    const awayScore = (override || m.awayScore === null) ? score.awayScore : m.awayScore
    return { ...m, homeScore, awayScore }
  })

  const newKO = appKO.map(m => {
    const teams = parsed.koTeams?.[m.id]
    const score = parsed.koScores?.[m.id]
    let updated = { ...m }
    if (teams) {
      if (override || !updated.home || updated.home === 'TBD') updated.home = teams.home
      if (override || !updated.away || updated.away === 'TBD') updated.away = teams.away
    }
    if (score) {
      if (override || updated.homeScore === null) updated.homeScore = score.homeScore
      if (override || updated.awayScore === null) updated.awayScore = score.awayScore
    }
    return updated
  })

  const newKoKickoffs = { ...koKickoffs }

  const newPodium = parsed.podium
    ? { ...appPodium, ...parsed.podium }
    : appPodium

  return {
    matches: newMatches,
    ko: newKO,
    podium: newPodium,
    koKickoffs: newKoKickoffs,
    groupKickoffs: {},
    stats: {
      groupScores: Object.keys(parsed.groupScores).length,
      koScores: Object.keys(parsed.koScores || {}).length,
      koTeams: Object.keys(parsed.koTeams || {}).length,
      hasPodium: !!parsed.podium?.first,
    }
  }
}
