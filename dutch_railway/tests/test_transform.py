"""Unit tests for the ETL transform stage."""

import sys
import unittest
from unittest.mock import MagicMock

try:
    import duckdb
except ImportError:
    sys.modules["duckdb"] = MagicMock()

from etl import transform


class TestTransform(unittest.TestCase):
    """Test SQL query generation and transformation helper functions."""

    def test_tables_list(self):
        expected = ["dim_date", "dim_time", "dim_station", "fact_service", "fact_stop"]
        self.assertEqual(transform.TABLES, expected)

    def test_queries_keys(self):
        for table in transform.TABLES:
            self.assertIn(table, transform._QUERIES)

    def test_time_key_sql(self):
        sql = transform._time_key('"Stop:Arrival time"')
        self.assertIn('hour("Stop:Arrival time")', sql)
        self.assertIn('minute("Stop:Arrival time")', sql)
        self.assertIn("SMALLINT", sql)

    def test_date_key_sql(self):
        sql = transform._date_key('"Service:Date"')
        self.assertIn('strftime("Service:Date", \'%Y%m%d\')', sql)
        self.assertIn("INTEGER", sql)

    def test_time_of_day_sql(self):
        sql = transform._time_of_day_sql("h")
        self.assertTrue(sql.startswith("CASE "))
        self.assertTrue(sql.endswith("END"))
        self.assertIn("'morning'", sql)
        self.assertIn("'afternoon'", sql)
        self.assertIn("'night'", sql)

    def test_station_code_sql(self):
        sql = transform._station_code_sql()
        self.assertTrue(sql.startswith("CASE "))
        self.assertIn('ELSE "Stop:Station code" END', sql)
        self.assertIn("'BERHBL'", sql)
        self.assertIn("'VENEZ'", sql)


if __name__ == "__main__":
    unittest.main()
