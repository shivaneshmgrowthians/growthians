-- ============================================================
-- LEDGER v1 — Daily Task Tracker
-- Full Supabase schema with Row Level Security
-- ============================================================
-- HOW TO APPLY:
-- 1. Open Supabase SQL Editor → New Query
-- 2. Paste this entire file → Click RUN
-- ============================================================

-- ----- EXTENSIONS -----
create extension if not exists "uuid-ossp";

-- ============================================================
-- DROP OLD TABLES (Fresh Start - removes anything from v0)
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users cascade;
drop function if exists public.handle_new_auth_user() cascade;
drop function if exists public.is_ceo() cascade;
drop function if exists public.invite_team_member(text, text) cascade;
drop function if exists public.credit_monthly_leaves() cascade;

drop table if exists public.notifications cascade;
drop table if exists public.logoff_requests cascade;
drop table if exists public.leave_requests cascade;
drop table if exists public.task_slots cascade;
drop table if exists public.daily_tasks cascade;
drop table if exists public.todos cascade;
drop table if exists public.notepads cascade;
drop table if exists public.user_slots cascade;
drop table if exists public.sat_overrides cascade;
drop table if exists public.holidays cascade;
drop table if exists public.users cascade;

-- ============================================================
-- USERS TABLE (1:1 with auth.users)
-- ============================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null default 'employee' check (role in ('employee','ceo')),
  designation text default 'Team Member',
  avatar_id integer default 1 check (avatar_id between 1 and 8),
  active boolean not null default true,
  works_on_sat boolean not null default true,
  leave_balance numeric not null default 0,
  last_credited_month text, -- format: 'YYYY-MM'
  created_at timestamptz not null default now()
);

create index idx_users_role on public.users(role);
create index idx_users_active on public.users(active);

-- ============================================================
-- DAILY TASKS (one row per user per day)
-- ============================================================
create table public.daily_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  status text not null default 'draft' check (status in ('draft','submitted')),
  login_time text,
  logoff_time text,
  total_hours numeric default 0,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index idx_daily_tasks_user_date on public.daily_tasks(user_id, date);

-- ============================================================
-- TASK SLOTS (hourly entries: tasks worked on, agenda, pending)
-- ============================================================
create table public.task_slots (
  id uuid primary key default uuid_generate_v4(),
  daily_task_id uuid not null references public.daily_tasks(id) on delete cascade,
  slot_index integer not null,
  time_slot text not null,
  tasks_worked_on text default '',
  days_agenda text default '',
  task_pending text default '',
  created_at timestamptz not null default now()
);

create index idx_task_slots_daily on public.task_slots(daily_task_id);

-- ============================================================
-- USER TIME SLOTS (each user's customizable list of time slots)
-- ============================================================
create table public.user_slots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  slot_index integer not null,
  time_slot text not null,
  unique (user_id, slot_index)
);

create index idx_user_slots_user on public.user_slots(user_id);

-- ============================================================
-- LEAVE REQUESTS
-- ============================================================
create table public.leave_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  leave_type text not null default 'full' check (leave_type in ('full','half')),
  days_requested numeric not null default 1,
  lop_days numeric default 0,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  ceo_comment text default '',
  reviewer_id uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_leave_user on public.leave_requests(user_id);
create index idx_leave_status on public.leave_requests(status);

-- ============================================================
-- EARLY LOGOFF REQUESTS
-- ============================================================
create table public.logoff_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  logoff_date date not null,
  logoff_time text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  ceo_comment text default '',
  reviewer_id uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_logoff_user on public.logoff_requests(user_id);
create index idx_logoff_status on public.logoff_requests(status);

-- ============================================================
-- NOTIFICATIONS (real-time)
-- ============================================================
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  message text not null,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notif_recipient on public.notifications(recipient_id, is_read);

-- ============================================================
-- TODOS (per-user daily todos that reset)
-- ============================================================
create table public.todos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  date date not null,
  created_at timestamptz not null default now()
);

create index idx_todos_user_date on public.todos(user_id, date);

