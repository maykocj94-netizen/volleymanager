-- =====================================================================
-- VOLLEY MANAGER — Row Level Security (Supabase)
-- Aplicar após schema.sql: psql "$DATABASE_URL" -f db/policies.sql
--
-- Regra geral: o cliente lê dados públicos e gerencia o que é seu.
-- Operações de jogo (simulação, finanças, mercado) passam pelo backend
-- com a service_role, que ignora RLS.
-- =====================================================================

-- Helper: usuário é admin?
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$ language sql stable security definer;

-- PROFILES -------------------------------------------------------------
alter table profiles enable row level security;

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select using (true);                       -- perfis são públicos (username, país)

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles
  for insert with check (auth.uid() = id);

-- CLUBS ----------------------------------------------------------------
alter table clubs enable row level security;

drop policy if exists clubs_select on clubs;
create policy clubs_select on clubs
  for select using (true);                       -- leitura pública

drop policy if exists clubs_modify_owner on clubs;
create policy clubs_modify_owner on clubs
  for all using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

-- ATHLETES -------------------------------------------------------------
alter table athletes enable row level security;

drop policy if exists athletes_select on athletes;
create policy athletes_select on athletes
  for select using (true);

drop policy if exists athletes_modify_owner on athletes;
create policy athletes_modify_owner on athletes
  for all using (
    is_admin() or club_id in (select id from clubs where owner_id = auth.uid())
  ) with check (
    is_admin() or club_id in (select id from clubs where owner_id = auth.uid())
  );

-- ATHLETE_ATTRIBUTES (leitura pública; escrita só backend/admin) -------
alter table athlete_attributes enable row level security;

drop policy if exists attr_select on athlete_attributes;
create policy attr_select on athlete_attributes
  for select using (true);

drop policy if exists attr_modify_admin on athlete_attributes;
create policy attr_modify_admin on athlete_attributes
  for all using (is_admin()) with check (is_admin());

-- CHALLENGES (multiplayer) ---------------------------------------------
alter table challenges enable row level security;

drop policy if exists challenges_select on challenges;
create policy challenges_select on challenges
  for select using (from_user = auth.uid() or to_user = auth.uid());

drop policy if exists challenges_insert on challenges;
create policy challenges_insert on challenges
  for insert with check (from_user = auth.uid());

drop policy if exists challenges_update_target on challenges;
create policy challenges_update_target on challenges
  for update using (to_user = auth.uid() or from_user = auth.uid());

-- RANKINGS / leagues: leitura pública -----------------------------------
alter table rankings enable row level security;
drop policy if exists rankings_select on rankings;
create policy rankings_select on rankings for select using (true);

alter table leagues enable row level security;
drop policy if exists leagues_select on leagues;
create policy leagues_select on leagues for select using (true);
drop policy if exists leagues_modify_owner on leagues;
create policy leagues_modify_owner on leagues
  for all using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

-- NOTA: tabelas de simulação (matches, match_events, finances, transfers...)
-- não recebem políticas de escrita para o cliente. São manipuladas pelo
-- backend via service_role. Se quiser leitura pública, habilite RLS e
-- adicione policies `for select using (true)` conforme a necessidade.
