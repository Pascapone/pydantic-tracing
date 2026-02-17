"""
Python worker configuration and utilities.
"""

import os
from typing import Optional
from pydantic import BaseModel
from functools import lru_cache


class WorkerConfig(BaseModel):
    redis_url: str = "redis://localhost:6379"
    max_workers: int = 4
    default_timeout: int = 300000  # 5 minutes
    heartbeat_interval: int = 30000  # 30 seconds
    log_level: str = "INFO"


@lru_cache()
def get_config() -> WorkerConfig:
    return WorkerConfig(
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
        max_workers=int(os.getenv("MAX_PYTHON_WORKERS", "4")),
        default_timeout=int(os.getenv("JOB_DEFAULT_TIMEOUT", "300000")),
        heartbeat_interval=int(os.getenv("JOB_HEARTBEAT_INTERVAL", "30000")),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
    )
