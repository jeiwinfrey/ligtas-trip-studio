# LIGTAS Trip Studio — manual trips

A local map editor for creating synthetic vehicle GPS recordings every 10 seconds. Manually plan each trip’s recording points, stops, detours and speed curve, then export CSV, JSON or GPX files in ZIPs.

## Clone and run

You need **Git**, **Python 3**, and a modern web browser. Internet access is needed for map tiles and OSRM road routing. No API key, account, package installation or build step is required; the app and its libraries are included in `dist/`.

```sh
git clone https://github.com/jeiwinfrey/ligtas-trip-studio.git
cd ligtas-trip-studio
```

On **macOS or Linux**, start the local server:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

On **Windows** (PowerShell or Command Prompt), use:

```powershell
py -3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

If Windows does not have the `py` launcher, use `python` in its place. Open **http://localhost:4173/** in your browser and keep the terminal running. Press **Ctrl+C** to stop the server. Serve the folder using these commands rather than opening `index.html` directly, since it uses JavaScript modules.

If port 4173 is busy, replace it with 4174 in the command and open http://localhost:4174/. Trip projects are saved in your browser on that address; use **Save project** to download a portable backup and **Open project** to restore it or share it with your friend. Exported recordings are separate from the editable project backup.

### Optional npm commands

With **Node.js 18+ and npm** installed, you can also use:

```sh
npm run dev  # Starts Python via python3; macOS/Linux or Windows with python3 available
npm test     # Runs the simulation and model tests
```

`npm install` is unnecessary because the project has no npm dependencies.

## Design each trip manually

1. **Create a route and set A/B once.** Choose Home (A) and Destination (B) on the map. Once both are set, they are locked for this route. They cannot be dragged, removed or reassigned from any trip. These are route reference points, separate from each trip’s recording start and end. Create a new route to use different references.
2. **Add one trip.** Choose A → B or B → A and its departure/arrival in Manila time. Each new trip starts with an empty stop and detour list and its own editable speed curve, seed and variation settings.
3. **Plan this trip on its map.** Set recording start (S) and recording end (E) for this trip first. New trips leave both blank. They can be placed anywhere, dragged, removed or reassigned without changing A/B or other trips. Use Add detour to place intermediate road waypoints in travel order, and Add stop to choose stop locations and durations. Drag or remove these trip points as needed, then Update this trip’s path with OSRM. Each trip stores its own road geometry. Switching trips switches the map; changes do not affect other trips or fixed A/B.
4. **Shape its full speed timeline.** Small dots show each 10-second GPS observation; large dots are editable speed controls. Click to add a control anywhere, drag controls, or edit times and speeds in the table. Stop bands consume elapsed time at zero speed. Axis labels span the entire chosen departure-to-arrival window.
5. **Choose seeded variation.** Expand Seeded variation for this trip to set speed variation, stop-duration variation and seed. Individual control speeds vary reproducibly. Stop variation uses a separate seeded stream, so adding speed controls does not randomly redraw stop durations.
6. **Preview and export.** Preview/download the selected recording, export its route, or export all routes. ZIPs group manually added recordings into a-to-b/ and b-to-a/ folders inside each route. Project JSON backs up fixed endpoints and every independently designed trip.

## Fixed times and consistent motion

Departure, arrival, road distance and stopping time constrain the area under the speed curve. The editor treats speed controls as a shape and scales the seeded curve over available driving time so it reaches the destination at exactly the requested arrival. It shows the resulting km/h in the graph and in the Fitted column. Increasing stop durations leaves less driving time and therefore changes fitted speeds. Required peaks above 160 km/h block export; adjust the schedule or shape.

The speed controls are stored as fractions of available driving time. On screen they are mapped onto full elapsed time including stop bands. This lets pauses shift the graph naturally while the full trip remains visible. Stops are positioned from their location along the road geometry, with stationary GPS coordinates during each stop. Speed controls linearly interpolate; explicit stop boundaries can change speed abruptly. This is a controlled synthetic trace editor, not a calibrated vehicle dynamics model.

## Recording format

CSV is recommended and contains exactly `timestamp,latitude,longitude`. JSON and GPX are also available. Each recording has a neutral trip filename with no direction labels inside it. UTC timestamps are departure plus exact multiples of 10 seconds. If arrival is not on that grid, the final GPS fix precedes arrival; the exact manually chosen arrival remains in the separate manifest and graph. No padded sample or irregular endpoint is added.

Every recording starts at its trip-specific S and ends at its trip-specific E. A/B are route references only. Direction is an explicit classification for export folders and does not move S/E or reverse detours. The chosen arrival time fits travel to E. Completion uses the OSRM road endpoint at E, preserving selected map coordinates separately. A terminal stop at that endpoint is excluded because recording has already ended. A trailing zero-speed plateau that would reach the endpoint before the chosen arrival is rejected rather than recording an extra dwell.

Manifests preserve `source: synthetic`, fixed endpoint identifiers and coordinates, the recording completion target/reason/time, trip direction, departure/arrival, seed, speed fit, actual stop events, geometry and all scenario settings. Project JSON restores manually designed trips. Same geometry, settings and seed reproduce identical recording rows. Older manual projects keep existing trips, times, speed curves and seeds. Shared intermediate locations and geometry are copied into each existing trip, then removed from the route definition. These copies are independent; disabled historical stops require rebuilding only that trip’s path. Original v1/v2/v3 browser backups remain intact under their old keys. New data uses project schema version 4. Migrating an existing trip copies its old directional A/B endpoints into its own editable S/E while preserving its cached path and recording behavior. Automated v1 batch settings are not converted into trips.

## Services and limits

Map tiles use OpenStreetMap, and routing defaults to the public OSRM demo. Internet access is required for those services; the configured OSRM server receives selected waypoints. Simulation, browser storage, backups and exports run locally in the browser. Use your own OSRM server for sustained routing loads.

Limits: 50 routes, 2 fixed map endpoints per route and 2 independent recording endpoints plus up to 98 intermediate map points per trip, 1,000 manually added trips per route, 1,000 speed controls per trip, 24 hours per trip, 7,200 seconds per base stop duration, one million rows per route ZIP and two million per project ZIP.

`npm test` verifies geometry, encodings, manual schedules, ten-second sampling, whole-trip curves, zero-speed stops, fixed arrival under variation, reproducibility and invalid inputs.

Vehicle speed generation: choose Jeepney, Modern jeepney, Bus or Tricycle and an average driving speed (1–80 km/h). These are illustrative synthetic styles, not calibrated fleet measurements. Randomize entire curve replaces only the selected trip’s curve with seeded controls across its full driving interval (roughly 10 seconds; capped at 1,000 controls), normalized to the requested mean before schedule fitting. Extra per-control variation resets to zero. Manual arrival remains authoritative, and the actual fitted driving/overall averages are displayed. Set arrival from average explicitly updates arrival using distance / average plus seeded stop seconds, then generates the curve. Round-second arrivals can slightly round the actual average. Changing the seed and pressing Randomize reproduces that seed’s curve.

Passenger riding/dropping is a separate map mode and an action on existing stops. It produces seed-based integer durations from 10 through 30 seconds inclusive, exempt from general stop variation. Clicking the stop action again rerolls reproducibly; changing the trip seed updates passenger pauses. Editing the duration manually converts it to an ordinary stop.
