import sys
from pathlib import Path
from unittest.mock import MagicMock

_PROJECT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(_PROJECT / "dags"), str(_PROJECT / "config")]

try:
    import duckdb  
except ImportError:
    sys.modules["duckdb"] = MagicMock()

try:
    import psycopg2  
except ImportError:
    sys.modules["psycopg2"] = MagicMock()

