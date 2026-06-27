"""Geração procedural de atletas — determinística por seed.

Pura (sem I/O): recebe pools de nomes e devolve estruturas de dados.
O service persiste o resultado.
"""

import random
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.enums import BeachPosition, CourtPosition, Handedness, Modality, Sex

# Pools de fallback caso o banco de referência esteja vazio.
_FALLBACK_FIRST_M = ["Mayko", "Bruno", "Lucas", "Gabriel", "Marco", "Bartosz", "Yuki"]
_FALLBACK_FIRST_F = ["Carol", "Juliana", "Ana", "Mariana", "Sarah", "Emily", "Tainá"]
_FALLBACK_LAST = ["Silva", "Santos", "Oliveira", "Souza", "Rossi", "Johnson", "Kowalski"]

# Pesos de atributos por posição: definem o "molde" do atleta gerado.
_COURT_WEIGHTS: dict[CourtPosition, dict[str, float]] = {
    CourtPosition.SETTER: {"setting": 1.0, "decision": 0.9, "speed": 0.8, "defense": 0.6},
    CourtPosition.OPPOSITE: {"attack": 1.0, "block": 0.8, "serve": 0.8, "jump": 0.9},
    CourtPosition.OUTSIDE: {"attack": 0.9, "reception": 0.9, "defense": 0.8, "serve": 0.7},
    CourtPosition.MIDDLE: {"block": 1.0, "jump": 0.9, "attack": 0.7, "speed": 0.7},
    CourtPosition.LIBERO: {"reception": 1.0, "defense": 1.0, "positioning": 0.9, "speed": 0.8},
}

_BEACH_WEIGHTS: dict[BeachPosition, dict[str, float]] = {
    BeachPosition.DEFENDER: {"defense": 1.0, "reception": 0.9, "speed": 0.9, "positioning": 0.9},
    BeachPosition.BLOCKER: {"block": 1.0, "jump": 0.9, "attack": 0.8, "serve": 0.7},
    BeachPosition.UNIVERSAL: {"attack": 0.85, "defense": 0.85, "block": 0.8, "reception": 0.8},
}

_ALL_ATTRS = [
    "serve", "attack", "block", "defense", "reception", "setting",
    "speed", "jump", "stamina", "positioning", "decision",
    "concentration", "competitiveness",
]


@dataclass
class GeneratedAttributes:
    serve: int = 50
    attack: int = 50
    block: int = 50
    defense: int = 50
    reception: int = 50
    setting: int = 50
    speed: int = 50
    jump: int = 50
    stamina: int = 50
    positioning: int = 50
    decision: int = 50
    concentration: int = 50
    competitiveness: int = 50


@dataclass
class GeneratedAthlete:
    first_name: str
    last_name: str
    country: str
    birth_date: date
    height_cm: int
    weight_kg: int
    handedness: Handedness
    sex: Sex
    modality: Modality
    court_position: CourtPosition | None
    beach_position: BeachPosition | None
    current_ability: int
    potential_ability: int
    attributes: GeneratedAttributes = field(default_factory=GeneratedAttributes)


@dataclass
class NamePool:
    first_m: list[str]
    first_f: list[str]
    last: list[str]


def _default_pool() -> NamePool:
    return NamePool(_FALLBACK_FIRST_M, _FALLBACK_FIRST_F, _FALLBACK_LAST)


def _clamp(v: float, lo: int = 1, hi: int = 99) -> int:
    return max(lo, min(hi, int(round(v))))


def _gen_one(
    rng: random.Random,
    modality: Modality,
    country: str,
    pool: NamePool,
    today: date,
    random_sex: bool = False,
    max_ability: int | None = None,
) -> GeneratedAthlete:
    # Sexo: segue a modalidade, salvo quando `random_sex` (revelação às cegas),
    # em que sorteamos e ajustamos a modalidade para o sexo escolhido.
    if random_sex:
        sex = Sex.FEMALE if rng.random() < 0.5 else Sex.MALE
        modality = modality.with_sex(sex)
    else:
        sex = modality.sex
    female = sex is Sex.FEMALE
    first = rng.choice(pool.first_f if female else pool.first_m)
    last = rng.choice(pool.last)

    # Idade 16–34, enviesada para jovens (mais material para evoluir).
    age = int(16 + (34 - 16) * rng.betavariate(2, 3))
    birth = today - timedelta(days=age * 365 + rng.randint(0, 364))

    height = rng.randint(168, 188) if female else rng.randint(178, 205)
    weight = int(height * rng.uniform(0.40, 0.46))
    hand = Handedness.LEFT if rng.random() < 0.12 else Handedness.RIGHT

    # Posição
    court_pos = beach_pos = None
    if modality.is_indoor:
        court_pos = rng.choice(list(CourtPosition))
        weights = _COURT_WEIGHTS[court_pos]
    else:
        beach_pos = rng.choice(list(BeachPosition))
        weights = _BEACH_WEIGHTS[beach_pos]

    # Base de talento (média) e potencial.
    base = rng.gauss(58, 10)
    potential = _clamp(max(base, base + rng.uniform(5, 30)), 35, 99)

    attrs = GeneratedAttributes()
    for attr in _ALL_ATTRS:
        w = weights.get(attr, 0.5)
        raw = base * (0.7 + 0.6 * w) + rng.gauss(0, 6)
        setattr(attrs, attr, _clamp(raw))

    # Revelação (max_ability): nenhum atributo passa do teto, mantendo a forma
    # relativa por posição — o atleta nasce fraco e evolui depois.
    if max_ability is not None:
        for attr in _ALL_ATTRS:
            setattr(attrs, attr, _clamp(getattr(attrs, attr), 1, max_ability))

    # Habilidade atual = média ponderada pela posição, limitada ao potencial.
    weighted = sum(getattr(attrs, a) * weights.get(a, 0.5) for a in _ALL_ATTRS)
    total_w = sum(weights.get(a, 0.5) for a in _ALL_ATTRS)
    hi = max_ability if max_ability is not None else 99
    current = _clamp(min(weighted / total_w, potential, hi), 20, hi)

    return GeneratedAthlete(
        first_name=first,
        last_name=last,
        country=country,
        birth_date=birth,
        height_cm=height,
        weight_kg=weight,
        handedness=hand,
        sex=sex,
        modality=modality,
        court_position=court_pos,
        beach_position=beach_pos,
        current_ability=current,
        potential_ability=potential,
        attributes=attrs,
    )


def generate_athletes(
    *,
    modality: Modality,
    count: int,
    seed: int,
    country: str = "BRA",
    pool: NamePool | None = None,
    today: date | None = None,
    random_sex: bool = False,
    max_ability: int | None = None,
) -> list[GeneratedAthlete]:
    """Gera `count` atletas de forma determinística a partir de `seed`.

    Se `random_sex` for True, o sexo de cada atleta é sorteado (e a modalidade
    ajustada), usado na contratação de revelações às cegas. `max_ability` limita
    a pontuação final (revelação nasce fraca, teto 55).
    """
    rng = random.Random(seed)
    pool = pool or _default_pool()
    today = today or date.today()
    return [
        _gen_one(rng, modality, country, pool, today, random_sex, max_ability)
        for _ in range(count)
    ]
