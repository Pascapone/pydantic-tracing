"""
Job context for Python workers.
"""

import json
import time
from typing import Any, Dict, Optional


class JobContext:
    """Context object passed to job handlers."""

    def __init__(self, job_id: str, input_path: str, output_path: str):
        self.job_id = job_id
        self.input_path = input_path
        self.output_path = output_path
        self._progress = 0
        self._step: Optional[str] = None
        self._start_time = time.time()
        self._metadata: Dict[str, Any] = {}

    def progress(
        self,
        percentage: int,
        message: Optional[str] = None,
        step: Optional[str] = None,
    ) -> None:
        """Report job progress to the parent process."""
        self._progress = max(0, min(100, percentage))
        self._step = step or self._step

        self._send_message(
            "progress",
            {
                "percentage": self._progress,
                "message": message,
                "step": self._step,
            },
        )

    def log(
        self,
        message: str,
        level: str = "info",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log a message."""
        self._send_message(
            "log",
            {
                "level": level,
                "message": message,
                "metadata": metadata,
            },
        )

    def warn(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Log a warning."""
        self.log(message, level="warn", metadata=metadata)

    def error(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Log an error."""
        self.log(message, level="error", metadata=metadata)

    def debug(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Log a debug message."""
        self.log(message, level="debug", metadata=metadata)

    def set_metadata(self, key: str, value: Any) -> None:
        """Set metadata for the job."""
        self._metadata[key] = value

    def get_metadata(self, key: str, default: Any = None) -> Any:
        """Get metadata value."""
        return self._metadata.get(key, default)

    def heartbeat(self) -> None:
        """Send a heartbeat to indicate the job is still running."""
        self._send_message(
            "heartbeat",
            {
                "timestamp": int(time.time() * 1000),
                "elapsed_ms": int((time.time() - self._start_time) * 1000),
            },
        )

    def elapsed_seconds(self) -> float:
        """Get elapsed time in seconds."""
        return time.time() - self._start_time

    def _send_message(self, msg_type: str, payload: Any) -> None:
        """Send a message to stdout for the parent process to read."""
        message = {
            "type": msg_type,
            "jobId": self.job_id,
            "timestamp": int(time.time() * 1000),
            "payload": payload,
        }
        print(json.dumps(message), flush=True)
