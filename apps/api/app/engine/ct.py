"""Catálogo de itens do Centro de Treinamento (CT) e requisitos de montagem.

Ecossistema Loja → CT:
- O dono (admin) cria produtos na Loja; cada produto concede `quantity` unidades
  de um `item_type` (categoria abaixo) ao ser comprado.
- O jogador compra os produtos → as unidades vão para o baú (inventário).
- No CT, o jogador monta um CT de Praia ou de Quadra equipando os itens exigidos.
  Ao atingir todos os requisitos, o CT é montado (itens são consumidos do baú).
"""

# Categorias de itens reconhecidas pelo CT (a Loja vende produtos destas).
CT_ITEM_TYPES = [
    "terreno",
    "areia",
    "poste",
    "refletor",
    "mastro",
    "rede",
    "bola",
    "ginasio",
    "piso",
]

ITEM_LABEL: dict[str, str] = {
    "terreno": "Terreno",
    "areia": "Areia",
    "poste": "Poste",
    "refletor": "Refletor",
    "mastro": "Mastro",
    "rede": "Rede",
    "bola": "Bola",
    "ginasio": "Ginásio",
    "piso": "Piso",
}

ITEM_EMOJI: dict[str, str] = {
    "terreno": "🟫",
    "areia": "🏖️",
    "poste": "🗼",
    "refletor": "💡",
    "mastro": "⛵",
    "rede": "🥅",
    "bola": "🏐",
    "ginasio": "🏟️",
    "piso": "🔲",
}

# Quantidades mínimas para montar cada CT.
#   Praia: terreno, areia, 4 postes, 4 refletores (um por poste), 2 mastros
#          (para a rede), rede e 2 bolas.
#   Quadra: ginásio, 2 pisos (um de cada lado), 4 refletores, 2 mastros, rede
#          e 2 bolas.
BEACH_REQUIREMENTS: dict[str, int] = {
    "terreno": 1,
    "areia": 1,
    "poste": 4,
    "refletor": 4,
    "mastro": 2,
    "rede": 1,
    "bola": 2,
}

COURT_REQUIREMENTS: dict[str, int] = {
    "ginasio": 1,
    "piso": 2,
    "refletor": 4,
    "mastro": 2,
    "rede": 1,
    "bola": 2,
}

REQUIREMENTS: dict[str, dict[str, int]] = {
    "beach": BEACH_REQUIREMENTS,
    "indoor": COURT_REQUIREMENTS,
}

CT_KINDS = ("beach", "indoor")
CT_KIND_LABEL = {"beach": "CT de Praia", "indoor": "CT de Quadra"}


def is_item_type(value: str) -> bool:
    return value in ITEM_LABEL
