"""Region metadata and geometry stay usable before inference is initialized."""
import gzip
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

from aquagrid import api
from aquagrid.catalog import MODEL_FIELDS
from aquagrid.geometry import prepare_geometry


def request(**headers):
    return Request({"type": "http", "method": "GET", "headers": [
        (key.replace("_", "-").encode(), value.encode()) for key, value in headers.items()
    ]})


class RegionStartupTests(unittest.TestCase):
    def setUp(self):
        self.out = Path(self.enterContext(tempfile.TemporaryDirectory()))
        (self.out / "static").mkdir()
        (self.out / "model").mkdir()
        (self.out / "model" / "flood_xgb.ubj").touch()
        self.enterContext(patch.dict(api.REGIONS, {"example": SimpleNamespace(out_dir=self.out)}))
        self.path = self.out / "static" / "buildings.json"
        self.path.write_bytes(b'{"polys":[],"h":[]}')

    def test_metadata_needs_only_catalog_files(self):
        metrics = dict.fromkeys(MODEL_FIELDS, 1)
        (self.out / "model" / "metrics.json").write_text(json.dumps(metrics))
        (self.out / "static" / "meta.json").write_text('{"region":{"id":"example"}}')
        meta = api.meta("example")
        self.assertEqual(meta["region"]["id"], "example")
        self.assertEqual(meta["model"], metrics)
        self.assertIn("memorial", meta["presets"])
        self.assertIn("ambulance", meta["vehicles"])

    def test_built_geometry_is_revalidated_and_keeps_its_json_representation(self):
        prepare_geometry(self.path)
        response = api.buildings("example", request(accept_encoding="br, gzip"))
        self.assertEqual(response.headers["content-encoding"], "gzip")
        self.assertEqual(response.headers["content-type"], "application/json")
        self.assertEqual(gzip.decompress(Path(response.path).read_bytes()), self.path.read_bytes())
        cached = api.buildings("example", request(accept_encoding="gzip", if_none_match=response.headers["etag"]))
        self.assertEqual(cached.status_code, 304)
        self.assertEqual(cached.body, b"")
        identity = api.buildings("example", request())
        self.assertEqual(identity.path, self.path)
        self.assertNotEqual(identity.headers["etag"], response.headers["etag"])

    def test_legacy_and_rebuilt_geometry_do_not_serve_stale_bytes(self):
        self.assertEqual(api.buildings("example", request(accept_encoding="gzip")).path, self.path)
        prepare_geometry(self.path)
        previous = api.buildings("example", request(accept_encoding="gzip"))
        updated = self.path.stat().st_mtime_ns + 2_000_000_000
        self.path.write_bytes(b'{"polys":[[]],"h":[42]}')
        os.utime(self.path, ns=(updated, updated))
        fresh = api.buildings("example", request(accept_encoding="gzip", if_none_match=previous.headers["etag"]))
        self.assertEqual(fresh.status_code, 200)
        self.assertEqual(fresh.path, self.path)
        prepare_geometry(self.path)
        compressed = api.buildings("example", request(accept_encoding="gzip"))
        self.assertEqual(gzip.decompress(Path(compressed.path).read_bytes()), self.path.read_bytes())


    def test_missing_geometry_returns_service_unavailable(self):
        self.path.unlink()
        with self.assertRaises(HTTPException) as error:
            api.buildings("example", request())
        self.assertEqual(error.exception.status_code, 503)

    def test_saturation_returns_retryable_error(self):
        with api._simulation_slot(), api._simulation_slot(), api._simulation_slot():
            with self.assertRaises(HTTPException) as error, api._simulation_slot():
                self.fail("A saturated worker should refuse additional simulation work.")
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(error.exception.headers["Retry-After"], "1")
        with api._simulation_slot():
            pass

    def test_catalog_does_not_mark_partial_region_ready(self):
        example = api.REGIONS["example"]
        example.id, example.name, example.bbox = "example", "Example", (-96, 29, -95, 30)
        self.assertFalse(next(item for item in api.regions() if item["id"] == example.id)["built"])

    def test_unknown_route_selection_never_reaches_inference(self):
        region = SimpleNamespace(bbox=(-96, 29, -95, 30))
        engine = SimpleNamespace(meta={"hospitals": [{"id": "hospital"}], "neighborhoods": [{"id": "place"}]})
        with patch.object(api, "_region", return_value=region), patch.object(api, "_load_engine", return_value=engine):
            for selection in ({"hospital": "place"}, {"dest": "hospital"}, {"dest_lonlat": (-93, 29)}):
                with self.subTest(selection=selection), self.assertRaises(HTTPException) as error:
                    api.simulate("example", api.SimRequest(**selection))
                self.assertEqual(error.exception.status_code, 422)
