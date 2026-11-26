-- English Learning MN: initial Supabase schema
-- Run in Supabase SQL Editor. Review policies before production use.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'student' check (role in ('teacher','student')),
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  join_code text unique not null default upper(substr(encode(gen_random_bytes(8),'hex'),1,8)),
  created_at timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  module text not null check (module in ('translation','speaking','vocabulary','writing','listening','reading','grammar')),
  level text not null default 'B1' check (level in ('A1','A2','B1','B2','C1')),
  prompt text not null,
  reference_answer text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  due_at timestamptz,
  assigned_at timestamptz not null default now(),
  unique (exercise_id, class_id)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answer_text text not null default '',
  ai_feedback jsonb,
  status text not null default 'submitted' check (status in ('draft','submitted','reviewed')),
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.exercises enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- Profiles: users can read/update their own profile.
create policy "profile_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profile_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Classes: teacher manages own classes; enrolled students can view their classes.
create policy "class_teacher_all" on public.classes for all
using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "class_student_read" on public.classes for select
using (exists (select 1 from public.class_members m where m.class_id = id and m.student_id = auth.uid()));

-- Memberships: student can see own memberships; class teacher can see memberships in own class.
create policy "membership_read" on public.class_members for select
using (student_id = auth.uid() or exists (
  select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()
));
-- Joining by code should be implemented through a validated server-side function, not an open insert policy.

-- Exercises: teachers manage their own; students can read published exercises assigned to their class.
create policy "exercise_teacher_all" on public.exercises for all
using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "exercise_student_read_assigned" on public.exercises for select
using (is_published and exists (
  select 1 from public.assignments a
  join public.class_members m on m.class_id = a.class_id
  where a.exercise_id = id and m.student_id = auth.uid()
));

-- Assignments: teacher controls assignments in own classes; students can read assignments for their classes.
create policy "assignment_teacher_all" on public.assignments for all
using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()))
with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));
create policy "assignment_student_read" on public.assignments for select
using (exists (select 1 from public.class_members m where m.class_id = class_id and m.student_id = auth.uid()));

-- Submissions: students manage their own work; teachers can read submissions for assignments in their classes.
create policy "submission_student_select" on public.submissions for select using (student_id = auth.uid());
create policy "submission_student_insert" on public.submissions for insert with check (student_id = auth.uid());
create policy "submission_student_update" on public.submissions for update
using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "submission_teacher_read" on public.submissions for select
using (exists (
  select 1 from public.assignments a
  join public.classes c on c.id = a.class_id
  where a.id = assignment_id and c.teacher_id = auth.uid()
));

-- Production follow-up:
-- 1) Add a secure profile-creation trigger and teacher-role provisioning process.
-- 2) Implement class joining through a server-side function that validates join_code.
-- 3) Add rate limits and quotas for AI feedback.
-- 4) Test all RLS policies with separate teacher/student test accounts.
