# LIGTAS Trip Studio

A browser-based synthetic GPS dataset builder for Chapter 3 development and controlled replay. It does not collect commuter observations.

## Run

Run `npm run dev` from this directory and open http://localhost:4173. No package installation is needed. Node 18+ runs `npm test`; Python 3 serves the app.

## Workflow

1. Add and name a route. Click the map in travel order for a start, destination and via points. Drag markers to move them. Coordinates can also be entered through the expandable form.
2. Build the road route. OSRM is queried independently for outbound and return journeys, respecting each direction's roads. Export requires valid fetched road geometry. Configure another HTTPS OSRM server through the expandable form if needed.
3. Select Add stop and click along the route. Stops snap onto the current outbound geometry and become intermediate waypoints visited in each direction. Set a duration or choose Random time (30–300 seconds). Rebuild after moving or adding waypoints.
4. Edit each direction's speed profile. Click the graph to add points; drag them or edit the table. The axis measures **moving time**, paused during explicit stops. Grid spacing starts at 30 seconds; pointer edits snap to 5 seconds. Speeds are linearly interpolated; the final speed continues until arrival.
5. Set trip counts, first departure timestamps in Asia/Manila, repeat interval, seed and variations. Generate previews and scrub or play on the map. Download individual files, one route ZIP or all routes in a ZIP.
6. Save project JSON as a backup. Changes are also stored automatically in this browser.

## Output contract

CSV is the default, with exactly `timestamp,latitude,longitude`. JSON and GPX are also supported. Each trip is a separate neutral filename such as `trip-0001.csv`; recordings have no direction field. Timestamps use ISO 8601 UTC (`Z`) and are exactly 10 seconds apart. Stop coordinates remain stationary. The destination is held until the next exact sample after arrival.

Each ZIP contains separate route folders with recordings, a manifest and project JSON. The manifest identifies `source: synthetic` and records directions, seeds, actual stop events, speed factors, profile settings, routing provenance and cached road geometry. A project and seed reproduce identical GPS rows until geometry or settings change. Rebuilding with OSRM may return changed roads.

Speed variation draws a seeded multiplier per trip. Stop duration variation is independent per stop. Set both to zero for identical behavior. This version does not add GPS noise, missing uploads, battery simulation or vehicle dynamics. Profiles are controlled assumptions; calibrate them against observations before using them as realistic traffic distributions. Both directions share reversed intermediate places but use their own road geometry and speed profiles. Create a separate route if different intermediate places are needed for the return journey.

## Dependencies and limits

Map tiles use OpenStreetMap; routing defaults to the OSRM public demo. These require internet access. Selected waypoint coordinates go to the routing server; viewport tile requests go to the map provider. Project storage, simulation and exports run in the browser. No application database is used. Configure your own OSRM service for sustained dataset production.

Limits: 50 routes per project, 100 waypoints per route, 500 trips per direction, 24 hours per recording, 1 million observations per route, and 2 million per all-route export. Speeds are bounded to 160 km/h; stops to 7,200 seconds. Same-direction trips must not overlap in the configured schedule.

## Verification

`npm test` checks distance interpolation, integrated speeds, timed stops, exact sampling, arrival, return travel, reproducible variation, invalid input and all three encodings.

References: [OSRM route API](https://project-osrm.org/docs/v5.22.0/api/), [Leaflet API](https://leafletjs.com/reference). Vendored Leaflet 1.9.4 and JSZip 3.10.1 are distributed with their licenses in `dist/vendor`. Map attribution is displayed in the editor.
