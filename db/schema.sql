-- =====================================================================
-- VOLLEY MANAGER — Schema PostgreSQL (Supabase)
-- Aplicar com: psql "$DATABASE_URL" -f db/schema.sql
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type modality            as enum ('beach_m','beach_f','indoor_m','indoor_f');
  create type court_position      as enum ('setter','opposite','outside','middle','libero');
  create type beach_position      as enum ('defender','blocker','universal');
  create type handedness          as enum ('left','right');
  create type injury_severity     as enum ('light','moderate','severe');
  create type injury_type         as enum ('ankle','knee','shoulder','wrist','spine');
  create type weather             as enum ('sunny','cloudy','rain','light_wind','strong_wind');
  create type tactic              as enum ('very_offensive','offensive','balanced','defensive','very_defensive');
  create type cpu_profile         as enum ('offensive','defensive','balanced','aggressive','conservative');
  create type match_status        as enum ('scheduled','live','finished','cancelled');
  create type competition_format  as enum ('knockout','groups','round_robin');
  create type competition_tier    as enum ('amateur','state','national','world');
  create type transfer_type       as enum ('buy','sell','loan');
  create type user_role           as enum ('user','admin');
  create type challenge_status    as enum ('pending','accepted','declined','expired');
  create type room_status         as enum ('open','setup','ready','live','finished');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- IDENTIDADE
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  display_name text,
  country     text,
  role        user_role not null default 'user',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- EQUIPES
-- ---------------------------------------------------------------------
create table if not exists clubs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references profiles(id) on delete set null,  -- null = clube da CPU
  name        text not null,
  short_name  text,
  crest_url   text,
  country     text not null,
  city        text,
  modality    modality not null,
  reputation  int not null default 50 check (reputation between 0 and 100),
  fanbase     int not null default 1000,
  is_cpu      boolean not null default false,
  cpu_profile cpu_profile,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_clubs_owner    on clubs(owner_id);
create index if not exists idx_clubs_modality on clubs(modality);

create table if not exists club_finances (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  season_year int not null,
  balance     bigint not null default 0,           -- centavos
  income      bigint not null default 0,
  expenses    bigint not null default 0,
  updated_at  timestamptz not null default now(),
  unique (club_id, season_year)
);
create index if not exists idx_finances_club on club_finances(club_id);

create table if not exists facilities (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade unique,
  gym         int not null default 1 check (gym between 1 and 10),
  courts      int not null default 1 check (courts between 1 and 10),
  medical     int not null default 1 check (medical between 1 and 10),
  nutrition   int not null default 1 check (nutrition between 1 and 10),
  psychology  int not null default 1 check (psychology between 1 and 10),
  analysis    int not null default 1 check (analysis between 1 and 10),
  updated_at  timestamptz not null default now()
);

