"""Unit tests for the ETL load stage."""

import sys
import unittest
from unittest.mock import MagicMock

try:
    import duckdb  
except ImportError:
    sys.modules["duckdb"] = MagicMock()

try:
    import psycopg2  
except ImportError:
    sys.modules["psycopg2"] = MagicMock()

from etl import load


class TestLoad(unittest.TestCase):
    """Test load constants and table configuration."""

    def test_dim_keys(self):
        self.assertEqual(load._DIM_KEYS["dim_date"], "date_key")
        self.assertEqual(load._DIM_KEYS["dim_time"], "time_key")
        self.assertEqual(load._DIM_KEYS["dim_station"], "station_code")

    def test_facts(self):
        self.assertEqual(load._FACTS, ("fact_service", "fact_stop"))

    def test_schema_file_exists(self):
        self.assertTrue(load.SCHEMA_SQL.exists())
        content = load.SCHEMA_SQL.read_text()
        self.assertIn("CREATE TABLE IF NOT EXISTS dim_date", content)
        self.assertIn("CREATE TABLE IF NOT EXISTS dim_time", content)
        self.assertIn("CREATE TABLE IF NOT EXISTS dim_station", content)
        self.assertIn("CREATE TABLE IF NOT EXISTS fact_service", content)
        self.assertIn("CREATE TABLE IF NOT EXISTS fact_stop", content)


if __name__ == "__main__":
    unittest.main()
