# Proposal: arbitrary start and destination for scenario routes

Status: approved by the project lead and implemented as an optional simulator field.

## Problem

The simulator accepts a neighborhood or pin and a selected hospital, and uses the hospital as the source of its network-wide access calculation. Users also need to explore a journey between two arbitrary points. Replacing the hospital with an arbitrary point would change the meaning of hospital-access metrics and relief priorities.

## Proposed change

Keep `hospital`, `dest`, and `dest_lonlat` unchanged for backwards compatibility and preserve existing hospital-based access and planning outputs. Add a separate optional bounded route selection containing independent `start` and `end` WGS84 points. Require both points, reject coordinates outside the selected region, and snap each to the nearest graph node with disclosed snap distances. Compute dry and scenario routes on the same vehicle-weighted road graph, returning selected endpoints and route geometry in a separately named response field. Do not imply that a modeled route is safe or navigable.

Consumers should select and edit both pins independently, discard stale responses on either endpoint change, distinguish this trip from hospital access, and offer accessible non-map selection. Existing clients receive the existing response when the new field is absent.

## Verification before release

Test input bounds and incomplete points, identical and disconnected nodes, endpoint changes during pending requests, selected vehicle thresholds, existing hospital-access and allocation regressions, and desktop/touch pin workflows. Update the versioned wire contract, generated consumers, API documentation, and disclosure together after approval.
