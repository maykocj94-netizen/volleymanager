# Roadmap — Volley Manager

Desenvolvimento incremental em fases. Cada fase entrega algo jogável/testável.

## Fase 0 — Fundação ✅ (em andamento)
- [x] Monorepo, configs, .gitignore, README
- [x] Documentação base (arquitetura, roadmap, database)
- [ ] Schema SQL completo (enums, tabelas, índices, RLS, seed)
- [ ] Skeleton FastAPI (camadas, config, auth JWT, health)
- [ ] Skeleton PWA (Vite + React + TS + Tailwind + Shadcn, manifest, SW, tema dark)
- [ ] Package compartilhado de tipos

## Fase 1 — Domínio & Atletas
- [ ] Models ORM + migrations Alembic
- [ ] Geração procedural de atletas (nome, nacionalidade, atributos, potencial)
- [ ] CRUD de clubes e atletas
- [ ] Telas: elenco, perfil de atleta, atributos
- [ ] Cálculo de habilidade atual a partir dos 13 atributos por posição/modalidade

## Fase 2 — Engine de Partida
- [ ] Engine determinística por seed (rally a rally)
- [ ] Variáveis: atributos, entrosamento, moral, cansaço, clima, estratégia
- [ ] Narração textual via WebSocket
- [ ] Estatísticas de partida e persistência de eventos

## Fase 3 — Treino & Evolução
- [ ] Treinos por fundamento + carga semanal
- [ ] Evolução por treino/partidas/experiência/idade (curva de pico e declínio)
- [ ] Sistema de lesões (leve/moderada/grave por tipo)
- [ ] Entrosamento (química), especialmente para duplas de praia

## Fase 4 — Competições & CPU
- [ ] Ligas, torneios (mata-mata, grupos, pontos corridos)
- [ ] Temporadas, calendário, standings, premiações
- [ ] IA de treinador CPU (ofensivo/defensivo/equilibrado/agressivo/conservador)

## Fase 5 — Finanças & Centro de Treinamento
- [ ] Orçamento, receitas (patrocínio/premiação/bilheteria/venda) e despesas (salários/infra/staff)
- [ ] Instalações evolutivas (academia, quadras, médico, nutrição, psicologia, análise)

## Fase 6 — Mercado de Transferências
- [ ] Listagem, ofertas, compra/venda/empréstimo, contratos

## Fase 7 — Multiplayer & Ranking
- [ ] Convites, salas, sincronização de escalação/tática via WS
- [ ] Simulação autoritativa + anti-trapaça
- [ ] Rankings global/nacional/estadual e ligas de usuários

## Fase 8 — Seleções & Admin
- [ ] Convocações automáticas, Mundial/Olimpíadas/Liga das Nações
- [ ] Painel administrativo (eventos, ligas, banir, editar atletas/equipes)

## Fase 9 — Polish & PWA
- [ ] Offline parcial (cache de leitura, fila de ações)
- [ ] Instalação Android/iPhone, ícones, splash
- [ ] Performance, acessibilidade, testes E2E (Playwright) e unitários (engine)
