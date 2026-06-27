"""Desafio Online X1 (polling): presença, convite, sala, partida e aposta.

Sem WebSocket — o cliente faz heartbeat periódico e o servidor mantém o estado
em `challenges`. O vencedor leva a aposta; registra vitória/derrota online.
"""

import random
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.match_engine import MatchContext, TeamUnit, simulate_match
from app.enums import Modality, Sex, Tactic, Weather
from app.models.athlete import Athlete
from app.models.challenge import Challenge
from app.models.club import Club
from app.models.user_state import UserState
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository
from app.services.match_service import build_unit

_TEAM_SIZE = {"beach": 2, "indoor": 6}
ONLINE_WINDOW = 30  # segundos para considerar um usuário "online"
_ACTIVE = ("pending", "accepted", "running")


class OnlineError(Exception):
    pass


class NotFound(Exception):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class OnlineService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserRepository(session)

    async def _club(self, user_id: uuid.UUID) -> Club | None:
        return await self.repo.get_main_club(user_id)

    async def _my_active(self, user_id: uuid.UUID) -> Challenge | None:
        """Desafio mais recente em que estou e que ainda importa (sala/resultado)."""
        rows = (
            await self.session.execute(
                select(Challenge).where(
                    or_(Challenge.challenger_id == user_id, Challenge.opponent_id == user_id),
                    Challenge.status.in_(("accepted", "running", "finished")),
                ).order_by(Challenge.updated_at.desc()).limit(1)
            )
        ).scalars().first()
        # Só mostra "finished" recente (até 60s) como lobby ativo.
        if rows and rows.status == "finished" and (_now() - _aware(rows.updated_at)).total_seconds() > 90:
            return None
        return rows

    async def heartbeat(self, user_id: uuid.UUID) -> dict:
        state = await self.repo.get_or_create_state(user_id)
        state.last_seen = _now()
        await self.session.flush()

        cutoff = _now() - timedelta(seconds=ONLINE_WINDOW)
        states = (
            await self.session.execute(
                select(UserState).where(
                    UserState.last_seen.is_not(None),
                    UserState.last_seen >= cutoff,
                    UserState.user_id != user_id,
                    UserState.approved.is_(True),
                )
            )
        ).scalars().all()
        online = []
        for st in states:
            club = await self._club(st.user_id)
            if club is None:
                continue
            online.append({
                "user_id": st.user_id, "team_name": club.name, "city": club.city,
                "reputation": club.reputation, "online_wins": st.online_wins,
                "online_losses": st.online_losses,
            })

        incoming = (
            await self.session.execute(
                select(Challenge).where(
                    Challenge.opponent_id == user_id, Challenge.status == "pending"
                )
            )
        ).scalars().all()
        outgoing = (
            await self.session.execute(
                select(Challenge).where(
                    Challenge.challenger_id == user_id, Challenge.status == "pending"
                )
            )
        ).scalars().all()
        active = await self._my_active(user_id)
        return {
            "online": online,
            "incoming": [self._chal_brief(c) for c in incoming],
            "outgoing": [self._chal_brief(c) for c in outgoing],
            "active_id": active.id if active else None,
        }

    def _chal_brief(self, c: Challenge) -> dict:
        return {
            "id": c.id, "challenger_id": c.challenger_id, "opponent_id": c.opponent_id,
            "challenger_name": c.challenger_name, "opponent_name": c.opponent_name,
            "kind": c.kind, "sex": c.sex, "bet_currency": c.bet_currency,
            "bet_amount": c.bet_amount, "status": c.status,
        }

    async def create_challenge(
        self, challenger_id: uuid.UUID, opponent_id: uuid.UUID,
        kind: str, sex: str, currency: str, amount: int,
    ) -> Challenge:
        if opponent_id == challenger_id:
            raise OnlineError("Você não pode desafiar a si mesmo.")
        # um desafio ativo por vez (como desafiante)
        existing = (
            await self.session.execute(
                select(Challenge).where(
                    or_(Challenge.challenger_id == challenger_id, Challenge.opponent_id == challenger_id),
                    Challenge.status.in_(_ACTIVE),
                )
            )
        ).scalars().first()
        if existing is not None:
            raise OnlineError("Você já tem um desafio em andamento.")
        my_club = await self._club(challenger_id)
        opp_club = await self._club(opponent_id)
        if my_club is None or opp_club is None:
            raise OnlineError("Ambos precisam ter um clube.")
        c = Challenge(
            id=uuid.uuid4(), challenger_id=challenger_id, opponent_id=opponent_id,
            challenger_name=my_club.name, opponent_name=opp_club.name,
            kind=kind, sex=sex, bet_currency=currency, bet_amount=max(0, int(amount)),
            status="pending",
        )
        self.session.add(c)
        await self.session.flush()
        return c

    async def _get(self, cid: uuid.UUID, user_id: uuid.UUID) -> Challenge:
        c = await self.session.get(Challenge, cid)
        if c is None or user_id not in (c.challenger_id, c.opponent_id):
            raise NotFound("Desafio não encontrado.")
        return c

    async def respond(self, cid: uuid.UUID, user_id: uuid.UUID, accept: bool) -> Challenge:
        c = await self._get(cid, user_id)
        if c.opponent_id != user_id:
            raise OnlineError("Só o desafiado pode responder.")
        if c.status != "pending":
            raise OnlineError("Este convite não está mais pendente.")
        c.status = "accepted" if accept else "declined"
        await self.session.flush()
        return c

    async def cancel(self, cid: uuid.UUID, user_id: uuid.UUID) -> Challenge:
        c = await self._get(cid, user_id)
        if c.status in ("finished", "declined", "cancelled"):
            return c
        c.status = "cancelled"
        await self.session.flush()
        return c

    async def _validate_lineup(self, c: Challenge, user_id: uuid.UUID, athlete_ids: list[uuid.UUID]):
        need = _TEAM_SIZE.get(c.kind, 2)
        if len(athlete_ids) != need:
            raise OnlineError(f"Escale exatamente {need} atleta(s) para esta categoria.")
        club = await self._club(user_id)
        repo = AthleteRepository(self.session)
        out = []
        for aid in athlete_ids:
            a = await repo.get(aid)
            if a is None or club is None or a.club_id != club.id:
                raise OnlineError("Atleta inválido (não é do seu elenco).")
            if a.sex != c.sex:
                raise OnlineError("Atleta do sexo errado para a categoria.")
            if not (a.beach_position if c.kind == "beach" else a.court_position):
                raise OnlineError("Atleta que não joga nesta modalidade.")
            out.append(a)
        return out

    async def set_lineup(
        self, cid: uuid.UUID, user_id: uuid.UUID, athlete_ids: list[uuid.UUID]
    ) -> Challenge:
        c = await self._get(cid, user_id)
        if c.status != "accepted":
            raise OnlineError("A sala não está aberta para escalar.")
        is_challenger = user_id == c.challenger_id
        if (c.challenger_ready if is_challenger else c.opponent_ready):
            raise OnlineError("Você já está pronto — não dá para trocar o time.")
        await self._validate_lineup(c, user_id, athlete_ids)
        ids = [str(a) for a in athlete_ids]
        if is_challenger:
            c.challenger_athletes = ids
        else:
            c.opponent_athletes = ids
        await self.session.flush()
        return c

    async def ready(self, cid: uuid.UUID, user_id: uuid.UUID) -> Challenge:
        c = await self._get(cid, user_id)
        if c.status != "accepted":
            raise OnlineError("A sala não está pronta.")
        is_challenger = user_id == c.challenger_id
        mine = c.challenger_athletes if is_challenger else c.opponent_athletes
        if len(mine or []) != _TEAM_SIZE.get(c.kind, 2):
            raise OnlineError("Escale seu time antes de ficar pronto.")
        # Precisa ter a aposta.
        state = await self.repo.get_or_create_state(user_id)
        bal = state.gold if c.bet_currency == "gold" else state.silver
        if c.bet_amount > 0 and bal < c.bet_amount:
            raise OnlineError(f"Você não tem {c.bet_amount} de {c.bet_currency} para a aposta.")
        if is_challenger:
            c.challenger_ready = True
        else:
            c.opponent_ready = True
        await self.session.flush()
        if c.challenger_ready and c.opponent_ready:
            await self._run(c)
        return c

    async def _team(self, name: str, ids: list, tactic: Tactic) -> tuple[TeamUnit, list[Athlete]]:
        repo = AthleteRepository(self.session)
        ath = [a for a in [await repo.get(uuid.UUID(i)) for i in ids] if a is not None]
        return build_unit(name, ath, tactic=tactic, chemistry=65), ath

    async def _run(self, c: Challenge) -> None:
        modality = (Modality.BEACH_M if c.kind == "beach" else Modality.INDOOR_M).with_sex(
            Sex.MALE if c.sex == "male" else Sex.FEMALE
        )
        home, home_ath = await self._team(c.challenger_name, c.challenger_athletes, Tactic.BALANCED)
        away, away_ath = await self._team(c.opponent_name, c.opponent_athletes, Tactic.BALANCED)
        weather = random.choice(list(Weather)) if c.kind == "beach" else None
        ctx = MatchContext(modality=modality, weather=weather, seed=secrets.randbits(48))
        result = simulate_match(home, away, ctx)

        home_won = result.winner == "home"
        winner_id = c.challenger_id if home_won else c.opponent_id
        loser_id = c.opponent_id if home_won else c.challenger_id
        win_ath = home_ath if home_won else away_ath
        lose_ath = away_ath if home_won else home_ath

        # Aposta: debita dos dois e credita o total ao vencedor.
        amt = c.bet_amount
        ws = await self.repo.get_or_create_state(winner_id)
        ls = await self.repo.get_or_create_state(loser_id)
        if amt > 0:
            if c.bet_currency == "gold":
                ls.gold = max(0, ls.gold - amt)
                ws.gold += amt  # já tinha a própria aposta; ganha a do outro
            else:
                ls.silver = max(0, ls.silver - amt)
                ws.silver += amt
        # Estatísticas online (usuários e atletas).
        ws.online_wins += 1
        ls.online_losses += 1
        for a in win_ath:
            a.online_wins += 1
        for a in lose_ath:
            a.online_losses += 1

        c.winner_id = winner_id
        c.score_home, c.score_away = result.home_sets, result.away_sets
        c.weather = weather.value if weather else None
        win_name = c.challenger_name if home_won else c.opponent_name
        c.result_text = f"{win_name} venceu por {result.home_sets} x {result.away_sets}"
        c.status = "finished"
        await self.session.flush()

    async def lobby(self, cid: uuid.UUID, user_id: uuid.UUID) -> dict:
        c = await self._get(cid, user_id)
        repo = AthleteRepository(self.session)

        async def athletes(ids: list) -> list[Athlete]:
            return [a for a in [await repo.get(uuid.UUID(i)) for i in (ids or [])] if a is not None]

        return {
            "challenge": c,
            "challenger_ath": await athletes(c.challenger_athletes),
            "opponent_ath": await athletes(c.opponent_athletes),
            "me_is_challenger": user_id == c.challenger_id,
        }
