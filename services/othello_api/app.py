from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .contracts import AiConfig, ModeName, PASS_ACTION, SessionSettings, StrategyName
from .session import OthelloServiceUnavailableError
from .store import OthelloSessionStore


class SessionCreateRequest(BaseModel):
    mode: ModeName = "human_black"
    black_ai_time_limit_seconds: float = Field(default=1.0, ge=0.0001, le=30.0)
    white_ai_time_limit_seconds: float = Field(default=1.0, ge=0.0001, le=30.0)
    black_ai_strategy: StrategyName = "UCT"
    white_ai_strategy: StrategyName = "UCT"
    ai_vs_ai_delay_ms: int = Field(default=500, ge=0, le=5000)

    def to_settings(self) -> SessionSettings:
        return SessionSettings(
            mode=self.mode,
            black_ai=AiConfig(
                time_limit_seconds=self.black_ai_time_limit_seconds,
                strategy=self.black_ai_strategy,
            ),
            white_ai=AiConfig(
                time_limit_seconds=self.white_ai_time_limit_seconds,
                strategy=self.white_ai_strategy,
            ),
            ai_vs_ai_delay_ms=self.ai_vs_ai_delay_ms,
        )


class ActionRequest(BaseModel):
    action: int = Field(ge=0, le=PASS_ACTION)


store = OthelloSessionStore()
app = FastAPI(title="Hutaro Othello API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/othello/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "othello-api"}


@app.post("/api/othello/session")
def create_session(payload: SessionCreateRequest) -> dict[str, object]:
    try:
        session = store.create(payload.to_settings())
    except OthelloServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "session_id": session.session_id,
        "snapshot": session.to_snapshot().to_dict(),
    }


@app.get("/api/othello/session/{session_id}")
def get_session(session_id: str) -> dict[str, object]:
    session = _get_session_or_404(session_id)
    return {
        "session_id": session.session_id,
        "snapshot": session.to_snapshot().to_dict(),
    }


@app.post("/api/othello/session/{session_id}/human-move")
def human_move(session_id: str, payload: ActionRequest) -> dict[str, object]:
    session = _get_session_or_404(session_id)
    try:
        snapshot = session.apply_human_move(payload.action)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"session_id": session.session_id, "snapshot": snapshot.to_dict()}


@app.post("/api/othello/session/{session_id}/ai-move")
def ai_move(session_id: str) -> dict[str, object]:
    session = _get_session_or_404(session_id)
    try:
        snapshot = session.apply_ai_move()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"session_id": session.session_id, "snapshot": snapshot.to_dict()}


@app.post("/api/othello/session/{session_id}/undo")
def undo(session_id: str) -> dict[str, object]:
    session = _get_session_or_404(session_id)
    try:
        snapshot = session.undo()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"session_id": session.session_id, "snapshot": snapshot.to_dict()}


@app.post("/api/othello/session/{session_id}/redo")
def redo(session_id: str) -> dict[str, object]:
    session = _get_session_or_404(session_id)
    try:
        snapshot = session.redo()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"session_id": session.session_id, "snapshot": snapshot.to_dict()}


@app.post("/api/othello/session/{session_id}/reset")
def reset(session_id: str) -> dict[str, object]:
    session = _get_session_or_404(session_id)
    snapshot = session.reset()
    return {"session_id": session.session_id, "snapshot": snapshot.to_dict()}


def _get_session_or_404(session_id: str):
    try:
        return store.get(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="session not found") from exc
