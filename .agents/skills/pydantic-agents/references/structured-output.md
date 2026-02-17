# Structured Output Reference

Patterns for type-safe, validated agent outputs.

## Output Types

| Type | Use Case |
|------|----------|
| `None` (default) | Free text response |
| `str` | Text with optional structure |
| `BaseModel` | Structured, validated output |
| `list[Type]` | Multiple structured items |
| `TypedDict` | Lightweight structure |
| Function | Custom processing/validation |

## Pydantic Models

```python
from pydantic import BaseModel, Field
from typing import Literal

class Analysis(BaseModel):
    """Structured analysis result."""
    category: Literal["bug", "feature", "question"]
    priority: int = Field(ge=1, le=5, description="1=low, 5=critical")
    summary: str = Field(max_length=200)
    suggested_actions: list[str] = Field(default_factory=list)

agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    output_type=Analysis,
    instructions="Analyze user feedback and categorize."
)

result = agent.run_sync("The app crashes when I click submit")
# Analysis(category='bug', priority=4, summary='App crash on submit', ...)
```

## Union Output Types

Let the model choose from multiple output types.

```python
class Success(BaseModel):
    result: dict
    message: str

class NeedInfo(BaseModel):
    missing_fields: list[str]
    question: str

class Failure(BaseModel):
    error: str
    suggestion: str

agent = Agent(
    'openrouter:openai/gpt-4o',
    output_type=[Success, NeedInfo, Failure]
)
```

## Output Functions

Process output through a function instead of returning raw data.

```python
from pydantic_ai import RunContext, ModelRetry

class Query(BaseModel):
    sql: str
    table: str

async def execute_query(ctx: RunContext[AppDeps], query: Query) -> list[dict]:
    """Execute SQL and return results."""
    if "DROP" in query.sql.upper():
        raise ModelRetry("DROP statements not allowed")
    
    result = await ctx.deps.db.execute(query.sql)
    return result

agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    output_type=execute_query,
    deps_type=AppDeps,
    instructions="Generate and execute safe SQL queries."
)
```

## Output Modes

### Tool Output (Default)

Uses tool calling to return structured data. Works with all models.

```python
from pydantic_ai import ToolOutput

agent = Agent(
    'openrouter:openai/gpt-4o',
    output_type=ToolOutput(Analysis, name='return_analysis')
)
```

### Native Output

Uses model's native structured output feature. Higher reliability, but not all models support tools simultaneously.

```python
from pydantic_ai import NativeOutput

agent = Agent(
    'openrouter:openai/gpt-4o',
    output_type=NativeOutput(Analysis)
)
```

### Prompted Output

Includes schema in instructions, parses text response. Works with all models but less reliable.

```python
from pydantic_ai import PromptedOutput

agent = Agent(
    'openrouter:meta-llama/llama-3.3-70b-instruct',
    output_type=PromptedOutput(Analysis)
)
```

## Output Validators

Validate after Pydantic validation, for async checks or complex logic.

```python
from pydantic_ai import ModelRetry

@agent.output_validator
async def validate_sql_output(ctx: RunContext[AppDeps], output: Query) -> Query:
    """Validate SQL is safe before returning."""
    # Async validation (e.g., EXPLAIN query)
    is_safe = await ctx.deps.db.check_safety(output.sql)
    
    if not is_safe:
        raise ModelRetry(
            f"Query unsafe: {output.sql}. "
            "Rewrite to avoid destructive operations."
        )
    
    return output
```

### Partial Output in Streaming

Validators run on partial outputs during streaming. Check `ctx.partial_output`:

```python
@agent.output_validator
async def validate(ctx, output: Analysis) -> Analysis:
    if ctx.partial_output:
        return output  # Skip validation for partials
    
    # Full validation only on complete output
    if not output.summary:
        raise ModelRetry("Summary is required")
    return output
```

## Streaming Structured Output

```python
async def stream_structured():
    agent = Agent(
        'openrouter:openai/gpt-4o',
        output_type=Analysis
    )
    
    async with agent.run_stream("Analyze this feedback") as result:
        async for partial in result.stream_output():
            # partial is a partially-filled Analysis
            print(f"Progress: {partial}")
        
        # Final complete output
        final = await result.get_output()
```

## Custom JSON Schema

For dynamic or external schemas:

```python
from pydantic_ai import StructuredDict

DynamicSchema = StructuredDict(
    {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "score": {"type": "number", "minimum": 0, "maximum": 100}
        },
        "required": ["name"]
    },
    name="DynamicResult",
    description="A dynamically defined result"
)

agent = Agent('openrouter:openai/gpt-4o', output_type=DynamicSchema)
```

## Validation Context

Pass context to Pydantic validators:

```python
from pydantic import BaseModel, field_validator, ValidationInfo

class Item(BaseModel):
    value: int
    
    @field_validator('value')
    def check_max(cls, v, info: ValidationInfo):
        max_val = info.context.get('max_value', 100) if info.context else 100
        if v > max_val:
            raise ValueError(f"Value {v} exceeds max {max_val}")
        return v

agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    output_type=Item,
    validation_context={'max_value': 50}  # Static context
)

# Or dynamic from deps:
agent = Agent(
    output_type=Item,
    deps_type=AppDeps,
    validation_context=lambda ctx: {'max_value': ctx.deps.max_value}
)
```

## Image Output

For models that generate images:

```python
from pydantic_ai import BinaryImage

agent = Agent(
    'openrouter:openai/dall-e-3',
    output_type=BinaryImage
)

result = agent.run_sync("Generate a logo for a tech startup")
image = result.output  # BinaryImage instance
image.save("logo.png")
```
