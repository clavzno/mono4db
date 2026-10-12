"""Unit tests for ETL configuration and path helpers."""

import unittest

from etl import config


class TestConfig(unittest.TestCase):
    """Test ETL configuration invariants and path helpers."""

    def test_default_constants(self):
        self.assertEqual(config.DEFAULT_YEAR, 2025)
        self.assertEqual(config.SOURCE_TIMEZONE, "Europe/Amsterdam")
        self.assertIn("https://blobs.duckdb.org", config.SOURCE_URL_TEMPLATE)

    def test_source_url(self):
        url = config.source_url(2025)
        self.assertEqual(url, "https://blobs.duckdb.org/nl-railway/services-2025.csv.gz")

    def test_paths(self):
        self.assertEqual(config.raw_path(2025), config.RAW_DIR / "services-2025.csv.gz")
        self.assertEqual(config.staged_path(2025), config.STAGING_DIR / "services-2025.parquet")
        self.assertEqual(config.warehouse_dir(2025), config.WAREHOUSE_DIR / "2025")

    def test_services_columns(self):
        cols = config.SERVICES_COLUMNS
        self.assertEqual(len(cols), 20)
        self.assertIn("Service:RDT-ID", cols)
        self.assertIn("Stop:RDT-ID", cols)
        self.assertIn("Stop:Planned platform", cols)
        self.assertEqual(cols["Service:RDT-ID"], "BIGINT")
        self.assertEqual(cols["Service:Date"], "DATE")
        self.assertEqual(cols["Stop:Planned platform"], "VARCHAR")

    def test_station_code_mappings(self):
        self.assertEqual(config.STATION_CODE_MERGES.get("BERHBT"), "BERHBL")
        self.assertEqual(config.STATION_CODE_RENAMES.get(("LAND", "Venezia Santa Lucia")), "VENEZ")

    def test_time_of_day_buckets(self):
        self.assertIn("morning", config.TIME_OF_DAY)
        self.assertIn("afternoon", config.TIME_OF_DAY)
        self.assertIn("night", config.TIME_OF_DAY)
        self.assertEqual(config.TIME_OF_DAY["morning"], (5, 12))
        self.assertEqual(config.TIME_OF_DAY["afternoon"], (12, 18))
        self.assertEqual(config.TIME_OF_DAY["night"], (18, 5))


if __name__ == "__main__":
    unittest.main()
