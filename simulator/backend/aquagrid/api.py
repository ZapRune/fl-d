"""FastAPI app.

    uvicorn aquagrid.api:app --port 8000          (from backend/)
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, contextmanager
from importlib import import_module
from threading import BoundedSemaphore
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, ORJSONResponse
from pydantic import BaseModel, Field
from pydantic import FiniteFloat
from starlette.staticfiles import StaticFiles

from .catalog import public_meta
from .config import DEFAULT_REGION, REGIONS
from .geometry import compressed_geometry

def _preload_libraries():
    try:
        import_module(".engine", package=__package__)
    except Exception:
        # Catalog and regional geometry are still available. A simulation will retry the import.
        logging.getLogger(__name__).exception("Could not load AquaGrid inference libraries")


@asynccontextmanager
async def lifespan(app: FastAPI):
    warmup = asyncio.create_task(asyncio.to_thread(_preload_libraries))
    try:
        yield
    finally:
        await warmup


app = FastAPI(title="AquaGrid AI", version="0.1.0", default_response_class=ORJSONResponse, lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=2048, compresslevel=4)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
geometry_files = StaticFiles()
_simulation_slots = BoundedSemaphore(3)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    detail = [{key: entry[key] for key in ("loc", "msg", "type")} for entry in error.errors()]
    return ORJSONResponse({"detail": detail}, status_code=422)


@contextmanager
def _simulation_slot():
    if not _simulation_slots.acquire(blocking=False):
        raise HTTPException(503, "Simulator is busy. Try again shortly.", headers={"Retry-After": "1"})
    try:
        yield
    finally:
        _simulation_slots.release()


def _load_engine(region_id):
    try:
        from .engine import get_engine
        return get_engine(region_id)
    except (OSError, ValueError, KeyError, ImportError, RuntimeError) as error:
        logging.getLogger(__name__).exception("Could not initialize region %s", region_id)
        raise HTTPException(503, "The prepared simulation model or data could not be loaded.") from error


def _region(rid: str):
    if rid not in REGIONS:
        raise HTTPException(404, f"unknown region {rid}")
    out = REGIONS[rid].out_dir
    if (out / ".retrain-required").exists() or not (out / "model" / "flood_xgb.ubj").is_file():
        raise HTTPException(503, f"region {rid} not built: run the pipeline and training first")
    return REGIONS[rid]


class StormEventRequest(BaseModel):
    kind: Literal["flood", "hurricane"]
    track: list[tuple[FiniteFloat, FiniteFloat]] = Field(min_length=1, max_length=8, description="Origin and waypoints, WGS84 lon/lat")
    radius_km: float = Field(ge=0.2, le=20, description="Distance at which direct rainfall reaches zero")
    progress: float = Field(1, ge=0, le=1, description="Fraction of the storm track already traveled")


class TripRequest(BaseModel):
    start: tuple[FiniteFloat, FiniteFloat]
    end: tuple[FiniteFloat, FiniteFloat]


class SimRequest(BaseModel):
    rain: float = Field(0, ge=0, le=250, description="rain intensity, mm/h")
    duration: float = Field(1, gt=0, le=48, description="storm duration, h")
    surge: float = Field(0, ge=0, le=4, description="storm surge above high tide, m")
    clog: float = Field(0.1, ge=0, le=1, description="fraction of storm-drain capacity lost")
    vehicle: Literal["sedan", "ambulance", "truck"] = "ambulance"
    hospital: str | None = Field(default=None, max_length=160)
    dest: str | None = Field(default=None, max_length=160)
    dest_lonlat: tuple[FiniteFloat, FiniteFloat] | None = None
    trip: TripRequest | None = None
    overlay: bool = True
    event: StormEventRequest | None = None


def _validate_event_bounds(req: SimRequest, region):
    if req.event:
        west, south, east, north = region.bbox
        if any(not (west <= lon <= east and south <= lat <= north) for lon, lat in req.event.track):
            raise HTTPException(422, "Storm origin and waypoints must lie inside the selected study region.")


@app.get("/api/health")
def health():
    return {"ok": True, "default_region": DEFAULT_REGION}


@app.get("/api/regions")
def regions():
    def ready(region):
        out = region.out_dir
        required = ("grid.json", "rasters.npz", "model/flood_xgb.ubj", "model/metrics.json",
                    "static/meta.json", "static/roads.json", "static/buildings.json")
        inputs = ("nodes.npy", "building_node.npy", "edges.parquet", "feat_edges.parquet",
                  "feat_buildings.parquet", "feat_cells.parquet")
        return (not (out / ".retrain-required").exists()
                and all((out / name).is_file() for name in required)
                and ((out / "inference.npz").is_file() or all((out / name).is_file() for name in inputs)))

    return [dict(id=r.id, name=r.name, bbox=r.bbox, default=r.id == DEFAULT_REGION,
                 built=ready(r)) for r in REGIONS.values()]


@app.get("/api/regions/{rid}/meta")
def meta(rid: str):
    region = _region(rid)
    try:
        return public_meta(region)
    except (OSError, ValueError, KeyError) as error:
        logging.getLogger(__name__).exception("Could not load the catalog for %s", rid)
        raise HTTPException(503, "Regional metadata could not be loaded.") from error


def _geometry(rid: str, filename: str, request: Request):
    path = _region(rid).out_dir / "static" / filename
    if not path.is_file():
        raise HTTPException(503, "Regional geometry is missing. Prepare the study area before retrying.")
    encodings = {item.strip() for item in request.headers.get("accept-encoding", "").lower().split(",")}
    precompressed = compressed_geometry(path) if "gzip" in encodings and "range" not in request.headers else None
    selected = precompressed or path
    response = geometry_files.file_response(selected, selected.stat(), request.scope)
    if isinstance(response, FileResponse):
        response.chunk_size = 1024 * 1024
        if precompressed:
            response.headers["Content-Type"] = "application/json"
            response.headers["Content-Encoding"] = "gzip"
    response.headers["Vary"] = "Accept-Encoding"
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.get("/api/regions/{rid}/roads")
def roads(rid: str, request: Request):
    return _geometry(rid, "roads.json", request)


@app.get("/api/regions/{rid}/buildings")
def buildings(rid: str, request: Request):
    return _geometry(rid, "buildings.json", request)


@app.post("/api/regions/{rid}/simulate")
def simulate(rid: str, req: SimRequest):
    region = _region(rid)
    _validate_event_bounds(req, region)
    west, south, east, north = region.bbox
    points = [req.dest_lonlat] if req.dest_lonlat is not None else []
    if req.trip:
        points.extend((req.trip.start, req.trip.end))
    if any(not (west <= lon <= east and south <= lat <= north) for lon, lat in points):
        raise HTTPException(422, "All route points must lie inside the selected study region.")
    with _simulation_slot():
        engine = _load_engine(rid)
        if req.hospital is not None and not any(p["id"] == req.hospital for p in engine.meta["hospitals"]):
            raise HTTPException(422, "Choose a supported facility in this region.")
        if req.dest is not None and not any(p["id"] == req.dest for p in engine.meta["neighborhoods"]):
            raise HTTPException(422, "Choose a supported starting place in this region.")
        try:
            return ORJSONResponse(engine.simulate(**req.model_dump()))
        except (FloatingPointError, OSError) as error:
            logging.getLogger(__name__).exception("Simulation failed for region %s", rid)
            raise HTTPException(503, "Regional simulation data or model output is unavailable.") from error


class AdaptationRequest(BaseModel):
    scenario: SimRequest
    phase: Literal["mitigation", "response"]


@app.post("/api/regions/{rid}/adaptation")
def adaptation(rid: str, body: AdaptationRequest):
    """Compare up to three local road interventions using the selected event's routing graph."""
    region = _region(rid)
    req = body.scenario
    _validate_event_bounds(req, region)
    with _simulation_slot():
        engine = _load_engine(rid)
        from .adaptation import evaluate
        from .engine import Scenario

        if req.hospital not in [poi["id"] for poi in engine.meta["hospitals"]]:
            raise HTTPException(422, "Choose a supported facility in this region.")
        scenario = Scenario.make(req.rain, req.duration, req.surge, req.clog,
                                 event=req.event.model_dump() if req.event else None)
        try:
            return evaluate(engine, scenario, body.phase, req.vehicle, req.hospital)
        except (FloatingPointError, OSError) as error:
            logging.getLogger(__name__).exception("Adaptation evaluation failed for region %s", rid)
            raise HTTPException(503, "Regional simulation data or model output is unavailable.") from error
