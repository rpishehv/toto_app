import { supabase } from './supabase.js'

// ─── MODULE-LEVEL CACHE ───────────────────────────────────────────────────────
const _cache = {};
const CACHE_TTL = 30000; // 30s
function cacheGet(key) {
  const c = _cache[key];
  if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
  return null;
}
function cacheSet(key, data) { _cache[key] = { data, ts: Date.now() }; }
function cacheInvalidate(prefix) {
  Object.keys(_cache).forEach(k => { if (k.startsWith(prefix)) delete _cache[k]; });
}
export function invalidateCache(prefix) { cacheInvalidate(prefix); }


// ─── USER / PIN ───────────────────────────────────────────────────────────────

export async function sbGetUser(username, groupCode='default') {
  const { data, error } = await supabase
    .from('users').select('username,pin,group_code')
    .eq('username', username).eq('group_code', groupCode).maybeSingle()
  if (error) console.error('sbGetUser error:', error.message)
  return data || null
}

export async function sbCreateUser(username, pin, recoveryCode, groupCode='default') {
  const { error } = await supabase.from('users').upsert(
    { username, pin, recovery_code: recoveryCode, group_code: groupCode },
    { onConflict: 'username,group_code', ignoreDuplicates: false }
  );
  if (error) {
    console.error('sbCreateUser error:', error.message);
    // Fallback: update
    await supabase.from('users')
      .update({ pin, recovery_code: recoveryCode })
      .eq('username', username).eq('group_code', groupCode);
  }
}

export async function sbResetPin(username, newPin, groupCode='default') {
  const { error } = await supabase.from('users').update({ pin: newPin })
    .eq('username', username).eq('group_code', groupCode)
  if (error) console.error('sbResetPin error:', error.message)
}

export async function sbVerifyRecovery(username, code, groupCode='default') {
  const { data, error } = await supabase
    .from('users').select('recovery_code')
    .eq('username', username).eq('group_code', groupCode).maybeSingle()
  if (error || !data) return false
  return data.recovery_code?.toUpperCase() === code.toUpperCase()
}

export async function sbClearUser(username, groupCode='default') {
  console.log('sbClearUser called:', username, groupCode);
  const { data, error } = await supabase.from('users')
    .update({ pin: null, recovery_code: null })
    .eq('username', username).eq('group_code', groupCode)
    .select();
  console.log('sbClearUser result:', data, error?.message);
  if (error) console.error('sbClearUser error:', error.message)
}

export async function sbDeleteUser(username, groupCode='default') {
  const results = await Promise.all([
    supabase.from('predictions').delete().eq('username', username).eq('group_code', groupCode),
    supabase.from('leaderboard').delete().eq('username', username).eq('group_code', groupCode),
    supabase.from('reactions').delete().eq('username', username),
    supabase.from('chat_messages').delete().eq('username', username).eq('group_code', groupCode),
    supabase.from('users').delete().eq('username', username).eq('group_code', groupCode),
  ]);
  results.forEach(({error}, i) => {
    if (error) console.error(`sbDeleteUser table[${i}] error:`, error.message, error.details);
  });
}

// ─── PREDICTIONS ──────────────────────────────────────────────────────────────

export async function sbGetPrediction(username, groupCode='default') {
  const { data, error } = await supabase
    .from('predictions').select('*')
    .eq('username', username).eq('group_code', groupCode).maybeSingle()
  if (error) console.error('sbGetPrediction error:', error.message)
  return data || null
}

export async function sbSavePrediction(username, matches, knockout, podium, groupCode='default') {
  const { error } = await supabase.from('predictions').upsert(
    { username, matches, knockout, podium, group_code: groupCode, updated_at: new Date().toISOString() },
    { onConflict: 'username,group_code', ignoreDuplicates: false }
  );
  if (error) {
    console.error('sbSavePrediction error:', error.message);
    await supabase.from('predictions')
      .update({ matches, knockout, podium, updated_at: new Date().toISOString() })
      .eq('username', username).eq('group_code', groupCode);
  }
}

// ─── ACTUAL RESULTS ───────────────────────────────────────────────────────────
// Results are shared across all groups (same tournament)

export async function sbGetActualResults(groupCode='default') {
  const { data, error } = await supabase
    .from('actual_results').select('*').eq('id', 1).maybeSingle()
  if (error) console.error('sbGetActualResults error:', error.message)
  return data || null
}

