"""Public region metadata that can be served before loading the numerical engine."""
from __future__ import annotations

import json

from .config import Region


HOUSTON_PRESETS = {
    "clear": dict(label="Clear Skies", rain=0, duration=1, surge=0.0, clog=0.1,
                  blurb="Dry day; normal bayou water levels."),
    "shower": dict(label="Afternoon Downpour", rain=25, duration=1.2, surge=0.0, clog=0.15,
                   blurb="1 in/hr typical Gulf downpour. Streets pond briefly, drains keep up."),
    # Historical names are inspiration only: these are fixed parameter sets, not event reconstructions.
    "memorial": dict(label="Severe rainfall scenario", rain=65, duration=3, surge=0.0, clog=0.35,
                     blurb="~8 in cloudburst, inspired by the 2015 Memorial Day flood. "
                           "Illustrative parameters, not a reconstruction of that event."),
    "taxday": dict(label="Extreme rainfall scenario", rain=75, duration=4, surge=0.0, clog=0.45,
                   blurb="~12 in storm, inspired by the 2016 Tax Day flood. "
                         "Illustrative parameters, not a reconstruction of that event."),
    "100yr": dict(label="High-return-period stress test (illustrative)", rain=85, duration=3, surge=0.1, clog=0.5,
                  blurb="Intensity in the range of a rare, roughly 100-year rainfall. "
                        "A stress test, not a calibrated NOAA Atlas 14 design storm."),
    "harvey": dict(label="Harvey-scale rainfall scenario (illustrative)", rain=125, duration=8, surge=0.3, clog=0.75,
                   blurb="Prolonged extreme rain at a scale inspired by Hurricane Harvey (2017). "
                         "Illustrative parameters, not a reconstruction of that event."),
}

VEHICLES = {
    "sedan": dict(label="Passenger car", clearance_m=0.15),
    "ambulance": dict(label="Ambulance", clearance_m=0.30),
    "truck": dict(label="High-water rescue truck", clearance_m=0.75),
}

MODEL_FIELDS = (
    "model", "target", "teacher", "r2", "mae_cm", "rmse_cm", "n_trees", "n_train_rows",
    "n_train_storms", "n_val_storms", "classification", "importance", "presets",
)


def public_meta(region: Region) -> dict:
    out = region.out_dir
    meta = json.loads((out / "static" / "meta.json").read_bytes())
    metrics = json.loads((out / "model" / "metrics.json").read_bytes())
    model = {key: metrics[key] for key in MODEL_FIELDS}
    if "evaluation" in metrics:
        model["evaluation"] = metrics["evaluation"]
    return {
        **meta,
        "presets": HOUSTON_PRESETS,
        "vehicles": VEHICLES,
        "model": model,
    }
