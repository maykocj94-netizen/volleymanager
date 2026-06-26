"""Treinos do atleta. Cada treino melhora um atributo principal e, para manter
o balanceamento, pode reduzir levemente outro. Um treino por dia por atleta.

`gains`/`losses` são deltas aplicados aos 13 atributos (limitados a 1..99).
"""

from __future__ import annotations

# Ordem exibida no app.
TRAINING_ORDER = [
    "saque", "recepcao", "passe", "levantamento", "manchete",
    "ataque", "cortada", "impulsao", "deslocamento", "defesa",
]

TRAININGS: dict[str, dict] = {
    "saque":        {"label": "Saque",        "gains": {"serve": 2},                  "losses": {"reception": 1}},
    "recepcao":     {"label": "Recepção",     "gains": {"reception": 2},              "losses": {"serve": 1}},
    "passe":        {"label": "Passe",        "gains": {"setting": 1, "positioning": 1}, "losses": {"block": 1}},
    "levantamento": {"label": "Levantamento", "gains": {"setting": 2},                "losses": {"stamina": 1}},
    "manchete":     {"label": "Manchete",     "gains": {"defense": 2},                "losses": {"attack": 1}},
    "ataque":       {"label": "Ataque",       "gains": {"attack": 2},                 "losses": {"defense": 1}},
    "cortada":      {"label": "Cortada",      "gains": {"attack": 1, "jump": 1},      "losses": {"reception": 1}},
    "impulsao":     {"label": "Impulsão",     "gains": {"jump": 2},                   "losses": {"stamina": 1}},
    "deslocamento": {"label": "Deslocamento", "gains": {"speed": 2},                  "losses": {"jump": 1}},
    "defesa":       {"label": "Defesa",       "gains": {"defense": 1, "positioning": 1}, "losses": {"serve": 1}},
}


def is_valid(training: str) -> bool:
    return training in TRAININGS


def apply_training(attrs, training: str) -> dict[str, int]:
    """Aplica o treino aos atributos (mutando `attrs`). Devolve as mudanças."""
    spec = TRAININGS[training]
    changes: dict[str, int] = {}
    for attr, delta in spec["gains"].items():
        new = max(1, min(99, getattr(attrs, attr) + delta))
        changes[attr] = new - getattr(attrs, attr)
        setattr(attrs, attr, new)
    for attr, delta in spec["losses"].items():
        new = max(1, min(99, getattr(attrs, attr) - delta))
        changes[attr] = new - getattr(attrs, attr)
        setattr(attrs, attr, new)
    return changes
