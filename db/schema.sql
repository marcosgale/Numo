-- ============================================
-- NUMO — Esquema de base de datos
-- PostgreSQL (Supabase)
-- ============================================

-- Perfiles de usuario (extiende auth.users de Supabase)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  first_name text,
  last_name text,
  birth_date date,
  avatar_url text,
  currency text default 'EUR',
  created_at timestamptz default now()
);

-- Categorías de gastos/ingresos (propiedad del usuario)
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  icon text,
  color text,
  type text not null check (type in ('expense', 'income'))
);

-- Grupos para gastos compartidos
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  emoji text,
  created_by uuid references public.profiles(id) on delete set null,
  invite_code text unique not null,
  created_at timestamptz default now()
);

-- Metas de ahorro
create table public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  target_amount numeric(12,2) not null,
  current_amount numeric(12,2) default 0 not null,
  deadline date,
  emoji text,
  created_at timestamptz default now()
);

-- Límites de gasto por categoría
create table public.limits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  amount numeric(12,2) not null,
  period text not null check (period in ('daily', 'weekly', 'monthly')),
  created_at timestamptz default now()
);

-- Miembros de grupos (junction table N:M entre groups y profiles)
create table public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique (group_id, user_id)
);

-- Gastos compartidos de un grupo
create table public.group_expenses (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  paid_by uuid references public.profiles(id) on delete set null,
  amount numeric(12,2) not null,
  description text not null,
  date date not null,
  created_at timestamptz default now()
);

-- Reparto de cada gasto compartido entre miembros
create table public.group_expense_splits (
  id uuid default gen_random_uuid() primary key,
  group_expense_id uuid references public.group_expenses(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete set null,
  amount numeric(12,2) not null,
  is_paid boolean default false not null,
  unique (group_expense_id, user_id)
);

-- Movimientos personales (tabla central)
-- group_expense_id: NULL = movimiento personal;
-- con valor = reflejo automático de un gasto compartido
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(12,2) not null,
  type text not null check (type in ('expense', 'income')),
  description text,
  date date not null,
  is_recurring boolean default false not null,
  group_expense_id uuid references public.group_expenses(id) on delete cascade,
  created_at timestamptz default now()
);