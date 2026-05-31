import { supabase } from './supabase.js'

// ─── USER / PIN ───────────────────────────────────────────────────────────────

export async function sbGetUser(username) {
  const { data, error } = await supabase
    .from('users').select('username,pin').eq('username', username).maybeSingle()
  if (error) console.error('sbGetUser error:', error.message)
  return data || null
}

export async function sbCreateUser(username, pin, recoveryCode) {
  const { error } = await supabase.from('users').upsert(
    { username, pin, recovery_code: recoveryCode },
    { onConflict: 'username' }
  )
  if (error) console.error('sbCreateUser error:', error.message)
}

export async function sbResetPin(username, newPin) {
  const { error } = await supabase.from('users').update({ pin: newPin }).eq('username', username)
  if (error) console.error('sbResetPin error:', error.message)
}

export async function sbVerifyRecovery(username, code) {
  const { data, error } = await supabase
    .from('users').select('recovery_code').eq('username', username).maybeSingle()
  if (error || !data) return false
  return data.recovery_code?.toUpperCase() === code.toUpperCase()
}

export async function sbClearUser(username) {
  const { error } = await supabase.from('users')
    .update({ pin: null, recovery_code: null }).eq('username', username)
  if (error) console.error('sbClearUser error:', error.message)
}

export async function sbDeleteUser(username) {
  // Delete all user data across all tables
  await supabase.from('predictions').delete().eq('username', username);
  await supabase.from('leaderboard').delete().eq('username', username);
  await supabase.from('reactions').delete().eq('username', username);
  await supabase.from('chat_messages').delete().eq('username', username);
  await supabase.from('users').delete().eq('username', username);
}

// ─── PREDICTIONS ──────────────────────────────────────────────────────────────

export async function sbGetPrediction(username) {
  const { data, error } = await supabase
    .from('predictions').select('*').eq('username', username).maybeSingle()
  if (error) console.error('sbGetPrediction error:', error.message)
  return data || null
}

export async function sbSavePrediction(username, matches, knockout, podium) {
  const { error } = await supabase.from('predictions').upsert(
    { username, matches, knockout, podium, updated_at: new Date().toISOString() },
    { onConflict: 'username' }
  )
  if (error) console.error('sbSavePrediction error:', error.message)
}

// ─── ACTUAL RESULTS ───────────────────────────────────────────────────────────

export async function sbGetActualResults() {
  const { data, error } = await supabase
    .from('actual_results').select('*').eq('id', 1).maybeSingle()
  if (error) console.error('sbGetActualResults error:', error.message)
  return data || null
}

