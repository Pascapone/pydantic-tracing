"""
Data analysis tools for analysis agent.
"""
import asyncio
import json
import statistics
from typing import Any


def _parse_csv_like(data_str: str) -> list[dict[str, Any]]:
    lines = [l.strip() for l in data_str.strip().split("\n") if l.strip()]
    if not lines:
        return []
    
    headers = lines[0].split(",")
    result = []
    for line in lines[1:]:
        values = line.split(",")
        row = {}
        for i, h in enumerate(headers):
            v = values[i] if i < len(values) else ""
            try:
                row[h] = float(v)
            except ValueError:
                row[h] = v
        result.append(row)
    return result


def _parse_json_array(data_str: str) -> list[Any]:
    try:
        parsed = json.loads(data_str)
        if isinstance(parsed, list):
            return parsed
        return [parsed]
    except json.JSONDecodeError:
        return []


async def parse_data(data: str, format_type: str = "auto") -> str:
    """
    Parse data from various formats.
    
    Args:
        data: The raw data string
        format_type: Data format (auto, csv, json)
    
    Returns:
        JSON string with parsed data info
    """
    await asyncio.sleep(0.1)
    
    parsed = None
    detected_format = format_type
    
    if format_type == "auto":
        data_stripped = data.strip()
        if data_stripped.startswith("[") or data_stripped.startswith("{"):
            detected_format = "json"
            parsed = _parse_json_array(data)
        else:
            detected_format = "csv"
            parsed = _parse_csv_like(data)
    elif format_type == "json":
        parsed = _parse_json_array(data)
    elif format_type == "csv":
        parsed = _parse_csv_like(data)
    else:
        return json.dumps({"error": f"Unknown format: {format_type}"})
    
    row_count = len(parsed) if parsed else 0
    column_count = 0
    columns = []
    
    if parsed and isinstance(parsed[0], dict):
        columns = list(parsed[0].keys())
        column_count = len(columns)
    
    return json.dumps({
        "format": detected_format,
        "row_count": row_count,
        "column_count": column_count,
        "columns": columns,
        "sample_rows": parsed[:3] if parsed else [],
    })


async def calculate_stats(data: str, column: str | None = None) -> str:
    """
    Calculate statistical measures on data.
    
    Args:
        data: JSON or CSV data string
        column: Specific column to analyze (for tabular data)
    
    Returns:
        JSON string with statistical summary
    """
    await asyncio.sleep(0.15)
    
    try:
        if data.strip().startswith("["):
            parsed = _parse_json_array(data)
        else:
            parsed = _parse_csv_like(data)
    except Exception:
        return json.dumps({"error": "Failed to parse data"})
    
    if not parsed:
        return json.dumps({"error": "No data to analyze"})
    
    results = {}
    
    if isinstance(parsed[0], dict):
        columns_to_analyze = [column] if column else list(parsed[0].keys())
        
        for col in columns_to_analyze:
            values = []
            for row in parsed:
                v = row.get(col)
                if isinstance(v, (int, float)):
                    values.append(v)
            
            if values:
                results[col] = {
                    "count": len(values),
                    "mean": statistics.mean(values),
                    "median": statistics.median(values),
                    "std_dev": statistics.stdev(values) if len(values) > 1 else 0,
                    "min": min(values),
                    "max": max(values),
                }
    else:
        values = [v for v in parsed if isinstance(v, (int, float))]
        if values:
            results["values"] = {
                "count": len(values),
                "mean": statistics.mean(values),
                "median": statistics.median(values),
                "std_dev": statistics.stdev(values) if len(values) > 1 else 0,
                "min": min(values),
                "max": max(values),
            }
    
    return json.dumps(results)


async def generate_chart(data: str, chart_type: str = "bar", title: str = "") -> str:
    """
    Generate chart data for visualization.
    
    Args:
        data: JSON data string with labels and values
        chart_type: Type of chart (bar, line, pie)
        title: Chart title
    
    Returns:
        JSON string with chart configuration
    """
    await asyncio.sleep(0.2)
    
    try:
        parsed = json.loads(data)
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid JSON data"})
    
    if isinstance(parsed, list):
        if isinstance(parsed[0], dict):
            labels = [str(d.get("label", d.get("name", f"Item {i}"))) for i, d in enumerate(parsed)]
            values = [d.get("value", d.get("count", 0)) for d in parsed]
            if not any(isinstance(v, (int, float)) for v in values):
                numeric_keys = [k for k in parsed[0].keys() if isinstance(parsed[0].get(k), (int, float))]
                if numeric_keys:
                    values = [d.get(numeric_keys[0], 0) for d in parsed]
        else:
            labels = [f"Item {i}" for i in range(len(parsed))]
            values = [v if isinstance(v, (int, float)) else 0 for v in parsed]
    else:
        return json.dumps({"error": "Data must be a list"})
    
    total = sum(v for v in values if isinstance(v, (int, float)))
    
    return json.dumps({
        "chart_type": chart_type,
        "title": title or "Data Visualization",
        "data": {
            "labels": labels,
            "values": values,
        },
        "summary": {
            "total": total,
            "item_count": len(labels),
            "max_value": max(values) if values else 0,
            "min_value": min(values) if values else 0,
        },
    })
