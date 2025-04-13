#!/usr/bin/env python
import sys
import json
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Union
import time
from io import StringIO
import traceback


def parse_data(data: str, format_type: str) -> pd.DataFrame:
    """Parse CSV or JSON data into a pandas DataFrame"""
    try:
        if format_type.lower() == "csv":
            return pd.read_csv(StringIO(data))
        elif format_type.lower() == "json":
            # Handle both array of objects and object with array property
            parsed = json.loads(data)
            if isinstance(parsed, list):
                return pd.json_normalize(parsed)
            elif isinstance(parsed, dict) and any(isinstance(v, list) for v in parsed.values()):
                # Find the first array property
                for key, value in parsed.items():
                    if isinstance(value, list):
                        return pd.json_normalize(value)
            return pd.json_normalize(parsed)
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    except Exception as e:
        raise ValueError(f"Error parsing data: {str(e)}")


def filter_data(df: pd.DataFrame, options: Dict[str, Any]) -> pd.DataFrame:
    """Filter DataFrame based on options"""
    if not options:
        return df
    
    field = options.get("field")
    value = options.get("value")
    operator = options.get("operator", "eq")
    
    if not field or value is None:
        return df
    
    # Skip if field doesn't exist
    if field not in df.columns:
        return df
    
    # Apply filter based on operator
    if operator == "eq":
        return df[df[field] == value]
    elif operator == "neq":
        return df[df[field] != value]
    elif operator == "gt":
        return df[df[field] > value]
    elif operator == "gte":
        return df[df[field] >= value]
    elif operator == "lt":
        return df[df[field] < value]
    elif operator == "lte":
        return df[df[field] <= value]
    elif operator == "contains":
        return df[df[field].astype(str).str.contains(str(value), na=False)]
    elif operator == "starts_with":
        return df[df[field].astype(str).str.startswith(str(value), na=False)]
    elif operator == "ends_with":
        return df[df[field].astype(str).str.endswith(str(value), na=False)]
    
    return df


def aggregate_data(df: pd.DataFrame, options: Dict[str, Any]) -> pd.DataFrame:
    """Aggregate DataFrame based on options"""
    if not options:
        return df
    
    group_by = options.get("groupBy")
    metrics = options.get("metrics", [])
    
    if not group_by or not metrics:
        return df
    
    # Skip if groupBy field doesn't exist
    if group_by not in df.columns:
        return df
    
    # Build aggregation dictionary
    agg_dict = {}
    for metric in metrics:
        field = metric.get("field")
        func = metric.get("function", "sum")
        
        if not field or field not in df.columns:
            continue
        
        if func == "sum":
            agg_dict[field] = "sum"
        elif func == "avg":
            agg_dict[field] = "mean"
        elif func == "min":
            agg_dict[field] = "min"
        elif func == "max":
            agg_dict[field] = "max"
        elif func == "count":
            agg_dict[field] = "count"
    
    if not agg_dict:
        return df
    
    # Perform aggregation
    return df.groupby(group_by).agg(agg_dict).reset_index()


def transform_data(df: pd.DataFrame, options: Dict[str, Any]) -> pd.DataFrame:
    """Transform DataFrame based on options"""
    if not options:
        return df
    
    # Select specific fields
    select_fields = options.get("select", [])
    if select_fields and all(isinstance(field, str) for field in select_fields):
        # Only include fields that exist in the DataFrame
        valid_fields = [field for field in select_fields if field in df.columns]
        if valid_fields:
            df = df[valid_fields]
    
    # Rename fields
    rename_map = options.get("rename", {})
    if rename_map and isinstance(rename_map, dict):
        # Only rename fields that exist in the DataFrame
        valid_renames = {old: new for old, new in rename_map.items() if old in df.columns}
        if valid_renames:
            df = df.rename(columns=valid_renames)
    
    return df


