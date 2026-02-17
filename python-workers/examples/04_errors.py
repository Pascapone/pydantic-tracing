"""
Error handling example: ModelRetry and error spans.
Demonstrates: error capture, retry handling, error status spans.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pydantic_ai import Agent, RunContext, ModelRetry
from agents.schemas import AgentDeps
from tracing import get_tracer, SpanStatus, print_trace


async def main():
    print("=" * 60)
    print("Example 4: Error Handling and ModelRetry")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    
    class StrictOutput:
        value: int
        must_be_positive: bool
    
    from pydantic import BaseModel, Field, field_validator
    
    class StrictResult(BaseModel):
        value: int = Field(gt=0, description="Must be a positive integer")
        reason: str
        
        @field_validator("value")
        @classmethod
        def validate_positive(cls, v):
            if v <= 0:
                raise ValueError("Value must be positive")
            return v
    
    agent = Agent(
        "openrouter:minimax/minimax-m2.5",
        output_type=StrictResult,
        deps_type=AgentDeps,
        instructions="""You return structured results with a positive integer value.
        Always provide positive values only.""",
    )
    
    @agent.output_validator
    async def validate_result(ctx, output: StrictResult) -> StrictResult:
        span = tracer.start_span(
            name="validator.strict_result",
            attributes={"output.value": output.value},
        )
        
        if output.value < 100:
            tracer.add_event("validation_failed", {"value": output.value, "min_required": 100})
            tracer.end_span(span, SpanStatus.error, f"Value {output.value} is below minimum 100")
            raise ModelRetry(f"Value must be at least 100, got {output.value}. Please try again with a larger number.")
        
        tracer.end_span(span)
        return output
    
    deps = AgentDeps(
        user_id="user_004",
        session_id="session_004",
        request_id="req_004",
        metadata={"example": "error_handling"},
    )
    
    trace = tracer.start_trace(
        name="error_handling_example",
        user_id=deps.user_id,
        session_id=deps.session_id,
        request_id=deps.request_id,
        metadata=deps.metadata,
    )
    
    print(f"\nTrace ID: {trace.id}")
    print("Running agent with validation that may trigger retries...\n")
    
    try:
        run_span = tracer.start_span(
            name="agent.run:strict_validator",
            attributes={"has_validator": True},
        )
        
        result = await agent.run(
            "Generate a number between 1 and 1000. The validator requires minimum 100.",
            deps=deps,
        )
        
        tracer.end_span(run_span)
        tracer.end_trace()
        
        print(f"\nResult (after possible retries):")
        print(f"  Value: {result.output.value}")
        print(f"  Reason: {result.output.reason}")
        print(f"  Retries may have occurred if initial value was < 100")
        
        print("\n" + "=" * 60)
        print("Trace Summary (showing retry spans if any):")
        print("=" * 60)
        print_trace(trace.id, str(db_path))
        
    except Exception as e:
        if "run_span" in dir():
            tracer.end_span(run_span, SpanStatus.error, str(e))
        tracer.end_trace(SpanStatus.error)
        print(f"Agent failed: {e}")
        print("\nError was captured in trace.")
        print_trace(trace.id, str(db_path))


if __name__ == "__main__":
    asyncio.run(main())
