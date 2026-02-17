"""
Query and export utilities for traces.
"""
import json
from typing import Optional, Any
from datetime import datetime, timedelta
from pathlib import Path

from .collector import TraceCollector, get_collector
from .spans import SpanStatus


class TraceViewer:
    def __init__(self, collector: Optional[TraceCollector] = None, db_path: str = "traces.db"):
        self.collector = collector if collector is not None else get_collector(db_path)
    
    def get_trace(self, trace_id: str) -> Optional[dict[str, Any]]:
        return self.collector.get_trace(trace_id)
    
    def get_span_tree(self, trace_id: str) -> list[dict[str, Any]]:
        return self.collector.get_span_tree(trace_id)
    
    def list_recent_traces(self, limit: int = 20) -> list[dict[str, Any]]:
        return self.collector.list_traces(limit=limit)
    
    def find_traces_by_user(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        return self.collector.list_traces(user_id=user_id, limit=limit)
    
    def find_traces_by_session(self, session_id: str, limit: int = 50) -> list[dict[str, Any]]:
        return self.collector.list_traces(session_id=session_id, limit=limit)
    
    def get_stats(self) -> dict[str, Any]:
        return self.collector.get_stats()
    
    def export_trace(self, trace_id: str, format: str = "json") -> Optional[str]:
        trace = self.get_trace(trace_id)
        if not trace:
            return None
        
        if format == "json":
            return json.dumps(trace, indent=2, default=str)
        elif format == "otel":
            return self._to_otel_format(trace)
        else:
            raise ValueError(f"Unknown format: {format}")
    
    def export_traces(
        self,
        output_path: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        limit: int = 1000,
    ) -> int:
        traces = self.collector.list_traces(
            user_id=user_id,
            session_id=session_id,
            limit=limit,
        )
        
        full_traces = []
        for t in traces:
            full = self.get_trace(t["id"])
            if full:
                full_traces.append(full)
        
        with open(output_path, "w") as f:
            json.dump(full_traces, f, indent=2, default=str)
        
        return len(full_traces)
    
    def print_trace_summary(self, trace_id: str) -> None:
        trace = self.get_trace(trace_id)
        if not trace:
            print(f"Trace {trace_id} not found")
            return
        
        print(f"\n{'='*60}")
        print(f"Trace: {trace['name']}")
        print(f"ID: {trace['id']}")
        print(f"Status: {trace['status']}")
        print(f"Spans: {len(trace.get('spans', []))}")
        print(f"Duration: {trace.get('total_duration_ms', 0):.2f}ms")
        print(f"Started: {trace['started_at']}")
        if trace.get('completed_at'):
            print(f"Completed: {trace['completed_at']}")
        print(f"{'='*60}\n")
        
        self._print_span_tree(self.get_span_tree(trace_id), indent=0)
    
    def _print_span_tree(self, spans: list[dict[str, Any]], indent: int = 0) -> None:
        for span in spans:
            prefix = "  " * indent
            duration_ms = (span.get("duration_us") or 0) / 1000
            status_icon = "[OK]" if span["status"] == "ok" else "[ERR]" if span["status"] == "error" else "[...]"
            
            print(f"{prefix}{status_icon} {span['name']} ({duration_ms:.2f}ms)")
            
            attrs = span.get("attributes", {})
            if attrs:
                for key, value in attrs.items():
                    if key in ("agent.name", "tool.name", "model.name"):
                        val_str = str(value)[:50]
                        print(f"{prefix}  -> {key}: {val_str}")
            
            if span.get("children"):
                self._print_span_tree(span["children"], indent + 1)
    
    def _to_otel_format(self, trace: dict[str, Any]) -> str:
        otel_spans = []
        
        for span in trace.get("spans", []):
            otel_span = {
                "traceId": trace["id"],
                "spanId": span["id"],
                "parentSpanId": span.get("parent_id"),
                "name": span["name"],
                "kind": span["kind"],
                "startTimeUnixNano": span["start_time"] * 1000,
                "endTimeUnixNano": span["end_time"] * 1000 if span["end_time"] else None,
                "attributes": span.get("attributes", {}),
                "status": {
                    "code": span["status"].upper() if span["status"] else "UNSET",
                },
            }
            otel_spans.append(otel_span)
        
        return json.dumps({
            "resourceSpans": [{
                "scopeSpans": [{
                    "spans": otel_spans,
                }],
            }],
        }, indent=2)


def print_trace(trace_id: str, db_path: str = "traces.db") -> None:
    viewer = TraceViewer(db_path=db_path)
    viewer.print_trace_summary(trace_id)


def export_traces(output_path: str, db_path: str = "traces.db", **kwargs) -> int:
    viewer = TraceViewer(db_path=db_path)
    return viewer.export_traces(output_path, **kwargs)