export async function sbSaveActualResults(matches, knockout, actualPodium, koKickoffs, livePredictions, groupCode='default') {
  // Row id=1 always exists (inserted in schema), so use update not upsert
  const { data, error } = await supabase.from('actual_results').update({
    matches, knockout,
    actual_podium: actualPodium,
    ko_kickoffs: koKickoffs,
    live_predictions: livePredictions || {},
    updated_at: new Date().toISOString()
  }).eq('id', 1).select()
  if (error) console.error('sbSaveActualResults error:', error.message, error.code, error.details)
  else console.log('sbSaveActualResults success, rows updated:', data?.length)
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────

export async function sbGetAllGroupCodes() {
  const { data, error } = await supabase.from('leaderboard').select('group_code');
  if (error) { console.error('sbGetAllGroupCodes error:', error.message); return ['default']; }
  const codes = [...new Set((data || []).map(r => r.group_code).filter(Boolean))];
  return codes.length > 0 ? codes : ['default'];
}

// Fetch all predictions for a group in one query
export async function sbGetAllPredictions(groupCode='default') {
  const key = `preds_${groupCode}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const { data, error } = await supabase
    .from('predictions').select('username,matches,knockout,podium,prediction_hash,hash_locked_at').eq('group_code', groupCode);
  if (error) { console.error('sbGetAllPredictions error:', error.message); return []; }
  const result = data || [];
  if (result.length) cacheSet(key, result);
  return result;
}
export function invalidatePredsCache(groupCode) { cacheInvalidate(`preds_${groupCode}`); }

// Batch update entire leaderboard in one upsert
export async function sbBatchUpdateLeaderboard(entries, groupCode='default') {
  if (!entries.length) return;
  const rows = entries.map(e => ({
    username: e.username,
    group_code: groupCode,
    champion: e.podium?.first || '?',
    podium: e.podium || {},
    points: e.points,
    updated_at: new Date().toISOString(),
  }));
  // Batch in chunks of 50 to avoid request size limits
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase.from('leaderboard')
      .upsert(chunk, { onConflict: 'username,group_code', ignoreDuplicates: false });
    if (error) {
      console.error('sbBatchUpdateLeaderboard error:', error.message);
      // Fallback: update one by one
      for (const row of chunk) {
        await supabase.from('leaderboard')
          .update({ champion: row.champion, podium: row.podium, points: row.points, updated_at: row.updated_at })
          .eq('username', row.username).eq('group_code', groupCode);
      }
    }
  }
}

export async function sbGetLeaderboard(groupCode='default') {
  const key = `lb_${groupCode}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const { data, error } = await supabase
    .from('leaderboard').select('username,points,champion,podium,paid,rank_history')
    .eq('group_code', groupCode)
    .order('points', { ascending: false })
  if (error) console.error('sbGetLeaderboard error:', error.message)
  const result = data || [];
  if (result.length) cacheSet(key, result);
  return result;
}
export function invalidateLBCache(groupCode) { cacheInvalidate(`lb_${groupCode}`); }

export async function sbUpsertLeaderboard(username, podium, points, groupCode='default') {
  const row = {
    username, group_code: groupCode,
    champion: podium?.first || '?', podium, points,
    updated_at: new Date().toISOString()
  };

  // Check if row exists first
  const { data: existing, error: selectErr } = await supabase.from('leaderboard')
    .select('username').eq('username', username).eq('group_code', groupCode).maybeSingle();

  if (selectErr) console.error('sbUpsertLeaderboard select error:', selectErr.message);

  if (existing) {
    const { error } = await supabase.from('leaderboard')
      .update({ champion: row.champion, podium, points, updated_at: row.updated_at })
      .eq('username', username).eq('group_code', groupCode);
    if (error) console.error('sbUpsertLeaderboard update error:', error.message);
    else console.log('sbUpsertLeaderboard: updated', username, 'in group', groupCode);
  } else {
    const { error } = await supabase.from('leaderboard').insert(row);
    if (error) console.error('sbUpsertLeaderboard insert error:', error.message, 'row:', JSON.stringify(row));
    else console.log('sbUpsertLeaderboard: inserted', username, 'in group', groupCode);
  }

  return sbGetLeaderboard(groupCode);
}

export async function sbTogglePaid(username, paid, groupCode='default') {
  const { error } = await supabase.from('leaderboard')
    .update({ paid }).eq('username', username).eq('group_code', groupCode)
  if (error) console.error('sbTogglePaid error:', error.message)
}

// ─── RANK HISTORY ─────────────────────────────────────────────────────────────

export async function sbUpdateRankHistory(username, rank, points, groupCode='default') {
  const { data } = await supabase
    .from('leaderboard').select('rank_history')
    .eq('username', username).eq('group_code', groupCode).maybeSingle()
  const history = data?.rank_history || []
  const entry = { rank, points, savedAt: new Date().toISOString() }
  const updated = [...history.slice(-19), entry]
  await supabase.from('leaderboard')
    .update({ rank_history: updated })
    .eq('username', username).eq('group_code', groupCode)
}

export async function sbGetRankHistory(username, groupCode='default') {
  const { data } = await supabase
    .from('leaderboard').select('rank_history')
    .eq('username', username).eq('group_code', groupCode).maybeSingle()
  return data?.rank_history || []
}

// ─── SAVE HISTORY ─────────────────────────────────────────────────────────────
// Save history is global (same tournament results)

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
  const { data } = await supabase
    .from('save_history').select('id').order('saved_at', { ascending: false })
  if (data && data.length > 5) {
    const toDelete = data.slice(5).map(r => r.id)
    await supabase.from('save_history').delete().in('id', toDelete)
  }
  return sbGetSaveHistory()
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────

export async function sbGetMessages(limit=50, groupCode='default') {
  const { data, error } = await supabase
    .from('chat_messages').select('*')
    .eq('group_code', groupCode)
    .order('created_at', { ascending: false }).limit(limit)
  if (error) console.error('sbGetMessages error:', error.message)
  return (data || []).reverse() // reverse so oldest first for display
}

export async function sbSendMessage(username, message, groupCode='default') {
  const { error } = await supabase
    .from('chat_messages')
    .insert({ username, message: message.slice(0, 500000), group_code: groupCode })
  if (error) {
    console.error('sbSendMessage error:', error.message);
    throw new Error(error.message);
  }
  return true;
}

export async function sbDeleteMessage(id) {
  const { error } = await supabase.from('chat_messages').delete().eq('id', id)
  if (error) console.error('sbDeleteMessage error:', error.message)
}

// ─── REACTIONS ────────────────────────────────────────────────────────────────

export async function sbGetReactions(matchId) {
  const { data } = await supabase.from('reactions').select('*').eq('match_id', matchId)
  return data || []
}

export async function sbToggleReaction(matchId, username, emoji) {
  const id = `${matchId}_${username}_${emoji}`
  const { data } = await supabase.from('reactions').select('id').eq('id', id).maybeSingle()
  if (data) {
    await supabase.from('reactions').delete().eq('id', id)
    return false
  } else {
    await supabase.from('reactions').insert({ id, match_id: matchId, username, emoji })
    return true
  }
}

// ─── AI CONTENT ───────────────────────────────────────────────────────────────
// Scoped per group

export async function sbGetAIContent(groupCode='default') {
  const { data, error } = await supabase
    .from('ai_content').select('*').eq('group_code', groupCode).maybeSingle()
  if (error) console.error('sbGetAIContent error:', error.message)
  return data || null
}

// Helper: merge-update ai_content without wiping other columns
export async function sbMergeAIContent(fields, groupCode='default') {
  console.log('[sbMergeAIContent] saving fields:', Object.keys(fields), 'for group:', groupCode);
  // Ensure row exists first
  await supabase.from('ai_content')
    .insert({ group_code: groupCode })
    .select()
    .then(() => {}); // ignore conflict error — row already exists is fine
  // Now update
  const { error } = await supabase.from('ai_content')
    .update(fields).eq('group_code', groupCode);
  if (error) console.error('[sbMergeAIContent] update error:', error.message);
  else console.log('[sbMergeAIContent] update success');
}

export async function sbSaveAIContent(bracket, commentary, bracketGeneratedBy, commentaryGeneratedBy, groupCode='default') {
  await sbMergeAIContent({
    bracket: bracket || null,
    commentary: commentary || null,
    bracket_generated_by: bracketGeneratedBy || null,
    commentary_generated_by: commentaryGeneratedBy || null,
    commentary_generated_at: commentary ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, groupCode);
}

// ─── ANALYTICS ───────────────────────────────────────────────────────────────

export async function sbGetAnalytics(groupCode='default') {
  const { data } = await supabase
    .from('ai_content').select('analytics, analytics_generated_by, analytics_generated_at')
    .eq('group_code', groupCode).maybeSingle()
  return data || null
}

export async function sbSaveAnalytics(analysis, username, groupCode='default') {
  await sbMergeAIContent({
    analytics: analysis,
    analytics_generated_by: username,
    analytics_generated_at: new Date().toISOString(),
  }, groupCode);
}

// ─── NEWS ─────────────────────────────────────────────────────────────────────

export async function sbGetNews(groupCode='default') {
  const { data } = await supabase
    .from('ai_content').select('news, news_updated_by, news_updated_at')
    .eq('group_code', groupCode).maybeSingle()
  return data || null
}

export async function sbSaveNews(stories, username, groupCode='default') {
  console.log('[sbSaveNews] saving', stories?.length, 'stories for group:', groupCode);
  await sbMergeAIContent({
    news: stories,
    news_updated_by: username,
    news_updated_at: new Date().toISOString(),
  }, groupCode);
}

// ─── SESSION ─────────────────────────────────────────────────────────────────

const SESSION_DAYS = 30

export function saveSession(username, groupCode='default') {
  try {
    localStorage.setItem('wc26_session', JSON.stringify({
      username, groupCode,
      savedAt: new Date().toISOString(),
      expiry: Date.now() + SESSION_DAYS * 86400000
    }))
  } catch {}
}

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem('wc26_session') || 'null')
    if (s && s.username && s.expiry > Date.now()) {
      // Backward compat — old sessions have no groupCode
      return { username: s.username, groupCode: s.groupCode || 'default' }
    }
    return null
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
export async function detectStorage() { return 'supabase'; }

// ─── RECOVERY CODE GENERATION ──────────────────────────────────────────────────

export function generateRecoveryCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'WC26-'
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  code += '-'
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ─── PREDICTION INTEGRITY HASH ────────────────────────────────────────────────
// SHA-256 hash of all locked match predictions — tamper detection

export async function computePredictionHash(username, matches, knockout, kickoffs) {
  // Only include locked matches (kickoff time has passed)
  const now = Date.now();
  const LOCK_OFFSET = 15 * 60 * 1000;

  const lockedMatches = [...(matches||[]), ...(knockout||[])]
    .filter(m => {
      if (m.homeScore === null || m.awayScore === null) return false;
      const kickoff = kickoffs[`${m.home}||${m.away}`] || kickoffs[`${m.away}||${m.home}`] || kickoffs[m.id];
      return kickoff && now >= (kickoff - LOCK_OFFSET);
    })
    .sort((a,b) => a.id.localeCompare(b.id)) // deterministic order
    .map(m => `${m.id}:${m.homeScore}-${m.awayScore}`);

  if (!lockedMatches.length) return null;

  const payload = `${username}|${lockedMatches.join('|')}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16); // 16 char prefix
}

export async function savePredictionHash(username, hash, groupCode='default') {
  const { error } = await supabase.from('predictions')
    .update({ prediction_hash: hash, hash_locked_at: new Date().toISOString() })
    .eq('username', username).eq('group_code', groupCode);
  if (error) console.error('savePredictionHash error:', error.message);
}

export async function verifyPredictionHash(username, matches, knockout, kickoffs, groupCode='default') {
  const { data, error } = await supabase.from('predictions')
    .select('prediction_hash, hash_locked_at')
    .eq('username', username).eq('group_code', groupCode)
    .single();
  if (error || !data?.prediction_hash) return { status: 'no_hash' };

  const currentHash = await computePredictionHash(username, matches, knockout, kickoffs);
  if (!currentHash) return { status: 'no_locked_matches' };

  if (currentHash === data.prediction_hash) {
    return { status: 'ok', lockedAt: data.hash_locked_at };
  } else {
    return { status: 'tampered', stored: data.prediction_hash, current: currentHash, lockedAt: data.hash_locked_at };
  }
}

export async function saveTimestampToken(username, token, issuedAt, groupCode='default') {
  const { error } = await supabase.from('predictions')
    .update({ timestamp_token: token, timestamp_token_at: issuedAt })
    .eq('username', username).eq('group_code', groupCode);
  if (error) console.error('saveTimestampToken error:', error.message);
}

export async function getTimestampToken(username, groupCode='default') {
  const { data, error } = await supabase.from('predictions')
    .select('prediction_hash,hash_locked_at,timestamp_token,timestamp_token_at')
    .eq('username', username).eq('group_code', groupCode)
    .single();
  if (error) return null;
  return data;
}
