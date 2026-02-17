"""
Schemas for structured agent outputs.
"""
from pydantic import BaseModel, Field
from typing import Optional, Any
from enum import Enum


class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"


class AgentType(str, Enum):
    orchestrator = "orchestrator"
    research = "research"
    coding = "coding"
    analysis = "analysis"


class ResearchSource(BaseModel):
    url: str
    title: str
    snippet: str
    relevance_score: float = Field(ge=0, le=1)


class ResearchReport(BaseModel):
    query: str
    summary: str
    sources: list[ResearchSource]
    key_findings: list[str]
    confidence: float = Field(ge=0, le=1, description="Confidence in research accuracy")


class CodeFile(BaseModel):
    filename: str
    language: str
    content: str
    line_count: int


class CodeExecutionResult(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    execution_time_ms: int


class CodeResult(BaseModel):
    files: list[CodeFile]
    execution: Optional[CodeExecutionResult] = None
    explanation: str
    suggestions: list[str] = Field(default_factory=list)


class DataPoint(BaseModel):
    label: str
    value: float
    metadata: dict[str, Any] = Field(default_factory=dict)


class StatisticalSummary(BaseModel):
    count: int
    mean: float
    median: float
    std_dev: float
    min: float
    max: float


class AnalysisResult(BaseModel):
    data_type: str
    row_count: int
    column_count: Optional[int] = None
    statistics: dict[str, StatisticalSummary] = Field(default_factory=dict)
    insights: list[str]
    anomalies: list[dict[str, Any]] = Field(default_factory=list)
    chart_data: Optional[list[DataPoint]] = None


class SubTaskResult(BaseModel):
    agent_type: AgentType
    status: TaskStatus
    output: Optional[str] = None
    error: Optional[str] = None
    duration_ms: int


class TaskResult(BaseModel):
    task: str
    status: TaskStatus
    subtasks: list[SubTaskResult] = Field(default_factory=list)
    final_answer: str
    total_tokens_used: int
    total_duration_ms: int


class AgentDeps(BaseModel):
    user_id: str
    session_id: str
    request_id: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class SpanKind(str, Enum):
    internal = "INTERNAL"
    client = "CLIENT"
    server = "SERVER"
    producer = "PRODUCER"
    consumer = "CONSUMER"


class SpanStatus(str, Enum):
    unset = "UNSET"
    ok = "OK"
    error = "ERROR"