def analyze_data(df: pd.DataFrame) -> Dict[str, Any]:
    """Analyze DataFrame and return insights"""
    if df.empty:
        return {"error": "Empty dataset"}
    
    analysis = {
        "recordCount": len(df),
        "fieldCount": len(df.columns),
        "fieldTypes": [],
        "summary": {}
    }
    
    # Field type analysis
    for column in df.columns:
        field_info = {"name": column}
        
        # Determine field type
        if pd.api.types.is_numeric_dtype(df[column]):
            field_info["type"] = "number"
            # Calculate numeric statistics
            non_null = df[column].dropna()
            if not non_null.empty:
                field_info["min"] = float(non_null.min())
                field_info["max"] = float(non_null.max())
                field_info["mean"] = float(non_null.mean())
                field_info["stddev"] = float(non_null.std())
        elif pd.api.types.is_datetime64_dtype(df[column]):
            field_info["type"] = "date"
            non_null = df[column].dropna()
            if not non_null.empty:
                field_info["min"] = non_null.min().isoformat()
                field_info["max"] = non_null.max().isoformat()
        else:
            field_info["type"] = "string"
            # Calculate string statistics
            non_null = df[column].dropna()
            if not non_null.empty:
                field_info["uniqueValues"] = int(non_null.nunique())
                # Most common values
                value_counts = non_null.value_counts().head(5).to_dict()
                field_info["topValues"] = [{"value": str(k), "count": int(v)} for k, v in value_counts.items()]
        
        analysis["fieldTypes"].append(field_info)
    
    # Calculate null values
    null_counts = df.isnull().sum()
    if null_counts.sum() > 0:
        analysis["nullValues"] = {column: int(count) for column, count in null_counts.items() if count > 0}
    
    # Calculate correlations for numeric fields
    numeric_df = df.select_dtypes(include=[np.number])
    if len(numeric_df.columns) >= 2:
        corr_matrix = numeric_df.corr().round(3)
        # Convert correlation matrix to list of pairs
        corr_pairs = []
        for i, col1 in enumerate(corr_matrix.columns):
            for j, col2 in enumerate(corr_matrix.columns):
                if i < j:  # Upper triangle only
                    corr_pairs.append({
                        "field1": col1,
                        "field2": col2,
                        "value": float(corr_matrix.loc[col1, col2])
                    })
        # Sort by absolute correlation value
        corr_pairs.sort(key=lambda x: abs(x["value"]), reverse=True)
        analysis["correlations"] = {"pairs": corr_pairs[:10]}  # Top 10 correlations
    
    # Check for duplicate records
    duplicate_count = len(df) - len(df.drop_duplicates())
    if duplicate_count > 0:
        analysis["duplicateRecords"] = duplicate_count
    
    return analysis


def process_data(data: str, format_type: str, operation: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Process data according to the operation and options"""
    start_time = time.time()
    
    try:
        # Parse the data into a DataFrame
        df = parse_data(data, format_type)
        
        # Initial summary
        result = {
            "timestamp": pd.Timestamp.now().isoformat(),
            "operation": operation,
            "format": format_type,
            "summary": {
                "recordCount": len(df),
                "fieldCount": len(df.columns),
                "fields": list(df.columns)
            }
        }
        
        # Process options
        if options is None:
            options = {}
        
        # Apply operation
        if operation == "parse":
            # Already parsed, just return the data
            result["data"] = df.to_dict(orient="records")
            result["summary"].update({
                "format": format_type,
                "operation": "parse"
            })
        
        elif operation == "filter":
            filtered_df = filter_data(df, options)
            result["data"] = filtered_df.to_dict(orient="records")
            result["summary"].update({
                "inputCount": len(df),
                "outputCount": len(filtered_df),
                "criteria": options,
                "operation": "filter"
            })
        
        elif operation == "aggregate":
            aggregated_df = aggregate_data(df, options)
            result["data"] = aggregated_df.to_dict(orient="records")
            result["summary"].update({
                "inputCount": len(df),
                "groupCount": len(aggregated_df),
                "groupBy": options.get("groupBy"),
                "metrics": options.get("metrics"),
                "operation": "aggregate"
            })
        
        elif operation == "transform":
            transformed_df = transform_data(df, options)
            result["data"] = transformed_df.to_dict(orient="records")
            result["summary"].update({
                "inputCount": len(df),
                "outputCount": len(transformed_df),
                "select": options.get("select"),
                "rename": options.get("rename"),
                "operation": "transform"
            })
        
        elif operation == "analyze":
            analysis = analyze_data(df)
            # Include a small sample of the data
            sample_size = min(5, len(df))
            result["data"] = df.head(sample_size).to_dict(orient="records")
            result["summary"] = analysis
        
        else:
            raise ValueError(f"Unsupported operation: {operation}")
        
        # Add execution time
        result["summary"]["executionTimeMs"] = int((time.time() - start_time) * 1000)
        
        return result
    
    except Exception as e:
        # Return error
        error_details = {
            "timestamp": pd.Timestamp.now().isoformat(),
            "operation": operation,
            "format": format_type,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "summary": {
                "executionTimeMs": int((time.time() - start_time) * 1000)
            }
        }
        return error_details


if __name__ == "__main__":
    # Read input from stdin
    input_data = sys.stdin.read()
    
    try:
        # Parse the JSON input
        request = json.loads(input_data)
        
        # Extract parameters
        data = request.get("data", "")
        format_type = request.get("format", "json")
        operation = request.get("operation", "parse")
        options = request.get("options", {})
        
        # Process the data
        result = process_data(data, format_type, operation, options)
        
        # Output the result as JSON
        print(json.dumps(result))
    
    except Exception as e:
        # Return error as JSON
        error_result = {
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_result)) 