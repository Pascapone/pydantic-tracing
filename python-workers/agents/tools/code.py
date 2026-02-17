"""
Code-related tools for coding agent.
"""
import asyncio
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any


_virtual_fs: dict[str, str] = {}


async def write_file(filename: str, content: str, language: str = "python") -> str:
    """
    Write code content to a virtual file.
    
    Args:
        filename: Name of the file to create
        content: The code content to write
        language: Programming language (python, javascript, etc.)
    
    Returns:
        JSON string with file info and line count
    """
    await asyncio.sleep(0.1)
    
    _virtual_fs[filename] = content
    line_count = len(content.strip().split("\n"))
    
    return json.dumps({
        "filename": filename,
        "language": language,
        "line_count": line_count,
        "size_bytes": len(content.encode()),
        "status": "written",
    })


async def read_file(filename: str) -> str:
    """
    Read content from a virtual file.
    
    Args:
        filename: Name of the file to read
    
    Returns:
        The file content or error message
    """
    await asyncio.sleep(0.05)
    
    if filename in _virtual_fs:
        return _virtual_fs[filename]
    return f"Error: File '{filename}' not found"


async def run_code(code: str, language: str = "python", timeout_ms: int = 5000) -> str:
    """
    Execute code and return the result.
    
    Args:
        code: The code to execute
        language: Programming language (only python supported)
        timeout_ms: Execution timeout in milliseconds
    
    Returns:
        JSON string with stdout, stderr, exit_code, and execution_time_ms
    """
    start_time = asyncio.get_event_loop().time()
    
    if language != "python":
        return json.dumps({
            "stdout": "",
            "stderr": f"Unsupported language: {language}",
            "exit_code": 1,
            "execution_time_ms": 0,
        })
    
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(code)
            temp_path = f.name
        
        proc = await asyncio.create_subprocess_exec(
            "python", temp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=timeout_ms / 1000,
            )
            exit_code = proc.returncode or 0
        except asyncio.TimeoutError:
            proc.kill()
            stdout, stderr = b"", b"Execution timed out"
            exit_code = 124
        
        Path(temp_path).unlink(missing_ok=True)
        
    except Exception as e:
        stdout, stderr = b"", str(e).encode()
        exit_code = 1
    
    end_time = asyncio.get_event_loop().time()
    execution_time_ms = int((end_time - start_time) * 1000)
    
    return json.dumps({
        "stdout": stdout.decode()[:10000],
        "stderr": stderr.decode()[:5000],
        "exit_code": exit_code,
        "execution_time_ms": execution_time_ms,
    })


async def analyze_code(code: str, check_type: str = "syntax") -> str:
    """
    Analyze code for issues or improvements.
    
    Args:
        code: The code to analyze
        check_type: Type of analysis (syntax, style, complexity)
    
    Returns:
        JSON string with analysis results
    """
    await asyncio.sleep(0.2)
    
    issues = []
    suggestions = []
    
    if check_type in ("syntax", "all"):
        try:
            compile(code, "<string>", "exec")
            issues.append({"type": "syntax", "severity": "info", "message": "No syntax errors found"})
        except SyntaxError as e:
            issues.append({
                "type": "syntax",
                "severity": "error",
                "message": str(e),
                "line": e.lineno,
            })
    
    if check_type in ("style", "all"):
        lines = code.split("\n")
        for i, line in enumerate(lines, 1):
            if len(line) > 100:
                suggestions.append({
                    "type": "style",
                    "line": i,
                    "message": "Line exceeds 100 characters",
                })
    
    if check_type in ("complexity", "all"):
        if "def " in code:
            func_count = code.count("def ")
            if func_count > 5:
                suggestions.append({
                    "type": "complexity",
                    "message": f"Consider splitting {func_count} functions into modules",
                })
    
    return json.dumps({
        "check_type": check_type,
        "issues": issues,
        "suggestions": suggestions,
        "lines_analyzed": len(code.split("\n")),
    })
