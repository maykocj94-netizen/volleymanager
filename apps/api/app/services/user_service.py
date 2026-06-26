"""Regra de negócio do jogador: carteira, login diário, contratação, escalação."""

import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import Modality
from app.models.athlete import Athlete
from app.models.user_state import (
    HIRE_COST,
    LOGIN_STREAK_BONUS,
    LOGIN_STREAK_TARGET,
    UserState,
)
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository
from app.services.athlete_service import AthleteService


class InsufficientFunds(Exception):
    """Saldo de prata insuficiente para a operação."""


class NotFound(Exception):
    """Recurso inexistente ou não pertence ao jogador."""


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserRepository(session)

    async def get_state(self, user_id: uuid.UUID) -> UserState:
        return await self.repo.get_or_create_state(user_id)

    async def daily_login(self, user_id: uuid.UUID) -> tuple[UserState, bool]:
        """Registra o login do dia e aplica o bônus de sequência de 7 dias."""
        state = await self.repo.get_or_create_state(user_id)
        today = date.today()
        bonus = False
        if state.last_login != today:
            if state.last_login == today - timedelta(days=1):
                state.streak += 1
            else:
                state.streak = 1
            state.last_login = today
            if state.streak >= LOGIN_STREAK_TARGET:
                state.silver += LOGIN_STREAK_BONUS
                state.streak = 0
                bonus = True
        return state, bonus

    async def simulate_next_day(self, user_id: uuid.UUID) -> tuple[UserState, bool]:
        """DEV: avança um dia consecutivo (para testar o bônus de 7 dias)."""
        state = await self.repo.get_or_create_state(user_id)
        state.streak += 1
        bonus = False
        if state.streak >= LOGIN_STREAK_TARGET:
            state.silver += LOGIN_STREAK_BONUS
            state.streak = 0
            bonus = True
        state.last_login = date.today()
        return state, bonus

    async def set_lineup(self, user_id: uuid.UUID, lineup: dict[str, list[str]]) -> UserState:
        """Salva as escalações por categoria (beach_m/beach_f/indoor_m/indoor_f)."""
        state = await self.repo.get_or_create_state(user_id)
        keys = ("beach_m", "beach_f", "indoor_m", "indoor_f")
        state.lineup = {k: list(lineup.get(k, [])) for k in keys}
        return state

    async def hire(
        self, user_id: uuid.UUID, modality: Modality
    ) -> tuple[Athlete, UserState]:
        """Contrata 1 revelação (sexo aleatório) cobrando prata.

        A `modality` informada define apenas a disciplina (praia/quadra); o sexo
        do atleta é sorteado — pode vir masculino ou feminino.
        """
        state = await self.repo.get_or_create_state(user_id)
        if state.silver < HIRE_COST:
            raise InsufficientFunds(f"Precisa de {HIRE_COST} de prata (tem {state.silver}).")

        club = await self.repo.get_main_club(user_id)
        athlete_service = AthleteService(AthleteRepository(self.session))
        athletes = await athlete_service.generate(
            modality=modality,
            count=1,
            club_id=club.id if club else None,
            random_sex=True,
        )
        state.silver -= HIRE_COST
        return athletes[0], state

    async def record_match_result(
        self, user_id: uuid.UUID, won: bool, athlete_ids: list[uuid.UUID]
    ) -> UserState:
        """Registra o resultado de uma partida: atualiza stats do jogador e o
        desempenho (e o valor de mercado) dos atletas escalados."""
        state = await self.repo.get_or_create_state(user_id)
        state.matches_played += 1
        if won:
            state.matches_won += 1
        else:
            state.matches_lost += 1

        athlete_repo = AthleteRepository(self.session)
        for aid in athlete_ids:
            athlete = await athlete_repo.get(aid)
            if athlete is None:
                continue
            if won:
                athlete.wins += 1
            else:
                athlete.losses += 1
            athlete.market_value = athlete.sale_value
        return state

    async def sell_athlete(
        self, user_id: uuid.UUID, athlete_id: uuid.UUID
    ) -> tuple[int, UserState]:
        """Vende um atleta do elenco do jogador; credita prata pelo valor de venda."""
        state = await self.repo.get_or_create_state(user_id)
        club = await self.repo.get_main_club(user_id)
        athlete_repo = AthleteRepository(self.session)
        athlete = await athlete_repo.get(athlete_id)
        if athlete is None or club is None or athlete.club_id != club.id:
            raise NotFound("Atleta não encontrado no seu elenco.")
        value = athlete.sale_value
        state.silver += value
        await athlete_repo.delete(athlete)
        return value, state

    async def sign_custom(
        self, user_id: uuid.UUID, athlete_id: uuid.UUID
    ) -> tuple[Athlete, UserState]:
        """Contrata um atleta personalizado (Contratações) para o clube do jogador."""
        state = await self.repo.get_or_create_state(user_id)
        club = await self.repo.get_main_club(user_id)
        athlete_repo = AthleteRepository(self.session)
        athlete = await athlete_repo.get(athlete_id)
        if athlete is None or not athlete.is_custom or athlete.club_id is not None:
            raise NotFound("Atleta personalizado indisponível.")
        cost = athlete.market_value or athlete.sale_value
        if state.silver < cost:
            raise InsufficientFunds(f"Precisa de {cost} de prata (tem {state.silver}).")
        state.silver -= cost
        athlete.club_id = club.id if club else None
        return athlete, state
