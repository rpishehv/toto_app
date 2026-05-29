-- Run this in your Supabase SQL Editor
-- Go to: supabase.com → your project → SQL Editor → New Query → paste & run

-- Users (PIN storage)
create table if not exists users (
  username text primary key,
  pin text not null,
  recovery_code text,
  created_at timestamptz default now()
);

-- Predictions (per user)
create table if not exists predictions (
  username text primary key references users(username),
  matches jsonb default '[]',
  knockout jsonb default '[]',
  podium jsonb default '{}',
  updated_at timestamptz default now()
);

-- Actual results (shared, single row)
create table if not exists actual_results (
  id integer primary key default 1,
  matches jsonb default '[]',
  knockout jsonb default '[]',
  actual_podium jsonb default '{}',
  ko_kickoffs jsonb default '{}',
  live_predictions jsonb default '{}',
  updated_at timestamptz default now(),
  check (id = 1)
);

-- Insert the single results row
insert into actual_results (id) values (1) on conflict do nothing;

-- Leaderboard (shared)
create table if not exists leaderboard (
  username text primary key,
  champion text default '?',
  podium jsonb default '{}',
  points integer default 0,
  updated_at timestamptz default now()
);

-- Admin save history (shared)
create table if not exists save_history (
  id serial primary key,
  saved_at timestamptz default now(),
  label text,
  matches jsonb,
  knockout jsonb,
  actual_podium jsonb,
  ko_kickoffs jsonb
);

-- Enable Row Level Security but allow all for anon (simple app, no auth)
alter table users enable row level security;
alter table predictions enable row level security;
alter table actual_results enable row level security;
alter table leaderboard enable row level security;
alter table save_history enable row level security;

create policy "allow all users" on users for all using (true) with check (true);
create policy "allow all predictions" on predictions for all using (true) with check (true);
create policy "allow all actual_results" on actual_results for all using (true) with check (true);
create policy "allow all leaderboard" on leaderboard for all using (true) with check (true);
create policy "allow all save_history" on save_history for all using (true) with check (true);

-- AI Content (shared, single row)
create table if not exists ai_content (
  id integer primary key default 1,
  bracket jsonb,
  commentary text,
  bracket_generated_by text,
  commentary_generated_by text,
  updated_at timestamptz default now()
);

-- Seed the single row
insert into ai_content (id) values (1) on conflict (id) do nothing;

-- Rank history (per user, array of {rank, points, savedAt})
alter table leaderboard add column if not exists rank_history jsonb default '[]';

-- Reactions (shared, real-time)
create table if not exists reactions (
  id text primary key,  -- e.g. "matchId_userId_emoji"
  match_id text not null,
  username text not null,
  emoji text not null,
  created_at timestamptz default now()
);
alter table reactions enable row level security;
create policy "Anyone can read reactions" on reactions for select using (true);
create policy "Anyone can insert reactions" on reactions for insert with check (true);
create policy "Anyone can delete own reactions" on reactions for delete using (true);

-- Chat messages (global, real-time)
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  message text not null,
  created_at timestamptz default now()
);
alter table chat_messages enable row level security;
create policy "Anyone can read chat" on chat_messages for select using (true);
create policy "Anyone can insert chat" on chat_messages for insert with check (true);
create policy "Anyone can delete own chat" on chat_messages for delete using (true);