-- ============================================================
-- NOTEPADS (per-user persistent notepad)
-- ============================================================
create table public.notepads (
  user_id uuid primary key references public.users(id) on delete cascade,
  content text default '',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SATURDAY OVERRIDES (per-user per-Saturday override)
-- ============================================================
create table public.sat_overrides (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  sat_date date not null,
  status text not null check (status in ('working','off')),
  unique (user_id, sat_date)
);

create index idx_sat_user on public.sat_overrides(user_id);
create index idx_sat_date on public.sat_overrides(sat_date);

-- ============================================================
-- HOLIDAYS (company-wide, managed by CEO)
-- ============================================================
create table public.holidays (
  id uuid primary key default uuid_generate_v4(),
  date date not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create index idx_holidays_date on public.holidays(date);

-- ============================================================
-- HELPER: is_ceo()
-- ============================================================
create or replace function public.is_ceo()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'ceo' and active = true
  );
$$;

grant execute on function public.is_ceo() to authenticated;

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGN UP
-- First user becomes CEO. After that, only invited employees.
-- ============================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_role text;
  v_name text;
  v_designation text;
begin
  if exists (select 1 from public.users where id = new.id) then
    return new;
  end if;

  if (select count(*) from public.users) = 0 then
    v_role := 'ceo';
    v_designation := 'Founder & CEO';
  else
    v_role := 'employee';
    v_designation := coalesce(new.raw_user_meta_data->>'designation', 'Team Member');
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  insert into public.users (id, email, name, role, active, designation, avatar_id, leave_balance, works_on_sat, last_credited_month)
  values (new.id, new.email, v_name, v_role, true, v_designation, 1, 0, true, null);

  -- Initialize default time slots
  insert into public.user_slots (user_id, slot_index, time_slot) values
    (new.id, 0, '10:00 AM – 11:00 AM'),
    (new.id, 1, '11:00 AM – 12:00 PM'),
    (new.id, 2, '12:00 PM – 01:00 PM'),
    (new.id, 3, '01:00 PM – 02:00 PM'),
    (new.id, 4, '02:00 PM – 03:00 PM'),
    (new.id, 5, '03:00 PM – 04:00 PM'),
    (new.id, 6, '04:00 PM – 05:00 PM'),
    (new.id, 7, '05:00 PM – 06:30 PM');

  -- Initialize empty notepad
  insert into public.notepads (user_id, content) values (new.id, '');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================
-- AUTO-CREDIT MONTHLY LEAVES
-- Called on user sign in. Credits 1 leave per missed month
-- starting from May 2026. Carries forward, max 12.
-- ============================================================
create or replace function public.credit_monthly_leaves(p_user_id uuid)
returns table(credited integer, latest_month text, message text)
language plpgsql security definer
set search_path = public
as $$
declare
  v_user record;
  v_policy_start date := '2026-05-01';
  v_today date := current_date;
  v_cursor date;
  v_months_count integer := 0;
  v_actual_credited integer := 0;
  v_new_balance numeric;
  v_max numeric := 12;
  v_latest text;
begin
  select * into v_user from public.users where id = p_user_id;

  if v_user is null then
    return query select 0, null::text, 'User not found'::text;
    return;
  end if;

  if v_today < v_policy_start then
    return query select 0, v_user.last_credited_month, 'Before policy start date'::text;
    return;
  end if;

  if v_user.last_credited_month is not null then
    v_cursor := (v_user.last_credited_month || '-01')::date + interval '1 month';
  else
    v_cursor := v_policy_start;
  end if;

  v_new_balance := v_user.leave_balance;

  while v_cursor <= v_today loop
    v_months_count := v_months_count + 1;
    if v_new_balance < v_max then
      v_new_balance := v_new_balance + 1;
      v_actual_credited := v_actual_credited + 1;
    end if;
    v_latest := to_char(v_cursor, 'YYYY-MM');
    v_cursor := v_cursor + interval '1 month';
  end loop;

  if v_months_count > 0 then
    update public.users
    set leave_balance = least(v_new_balance, v_max),
        last_credited_month = v_latest
    where id = p_user_id;

    if v_actual_credited > 0 then
      insert into public.notifications (recipient_id, type, message)
      values (
        p_user_id,
        'leave_credited',
        case
          when v_months_count = 1 then '🎉 ' || v_actual_credited || ' leave credited'
          else '🎉 ' || v_actual_credited || ' leaves credited (covering ' || v_months_count || ' months)'
        end
      );
    end if;
  end if;

  return query select v_actual_credited, v_latest, 'OK'::text;
end;
$$;

grant execute on function public.credit_monthly_leaves(uuid) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.task_slots enable row level security;
alter table public.user_slots enable row level security;
alter table public.leave_requests enable row level security;
alter table public.logoff_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.todos enable row level security;
alter table public.notepads enable row level security;
alter table public.sat_overrides enable row level security;
alter table public.holidays enable row level security;

-- USERS
create policy "users_select_all" on public.users for select using (auth.uid() is not null);
create policy "users_update_self" on public.users for update using (id = auth.uid() or public.is_ceo());
create policy "users_insert_self" on public.users for insert with check (id = auth.uid() or public.is_ceo());

-- DAILY TASKS
create policy "daily_tasks_select" on public.daily_tasks for select using (user_id = auth.uid() or public.is_ceo());
create policy "daily_tasks_insert" on public.daily_tasks for insert with check (user_id = auth.uid());
create policy "daily_tasks_update" on public.daily_tasks for update using (
  (user_id = auth.uid() and status = 'draft') or public.is_ceo()
);

-- TASK SLOTS
create policy "task_slots_select" on public.task_slots for select using (
  exists (select 1 from public.daily_tasks dt where dt.id = task_slots.daily_task_id
          and (dt.user_id = auth.uid() or public.is_ceo()))
);
create policy "task_slots_modify" on public.task_slots for all using (
  exists (select 1 from public.daily_tasks dt where dt.id = task_slots.daily_task_id
          and dt.user_id = auth.uid() and dt.status = 'draft')
);

-- USER SLOTS
create policy "user_slots_select" on public.user_slots for select using (auth.uid() is not null);
create policy "user_slots_modify" on public.user_slots for all using (user_id = auth.uid());

-- LEAVE REQUESTS
create policy "leave_select" on public.leave_requests for select using (user_id = auth.uid() or public.is_ceo());
create policy "leave_insert" on public.leave_requests for insert with check (user_id = auth.uid());
create policy "leave_update_ceo" on public.leave_requests for update using (public.is_ceo());

-- LOGOFF REQUESTS
create policy "logoff_select" on public.logoff_requests for select using (user_id = auth.uid() or public.is_ceo());
create policy "logoff_insert" on public.logoff_requests for insert with check (user_id = auth.uid());
create policy "logoff_update_ceo" on public.logoff_requests for update using (public.is_ceo());

-- NOTIFICATIONS
create policy "notif_select_own" on public.notifications for select using (recipient_id = auth.uid());
create policy "notif_insert" on public.notifications for insert with check (auth.uid() is not null);
create policy "notif_update_own" on public.notifications for update using (recipient_id = auth.uid());

-- TODOS
create policy "todos_all_own" on public.todos for all using (user_id = auth.uid());

-- NOTEPADS
create policy "notepad_all_own" on public.notepads for all using (user_id = auth.uid());

-- SAT OVERRIDES
create policy "sat_select_all" on public.sat_overrides for select using (auth.uid() is not null);
create policy "sat_modify_own" on public.sat_overrides for all using (user_id = auth.uid());

-- HOLIDAYS
create policy "holidays_select_all" on public.holidays for select using (auth.uid() is not null);
create policy "holidays_modify_ceo" on public.holidays for all using (public.is_ceo());

-- ============================================================
-- REALTIME for notifications + sat_overrides + leave/logoff
-- ============================================================
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.sat_overrides;
alter publication supabase_realtime add table public.leave_requests;
alter publication supabase_realtime add table public.logoff_requests;
alter publication supabase_realtime add table public.daily_tasks;

-- ============================================================
-- DONE. Sign up at the app to create your CEO account.
-- ============================================================
