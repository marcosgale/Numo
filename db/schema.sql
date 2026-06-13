-- ============================================
-- NUMO — Esquema de base de datos
-- PostgreSQL (Supabase)
-- ============================================

-- ============================================
-- TABLAS
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

-- ============================================
-- TRIGGERS
-- ============================================

-- Crea automáticamente la fila en profiles cuando se registra un nuevo usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, birth_date)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    to_date(new.raw_user_meta_data ->> 'birth_date', 'DD/MM/YYYY')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- FUNCIÓN AUXILIAR (anti-recursión RLS de grupos)
-- ============================================

create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = _group_id
      and user_id = _user_id
  );
$$;

-- ============================================
-- POLÍTICAS RLS — Tablas personales
-- ============================================

-- PROFILES
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- CATEGORIES
create policy "Users can view own categories"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "Users can insert own categories"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update own categories"
  on public.categories for update
  using (auth.uid() = user_id);

create policy "Users can delete own categories"
  on public.categories for delete
  using (auth.uid() = user_id);

-- GOALS
create policy "Users can view own goals"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.goals for update
  using (auth.uid() = user_id);

create policy "Users can delete own goals"
  on public.goals for delete
  using (auth.uid() = user_id);

-- LIMITS
create policy "Users can view own limits"
  on public.limits for select
  using (auth.uid() = user_id);

create policy "Users can insert own limits"
  on public.limits for insert
  with check (auth.uid() = user_id);

create policy "Users can update own limits"
  on public.limits for update
  using (auth.uid() = user_id);

create policy "Users can delete own limits"
  on public.limits for delete
  using (auth.uid() = user_id);

-- TRANSACTIONS
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- ============================================
-- POLÍTICAS RLS — Tablas de grupos
-- ============================================

-- GROUPS
create policy "Users can view groups they belong to"
  on public.groups for select
  using (public.is_group_member(id, auth.uid()));

create policy "Users can create groups"
  on public.groups for insert
  with check (auth.uid() = created_by);

create policy "Members can update groups they belong to"
  on public.groups for update
  using (public.is_group_member(id, auth.uid()));

-- GROUP_MEMBERS
create policy "Users can view members of their groups"
  on public.group_members for select
  using (public.is_group_member(group_id, auth.uid()));

create policy "Users can join groups"
  on public.group_members for insert
  with check (auth.uid() = user_id);

create policy "Users can leave their groups"
  on public.group_members for delete
  using (auth.uid() = user_id);

-- GROUP_EXPENSES
create policy "Members can view group expenses"
  on public.group_expenses for select
  using (public.is_group_member(group_id, auth.uid()));

create policy "Members can create group expenses"
  on public.group_expenses for insert
  with check (public.is_group_member(group_id, auth.uid()));

create policy "Payer can update their group expenses"
  on public.group_expenses for update
  using (auth.uid() = paid_by);

create policy "Payer can delete their group expenses"
  on public.group_expenses for delete
  using (auth.uid() = paid_by);

-- GROUP_EXPENSE_SPLITS
create policy "Members can view splits of their group expenses"
  on public.group_expense_splits for select
  using (
    exists (
      select 1
      from public.group_expenses ge
      where ge.id = group_expense_id
        and public.is_group_member(ge.group_id, auth.uid())
    )
  );

create policy "Members can create splits"
  on public.group_expense_splits for insert
  with check (
    exists (
      select 1
      from public.group_expenses ge
      where ge.id = group_expense_id
        and public.is_group_member(ge.group_id, auth.uid())
    )
  );

create policy "Users can update own paid status"
  on public.group_expense_splits for update
  using (auth.uid() = user_id);

-- ============================================
-- GRANT permisos al rol authenticated
-- ============================================

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.limits to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.group_expenses to authenticated;
grant select, insert, update, delete on public.group_expense_splits to authenticated;