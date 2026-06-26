"""Enums de domínio — espelham os enums do PostgreSQL e packages/shared."""

from enum import Enum


class Sex(str, Enum):
    MALE = "male"
    FEMALE = "female"


class Modality(str, Enum):
    BEACH_M = "beach_m"
    BEACH_F = "beach_f"
    INDOOR_M = "indoor_m"
    INDOOR_F = "indoor_f"

    @property
    def is_beach(self) -> bool:
        return self in (Modality.BEACH_M, Modality.BEACH_F)

    @property
    def is_indoor(self) -> bool:
        return self in (Modality.INDOOR_M, Modality.INDOOR_F)

    @property
    def sex(self) -> "Sex":
        return Sex.FEMALE if self in (Modality.BEACH_F, Modality.INDOOR_F) else Sex.MALE

    @property
    def is_female(self) -> bool:
        return self.sex is Sex.FEMALE

    def with_sex(self, sex: "Sex") -> "Modality":
        """Mesma disciplina (praia/quadra) com o sexo informado."""
        if self.is_beach:
            return Modality.BEACH_F if sex is Sex.FEMALE else Modality.BEACH_M
        return Modality.INDOOR_F if sex is Sex.FEMALE else Modality.INDOOR_M


class CourtPosition(str, Enum):
    SETTER = "setter"
    OPPOSITE = "opposite"
    OUTSIDE = "outside"
    MIDDLE = "middle"
    LIBERO = "libero"


class BeachPosition(str, Enum):
    DEFENDER = "defender"
    BLOCKER = "blocker"
    UNIVERSAL = "universal"


class Handedness(str, Enum):
    LEFT = "left"
    RIGHT = "right"


class InjurySeverity(str, Enum):
    LIGHT = "light"
    MODERATE = "moderate"
    SEVERE = "severe"


class InjuryType(str, Enum):
    ANKLE = "ankle"
    KNEE = "knee"
    SHOULDER = "shoulder"
    WRIST = "wrist"
    SPINE = "spine"


class Weather(str, Enum):
    SUNNY = "sunny"
    CLOUDY = "cloudy"
    RAIN = "rain"
    LIGHT_WIND = "light_wind"
    STRONG_WIND = "strong_wind"


class Tactic(str, Enum):
    VERY_OFFENSIVE = "very_offensive"
    OFFENSIVE = "offensive"
    BALANCED = "balanced"
    DEFENSIVE = "defensive"
    VERY_DEFENSIVE = "very_defensive"


class CpuProfile(str, Enum):
    OFFENSIVE = "offensive"
    DEFENSIVE = "defensive"
    BALANCED = "balanced"
    AGGRESSIVE = "aggressive"
    CONSERVATIVE = "conservative"


class MatchStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    FINISHED = "finished"
    CANCELLED = "cancelled"
