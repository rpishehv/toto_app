import { supabase } from './supabase.js'

// ─── USER / PIN ───────────────────────────────────────────────────────────────

export async function sbGetUser(username) {
  const { data } = await supabase
    .from('users').select('username,pin').eq('username', username).single()
  return data || null
}

export async function sbCreateUser(username, pin, recoveryCode) {
  await supabase.from('users').upsert({ username, pin, recovery_code: recoveryCode })
}

export async function sbResetPin(username, newPin) {
  await supabase.from('users').update({ pin: newPin }).eq('username', username)
}

export async function sbVerifyRecovery(username, code) {
  const { data } = await supabase
    .from('users').select('recovery_code').eq('username', username).single()
  return data?.recovery_code?.toUpperCase() === code.toUpperCase()
}

export async function sbClearUser(username) {
  await supabase.from('users').update({ pin: null, recovery_code: null }).eq('username', username)
}

// ─── PREDICTIONS ──────────────────────────────────────────────────────────────

export async function sbGetPrediction(username) {
  const { data } = await supabase
    .from('predictions').select('*').eq('username', username).single()
  return data || null
}

export async function sbSavePrediction(username, matches, knockout, podium) {
  await supabase.from('predictions').upsert({
    username, matches, knockout, podium, updated_at: new Date().toISOString()
  })
}

// ─── ACTUAL RESULTS ───────────────────────────────────────────────────────────

export async function sbGetActualResults() {
  const { data } = await supabase
    .from('actual_results').select('*').eq('id', 1).single()
  return data || null
}

export async function sbSaveActualResults(matches, knockout, actualPodium, koKickoffs, livePredictions) {
  await supabase.from('actual_results').upsert({
    id: 1, matches, knockout,
    actual_podium: actualPodium,
    ko_kickoffs: koKickoffs,
    live_predictions: livePredictions,
    updated_at: new Date().toISOString()
  })
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────

export async function sbGetLeaderboard() {
  const { data } = await supabase
    .from('leaderboard').select('*').order('points', { ascending: false })
  return data || []
}

export async function sbUpsertLeaderboard(username, podium, points) {
  await supabase.from('leaderboard').upsert({
    username,
    champion: podium?.first || '?',
    podium,
    points,
    updated_at: new Date().toISOString()
  })
  return sbGetLeaderboard()
}

// ─── SAVE HISTORY ─────────────────────────────────────────────────────────────

export async function sbGetSaveHistory() {
  const { data } = await supabase
    .from('save_history').select('*').order('saved_at', { ascending: false }).limit(5)
  return data || []
}

export async function sbAddSaveHistory(label, matches, knockout, actualPodium, koKickoffs) {
  await supabase.from('save_history').insert({
    label, matches, knockout,
    actual_podium: actualPodium,
    ko_kickoffs: koKickoffs,
    saved_at: new Date().toISOString()
  })
  // Keep only last 5
  const { data } = await supabase
    .from('save_history').select('id').order('saved_at', { ascending: false })
  if (data && data.length > 5) {
    const toDelete = data.slice(5).map(r => r.id)
    await supabase.from('save_history').delete().in('id', toDelete)
  }
  return sbGetSaveHistory()
}

// ─── SESSION (localStorage — device-specific for auth) ────────────────────────

const SESSION_DAYS = 30

export function saveSession(username) {
  try {
    localStorage.setItem('wc26_session', JSON.stringify({
      username,
      expiry: Date.now() + SESSION_DAYS * 86400000
    }))
  } catch {}
}

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem('wc26_session') || 'null')
    return (s && s.username && s.expiry > Date.now()) ? s : null
  } catch { return null }
}

export function clearSession() {
  try { localStorage.removeItem('wc26_session') } catch {}
}

// ─── RECOVERY CODE GENERATION ──────────────────────────────────────────────────

export function generateRecoveryCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'WC26-'
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  code += '-'
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ─── localStorage helpers (for backup, session, AI predictions) ───────────────
// Some personal/device data still uses localStorage for simplicity

export function lsGet(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
export function lsDel(key) {
  try { localStorage.removeItem(key); } catch {}
}

// stGet/stSet: personal data → localStorage, shared data → Supabase actual_results
export async function stGet(key, shared=false) {
  if (!shared) return lsGet(key);
  // For shared keys, read from actual_results live_predictions field
  // This is handled directly in the component — return null here
  return null;
}
export async function stSet(key, val, shared=false) {
  if (!shared) { lsSet(key, val); return; }
  // shared stSet is handled via sbSaveActualResults
}
export async function detectStorage() { return 'supabase'; }
