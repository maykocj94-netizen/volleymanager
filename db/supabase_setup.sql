-- =====================================================================
-- VOLLEY MANAGER — Setup do banco no Supabase (Postgres)
-- Cole TUDO isto no Supabase → SQL Editor → New query → Run.
-- Corresponde exatamente aos modelos usados pela API hoje
-- (clubs, user_state, athletes, athlete_attributes).
-- Idempotente: pode rodar de novo sem apagar dados.
-- =====================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- CLUBES
-- owner_id = id do usuário no Supabase Auth (auth.users.id). null = CPU.
-- ---------------------------------------------------------------------
create table if not exists clubs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  name        text not null,
  short_name  text,
  crest_url   text,
  country     text not null,
  city        text,
  modality    text not null,
  reputation  integer not null default 50,
  fanbase     integer not null default 1000,
  is_cpu      boolean not null default false,
  cpu_profile text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_clubs_owner on clubs(owner_id);

-- ---------------------------------------------------------------------
-- ESTADO DO JOGADOR (carteira, login diário, stats de partidas, escalações)
-- user_id = id do usuário no Supabase Auth (auth.users.id).
-- ---------------------------------------------------------------------
create table if not exists user_state (
  user_id        uuid primary key,
  silver         integer not null default 3000,
  gold           integer not null default 0,
  streak         integer not null default 0,
  last_login     date,
  matches_played integer not null default 0,
  matches_won    integer not null default 0,
  matches_lost   integer not null default 0,
  lineup         jsonb   not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ATLETAS
-- ---------------------------------------------------------------------
create table if not exists athletes (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid references clubs(id) on delete set null,
  first_name        text not null,
  last_name         text not null,
  country           text not null,
  city              text,
  birth_date        date not null,
  height_cm         integer not null,
  weight_kg         integer not null,
  handedness        text not null default 'right',
  sex               text not null default 'male',
  modality          text not null,
  court_position    text,
  beach_position    text,
  current_ability   integer not null default 50,
  potential_ability integer not null default 60,
  morale            integer not null default 70,
  fatigue           integer not null default 0,
  form              integer not null default 50,
  market_value      integer not null default 0,
  salary            integer not null default 0,
  contract_until    integer,
  is_injured        boolean not null default false,
  wins              integer not null default 0,
  losses            integer not null default 0,
  is_custom         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_athletes_club     on athletes(club_id);
create index if not exists idx_athletes_modality on athletes(modality);
create index if not exists idx_athletes_custom   on athletes(is_custom) where is_custom;

-- ---------------------------------------------------------------------
-- ATRIBUTOS (1–1 com o atleta)
-- ---------------------------------------------------------------------
create table if not exists athlete_attributes (
  athlete_id      uuid primary key references athletes(id) on delete cascade,
  serve           integer not null default 50,
  attack          integer not null default 50,
  block           integer not null default 50,
  defense         integer not null default 50,
  reception       integer not null default 50,
  setting         integer not null default 50,
  speed           integer not null default 50,
  jump            integer not null default 50,
  stamina         integer not null default 50,
  positioning     integer not null default 50,
  decision        integer not null default 50,
  concentration   integer not null default 50,
  competitiveness integer not null default 50,
  updated_at      timestamptz not null default now()
);

-- =====================================================================
-- Observações:
-- • A API conecta via DATABASE_URL (usuário postgres) e é o ÚNICO cliente
--   do banco — o navegador NÃO acessa o Postgres direto. Por isso não é
--   necessário habilitar RLS para o jogo funcionar.
-- • O Supabase Auth cuida do cadastro/login; owner_id/user_id guardam o
--   auth.users.id do jogador.
-- =====================================================================
