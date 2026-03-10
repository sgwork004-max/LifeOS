-- LifeOS Database Migrations
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Habits ──────────────────────────────────────────────────────────────────
create table if not exists habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null default 'General',
  frequency text not null default 'daily' check (frequency in ('daily','weekly')),
  target_time text,
  importance_weight int not null default 3 check (importance_weight between 1 and 5),
  color text default '#7c3aed',
  created_at timestamptz default now()
);

create table if not exists habit_logs (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid references habits(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  completed_at timestamptz default now(),
  notes text
);

-- ─── Health ──────────────────────────────────────────────────────────────────
create table if not exists health_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  weight_kg numeric(5,2) not null,
  body_fat_pct numeric(4,1),
  notes text,
  logged_at timestamptz default now()
);

-- ─── Emotional Intelligence ──────────────────────────────────────────────────
create table if not exists emotional_checkins (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  mood int not null check (mood between 1 and 10),
  energy int not null check (energy between 1 and 10),
  emotion_tags text[] default '{}',
  journal_note text,
  logged_at timestamptz default now()
);

create table if not exists gratitude_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entries text[] not null,
  logged_at timestamptz default now()
);

create table if not exists anxiety_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  trigger_desc text not null,
  intensity int not null check (intensity between 1 and 10),
  symptoms text[] default '{}',
  coping_used text default '',
  logged_at timestamptz default now()
);

create table if not exists cbt_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  negative_thought text not null,
  distortions text[] default '{}',
  reframe text default '',
  logged_at timestamptz default now()
);

-- ─── Goals ───────────────────────────────────────────────────────────────────
create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  horizon text not null check (horizon in ('monthly','yearly','5-year')),
  category text not null check (category in ('career','health','relationships','finance','personal_growth')),
  success_metric text not null,
  deadline date,
  created_at timestamptz default now()
);

create table if not exists milestones (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid references goals(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  due_date date,
  completed_at timestamptz
);

create table if not exists weekly_tasks (
  id uuid primary key default uuid_generate_v4(),
  milestone_id uuid references milestones(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  due_date date,
  completed_at timestamptz
);

-- ─── Reports & Alerts ────────────────────────────────────────────────────────
create table if not exists weekly_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start date not null,
  score int not null default 0,
  report_json jsonb not null default '{}',
  generated_at timestamptz default now()
);

create table if not exists pattern_alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  layer text not null check (layer in ('habits','health','emotional','goals')),
  alert_type text not null,
  data_summary text not null,
  dismissed boolean default false,
  created_at timestamptz default now()
);

-- ─── User Profiles ───────────────────────────────────────────────────────────
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  onboarding_complete boolean default false,
  ai_enabled boolean default false,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table health_logs enable row level security;
alter table emotional_checkins enable row level security;
alter table gratitude_logs enable row level security;
alter table anxiety_events enable row level security;
alter table cbt_logs enable row level security;
alter table goals enable row level security;
alter table milestones enable row level security;
alter table weekly_tasks enable row level security;
alter table weekly_reports enable row level security;
alter table pattern_alerts enable row level security;
alter table user_profiles enable row level security;

-- Policies: users can only access their own data
-- Tables with user_id column
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'habits','habit_logs','health_logs','emotional_checkins',
    'gratitude_logs','anxiety_events','cbt_logs','goals',
    'milestones','weekly_tasks','weekly_reports','pattern_alerts'
  ]
  loop
    execute format('
      drop policy if exists "Users own data" on %I;
      create policy "Users own data" on %I
        for all using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    ', tbl, tbl);
  end loop;
end;
$$;

-- user_profiles uses id (not user_id) as the user reference
drop policy if exists "Users own data" on user_profiles;
create policy "Users own data" on user_profiles
  for all using (auth.uid() = id)
  with check (auth.uid() = id);

-- Indexes for common queries
create index if not exists idx_habit_logs_habit_id on habit_logs(habit_id);
create index if not exists idx_habit_logs_user_date on habit_logs(user_id, completed_at);
create index if not exists idx_health_logs_user_date on health_logs(user_id, logged_at);
create index if not exists idx_checkins_user_date on emotional_checkins(user_id, logged_at);
create index if not exists idx_goals_user on goals(user_id);
create index if not exists idx_milestones_goal on milestones(goal_id);
create index if not exists idx_tasks_milestone on weekly_tasks(milestone_id);
create index if not exists idx_alerts_user on pattern_alerts(user_id, dismissed);
