"""Unit tests for the ETL extract stage."""

import gzip
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock

try:
    import duckdb  
except ImportError:
    sys.modules["duckdb"] = MagicMock()

from etl import extract


class TestExtract(unittest.TestCase):
    """Test extract helper functions and validation logic."""

    def test_sql_str_escaping(self):
        self.assertEqual(extract._sql_str("hello"), "'hello'")
        self.assertEqual(extract._sql_str("O'Reilly"), "'O''Reilly'")
        self.assertEqual(extract._sql_str(Path("/data/test.parquet")), "'/data/test.parquet'")

    def test_meta_path(self):
        dest = Path("/tmp/data/services-2025.csv.gz")
        meta = extract._meta_path(dest)
        self.assertEqual(meta, Path("/tmp/data/services-2025.csv.gz.meta.json"))

    def test_remote_file_dataclass(self):
        rf = extract.RemoteFile(
            url="https://example.com/file.gz",
            size=1024,
            etag="abc123etag",
            last_modified="Wed, 21 Oct 2025 07:28:00 GMT",
        )
        self.assertEqual(rf.url, "https://example.com/file.gz")
        self.assertEqual(rf.size, 1024)
        self.assertEqual(rf.etag, "abc123etag")
        self.assertEqual(rf.last_modified, "Wed, 21 Oct 2025 07:28:00 GMT")

    def test_validate_header_success(self):
        expected = ["col_a", "col_b", "col_c"]
        with tempfile.NamedTemporaryFile(suffix=".csv.gz", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            with gzip.open(tmp_path, "wt", encoding="utf-8") as f:
                f.write("col_a,col_b,col_c\n1,2,3\n")
            result = extract.validate_header(tmp_path, expected=expected)
            self.assertEqual(result, expected)
        finally:
            tmp_path.unlink(missing_ok=True)

    def test_validate_header_mismatch(self):
        expected = ["col_a", "col_b", "col_c"]
        with tempfile.NamedTemporaryFile(suffix=".csv.gz", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            with gzip.open(tmp_path, "wt", encoding="utf-8") as f:
                f.write("col_a,col_b,col_wrong\n1,2,3\n")
            with self.assertRaises(ValueError) as ctx:
                extract.validate_header(tmp_path, expected=expected)
            self.assertIn("Header mismatch", str(ctx.exception))
            self.assertIn("missing=['col_c']", str(ctx.exception))
            self.assertIn("extra=['col_wrong']", str(ctx.exception))
        finally:
            tmp_path.unlink(missing_ok=True)

    def test_validate_header_order_differs(self):
        expected = ["col_a", "col_b", "col_c"]
        with tempfile.NamedTemporaryFile(suffix=".csv.gz", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            with gzip.open(tmp_path, "wt", encoding="utf-8") as f:
                f.write("col_b,col_a,col_c\n1,2,3\n")
            with self.assertRaises(ValueError) as ctx:
                extract.validate_header(tmp_path, expected=expected)
            self.assertIn("order differs: True", str(ctx.exception))
        finally:
            tmp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
