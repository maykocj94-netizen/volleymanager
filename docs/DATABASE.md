# Banco de Dados — Volley Manager

PostgreSQL (Supabase). Schema declarativo em [`db/schema.sql`](../db/schema.sql), dados iniciais em [`db/seed.sql`](../db/seed.sql) e políticas RLS em [`db/policies.sql`](../db/policies.sql).

## Convenções

- Chaves primárias `uuid` (`gen_random_uuid()`), exceto tabelas de referência pequenas.
- `created_at` / `updated_at` em `timestamptz` com default `now()`.
- Enums nativos do Postgres para domínios fechados.
- Nomes de tabela em inglês, plural (`athletes`, `clubs`).
- Índices em todas as FKs e colunas de filtro frequente.

## Enums

| Enum | Valores |
|---|---|
| `modality` | `beach_m`, `beach_f`, `indoor_m`, `indoor_f` |
| `court_position` | `setter`, `opposite`, `outside`, `middle`, `libero` |
| `beach_position` | `defender`, `blocker`, `universal` |
| `handedness` | `left`, `right` |
| `injury_severity` | `light`, `moderate`, `severe` |
| `injury_type` | `ankle`, `knee`, `shoulder`, `wrist`, `spine` |
| `weather` | `sunny`, `cloudy`, `rain`, `light_wind`, `strong_wind` |
| `tactic` | `very_offensive`, `offensive`, `balanced`, `defensive`, `very_defensive` |
| `cpu_profile` | `offensive`, `defensive`, `balanced`, `aggressive`, `conservative` |
| `match_status` | `scheduled`, `live`, `finished`, `cancelled` |
| `competition_format` | `knockout`, `groups`, `round_robin` |
| `transfer_type` | `buy`, `sell`, `loan` |

## Grupos de tabelas

### Identidade
- **profiles** — 1:1 com `auth.users` (Supabase). Apelido, país, papel (`user`/`admin`), datas.

### Equipes
- **clubs** — nome, escudo, país/cidade, modalidade, reputação, torcida, dono (`profile`).
- **club_finances** — saldo, receitas/despesas agregadas por temporada.
- **facilities** — níveis de academia, quadras, médico, nutrição, psicologia, análise.
- **staff** — comissão técnica (cargo, qualidade, salário).
- **sponsorships** — patrocínios ativos (valor, duração).

### Atletas
- **athletes** — dados pessoais, modalidade, posição, mão, altura/peso, club_id, moral, cansaço, forma, habilidade atual/potencial.
- **athlete_attributes** — os 13 atributos (0–100), 1:1 com athlete.
- **injuries** — histórico/atual (tipo, severidade, retorno previsto).
- **partnerships** — entrosamento entre dois atletas (nível 0–100, partidas juntos).

### Competição
- **competitions** — liga/torneio, modalidade, formato, nível (amador→mundial), dono.
- **seasons** — ano, status.
- **tournaments / groups / rounds / fixtures** — estrutura de jogos.
- **standings** — classificação por temporada/grupo.

### Partidas
- **matches** — modalidade, clima, seed, status, placar, clubes/duplas, tática de cada lado.
- **match_sets** — placar por set.
- **match_events** — narração (minuto/rally, texto, tipo, autor).
- **lineups** — escalação por partida/lado.

### Mercado
- **transfer_listings** — atletas à venda/empréstimo.
- **transfers** — operações concluídas.
- **contract_offers** — propostas de contrato.

### Multiplayer
- **challenges** — convites entre usuários.
- **match_rooms** — salas (estado, modalidade).
- **room_players** — participantes, escalação, tática, `ready`.

### Ranking / Ligas
- **rankings** — pontuação por escopo (global/nacional/estadual).
- **leagues / league_members** — ligas criadas por usuários.

### Seleções
- **national_teams** — por país/modalidade.
- **call_ups** — convocações.

### Admin
- **audit_log**, **bans**, **events**.

## Segurança (RLS)

- `profiles`: usuário lê/edita o próprio registro; admin lê todos.
- `clubs`/`athletes`: dono gerencia; leitura pública de dados não sensíveis.
- Operações de jogo (simulação, mercado, finanças) passam **apenas** pelo backend com `service_role`, não diretamente pelo cliente.
