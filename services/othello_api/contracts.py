from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal


StrategyName = Literal["UCT", "EPSILON_GREEDY"]
ModeName = Literal["human_black", "human_white", "ai_vs_ai"]
PlayerType = Literal["human", "ai"]
CellValue = Literal[".", "x", "o"]

BOARD_CELLS = 64
PASS_ACTION = 64


@dataclass
class AiConfig:
    time_limit_seconds: float = 1.0
    strategy: StrategyName = "UCT"

    def to_dict(self) -> dict[str, float | str]:
        return asdict(self)


@dataclass
class SessionSettings:
    mode: ModeName = "human_black"
    black_ai: AiConfig = field(default_factory=AiConfig)
    white_ai: AiConfig = field(default_factory=AiConfig)
    ai_vs_ai_delay_ms: int = 500

    def to_dict(self) -> dict[str, object]:
        return {
            "mode": self.mode,
            "black_ai": self.black_ai.to_dict(),
            "white_ai": self.white_ai.to_dict(),
            "ai_vs_ai_delay_ms": self.ai_vs_ai_delay_ms,
        }


@dataclass
class Snapshot:
    board: list[CellValue]
    current_player: int
    legal_actions: list[int]
    is_terminal: bool
    match_finished: bool
    last_action: int | None
    status_message: str
    black_count: int
    white_count: int
    evaluation: float | None
    iterations: int | None
    can_undo: bool
    can_redo: bool
    history_index: int
    history_length: int
    mode: ModeName
    player_types: dict[str, PlayerType]
    ai_config: dict[str, dict[str, float | str]]

    def __post_init__(self) -> None:
        if len(self.board) != BOARD_CELLS:
            raise ValueError(f"board must contain {BOARD_CELLS} cells")

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def player_types_for_mode(mode: ModeName) -> dict[str, PlayerType]:
    if mode == "human_black":
        return {"0": "human", "1": "ai"}
    if mode == "human_white":
        return {"0": "ai", "1": "human"}
    return {"0": "ai", "1": "ai"}
