import sys
from unittest.mock import MagicMock

try:
    import duckdb  
except ImportError:
    sys.modules["duckdb"] = MagicMock()

try:
    import psycopg2  
except ImportError:
    sys.modules["psycopg2"] = MagicMock()

