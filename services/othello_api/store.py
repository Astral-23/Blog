from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from .contracts import SessionSettings
from .session import OthelloSession


@dataclass
class StoredSession:
    session: OthelloSession
    touched_at: float


class OthelloSessionStore:
    def __init__(self, ttl_seconds: int = 60 * 60):
        self.ttl_seconds = ttl_seconds
        self._sessions: dict[str, StoredSession] = {}

    def create(self, settings: SessionSettings) -> OthelloSession:
        self.cleanup()
        session_id = uuid.uuid4().hex
        session = OthelloSession(session_id=session_id, settings=settings)
        self._sessions[session_id] = StoredSession(session=session, touched_at=time.time())
        return session

    def get(self, session_id: str) -> OthelloSession:
        self.cleanup()
        stored = self._sessions.get(session_id)
        if stored is None:
            raise KeyError(session_id)
        stored.touched_at = time.time()
        return stored.session

    def cleanup(self) -> None:
        now = time.time()
        stale = [
            session_id
            for session_id, stored in self._sessions.items()
            if now - stored.touched_at > self.ttl_seconds
        ]
        for session_id in stale:
            del self._sessions[session_id]
