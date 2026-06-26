-- =====================================================================
-- VOLLEY MANAGER — Schema atual (Postgres/Supabase)
--
-- ⚠️ OPCIONAL: você NÃO precisa rodar este SQL. O backend (FastAPI) cria
-- estas tabelas automaticamente no primeiro start em produção
-- (AUTO_CREATE_TABLES=true). Este arquivo serve apenas como referência ou
-- caso você queira pré-criar o schema manualmente.
--
-- Gerado a partir dos models ORM atuais (4 tabelas). Não usa a tabela
-- "profiles" nem RLS, pois o cliente fala com o backend (não direto com o
-- banco) e o backend conecta com o usuário postgres (ignora RLS).
-- =====================================================================

CREATE TABLE IF NOT EXISTS clubs (
    id UUID NOT NULL,
    owner_id UUID,
    name VARCHAR NOT NULL,
    short_name VARCHAR,
    crest_url VARCHAR,
    country VARCHAR NOT NULL,
    city VARCHAR,
    modality VARCHAR NOT NULL,
    reputation INTEGER NOT NULL,
    fanbase INTEGER NOT NULL,
    is_cpu BOOLEAN NOT NULL,
    cpu_profile VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS user_state (
    user_id UUID NOT NULL,
    silver INTEGER NOT NULL,
    gold INTEGER NOT NULL,
    streak INTEGER NOT NULL,
    last_login DATE,
    matches_played INTEGER NOT NULL,
    matches_won INTEGER NOT NULL,
    matches_lost INTEGER NOT NULL,
    lineup JSON NOT NULL,
    scenario JSON NOT NULL,
    reroll_week_start DATE,
    reroll_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS athletes (
    id UUID NOT NULL,
    club_id UUID,
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    country VARCHAR NOT NULL,
    city VARCHAR,
    birth_date DATE NOT NULL,
    height_cm INTEGER NOT NULL,
    weight_kg INTEGER NOT NULL,
    handedness VARCHAR NOT NULL,
    sex VARCHAR NOT NULL,
    modality VARCHAR NOT NULL,
    court_position VARCHAR,
    beach_position VARCHAR,
    current_ability INTEGER NOT NULL,
    potential_ability INTEGER NOT NULL,
    morale INTEGER NOT NULL,
    fatigue INTEGER NOT NULL,
    form INTEGER NOT NULL,
    market_value INTEGER NOT NULL,
    salary INTEGER NOT NULL,
    contract_until INTEGER,
    is_injured BOOLEAN NOT NULL,
    wins INTEGER NOT NULL,
    losses INTEGER NOT NULL,
    is_custom BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS athlete_attributes (
    athlete_id UUID NOT NULL,
    serve INTEGER NOT NULL,
    attack INTEGER NOT NULL,
    block INTEGER NOT NULL,
    defense INTEGER NOT NULL,
    reception INTEGER NOT NULL,
    setting INTEGER NOT NULL,
    speed INTEGER NOT NULL,
    jump INTEGER NOT NULL,
    stamina INTEGER NOT NULL,
    positioning INTEGER NOT NULL,
    decision INTEGER NOT NULL,
    concentration INTEGER NOT NULL,
    competitiveness INTEGER NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (athlete_id),
    FOREIGN KEY (athlete_id) REFERENCES athletes (id) ON DELETE CASCADE
);
