#!/usr/bin/env node
/**
 * FIFA 2026 Predictor — Supabase Backup Script
 * 
 * Dumps all tables to CSV files in a timestamped folder.
 * Run from your laptop:
 *   node wc2026-backup.js
 * 
 * Requires:
 *   npm install @supabase/supabase-js
 * 
 * Set your credentials below or as environment variables:
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY=eyJh...  (use SERVICE KEY, not anon key — has full read access)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_ROLE_KEY';

// Tables to back up
const TABLES = [
  'users',
  'predictions',
  'actual_results',
  'leaderboard',
  'save_history',
  'ai_content',
  'reactions',
  'chat_messages',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toCSV(rows) {
  if (!rows || rows.length === 0) return 'no data\n';
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    // Wrap in quotes if contains comma, newline or quote
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerRow = headers.join(',');
  const dataRows  = rows.map(r => headers.map(h => escape(r[h])).join(','));
  return [headerRow, ...dataRows].join('\n') + '\n';
}

function formatDate(d) {
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function backup() {
  // Validate config
  if (SUPABASE_URL.includes('YOUR_PROJECT') || SUPABASE_KEY.includes('YOUR_SERVICE')) {
    console.error('❌ Please set your SUPABASE_URL and SUPABASE_SERVICE_KEY.');
    console.error('   Either edit the script or run:');
    console.error('   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node wc2026-backup.js');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  });

  // Create output folder
  const timestamp = formatDate(new Date());
  const outDir = path.join(process.cwd(), `wc2026-backup-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n📁 Saving backup to: ${outDir}\n`);

  const summary = [];

  for (const table of TABLES) {
    process.stdout.write(`  Backing up ${table}... `);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: true, nullsFirst: true })
        .limit(100000);

      if (error) {
        // Some tables may not have created_at — retry without ordering
        const { data: data2, error: error2 } = await supabase
          .from(table).select('*').limit(100000);
        if (error2) throw new Error(error2.message);
        const csv = toCSV(data2 || []);
        fs.writeFileSync(path.join(outDir, `${table}.csv`), csv, 'utf8');
        console.log(`✅ ${(data2||[]).length} rows`);
        summary.push({ table, rows: (data2||[]).length, status: 'ok' });
      } else {
        const csv = toCSV(data || []);
        fs.writeFileSync(path.join(outDir, `${table}.csv`), csv, 'utf8');
        console.log(`✅ ${(data||[]).length} rows`);
        summary.push({ table, rows: (data||[]).length, status: 'ok' });
      }
    } catch (e) {
      console.log(`⚠️  ${e.message}`);
      summary.push({ table, rows: 0, status: `error: ${e.message}` });
    }
  }

  // Write summary
  const summaryLines = [
    `FIFA 2026 Predictor — Supabase Backup`,
    `Date: ${new Date().toLocaleString()}`,
    `URL:  ${SUPABASE_URL}`,
    '',
    'Table                  Rows    Status',
    '─'.repeat(50),
    ...summary.map(s =>
      `${s.table.padEnd(22)} ${String(s.rows).padStart(6)}  ${s.status}`
    ),
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'BACKUP_SUMMARY.txt'), summaryLines, 'utf8');
  console.log('\n' + summaryLines);
  console.log(`\n✅ Backup complete → ${outDir}`);
  console.log('   Keep this folder somewhere safe (Dropbox, iCloud, external drive).\n');
}

backup().catch(e => {
  console.error('❌ Backup failed:', e.message);
  process.exit(1);
});
