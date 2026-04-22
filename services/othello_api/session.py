from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .agent import OthelloAgent, SearchResult

from .contracts import (
    PASS_ACTION,
    AiConfig,
    ModeName,
    PlayerType,
    SessionSettings,
    Snapshot,
    player_types_for_mode,
)

try:
    import pyspiel  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - local env may not have pyspiel.
    pyspiel = None


class OthelloServiceUnavailableError(RuntimeError):
    """Raised when optional runtime dependencies are missing."""


@dataclass
class HistoryEntry:
    state: Any
    last_action: int | None
    status_message: str
    evaluation: float | None
    iterations: int | None


def _ensure_pyspiel() -> Any:
    if pyspiel is None:
        raise OthelloServiceUnavailableError(
            "pyspiel is not installed. Install OpenSpiel/pyspiel on the Python service host."
        )
    return pyspiel


class OthelloSession:
    def __init__(self, session_id: str, settings: SessionSettings):
        self.session_id = session_id
        self.settings = settings
        self._pyspiel = _ensure_pyspiel()
        self.game = self._pyspiel.load_game("othello")

        self.player_types: dict[int, PlayerType] = {
            int(player_id): player_type
            for player_id, player_type in player_types_for_mode(settings.mode).items()
        }
        self.status_message = ""
        self.last_action: int | None = None
        self.last_evaluation: float | None = None
        self.last_iterations: int | None = None
        self.state = None
        self.ai_agents: dict[int, OthelloAgent] = {}
        self.history: list[HistoryEntry] = []
        self.history_index = -1
        self.match_finished = False
        self.reset()

    def reset(self) -> Snapshot:
        self.state = self.game.new_initial_state()
        self.last_action = None
        self.last_evaluation = None
        self.last_iterations = None
        self.status_message = "新しい対局を開始しました。"
        self.ai_agents = self._build_ai_agents()
        self.history = []
        self.history_index = -1
        self.match_finished = False
        self._record_history()
        return self.to_snapshot()

    def to_snapshot(self) -> Snapshot:
        board = self._extract_board()
        black_count, white_count = self._count_stones(board)
        current_player = -1 if self.state.is_terminal() else self.state.current_player()
        legal_actions = [] if self.state.is_terminal() else list(self.state.legal_actions())
        return Snapshot(
            board=board,
            current_player=current_player,
            legal_actions=legal_actions,
            is_terminal=self.state.is_terminal(),
            match_finished=self.match_finished,
            last_action=self.last_action,
            status_message=self.status_message,
            black_count=black_count,
            white_count=white_count,
            evaluation=self.last_evaluation,
            iterations=self.last_iterations,
            can_undo=self.match_finished and self.history_index > 0,
            can_redo=self.match_finished and self.history_index < len(self.history) - 1,
            history_index=self.history_index,
            history_length=len(self.history),
            mode=self.settings.mode,
            player_types={str(player_id): player_type for player_id, player_type in self.player_types.items()},
            ai_config={
                "black": self.settings.black_ai.to_dict(),
                "white": self.settings.white_ai.to_dict(),
            },
        )

    def apply_human_move(self, action: int) -> Snapshot:
        self._ensure_active()
        current_player = self.state.current_player()
        if self.player_types.get(current_player) != "human":
            raise ValueError("It is not the human player's turn.")
        if action not in self.state.legal_actions():
            raise ValueError("Illegal action.")
        row, col = divmod(action, 8)
        self._apply_action(action, f"{self._player_name(current_player)} は {row + 1}{chr(ord('a') + col)} に打ちました。")
        self._maybe_auto_pass()
        self._refresh_metrics()
        return self.to_snapshot()

    def apply_ai_move(self) -> Snapshot:
        self._ensure_active()
        self._maybe_auto_pass()
        if self.state.is_terminal():
            self._set_terminal_status()
            return self.to_snapshot()

        current_player = self.state.current_player()
        if self.player_types.get(current_player) != "ai":
            raise ValueError("It is not the AI player's turn.")

        agent = self.ai_agents[current_player]
        time_limit = self._ai_config_for_player(current_player).time_limit_seconds
        search_result = agent.get_search_result(dead_line=time_limit)
        self.last_iterations = search_result.iterations
        self.last_evaluation = self._display_evaluation()

        action = search_result.action
        if action is None:
            raise RuntimeError("AI could not select an action.")
        if action == PASS_ACTION:
            self._apply_action(action, f"{self._player_name(current_player)} はパスしました。")
            self._maybe_auto_pass()
            self._refresh_metrics()
            return self.to_snapshot()

        row, col = divmod(action, 8)
        self._apply_action(action, f"{self._player_name(current_player)} は {row + 1}{chr(ord('a') + col)} に打ちました。")
        self._maybe_auto_pass()
        self._refresh_metrics()
        return self.to_snapshot()

    def undo(self) -> Snapshot:
        if not self.match_finished:
            raise ValueError("Replay is available after the game ends.")
        if self.history_index <= 0:
            raise ValueError("No earlier history.")
        self.history_index -= 1
        self._restore_history(self.history_index)
        self.status_message = f"履歴閲覧中: {self.history_index} 手目の局面です。"
        return self.to_snapshot()

    def redo(self) -> Snapshot:
        if not self.match_finished:
            raise ValueError("Replay is available after the game ends.")
        if self.history_index >= len(self.history) - 1:
            raise ValueError("No later history.")
        self.history_index += 1
        self._restore_history(self.history_index)
        if self.state.is_terminal() and self.history_index == len(self.history) - 1:
            self._set_terminal_status()
        else:
            self.status_message = f"履歴閲覧中: {self.history_index} 手目の局面です。"
        return self.to_snapshot()

    def _build_ai_agents(self) -> dict[int, OthelloAgent]:
        agents: dict[int, OthelloAgent] = {}
        for player_id, player_type in self.player_types.items():
            if player_type == "ai":
                agents[player_id] = OthelloAgent(
                    self.state,
                    strategy=self._ai_config_for_player(player_id).strategy,
                )
        return agents

    def _restore_history(self, index: int) -> None:
        entry = self.history[index]
        self.state = entry.state.clone()
        self.last_action = entry.last_action
        self.last_evaluation = entry.evaluation
        self.last_iterations = entry.iterations
        self.status_message = entry.status_message
        self.ai_agents = self._build_ai_agents()

    def _record_history(self) -> None:
        entry = HistoryEntry(
            state=self.state.clone(),
            last_action=self.last_action,
            status_message=self.status_message,
            evaluation=self.last_evaluation,
            iterations=self.last_iterations,
        )
        if self.history_index < len(self.history) - 1:
            self.history = self.history[: self.history_index + 1]
        self.history.append(entry)
        self.history_index = len(self.history) - 1

    def _apply_action(self, action: int, status_message: str) -> None:
        self.state.apply_action(action)
        for player_id, agent in list(self.ai_agents.items()):
            next_agent = agent.apply_action(action)
            if next_agent is None:
                del self.ai_agents[player_id]
            else:
                self.ai_agents[player_id] = next_agent
        self.last_action = None if action == PASS_ACTION else action
        self.status_message = status_message
        self._record_history()
        if self.state.is_terminal():
            self._set_terminal_status()

    def _maybe_auto_pass(self) -> None:
        while not self.state.is_terminal() and self.state.legal_actions() == [PASS_ACTION]:
            player_id = self.state.current_player()
            self._apply_action(PASS_ACTION, f"{self._player_name(player_id)} はパスしました。")
        if self.state.is_terminal():
            self._set_terminal_status()

    def _set_terminal_status(self) -> None:
        self.match_finished = True
        board = self._extract_board()
        black_count, white_count = self._count_stones(board)
        returns = self.state.returns()
        if returns[0] > returns[1]:
            result = "黒の勝ちです。"
        elif returns[0] < returns[1]:
            result = "白の勝ちです。"
        else:
            result = "引き分けです。"
        self.status_message = f"対局終了 | 黒 {black_count} - 白 {white_count} | {result}"
        if self.history:
            self.history[self.history_index].status_message = self.status_message

    def _extract_board(self) -> list[str]:
        lines = str(self.state).splitlines()
        board_lines = lines[2:10]
        board: list[str] = []
        for line in board_lines:
            parts = line.split()
            board.extend("." if cell == "-" else cell for cell in parts[1:9])
        if len(board) != 64:
            raise RuntimeError("Failed to parse board from pyspiel state.")
        return board

    @staticmethod
    def _count_stones(board: list[str]) -> tuple[int, int]:
        black_count = sum(cell == "x" for cell in board)
        white_count = sum(cell == "o" for cell in board)
        return black_count, white_count

    def _display_evaluation(self) -> float | None:
        agent = self.ai_agents.get(0) or self.ai_agents.get(1)
        if agent is None:
            return None
        evaluation = agent.get_evaluation(0)
        return None if evaluation < 0 else evaluation

    def _refresh_metrics(self) -> None:
        if self.state is None:
            return
        if self.state.is_terminal():
            self.last_evaluation = None
            self.last_iterations = None
        else:
            self.last_evaluation = self._display_evaluation()
        if self.history:
            self.history[self.history_index].evaluation = self.last_evaluation
            self.history[self.history_index].iterations = self.last_iterations

    def _ai_config_for_player(self, player_id: int) -> AiConfig:
        return self.settings.black_ai if player_id == 0 else self.settings.white_ai

    def _player_name(self, player_id: int) -> str:
        if self.player_types.get(player_id) == "human":
            stone = "黒" if player_id == 0 else "白"
            return f"あなた（{stone}）"
        stone = "黒" if player_id == 0 else "白"
        return f"伊抜きちゃんロボ（{stone}）"

    def _ensure_active(self) -> None:
        if self.state is None:
            raise RuntimeError("Session is not initialized.")
