# flŭd · Flood impact & community resilience

See how flooding disrupts a community, identify who loses access to essential
services, and explore where relief should be prioritized.

flŭd opens on a guided introduction to Houston. Choose one of five areas, design
a storm, and watch modeled flood depths change on roads and 3D buildings. Then
check which buildings lose modeled access to a hospital and compare census
tracts where flooding and social vulnerability overlap. All five areas run on
flŭd's built-in flood simulator.

## Run locally

Use Node **22.16.0**, pnpm **10.12.1**, and Python **3.13**. Git is the team
synchronization boundary. Pull before starting and read `AGENTS.md`, `STATUS.md`,
`DECISIONS.md` and your assignment in `prompts/`.

```sh
git pull --ff-only
corepack enable
corepack prepare pnpm@10.12.1 --activate
pnpm install --frozen-lockfile
python -m venv .venv
```

Install Python dependencies using the matching platform command:

```powershell
# Windows PowerShell
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
```

```sh
# macOS / Linux
.venv/bin/python -m pip install -r requirements.lock
```

To run the simulator locally, complete the [simulator setup](simulator/README.md)
to install its frontend and Python dependencies. Prepare the regional data with
`python -m aquagrid.prepare_zones` from `simulator/backend` using the simulator
Python environment. Alternatively, point to a hosted simulator map using
`VITE_SIMULATOR_URL`. Start flŭd from the repository root:

```sh
pnpm dev
```

Open [flŭd](http://127.0.0.1:5173/), follow **Explore Houston**, and use the
button at the end of the introduction to choose an area. You can also go
directly to the [five-area chooser](http://127.0.0.1:5173/#/simulate).
`pnpm dev` and `pnpm dev:integrated` run the same local stack.

| Local service | Address |
| --- | --- |
| flŭd site | http://127.0.0.1:5173 |
| flŭd planning API | http://127.0.0.1:8000/docs |
| Simulator 3D map | http://127.0.0.1:5174 |
| Simulator region catalog | http://127.0.0.1:8001/api/regions |

For a hosted simulator map, set `VITE_SIMULATOR_URL` to its frontend URL before
starting flŭd. The launcher then starts only the site and planning API. To use
the local map with an existing simulator backend, set `AQUAGRID_API` to its
origin. The launcher reads these settings from the shell or a root
`.env.local` file. With no overrides it starts all four services. Local simulation
requires no provider credentials. Keep server secrets out of `VITE_*` variables.

## Try a simulation

Choose a Houston area. Its street and building map opens inside flŭd with a
four-step guide (the **Guide** button shows it again):

1. **Design a storm.** In **Storm controls**, choose a scenario preset or set
   rainfall, duration, sea surge and drain blockage. Optionally draw the storm's
   path on the map.
2. **Simulate community impact.** Select **Animate** to step the scenario up and
   watch road segments and buildings change.
3. **Inspect emergency access.** In **Impact & routing**, choose a hospital and
   vehicle, then place a pin to calculate a hypothetical route.
4. **Prioritize relief.** Open **Relief priorities** to compare affected census
   tracts using CDC Social Vulnerability Index indicators and split a budget.

Use the area selector to open another region.

## How it works

- **Terrain and features.** USGS 3DEP lidar elevation is processed into
  depression, flow-accumulation, wetness, height-above-drainage and
  sea-connectivity features. Roads and buildings come from Overture Maps
  (OpenStreetMap).
- **Flood model.** A process-based simulator (coastal surge, drain backflow and
  rainfall ponding) generates depth labels for synthetic storms. An XGBoost
  surrogate is trained to reproduce those depths, so each change re-predicts
  every road segment, building footprint and ground cell in milliseconds. Each
  region trains on about 2.1 million rows from 838 storms and validates on
  162 held-out storms.
- **Emergency access.** NetworkX A\* and SciPy Dijkstra route over roads that
  stay passable for the selected vehicle (car 15 cm, ambulance 30 cm, rescue
  truck 75 cm of water).
- **Relief priorities.** Census tracts combine ACS 2018–2022 population with
  the 2022 CDC/ATSDR Social Vulnerability Index. A tract's need grows with its
  estimated residents in flooded buildings, weighted by deep water, households
  without a car, and older or disabled residents without modeled hospital
  access. **Most in need** adds weight for high SVI.

## Limitations

- **The model is a surrogate.** Its R², MAE and F1 scores measure agreement
  with flŭd's own process-based simulator on held-out synthetic storms. They
  are not independently validated real-world flood-prediction accuracy. The
  separate Hurricane Harvey model in `ml/flood/` is not connected to the app.
- **Impact counts are flags, not measurements.** Each road segment and building
  footprint is scored at its lowest point. A flagged segment counts at its full
  length, so flooded kilometres are not a measured submerged length.
- **Residents are a tract-level proxy.** Each tract's population is spread
  evenly over its mapped buildings. Relief rankings are an exploratory starting
  point to check with local groups, not a needs assessment.
- **Presets are illustrative.** Names that echo past Houston storms describe
  their scale. They are not reconstructions of those events.
- **Playback is not a time-resolved simulation.** **Animate** steps the
  scenario inputs up and re-predicts each step.
- Routes are hypothetical, exclude live traffic, and are not operational
  navigation.

## Infrastructure planning

The separate resource-allocation engine is available through the flŭd planning API
and `pnpm demo:allocation` for the mitigation and response examples. It uses
an illustrative graph. The [planning handoff](docs/handoffs/houston-resource-planning.md)
documents its assumptions and utility functions.

## Verify

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm contracts:check
pnpm openapi:check
python scripts/validate_kit.py
```

`pnpm test` runs web tests and Python API, contract and ML checks using `.venv`.
For the original direct Python command, activate `.venv` first, then run
`python -m pytest apps/api/tests ml/tests`. The API docs are generated from the
runnable skeleton; schema drift is checked in CI. Regenerate after approved
contract edits with `pnpm contracts:generate` and `pnpm openapi:generate`.

```sh
python ml/train.py --config ml/config.yaml
```

Training needs the separate ML dependencies and prepared dataset. Missing inputs
produce exit code 2. The training pipelines and evaluation reports are in the
repository. The application still serves the offline county example.
See the [ML setup and artifact handoff](ml/README.md).

## Team handoff

- Lead: root configuration, `packages/contracts`, schemas, CI and integration.
- Frontend: `apps/web/**`, including the atlas and Earth index.
- ML/data: `ml/**`, provenance and prediction/model service paths.
- Infrastructure: network routes/service and independently sourced graph fixture.
- AI/voice: interpretation/voice routes and provider services.

Read `docs/05-TEAM-PROTOCOL.md` before branching. Use isolated worktrees on a shared
machine. Shared wire changes require a proposal and lead approval. All UI work
must read and apply the installed `$interface-craft` skill and `docs/04-DESIGN.md`.

See `contracts/README.md`, `docs/09-SETUP-DEPLOY.md`, `STATUS.md` and
`docs/handoffs/bootstrap-lead.md` for exact integration state and remaining work.