create table if not exists staff (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,
  role        text not null,                       -- assistente, preparador, fisio...
  quality     int not null default 50 check (quality between 0 and 100),
  salary      bigint not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_staff_club on staff(club_id);

create table if not exists sponsorships (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  sponsor_name text not null,
  amount      bigint not null,
  per_season  boolean not null default true,
  starts_year int not null,
  ends_year   int not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_sponsor_club on sponsorships(club_id);

-- ---------------------------------------------------------------------
-- ATLETAS
-- ---------------------------------------------------------------------
create table if not exists athletes (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid references clubs(id) on delete set null,  -- null = agente livre
  first_name      text not null,
  last_name       text not null,
  country         text not null,
  city            text,
  birth_date      date not null,
  height_cm       int  not null check (height_cm between 140 and 230),
  weight_kg       int  not null check (weight_kg between 40 and 160),
  handedness      handedness not null default 'right',
  modality        modality not null,
  court_position  court_position,                  -- preenchido se modalidade indoor
  beach_position  beach_position,                  -- preenchido se modalidade beach
  current_ability int not null default 50 check (current_ability between 0 and 100),
  potential_ability int not null default 60 check (potential_ability between 0 and 100),
  morale          int not null default 70 check (morale between 0 and 100),
  fatigue         int not null default 0  check (fatigue between 0 and 100),
  form            int not null default 50 check (form between 0 and 100),
  market_value    bigint not null default 0,
  salary          bigint not null default 0,
  contract_until  int,                             -- ano
  is_injured      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (
    (modality in ('indoor_m','indoor_f') and court_position is not null and beach_position is null) or
    (modality in ('beach_m','beach_f')   and beach_position is not null and court_position is null)
  )
);
create index if not exists idx_athletes_club     on athletes(club_id);
create index if not exists idx_athletes_modality on athletes(modality);
create index if not exists idx_athletes_country  on athletes(country);

create table if not exists athlete_attributes (
  athlete_id      uuid primary key references athletes(id) on delete cascade,
  serve           int not null default 50 check (serve between 0 and 100),
  attack          int not null default 50 check (attack between 0 and 100),
  block           int not null default 50 check (block between 0 and 100),
  defense         int not null default 50 check (defense between 0 and 100),
  reception       int not null default 50 check (reception between 0 and 100),
  setting         int not null default 50 check (setting between 0 and 100),
  speed           int not null default 50 check (speed between 0 and 100),
  jump            int not null default 50 check (jump between 0 and 100),
  stamina         int not null default 50 check (stamina between 0 and 100),
  positioning     int not null default 50 check (positioning between 0 and 100),
  decision        int not null default 50 check (decision between 0 and 100),
  concentration   int not null default 50 check (concentration between 0 and 100),
  competitiveness int not null default 50 check (competitiveness between 0 and 100),
  updated_at      timestamptz not null default now()
);

create table if not exists injuries (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references athletes(id) on delete cascade,
  type         injury_type not null,
  severity     injury_severity not null,
  occurred_at  date not null default current_date,
  return_at    date,                               -- previsão de retorno
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_injuries_athlete on injuries(athlete_id);
create index if not exists idx_injuries_active  on injuries(athlete_id) where active;

-- Entrosamento (química) — relevante sobretudo no vôlei de praia
create table if not exists partnerships (
  id           uuid primary key default gen_random_uuid(),
  athlete_a    uuid not null references athletes(id) on delete cascade,
  athlete_b    uuid not null references athletes(id) on delete cascade,
  chemistry    int not null default 0 check (chemistry between 0 and 100),
  matches_together int not null default 0,
  updated_at   timestamptz not null default now(),
  check (athlete_a <> athlete_b),
  unique (athlete_a, athlete_b)
);
create index if not exists idx_partnership_a on partnerships(athlete_a);
create index if not exists idx_partnership_b on partnerships(athlete_b);

-- ---------------------------------------------------------------------
-- COMPETIÇÃO
-- ---------------------------------------------------------------------
create table if not exists competitions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references profiles(id) on delete set null,
  name        text not null,
  modality    modality not null,
  format      competition_format not null,
  tier        competition_tier not null default 'amateur',
  country     text,
  region      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_competitions_modality on competitions(modality);

create table if not exists seasons (
  id            uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  year          int not null,
  is_current    boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (competition_id, year)
);
create index if not exists idx_seasons_competition on seasons(competition_id);

create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references seasons(id) on delete cascade,
  name        text not null
);

create table if not exists fixtures (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references seasons(id) on delete cascade,
  group_id    uuid references groups(id) on delete set null,
  round_no    int not null default 1,
  home_club   uuid references clubs(id) on delete set null,
  away_club   uuid references clubs(id) on delete set null,
  match_id    uuid,                                -- preenchido após simular
  scheduled_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_fixtures_season on fixtures(season_id);

create table if not exists standings (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references seasons(id) on delete cascade,
  group_id    uuid references groups(id) on delete set null,
  club_id     uuid not null references clubs(id) on delete cascade,
  played      int not null default 0,
  wins        int not null default 0,
  losses      int not null default 0,
  sets_for    int not null default 0,
  sets_against int not null default 0,
  points      int not null default 0,
  unique (season_id, club_id)
);
create index if not exists idx_standings_season on standings(season_id);

-- ---------------------------------------------------------------------
-- PARTIDAS
-- ---------------------------------------------------------------------
create table if not exists matches (
  id            uuid primary key default gen_random_uuid(),
  modality      modality not null,
  status        match_status not null default 'scheduled',
  season_id     uuid references seasons(id) on delete set null,
  home_club     uuid references clubs(id) on delete set null,
  away_club     uuid references clubs(id) on delete set null,
  home_tactic   tactic not null default 'balanced',
  away_tactic   tactic not null default 'balanced',
  weather       weather,
  seed          bigint not null,                   -- determinismo
  home_sets     int not null default 0,
  away_sets     int not null default 0,
  is_multiplayer boolean not null default false,
  room_id       uuid,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_matches_status on matches(status);
create index if not exists idx_matches_season on matches(season_id);

create table if not exists match_sets (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches(id) on delete cascade,
  set_no      int not null,
  home_points int not null default 0,
  away_points int not null default 0,
  unique (match_id, set_no)
);

create table if not exists match_events (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches(id) on delete cascade,
  set_no      int not null default 1,
  rally_no    int not null default 0,
  event_type  text not null,                       -- serve, reception, set, attack, block, point...
  side        text,                                -- home / away
  athlete_id  uuid references athletes(id) on delete set null,
  text        text not null,                       -- narração
  created_at  timestamptz not null default now()
);
create index if not exists idx_events_match on match_events(match_id);

create table if not exists lineups (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches(id) on delete cascade,
  club_id     uuid references clubs(id) on delete set null,
  side        text not null,                       -- home / away
  athlete_id  uuid not null references athletes(id) on delete cascade,
  slot        int not null,
  unique (match_id, side, slot)
);
create index if not exists idx_lineups_match on lineups(match_id);

-- ---------------------------------------------------------------------
-- MERCADO DE TRANSFERÊNCIAS
-- ---------------------------------------------------------------------
create table if not exists transfer_listings (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references athletes(id) on delete cascade,
  selling_club uuid references clubs(id) on delete cascade,
  ask_price   bigint not null,
  loan        boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_listings_active on transfer_listings(active) where active;

create table if not exists transfers (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references athletes(id) on delete cascade,
  from_club   uuid references clubs(id) on delete set null,
  to_club     uuid references clubs(id) on delete set null,
  type        transfer_type not null,
  fee         bigint not null default 0,
  season_year int not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_transfers_athlete on transfers(athlete_id);

create table if not exists contract_offers (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references athletes(id) on delete cascade,
  club_id     uuid not null references clubs(id) on delete cascade,
  salary      bigint not null,
  years       int not null default 1,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- MULTIPLAYER
-- ---------------------------------------------------------------------
create table if not exists challenges (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid not null references profiles(id) on delete cascade,
  to_user     uuid not null references profiles(id) on delete cascade,
  modality    modality not null,
  status      challenge_status not null default 'pending',
  created_at  timestamptz not null default now(),
  check (from_user <> to_user)
);
create index if not exists idx_challenges_to on challenges(to_user, status);

create table if not exists match_rooms (
  id          uuid primary key default gen_random_uuid(),
  modality    modality not null,
  status      room_status not null default 'open',
  match_id    uuid references matches(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists room_players (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references match_rooms(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  club_id     uuid references clubs(id) on delete set null,
  side        text not null,                       -- home / away
  tactic      tactic not null default 'balanced',
  ready       boolean not null default false,
  unique (room_id, user_id)
);
create index if not exists idx_room_players_room on room_players(room_id);

-- ---------------------------------------------------------------------
-- RANKING / LIGAS
-- ---------------------------------------------------------------------
create table if not exists rankings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  modality    modality not null,
  scope       text not null default 'global',      -- global / national / state
  scope_key   text,                                -- país/UF quando aplicável
  points      int not null default 0,
  updated_at  timestamptz not null default now(),
  unique (user_id, modality, scope, scope_key)
);
create index if not exists idx_rankings_scope on rankings(modality, scope, scope_key, points desc);

create table if not exists leagues (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references profiles(id) on delete set null,
  name        text not null,
  tier        competition_tier not null default 'amateur',
  modality    modality not null,
  created_at  timestamptz not null default now()
);

create table if not exists league_members (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references leagues(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  club_id     uuid references clubs(id) on delete set null,
  joined_at   timestamptz not null default now(),
  unique (league_id, user_id)
);

-- ---------------------------------------------------------------------
-- SELEÇÕES NACIONAIS
-- ---------------------------------------------------------------------
create table if not exists national_teams (
  id          uuid primary key default gen_random_uuid(),
  country     text not null,
  modality    modality not null,
  unique (country, modality)
);

create table if not exists call_ups (
  id          uuid primary key default gen_random_uuid(),
  national_team_id uuid not null references national_teams(id) on delete cascade,
  athlete_id  uuid not null references athletes(id) on delete cascade,
  season_year int not null,
  unique (national_team_id, athlete_id, season_year)
);

-- ---------------------------------------------------------------------
-- ADMIN
-- ---------------------------------------------------------------------
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,
  entity      text,
  entity_id   uuid,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_actor on audit_log(actor_id);

create table if not exists bans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  reason      text,
  until       timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TRIGGER: updated_at automático
-- ---------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

do $$
declare t text;
begin
  for t in
    select unnest(array['profiles','clubs','athletes','athlete_attributes','partnerships'])
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on %1$s;
       create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;
