"""Models ORM: Athlete e AthleteAttributes."""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Athlete(Base):
    __tablename__ = "athletes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    club_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("clubs.id", ondelete="SET NULL"), nullable=True
    )
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    country: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    height_cm: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[int] = mapped_column(Integer, nullable=False)
    handedness: Mapped[str] = mapped_column(String, default="right")
    sex: Mapped[str] = mapped_column(String, nullable=False, default="male")
    modality: Mapped[str] = mapped_column(String, nullable=False)
    court_position: Mapped[str | None] = mapped_column(String, nullable=True)
    beach_position: Mapped[str | None] = mapped_column(String, nullable=True)
    current_ability: Mapped[int] = mapped_column(Integer, default=50)
    potential_ability: Mapped[int] = mapped_column(Integer, default=60)
    morale: Mapped[int] = mapped_column(Integer, default=70)
    fatigue: Mapped[int] = mapped_column(Integer, default=0)
    form: Mapped[int] = mapped_column(Integer, default=50)
    market_value: Mapped[int] = mapped_column(Integer, default=0)
    salary: Mapped[int] = mapped_column(Integer, default=0)
    contract_until: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_injured: Mapped[bool] = mapped_column(Boolean, default=False)
    # Desempenho acumulado (alimenta a valorização de venda no mercado).
    wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Atleta personalizado criado pelo jogador (aparece em Mercado → Contratações).
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Nível do atleta (LVL 1..999). Sobe ganhando/perdendo partidas (ganhar conta mais).
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    level_xp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Condição física: "ok" | "fatigued" (fadigado) | "injured" (lesionado).
    condition: Mapped[str] = mapped_column(String, default="ok", nullable=False)
    # Fadiga: jogos restantes de descanso (fora) até voltar; uso acumulado.
    rest_games_left: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    games_since_rest: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Lesão: até quando (tempo real) e sequência de jogos difíceis seguidos.
    injured_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hard_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Treino: último dia (real) em que treinou — limita a 1 treino por dia.
    last_trained_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Venda: atleta anunciado pelo jogador, aguardando aprovação do dono.
    for_sale: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sale_listed_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Marketplace de contratações: atleta veio de um anúncio do dono e expira
    # (tempo real) após o período de validade definido na publicação.
    listing_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    club: Mapped["Club | None"] = relationship(  # noqa: F821
        back_populates="athletes", lazy="joined"
    )
    attributes: Mapped["AthleteAttributes"] = relationship(
        back_populates="athlete", lazy="joined", cascade="all, delete-orphan", uselist=False
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def sale_value(self) -> int:
        """Preço de venda. Atleta NASCE bem desvalorizado (bem abaixo do custo de
        1000 de uma revelação, evitando o farm de comprar-e-vender) e se VALORIZA
        com o tempo: pelo nível (LVL) e pelas vitórias acumuladas; derrotas reduzem
        um pouco. A habilidade pesa pouco — o valor vem do desenvolvimento."""
        lvl = max(1, self.level or 1)
        wins = self.wins or 0
        losses = self.losses or 0
        value = 100 + lvl * 35 + wins * 28 + (self.current_ability or 50) * 2
        value -= losses * 12
        return max(50, round(value))


class AthleteAttributes(Base):
    __tablename__ = "athlete_attributes"

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("athletes.id", ondelete="CASCADE"),
        primary_key=True,
    )
    serve: Mapped[int] = mapped_column(Integer, default=50)
    attack: Mapped[int] = mapped_column(Integer, default=50)
    block: Mapped[int] = mapped_column(Integer, default=50)
    defense: Mapped[int] = mapped_column(Integer, default=50)
    reception: Mapped[int] = mapped_column(Integer, default=50)
    setting: Mapped[int] = mapped_column(Integer, default=50)
    speed: Mapped[int] = mapped_column(Integer, default=50)
    jump: Mapped[int] = mapped_column(Integer, default=50)
    stamina: Mapped[int] = mapped_column(Integer, default=50)
    positioning: Mapped[int] = mapped_column(Integer, default=50)
    decision: Mapped[int] = mapped_column(Integer, default=50)
    concentration: Mapped[int] = mapped_column(Integer, default=50)
    competitiveness: Mapped[int] = mapped_column(Integer, default=50)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    athlete: Mapped["Athlete"] = relationship(back_populates="attributes")