export async function sbSaveActualResults(matches, knockout, actualPodium, koKickoffs, livePredictions) {
  const { error } = await supabase.from('actual_results').upsert({
    id: 1,
    matches,
    knockout,
    actual_podium: actualPodium,
    ko_kickoffs: koKickoffs,
    live_predictions: livePredictions || {},
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' })
  if (error) console.error('sbSaveActualResults error:', error.message)
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────

export async function sbGetLeaderboard() {
  const { data, error } = await supabase
    .from('leaderboard').select('*').order('points', { ascending: false })
  if (error) console.error('sbGetLeaderboard error:', error.message)
  return data || []
}

export async function sbUpsertLeaderboard(username, podium, points) {
  const { error } = await supabase.from('leaderboard').upsert(
    {
      username,
      champion: podium?.first || '?',
      podium,
      points,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'username' }
  )
  if (error) console.error('sbUpsertLeaderboard error:', error.message)
  return sbGetLeaderboard()
}

// ─── SAVE HISTORY ─────────────────────────────────────────────────────────────

export async function sbGetSaveHistory() {
  const { data, error } = await supabase
    .from('save_history').select('*').order('saved_at', { ascending: false }).limit(5)
  if (error) console.error('sbGetSaveHistory error:', error.message)
  return data || []
}

export async function sbAddSaveHistory(label, matches, knockout, actualPodium, koKickoffs) {
  const { error } = await supabase.from('save_history').insert({
    label, matches, knockout,
    actual_podium: actualPodium,
    ko_kickoffs: koKickoffs,
    saved_at: new Date().toISOString()
  })
  if (error) console.error('sbAddSaveHistory error:', error.message)
  // Keep only last 5
  const { data } = await supabase
    .from('save_history').select('id').order('saved_at', { ascending: false })
  if (data && data.length > 5) {
    const toDelete = data.slice(5).map(r => r.id)
    await supabase.from('save_history').delete().in('id', toDelete)
  }
  return sbGetSaveHistory()
}

// ─── SESSION (localStorage) ───────────────────────────────────────────────────

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

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function lsGet(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
export function lsDel(key) {
  try { localStorage.removeItem(key); } catch {}
}
export async function stGet(key, shared=false) {
  if (!shared) return lsGet(key);
  return null;
}
export async function stSet(key, val, shared=false) {
  if (!shared) { lsSet(key, val); }
}
export async function detectStorage() { return 'supabase'; }

// ─── AI CONTENT ───────────────────────────────────────────────────────────────
// Stores shared AI-generated content (bracket prediction, commentary)
// Single row table — id=1 always

// ─── CHAT ─────────────────────────────────────────────────────────────────────
export async function sbGetMessages(limit=50) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) console.error('sbGetMessages error:', error.message);
  return data || [];
}

export async function sbSendMessage(username, message) {
  const { error } = await supabase
    .from('chat_messages')
    .insert({ username, message: message.trim() });
  if (error) console.error('sbSendMessage error:', error.message);
  return !error;
}

export async function sbDeleteMessage(id) {
  const { error } = await supabase
    .from('chat_messages').delete().eq('id', id);
  if (error) console.error('sbDeleteMessage error:', error.message);
}

export async function sbTogglePaid(username, paid) {
  const { error } = await supabase.from('leaderboard')
    .update({ paid }).eq('username', username);
  if (error) console.error('sbTogglePaid error:', error.message);
}

// ─── NEWS ─────────────────────────────────────────────────────────────────────
export async function sbGetNews() {
  const { data } = await supabase
    .from('ai_content').select('news, news_updated_by, news_updated_at').eq('id', 1).maybeSingle();
  return data || null;
}

export async function sbSaveNews(stories, username) {
  await supabase.from('ai_content').upsert({
    id: 1,
    news: stories,
    news_updated_by: username,
    news_updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
}

// ─── RANK HISTORY ─────────────────────────────────────────────────────────────
export async function sbUpdateRankHistory(username, rank, points) {
  const { data } = await supabase
    .from('leaderboard').select('rank_history').eq('username', username).maybeSingle();
  const history = data?.rank_history || [];
  const entry = { rank, points, savedAt: new Date().toISOString() };
  const updated = [...history.slice(-19), entry]; // keep last 20
  await supabase.from('leaderboard')
    .update({ rank_history: updated }).eq('username', username);
}

export async function sbGetRankHistory(username) {
  const { data } = await supabase
    .from('leaderboard').select('rank_history').eq('username', username).maybeSingle();
  return data?.rank_history || [];
}

// ─── REACTIONS ────────────────────────────────────────────────────────────────
export async function sbGetReactions(matchId) {
  const { data } = await supabase
    .from('reactions').select('*').eq('match_id', matchId);
  return data || [];
}

export async function sbToggleReaction(matchId, username, emoji) {
  const id = `${matchId}_${username}_${emoji}`;
  const { data } = await supabase
    .from('reactions').select('id').eq('id', id).maybeSingle();
  if (data) {
    await supabase.from('reactions').delete().eq('id', id);
    return false; // removed
  } else {
    await supabase.from('reactions').insert({ id, match_id: matchId, username, emoji });
    return true; // added
  }
}

export async function sbGetAIContent() {
  const { data, error } = await supabase
    .from('ai_content').select('*').eq('id', 1).maybeSingle()
  if (error) console.error('sbGetAIContent error:', error.message)
  return data || null
}

export async function sbSaveAIContent(bracket, commentary, bracketGeneratedBy, commentaryGeneratedBy) {
  const { error } = await supabase.from('ai_content').upsert({
    id: 1,
    bracket: bracket || null,
    commentary: commentary || null,
    bracket_generated_by: bracketGeneratedBy || null,
    commentary_generated_by: commentaryGeneratedBy || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) console.error('sbSaveAIContent error:', error.message)
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

