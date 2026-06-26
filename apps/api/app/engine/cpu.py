"""CPU adversária: cenário da partida (dificuldade, clima, tática) e nomes
procedurais da dupla/sexteto. Puro e determinístico por seed.

As faixas de força foram calibradas (medição empírica) para que, contra um time
típico (~78), o jogador vença ~100% no Fácil e <10% no Brutal — ou seja, do
"Difícil" para cima é realmente desafiador.
"""

import random

from app.enums import Sex, Tactic, Weather

# Pools de nomes para a CPU (estilo brasileiro, variados).
_FIRST_M = [
    "Gabriel", "Wanderson", "Bruno", "Lucas", "Thiago", "Rafael", "Vinícius",
    "Matheus", "Felipe", "Rodrigo", "Diego", "André", "Caio", "Pedro", "Léo",
    "Renan", "Maurício", "Otávio", "Iago", "Murilo", "Anderson", "Everton",
]
_FIRST_F = [
    "Carol", "Juliana", "Ana", "Mariana", "Tainá", "Beatriz", "Larissa",
    "Fernanda", "Patrícia", "Camila", "Bruna", "Letícia", "Gabriela", "Duda",
    "Vitória", "Sabrina", "Renata", "Talita", "Yasmin", "Manuela",
]
_LAST = [
    "Diniz", "Chagas", "Silva", "Santos", "Oliveira", "Souza", "Costa",
    "Pereira", "Almeida", "Ferreira", "Rocha", "Barbosa", "Nunes", "Cardoso",
    "Teixeira", "Moraes", "Lima", "Araújo", "Cavalcante", "Schmidt", "Pimenta",
]

# Níveis de dificuldade → faixa de força da CPU (0–100).
TIER_ORDER = ["facil", "medio", "dificil", "muito_dificil", "brutal"]
TIER_BASE: dict[str, tuple[int, int]] = {
    "facil": (45, 56),
    "medio": (60, 71),
    "dificil": (78, 85),
    "muito_dificil": (88, 92),
    "brutal": (95, 99),
}
TIER_LABEL: dict[str, str] = {
    "facil": "Fácil",
    "medio": "Médio",
    "dificil": "Difícil",
    "muito_dificil": "Muito difícil",
    "brutal": "Brutal",
}
# Frequência de cada nível ao sortear (às vezes fácil, às vezes brutal).
_TIER_WEIGHTS = [0.22, 0.30, 0.25, 0.15, 0.08]


def roll_scenario(seed: int | None = None) -> dict:
    """Sorteia um cenário de partida (estável até o jogador trocar)."""
    rng = random.Random(seed)
    tier = rng.choices(TIER_ORDER, weights=_TIER_WEIGHTS)[0]
    lo, hi = TIER_BASE[tier]
    return {
        "tier": tier,
        "base": rng.randint(lo, hi),
        "tactic": rng.choice(list(Tactic)).value,
        "weather": rng.choice(list(Weather)).value,
        "name_seed": rng.randint(0, 1_000_000),
    }


def difficulty_label(tier: str) -> str:
    return TIER_LABEL.get(tier, "Médio")


def cpu_names(name_seed: int, sex: Sex, count: int) -> list[str]:
    """Nomes da CPU, estáveis por `name_seed` e adequados ao sexo da categoria."""
    rng = random.Random(f"{name_seed}-{sex.value}")
    firsts = _FIRST_F if sex is Sex.FEMALE else _FIRST_M
    names: list[str] = []
    seen: set[str] = set()
    while len(names) < count:
        candidate = f"{rng.choice(firsts)} {rng.choice(_LAST)}"
        if candidate not in seen:
            seen.add(candidate)
            names.append(candidate)
    return names
