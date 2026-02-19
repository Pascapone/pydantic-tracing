import pytest
import sys
import shutil
import asyncio
import uuid
from pathlib import Path
from typing import AsyncGenerator, Generator

# Add the python-workers directory to the path so we can import modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from tracing.collector import TraceCollector
from tracing.processor import PydanticAITracer, set_tracer

TEST_TMP_ROOT = Path(__file__).parent.parent / ".test-tmp"

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session", autouse=True)
def test_tmp_root() -> Generator[Path, None, None]:
    """Ensure tests write temporary files inside the workspace."""
    TEST_TMP_ROOT.mkdir(parents=True, exist_ok=True)
    yield TEST_TMP_ROOT
    shutil.rmtree(TEST_TMP_ROOT, ignore_errors=True)

@pytest.fixture
def temp_db_path() -> Generator[str, None, None]:
    """Create a temporary database path for testing."""
    db_path = str(TEST_TMP_ROOT / f"test_traces_{uuid.uuid4().hex}.db")
    yield db_path

@pytest.fixture
def tracer(temp_db_path: str) -> Generator[PydanticAITracer, None, None]:
    """Create a tracer instance with a temporary database."""
    # Reset singleton instance
    TraceCollector.reset_instance()
    
    tracer = PydanticAITracer(db_path=temp_db_path)
    set_tracer(tracer)
    yield tracer
    
    # Cleanup
    set_tracer(None)
    TraceCollector.reset_instance()
