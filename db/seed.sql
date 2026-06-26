-- =====================================================================
-- VOLLEY MANAGER — Seed mínimo (referências para geração procedural)
-- Aplicar após schema.sql: psql "$DATABASE_URL" -f db/seed.sql
-- =====================================================================

-- Tabelas de referência usadas pelo gerador procedural de atletas.
create table if not exists ref_countries (
  code text primary key,             -- ISO-3
  name text not null,
  strength int not null default 50   -- influencia qualidade média dos atletas gerados
);

create table if not exists ref_names (
  id      bigserial primary key,
  country text not null,             -- ISO-3 (ou '*' genérico)
  kind    text not null,             -- 'first' | 'last'
  gender  text,                      -- 'm' | 'f' | null (qualquer)
  value   text not null
);
create index if not exists idx_ref_names on ref_names(country, kind, gender);

insert into ref_countries (code, name, strength) values
  ('BRA','Brasil',92),
  ('USA','Estados Unidos',80),
  ('ITA','Itália',85),
  ('POL','Polônia',88),
  ('FRA','França',82),
  ('ARG','Argentina',74),
  ('JPN','Japão',76),
  ('NOR','Noruega',79),
  ('GER','Alemanha',77),
  ('NED','Holanda',75)
on conflict (code) do nothing;

insert into ref_names (country, kind, gender, value) values
  ('BRA','first','m','Mayko'), ('BRA','first','m','Bruno'), ('BRA','first','m','Lucas'),
  ('BRA','first','m','Gabriel'), ('BRA','first','m','Thiago'), ('BRA','first','m','Rafael'),
  ('BRA','first','f','Carol'), ('BRA','first','f','Juliana'), ('BRA','first','f','Ana'),
  ('BRA','first','f','Mariana'), ('BRA','first','f','Tainá'), ('BRA','first','f','Beatriz'),
  ('BRA','last',null,'Silva'), ('BRA','last',null,'Santos'), ('BRA','last',null,'Oliveira'),
  ('BRA','last',null,'Souza'), ('BRA','last',null,'Costa'), ('BRA','last',null,'Pereira'),
  ('ITA','first','m','Marco'), ('ITA','first','m','Luca'), ('ITA','last',null,'Rossi'),
  ('POL','first','m','Bartosz'), ('POL','first','m','Wilfredo'), ('POL','last',null,'Kowalski'),
  ('USA','first','f','Sarah'), ('USA','first','f','Emily'), ('USA','last',null,'Johnson')
on conflict do nothing;

-- Patrocinadores genéricos (pool para club sponsorships)
create table if not exists ref_sponsors (
  id    bigserial primary key,
  name  text not null,
  tier  int not null default 1   -- 1 pequeno .. 5 global
);
insert into ref_sponsors (name, tier) values
  ('Praia Sports', 1), ('AquaWear', 2), ('NetPro', 2),
  ('VoltEnergyDrink', 3), ('Atlântico Bank', 4), ('Global Airlines', 5)
on conflict do nothing;
