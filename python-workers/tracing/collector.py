"""
SQLite-based trace collector and storage.
"""
import sqlite3
import json
import threading
from pathlib import Path
from typing import Optional, Any
from datetime import datetime
from contextlib import contextmanager

from .spans import Span, Trace, SpanStatus


class TraceCollector:
    _instance: Optional["TraceCollector"] = None
    _lock = threading.Lock()
    
    def __new__(cls, db_path: str = "traces.db") -> "TraceCollector":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance
    
    def __init__(self, db_path: str = "traces.db"):
        if self._initialized:
            return
        self._initialized = True
        self.db_path = db_path
        self._local = threading.local()
        self._init_db()
    
    def _get_connection(self) -> sqlite3.Connection:
        if not hasattr(self._local, "connection") or self._local.connection is None:
            self._local.connection = sqlite3.connect(self.db_path)
            self._local.connection.row_factory = sqlite3.Row
        return self._local.connection
    
    def _init_db(self) -> None:
        conn = self._get_connection()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS traces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                user_id TEXT,
                session_id TEXT,
                request_id TEXT,
                metadata JSON,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                status TEXT NOT NULL,
                span_count INTEGER DEFAULT 0,
                total_duration_ms REAL DEFAULT 0
            );
            
            CREATE TABLE IF NOT EXISTS spans (
                id TEXT PRIMARY KEY,
                trace_id TEXT NOT NULL,
                parent_id TEXT,
                name TEXT NOT NULL,
                kind TEXT NOT NULL,
                span_type TEXT,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                duration_us INTEGER,
                attributes JSON,
                status TEXT NOT NULL,
                status_message TEXT,
                events JSON,
                created_at TEXT NOT NULL,
                FOREIGN KEY (trace_id) REFERENCES traces(id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id);
            CREATE INDEX IF NOT EXISTS idx_spans_parent_id ON spans(parent_id);
            CREATE INDEX IF NOT EXISTS idx_traces_user_id ON traces(user_id);
            CREATE INDEX IF NOT EXISTS idx_traces_session_id ON traces(session_id);
            CREATE INDEX IF NOT EXISTS idx_spans_name ON spans(name);
            CREATE INDEX IF NOT EXISTS idx_spans_start_time ON spans(start_time);
        """)
        conn.commit()
    
    def create_trace(
        self,
        name: str = "unnamed_trace",
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Trace:
        trace = Trace(
            name=name,
            user_id=user_id,
            session_id=session_id,
            request_id=request_id,
            metadata=metadata or {},
        )
        
        conn = self._get_connection()
        conn.execute(
            """
            INSERT INTO traces (id, name, user_id, session_id, request_id, metadata, started_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                trace.id,
                trace.name,
                trace.user_id,
                trace.session_id,
                trace.request_id,
                json.dumps(trace.metadata),
                trace.started_at.isoformat(),
                trace.status.value,
            ),
        )
        conn.commit()
        return trace
    
    def save_span(self, span: Span) -> None:
        conn = self._get_connection()
        conn.execute(
            """
            INSERT OR REPLACE INTO spans (
                id, trace_id, parent_id, name, kind, span_type,
                start_time, end_time, duration_us, attributes,
                status, status_message, events, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                span.id,
                span.trace_id,
                span.parent_id,
                span.name,
                span.kind.value,
                span.span_type.value if span.span_type else None,
                span.start_time,
                span.end_time,
                span.duration_us,
                json.dumps(span.attributes),
                span.status.value,
                span.status_message,
                json.dumps(span.events),
                span.created_at.isoformat(),
            ),
        )
        
        conn.execute(
            """
            UPDATE traces SET span_count = (
                SELECT COUNT(*) FROM spans WHERE trace_id = ?
            ) WHERE id = ?
            """,
            (span.trace_id, span.trace_id),
        )
        conn.commit()
    
    def complete_trace(self, trace: Trace) -> None:
        trace.complete()
        conn = self._get_connection()
        span_count = conn.execute(
            "SELECT COUNT(*) FROM spans WHERE trace_id = ?",
            (trace.id,)
        ).fetchone()[0]
        
        total_duration = conn.execute(
            "SELECT COALESCE(SUM(duration_us), 0) / 1000.0 FROM spans WHERE trace_id = ?",
            (trace.id,)
        ).fetchone()[0]
        
        conn.execute(
            """
            UPDATE traces 
            SET completed_at = ?, status = ?, total_duration_ms = ?, span_count = ?
            WHERE id = ?
            """,
            (
                trace.completed_at.isoformat() if trace.completed_at else None,
                trace.status.value,
                total_duration,
                span_count,
                trace.id,
            ),
        )
        conn.commit()
    
    def get_trace(self, trace_id: str) -> Optional[dict[str, Any]]:
        conn = self._get_connection()
        row = conn.execute(
            "SELECT * FROM traces WHERE id = ?",
            (trace_id,)
        ).fetchone()
        
        if not row:
            return None
        
        trace = dict(row)
        trace["metadata"] = json.loads(trace["metadata"]) if trace["metadata"] else {}
        
        spans = conn.execute(
            "SELECT * FROM spans WHERE trace_id = ? ORDER BY start_time",
            (trace_id,)
        ).fetchall()
        
        trace["spans"] = [self._row_to_span_dict(s) for s in spans]
        return trace
    
    def get_spans(self, trace_id: str) -> list[dict[str, Any]]:
        conn = self._get_connection()
        rows = conn.execute(
            "SELECT * FROM spans WHERE trace_id = ? ORDER BY start_time",
            (trace_id,)
        ).fetchall()
        return [self._row_to_span_dict(r) for r in rows]
    
    def list_traces(
        self,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        conn = self._get_connection()
        
        query = "SELECT * FROM traces"
        params = []
        conditions = []
        
        if user_id:
            conditions.append("user_id = ?")
            params.append(user_id)
        if session_id:
            conditions.append("session_id = ?")
            params.append(session_id)
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " ORDER BY started_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]
    
    def get_span_tree(self, trace_id: str) -> list[dict[str, Any]]:
        spans = self.get_spans(trace_id)
        span_map = {s["id"]: s for s in spans}
        roots = []
        
        for span in spans:
            span["children"] = []
            if span["parent_id"] and span["parent_id"] in span_map:
                span_map[span["parent_id"]]["children"].append(span)
            else:
                roots.append(span)
        
        return roots
    
    def delete_trace(self, trace_id: str) -> bool:
        conn = self._get_connection()
        conn.execute("DELETE FROM spans WHERE trace_id = ?", (trace_id,))
        result = conn.execute("DELETE FROM traces WHERE id = ?", (trace_id,))
        conn.commit()
        return result.rowcount > 0
    
    def get_stats(self) -> dict[str, Any]:
        conn = self._get_connection()
        
        trace_count = conn.execute("SELECT COUNT(*) FROM traces").fetchone()[0]
        span_count = conn.execute("SELECT COUNT(*) FROM spans").fetchone()[0]
        
        avg_duration = conn.execute(
            "SELECT AVG(total_duration_ms) FROM traces WHERE completed_at IS NOT NULL"
        ).fetchone()[0] or 0
        
        return {
            "trace_count": trace_count,
            "span_count": span_count,
            "avg_duration_ms": avg_duration,
        }
    
    def _row_to_span_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        span = dict(row)
        span["attributes"] = json.loads(span["attributes"]) if span["attributes"] else {}
        span["events"] = json.loads(span["events"]) if span["events"] else []
        return span
    
    @classmethod
    def reset_instance(cls) -> None:
        with cls._lock:
            cls._instance = None


def get_collector(db_path: str = "traces.db") -> TraceCollector:
    return TraceCollector(db_path)
