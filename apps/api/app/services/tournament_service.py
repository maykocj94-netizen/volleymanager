"""Serviço de Competições (torneios).

Fluxo: dono cria -> usuários se inscrevem (atletas travados) -> dono inicia
(gera o chaveamento/tabela) -> dono define os resultados -> dono finaliza e a
premiação é creditada nas carteiras.

Estágio atual: formato "Pontos Corridos" (round_robin) completo. Mata-mata,
Grupos e Repescagem reutilizam esta base (em desenvolvimento).
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.athlete import Athlete
from app.models.tournament import Tournament, TournamentEntry, TournamentMatch
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository

_TEAM_SIZE = {"beach": 2, "indoor": 6}
WIN_POINTS = 3

# Famílias de estágios de cada "chave" de mata-mata (para avanço e colocação).
# round = rodadas intermediárias, final = decisão, bronze = disputa de 3º.
_BRACKETS = {
    "main": {"round": "ko", "final": "final", "bronze": "bronze"},
    "rep": {"round": "rep", "final": "rep_final", "bronze": None},
}


def _seed_order(size: int) -> list[int]:
    """Ordem de chaveamento padrão (1-based) para `size` (potência de 2):
    distribui os byes de forma equilibrada (1 enfrenta o último, etc.)."""
    seeds = [1]
    while len(seeds) < size:
        m = len(seeds) * 2 + 1
        nxt: list[int] = []
        for s in seeds:
            nxt.append(s)
            nxt.append(m - s)
        seeds = nxt
    return seeds


def _next_pow2(n: int) -> int:
    p = 1
    while p < n:
        p *= 2
    return p


class TournamentError(Exception):
    """Erro de regra do torneio (inscrição inválida, estado errado, etc.)."""


class NotFound(Exception):
    pass


class TournamentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ---- consultas -------------------------------------------------------
    async def list_for_users(self) -> list[dict]:
        rows = (
            await self.session.execute(select(Tournament).order_by(Tournament.created_at.desc()))
        ).scalars().all()
        out = []
        for t in rows:
            count = await self._entry_count(t.id)
            out.append(self._tour_dict(t, count))
        return out

    async def _entry_count(self, tid: uuid.UUID) -> int:
        from sqlalchemy import func
        return int(
            await self.session.scalar(
                select(func.count()).select_from(TournamentEntry).where(
                    TournamentEntry.tournament_id == tid
                )
            ) or 0
        )

    async def get_entries(self, tid: uuid.UUID) -> list[TournamentEntry]:
        return list(
            (
                await self.session.execute(
                    select(TournamentEntry).where(TournamentEntry.tournament_id == tid)
                )
            ).scalars().all()
        )

    async def get_matches(self, tid: uuid.UUID) -> list[TournamentMatch]:
        return list(
            (
                await self.session.execute(
                    select(TournamentMatch).where(TournamentMatch.tournament_id == tid)
                    .order_by(TournamentMatch.round_no, TournamentMatch.order)
                )
            ).scalars().all()
        )

    async def get(self, tid: uuid.UUID) -> Tournament:
        t = await self.session.get(Tournament, tid)
        if t is None:
            raise NotFound("Torneio não encontrado.")
        return t

    def _tour_dict(self, t: Tournament, entry_count: int) -> dict:
        return {
            "id": t.id, "title": t.title, "subtitle": t.subtitle, "image_url": t.image_url,
            "type": t.type, "kind": t.kind, "sex": t.sex, "slots": t.slots,
            "num_groups": t.num_groups, "teams_per_group": t.teams_per_group,
            "advance_per_group": t.advance_per_group,
            "prize_silver_1": t.prize_silver_1, "prize_silver_2": t.prize_silver_2,
            "prize_silver_3": t.prize_silver_3, "prize_gold_1": t.prize_gold_1,
            "prize_gold_2": t.prize_gold_2, "prize_gold_3": t.prize_gold_3,
            "status": t.status, "entry_count": entry_count, "team_size": _TEAM_SIZE.get(t.kind, 2),
        }

    # ---- dono ------------------------------------------------------------
    async def create(self, data: dict) -> Tournament:
        t = Tournament(
            id=uuid.uuid4(),
            title=data["title"],
            subtitle=data.get("subtitle"),
            image_url=data.get("image_url"),
            type=data.get("type", "round_robin"),
            kind=data.get("kind", "beach"),
            sex=data.get("sex", "male"),
            slots=int(data.get("slots", 8)),
            num_groups=int(data.get("num_groups", 2)),
            teams_per_group=int(data.get("teams_per_group", 4)),
            advance_per_group=int(data.get("advance_per_group", 2)),
            prize_silver_1=int(data.get("prize_silver_1", 0)),
            prize_silver_2=int(data.get("prize_silver_2", 0)),
            prize_silver_3=int(data.get("prize_silver_3", 0)),
            prize_gold_1=int(data.get("prize_gold_1", 0)),
            prize_gold_2=int(data.get("prize_gold_2", 0)),
            prize_gold_3=int(data.get("prize_gold_3", 0)),
            status="open",
        )
        if t.type == "groups":
            t.slots = t.num_groups * t.teams_per_group
        self.session.add(t)
        await self.session.flush()
        return t

    async def delete(self, tid: uuid.UUID) -> None:
        t = await self.get(tid)
        for e in await self.get_entries(tid):
            await self.session.delete(e)
        for m in await self.get_matches(tid):
            await self.session.delete(m)
        await self.session.delete(t)

    async def start(self, tid: uuid.UUID) -> Tournament:
        """Fecha as inscrições e gera a tabela/chaveamento."""
        t = await self.get(tid)
        if t.status != "open":
            raise TournamentError("O torneio já foi iniciado.")
        entries = await self.get_entries(tid)
        if len(entries) < 2:
            raise TournamentError("Precisa de pelo menos 2 inscritos para iniciar.")
        if t.type == "round_robin":
            self._gen_round_robin(t, entries)
        elif t.type == "knockout":
            await self._gen_knockout(t, entries, bracket="main", with_bronze=True)
        elif t.type == "repechage":
            await self._gen_knockout(t, entries, bracket="main", with_bronze=False)
        elif t.type == "groups":
            self._gen_groups(t, entries)
        else:
            raise TournamentError("Formato de torneio desconhecido.")
        t.status = "running"
        await self.session.flush()
        return t

    def _gen_round_robin(self, t: Tournament, entries: list[TournamentEntry]) -> None:
        """Todos contra todos (uma vez)."""
        order = 0
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                a, b = entries[i], entries[j]
                order += 1
                self.session.add(TournamentMatch(
                    id=uuid.uuid4(), tournament_id=t.id, stage="rr", round_no=1, order=order,
                    entry_a_id=a.id, entry_b_id=b.id, a_name=a.team_name, b_name=b.team_name,
                    status="pending",
                ))

    def _gen_groups(self, t: Tournament, entries: list[TournamentEntry]) -> None:
        """Distribui em grupos (serpentina) e gera todos-contra-todos por grupo."""
        g = max(1, t.num_groups)
        groups: list[list[TournamentEntry]] = [[] for _ in range(g)]
        for idx, e in enumerate(entries):
            e.group_no = (idx % g) + 1
            groups[idx % g].append(e)
        order = 0
        for gi, grp in enumerate(groups):
            for i in range(len(grp)):
                for j in range(i + 1, len(grp)):
                    a, b = grp[i], grp[j]
                    order += 1
                    self.session.add(TournamentMatch(
                        id=uuid.uuid4(), tournament_id=t.id, stage="group", group_no=gi + 1,
                        round_no=1, order=order, entry_a_id=a.id, entry_b_id=b.id,
                        a_name=a.team_name, b_name=b.team_name, status="pending",
                    ))

    async def _gen_knockout(
        self, t: Tournament, entries: list[TournamentEntry], *, bracket: str, with_bronze: bool
    ) -> None:
        """Gera um chaveamento mata-mata com byes equilibrados e (opcional) disputa de 3º."""
        cfg = _BRACKETS[bracket]
        n = len(entries)
        if n < 2:
            return
        size = _next_pow2(n)
        rounds = size.bit_length() - 1
        seeds = _seed_order(size)
        slots = [entries[s - 1] if s <= n else None for s in seeds]

        r1: list[TournamentMatch] = []
        for i in range(size // 2):
            a, b = slots[2 * i], slots[2 * i + 1]
            stage = cfg["final"] if rounds == 1 else cfg["round"]
            m = TournamentMatch(
                id=uuid.uuid4(), tournament_id=t.id, stage=stage, round_no=1, order=i,
                entry_a_id=a.id if a else None, entry_b_id=b.id if b else None,
                a_name=a.team_name if a else "(bye)", b_name=b.team_name if b else "(bye)",
                status="pending",
            )
            self.session.add(m)
            r1.append(m)
        for r in range(2, rounds + 1):
            for i in range(size // (2 ** r)):
                stage = cfg["final"] if r == rounds else cfg["round"]
                self.session.add(TournamentMatch(
                    id=uuid.uuid4(), tournament_id=t.id, stage=stage, round_no=r, order=i,
                    a_name="A definir", b_name="A definir", status="pending",
                ))
        if with_bronze and cfg["bronze"] and rounds >= 2:
            self.session.add(TournamentMatch(
                id=uuid.uuid4(), tournament_id=t.id, stage=cfg["bronze"], round_no=rounds, order=99,
                a_name="Perdedor da semi", b_name="Perdedor da semi", status="pending",
            ))
        await self.session.flush()
        # Resolve byes (lado vazio): o time presente avança automaticamente.
        for m in r1:
            if (m.entry_a_id is None) ^ (m.entry_b_id is None):
                win = m.entry_a_id or m.entry_b_id
                m.winner_entry_id = win
                m.score_a, m.score_b = (1, 0) if m.entry_a_id else (0, 1)
                m.status = "done"
                await self._advance_knockout(m)
        await self.session.flush()

    async def _place(self, match: TournamentMatch, entry_id: uuid.UUID, *, side_a: bool) -> None:
        e = await self.session.get(TournamentEntry, entry_id)
        name = e.team_name if e else "—"
        if side_a:
            match.entry_a_id, match.a_name = entry_id, name
        else:
            match.entry_b_id, match.b_name = entry_id, name

    async def _advance_knockout(self, m: TournamentMatch) -> None:
        bracket = "rep" if m.stage in ("rep", "rep_final") else "main"
        cfg = _BRACKETS[bracket]
        round_stages = (cfg["round"], cfg["final"])
        if m.stage not in round_stages or m.winner_entry_id is None:
            return
        final_round = await self.session.scalar(
            select(func.max(TournamentMatch.round_no)).where(
                TournamentMatch.tournament_id == m.tournament_id,
                TournamentMatch.stage.in_(round_stages),
            )
        )
        winner = m.winner_entry_id
        loser = m.entry_a_id if winner == m.entry_b_id else m.entry_b_id
        if final_round and m.round_no < final_round:
            nxt = (
                await self.session.execute(
                    select(TournamentMatch).where(
                        TournamentMatch.tournament_id == m.tournament_id,
                        TournamentMatch.stage.in_(round_stages),
                        TournamentMatch.round_no == m.round_no + 1,
                        TournamentMatch.order == m.order // 2,
                    )
                )
            ).scalars().first()
            if nxt is not None:
                await self._place(nxt, winner, side_a=(m.order % 2 == 0))
        # Perdedor da semifinal vai para a disputa de 3º.
        if cfg["bronze"] and final_round and m.round_no == final_round - 1 and loser:
            bronze = (
                await self.session.execute(
                    select(TournamentMatch).where(
                        TournamentMatch.tournament_id == m.tournament_id,
                        TournamentMatch.stage == cfg["bronze"],
                    )
                )
            ).scalars().first()
            if bronze is not None:
                await self._place(bronze, loser, side_a=(m.order == 0))

    async def advance_phase(self, tid: uuid.UUID) -> Tournament:
        """Gera a próxima fase: grupos -> mata-mata dos classificados; repescagem
        -> chave dos eliminados (após a final da chave principal)."""
        t = await self.get(tid)
        if t.status != "running":
            raise TournamentError("O torneio não está em andamento.")
        matches = await self.get_matches(tid)
        entries = await self.get_entries(tid)
        if t.type == "groups":
            if any(m.stage in ("ko", "final", "bronze") for m in matches):
                raise TournamentError("A fase final já foi gerada.")
            group_m = [m for m in matches if m.stage == "group"]
            if not group_m or any(m.status != "done" for m in group_m):
                raise TournamentError("Conclua todas as partidas dos grupos primeiro.")
            qualifiers: list[TournamentEntry] = []
            for gi in range(1, t.num_groups + 1):
                grp = self._rank([e for e in entries if e.group_no == gi])
                qualifiers.extend(grp[: t.advance_per_group])
            if len(qualifiers) < 2:
                raise TournamentError("Classificados insuficientes para a fase final.")
            await self._gen_knockout(t, qualifiers, bracket="main", with_bronze=True)
        elif t.type == "repechage":
            if any(m.stage in ("rep", "rep_final") for m in matches):
                raise TournamentError("A repescagem já foi gerada.")
            final_m = next((m for m in matches if m.stage == "final"), None)
            if final_m is None or final_m.status != "done":
                raise TournamentError("Conclua a chave principal (até a final) primeiro.")
            finalists = {final_m.entry_a_id, final_m.entry_b_id}
            eliminated = [e for e in entries if e.id not in finalists]
            if len(eliminated) < 2:
                raise TournamentError("Não há eliminados suficientes para a repescagem.")
            await self._gen_knockout(t, eliminated, bracket="rep", with_bronze=False)
        else:
            raise TournamentError("Este formato não tem fase adicional.")
        await self.session.flush()
        return t

    async def set_result(
        self, tid: uuid.UUID, match_id: uuid.UUID, score_a: int, score_b: int
    ) -> TournamentMatch:
        t = await self.get(tid)
        if t.status != "running":
            raise TournamentError("O torneio não está em andamento.")
        m = await self.session.get(TournamentMatch, match_id)
        if m is None or m.tournament_id != tid:
            raise NotFound("Partida não encontrada.")
        if m.entry_a_id is None or m.entry_b_id is None:
            raise TournamentError("Partida ainda sem os dois times definidos.")
        if score_a == score_b:
            raise TournamentError("Não pode haver empate — defina um vencedor.")

        # Reverte standings se já estava definida (permite corrigir).
        if m.status == "done":
            await self._apply_standings(m, revert=True)

        m.score_a, m.score_b = int(score_a), int(score_b)
        m.winner_entry_id = m.entry_a_id if score_a > score_b else m.entry_b_id
        m.status = "done"
        await self._apply_standings(m, revert=False)
        if m.stage in ("ko", "final", "rep", "rep_final"):
            await self._advance_knockout(m)
        await self.session.flush()
        return m

    async def _apply_standings(self, m: TournamentMatch, *, revert: bool) -> None:
        """Atualiza pontos/sets dos dois times (round_robin/grupos)."""
        if m.stage not in ("rr", "group"):
            return
        a = await self.session.get(TournamentEntry, m.entry_a_id)
        b = await self.session.get(TournamentEntry, m.entry_b_id)
        if a is None or b is None:
            return
        sa, sb = int(m.score_a or 0), int(m.score_b or 0)
        sign = -1 if revert else 1
        win, lose = (a, b) if sa > sb else (b, a)
        ws, ls = (sa, sb) if sa > sb else (sb, sa)
        win.points += sign * WIN_POINTS
        win.wins += sign * 1
        win.sets_won += sign * ws
        win.sets_lost += sign * ls
        lose.losses += sign * 1
        lose.sets_won += sign * ls
        lose.sets_lost += sign * ws

    async def finish(self, tid: uuid.UUID) -> Tournament:
        """Define as colocações e credita a premiação nas carteiras."""
        t = await self.get(tid)
        if t.status == "finished":
            raise TournamentError("Torneio já finalizado.")
        if t.status != "running":
            raise TournamentError("Inicie o torneio antes de finalizar.")
        entries = await self.get_entries(tid)

        if t.type == "round_robin":
            ranked = self._rank(entries)
            for idx, e in enumerate(ranked):
                e.placement = idx + 1
            podium: list[TournamentEntry | None] = list(ranked[:3])
        else:
            podium = await self._bracket_podium(t, entries)

        prizes = [
            (t.prize_silver_1, t.prize_gold_1),
            (t.prize_silver_2, t.prize_gold_2),
            (t.prize_silver_3, t.prize_gold_3),
        ]
        repo = UserRepository(self.session)
        for idx in range(3):
            w = podium[idx] if idx < len(podium) else None
            if w is None:
                continue
            w.placement = idx + 1
            silver, gold = prizes[idx]
            if silver or gold:
                state = await repo.get_or_create_state(w.user_id)
                state.silver += int(silver)
                state.gold += int(gold)
        t.status = "finished"
        await self.session.flush()
        return t

    async def _bracket_podium(
        self, t: Tournament, entries: list[TournamentEntry]
    ) -> list[TournamentEntry | None]:
        matches = await self.get_matches(t.id)
        by_id = {e.id: e for e in entries}
        final_m = next((m for m in matches if m.stage == "final"), None)
        if final_m is None or final_m.status != "done":
            raise TournamentError("Defina o resultado da FINAL antes de finalizar.")
        first = by_id.get(final_m.winner_entry_id)
        loser = final_m.entry_a_id if final_m.winner_entry_id == final_m.entry_b_id else final_m.entry_b_id
        second = by_id.get(loser)
        third_stage = "rep_final" if t.type == "repechage" else "bronze"
        bm = next((m for m in matches if m.stage == third_stage), None)
        third = by_id.get(bm.winner_entry_id) if bm and bm.status == "done" and bm.winner_entry_id else None
        return [first, second, third]

    @staticmethod
    def _rank(entries: list[TournamentEntry]) -> list[TournamentEntry]:
        """Classificação: pontos, depois saldo de sets, depois sets ganhos."""
        return sorted(
            entries,
            key=lambda e: (e.points, e.sets_won - e.sets_lost, e.sets_won),
            reverse=True,
        )

    # ---- usuário ---------------------------------------------------------
    async def register(
        self, user_id: uuid.UUID, tid: uuid.UUID, athlete_ids: list[uuid.UUID]
    ) -> TournamentEntry:
        t = await self.get(tid)
        if t.status != "open":
            raise TournamentError("As inscrições deste torneio estão encerradas.")
        entries = await self.get_entries(tid)
        if any(e.user_id == user_id for e in entries):
            raise TournamentError("Você já está inscrito neste torneio.")
        if len(entries) >= t.slots:
            raise TournamentError("As vagas deste torneio já se esgotaram.")

        need = _TEAM_SIZE.get(t.kind, 2)
        if len(athlete_ids) != need:
            raise TournamentError(f"Escale exatamente {need} atleta(s) para esta categoria.")

        repo = UserRepository(self.session)
        club = await repo.get_main_club(user_id)
        if club is None:
            raise TournamentError("Você precisa de um clube para participar.")
        athlete_repo = AthleteRepository(self.session)
        chosen: list[Athlete] = []
        for aid in athlete_ids:
            a = await athlete_repo.get(aid)
            if a is None or a.club_id != club.id:
                raise TournamentError("Atleta inválido (não é do seu elenco).")
            if a.sex != t.sex:
                raise TournamentError("Há atleta do sexo errado para a categoria do torneio.")
            pos_ok = a.beach_position if t.kind == "beach" else a.court_position
            if not pos_ok:
                raise TournamentError("Há atleta que não joga nesta modalidade.")
            chosen.append(a)

        entry = TournamentEntry(
            id=uuid.uuid4(), tournament_id=tid, user_id=user_id, club_id=club.id,
            team_name=club.name, athlete_ids=[str(a.id) for a in chosen],
        )
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def my_entry(self, user_id: uuid.UUID, tid: uuid.UUID) -> TournamentEntry | None:
        return (
            await self.session.execute(
                select(TournamentEntry).where(
                    TournamentEntry.tournament_id == tid, TournamentEntry.user_id == user_id
                )
            )
        ).scalars().first()
