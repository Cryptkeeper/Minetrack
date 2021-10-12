**5.6.1** *(Oct 12 2021)*
- Removed Mojang service status display, status.mojang.com/check was disabled by Mojang. See https://github.com/Cryptkeeper/Minetrack/issues/274

**5.6.0** *(June 7 2021)*
- Fixed a regression caused by rendering error fixed in 5.5.9. See https://github.com/Cryptkeeper/Minetrack/issues/257

**5.5.9** *(May 31 2021)*
- Added configuration option to enable/disable ping failure logging.
- Fixed a rendering error when the primary historical graph has too many data points.
- Fixed sqlite3 errors from being ignored (now always logged).
- Fixed Minecraft session server URL (sessionserver.mojang.com -> session.minecraft.net)
- Updated to use parcel2
- Updated various dependencies.

**5.5.8** *(August 1 2020)*
- Adds daily database copies. This is mostly for use by Minetrack Data for automated exports. By setting `createDailyDatabaseCopy: true` in `config.json`, Minetrack will lazily create a copy of `database.sql` for each day, automatically rolling over to a new file each day. The database file is named in the format of `database_copy_(day)-(month)-(year).sql`. Daily database copies do not contain indexes or previous records. Pings are inserted into the daily database copy as they occur, Minetrack will not retroactively insert previous pings from `database.sql`.
-  Bump lodash from 4.17.15 to 4.17.19

**5.5.7** *(July 7 2020)*
- Fixes an issue in which the light theme CSS may not be applied by default.

**5.5.6** *(June 24 2020)*
- Adds Minecraft versions 1.16 and 1.16.1 to `minecraft_versions.json`
- Fixes the historical graph not updating.

**5.5.5** *(June 17 2020)*
- Fixes servers with constant player counts failing to render graphs due to the min/max values being equal.

**5.5.4** *(June 16 2020)*
- Updated uPlot dependency 1.0.8 -> 1.0.11.

**5.5.3** *(June 14 2020)*
- Fixed issue with graph scales being wrongly set which could cause Y axis labels to not appear.

**5.5.2** *(June 12 2020)*
- Fixed ping errors causing server graphs (or the historical graph) to sometimes disappear.
- Fixed ping errors causing server graphs to reset their Y scale minimum to 0.
- Improved zoomed detection and updating of the historical graph with recommendations by [@leeoniya](https://github.com/leeoniya).

**5.5.1** *(June 10 2020)*
- New tooltip hover design on the historical graph. It will highlight the server closest to your cursor.
- Historical graph is now limited to 10,000 increments on the Y axis. This prevents servers with over 100,000 players forcing the graph into 100,000 increments.
- Fixed the historical graph zooming out when receiving new data points.
- Fixed newly added servers aligning to the left of the historical graph.
- Replaces manual string concats with template literals.
- Updated various dependencies.

**5.5.0** *(May 20 2020)*

**IMPORTANT**
This update moves ping timestamps to a shared timestamp per round. Meaning that when pinging servers, each will share the same timestamp for that series of pings. The legacy backend used a timestamp per ping per series of pings. This means after updating Minetrack, the historical graph may render slightly inaccurate for the first 24 hours (or whatever your config.json->graphDuration is), and will automatically correct itself as it receives new updates. Don't worry.

- Replaces flot.js charts with uPlot charts. This new chart library renders much quicker and supports a reduced data format. This results in ~1/12th the bandwidth use when sending the historical graph. 
- Removed jQuery (flot.js required this dependency). Between removing flot.js and jQuery, the page size has been reduced by 100KB (33%)!
- New historical graph tooltip design to better compare multiple servers.
- Historical graph now supports click dragging to zoom in to a custom time frame. Double click to reset.
- Historical graph now displays time markers along the bottom.
- All graphs now have horizontal ticks to improve readability.
- Graphs will now display gaps (null) when the ping fails. This removes legacy graph smoothing code and prevents 0 player count pings messing up graph scales.
- Graphs will now render the same on initial page load as they will after being open for a while. This fixes a long standing bug where the frontend ignored 0 player count pings in updates but not on initial load.
- Removes the mobile browser detection/manual historical graph load request. It is now automatically loaded given its smaller size.

Faster, smaller, more features.

**5.4.3** *(May 14 2020)*
- Added support for the optional field `config->skipSrvTimeout` in `config.json`. If a configured server does not return a valid response when unfurling potential SRV records, it will avoid re-unfurling SRV records for this duration in milliseconds. Use a value of `0` to disable this feature altogether.
- Removes support for the `config->performance->skipUnfurlSrv` and `config->performance->unfurlSrvCacheTtl` fields in `config.json

**5.4.2** *(May 13 2020)*
- Fixes a typo causing `_minecraft._tcp.*` SRV records to not resolve.

**5.4.1** *(May 10 2020)*
- Adds warnings when the system is pinging more frequently than it is getting replies.
- Replaces the legacy mc-ping-updated dependency with a new library, mcping-js. This fixes some bugs that could cause "zombie" connections and cause stuttering in the ping loops.
- Fixes potential crash issue when hashing favicons.

**5.4.0** *(May 9 2020)*
- Favicons are now served over the http server (using a unique hash). This allows the favicons to be safely cached for long durations and still support dynamic updates.
- Adds "graphDurationLabel" to `config.json` which allows you to manually modify the "24h Peak" label to a custom time duration.
- Adds "serverGraphDuration" (default 3 minutes) to `config.json` which allows you to specify the max time duration for the individual server player count graphs.
- Adds "performance.skipUnfurlSrv" (default false) to `config.json` which allows you to skip SRV unfurling when pinging. For those who aren't pinging servers that use SRV records, this should help speed up ping times.
- Adds "performance.skipUnfurlSrv" (default 120 seconds) to `config.json` which allows you specify how long a SRV unfurl should be cached for. This prevents repeated, potentially slow lookups. Set to 0 to disable caching.
- Ping timestamps are now shared between all server pings. This means less data transfer when loading or updating the page, less memory usage by the backend and frontend, and less hectic updates on the frontend.
- Optimized several protocol level schemas to remove legacy format waste. Less bandwidth!
- Fixes a bug where favicons may not be updated if the page is loaded prior to their initialization.

**5.3.1** *(May 5 2020)*
- Fixes Mojang service status indicators not updating after initial page load.

**5.3.0** *(May 5 2020)*
- Replaces socket.io library (and dependency) with vanilla WebSockets.
- Frontend reconnect behavior has been improved to use exponential backoff behavior (up to 30 seconds) with unlimited retries.
- The "Lost connection!" message will now show the reconnection attempt timer.
- "Counting N players on N Minecraft servers" is now instantly updated when initially loading the page.

**5.2.1** *(May 1 2020)*
- The historical graph will now auto scale its yaxis steps.

**5.2.0** *(Apr 29 2020)*
- Updated protocol to use serverIds instead of string names. This will reduce wasted bandwidth when pushing updates.
- Removed "updatePeak", "peaks" and "updateHistoryGraph" socket events. Their behavior has been optimized and merged into "update".
- Removed various legacy code.

**5.1.2** *(Apr 22 2020)*
- Fixes the historical graph overflowing the maximum graphDuration value.

**5.1.1** *(Apr 21 2020)*
- Fixes records being overwritten after boot. This bug did not corrupt saves and is only a visual error.

**5.1.0** *(Apr 21 2020)*
- Completely rebuilt the backend. This includes several optimizations, code cleanup and syncing fixes. Its code model now pairs nicely with the frontend's Javascript model.

**5.0.0** *(Apr 8 2020)*
- New logo!
- Completely rebuilt the frontend's Javascript (heavy optimizations and cleanup!)
- Adds a button for mobile devices to manually request the historical graph
- Adds timestamp to each server's player count record
- Adds the ability to favorite servers so they'll always be sorted first
- Adds "Sort By" option for controlling the server listing sort order
- Adds "Only Favorites" button to graph controls
- Adds ESLint configuration
- New missing favicon icon
- The versions section, and minecraft.json file, have been merged into minecraft_versions.json
- Removes "routes" from config.json. The HTTP server will now serve static assets from dist/
- Added Parcel bundler which bundles the assets/ directory into dist/ 
- Custom favicons are now served from "favicons/" directory and their configuration moved into servers.json. Paths in servers.json should be updated to reflect their filename without the path.
- Added finalhandler and serve-static dependencies
- Add ```npm run dev``` and ```npm run build``` scripts to package.json
- Added a distinct loading/connection status screen to simplify state management
- publicConfig.json is now sent over the socket connection so the frontend can be safely reloaded on rebooted instances
- Tooltips have been optimized and updated to a more readable design
- Initial page loading has been optimized
- MISSING_FAVICON_BASE64 has been moved to a file, images/missing_favicon.svg to improve caching behavior (and its customizable now!)
- Peak player count labels are formatted using the graphDuration hours and now displays the timestamp seconds
- Fixed favicon payloads being repeatedly sent.
- Fixed the page being broken when connecting to a freshly booted instance
- Fixed graphs starting at 0 player count when a server is initially pinged
- Fixed status text ocassionally not being shown
- Fixed some elements/frontend state not being completely reset on disconnect
- Fixed Minecraft Bedrock Edition servers showing the default port of 19132
- Fixed tooltips overflowing the page width
- Fixed backend bug causing servers to skip some Minecraft versions
- Minor connection blips have a grace period before the UI is updated, this prevents page reshuffle spam when experiencing minor connection issues
- Moved localStorage keys to "minetrack_hidden_servers" since the data structure has been changed
- Removed #validateBootTime loop and logic
- Removed mime dependency

**4.0.5** *(Apr 1 2020)*
- The frontend will now auto calculate the "24h Peak" label using your configured graphDuration in config.json

**4.0.3** *(Apr 1 2020)*
- Updated jquery dependency, 2.1.4->3.4.1
- Updated socket.io dependency, 1.3.7->2.3.0 (fixes several socket.io low risk vulns)
- Logs CF-Connecting-IP/X-Forwarded-For headers when present
- Added Minecraft version 1.15.1 support to config.json & minecraft.json

**4.0.2** *(Apr 1 2020)*
- Updated install.sh & start.sh scripts
- Committed package-lock.json
- Fixed outdated package.json version

**4.0.1** *(Apr 1 2020)*
- Fixed potential crash issue during startup when determining 24 hour graph peaks.
- Fixed a bug in the frontend that could result in "undefined" AM/PM time markers.
- Added protection to prevent artifically high player counts (>250k) degrading browser performance by abusing the graphs.
- Updated mime dependency, 1.3.4->2.4.4
- Updated request dependency, 2.74.0->2.88.2 (deprecated, should investigate removal)
- Updated sqlite3 dependency, 3.1.8->4.1.1 (fixes macOS install issue)
- winston & socket.io dependencies were not updated due to broken behavior. Will investigate as a follow up patch.

**4.0.0** *(Mar 30 2020)*
- Added dark mode
- Added 24hr peak feature
- Removed legacy category system
- Removed /status.json deprecation warning
- Removed Google Analytics tracker
- Changed default footer text
- Various bug fixes
- Removed gulp build tools

**3.1.0** *(Mar 14 2017)*
- Updated design. More flexible!
- Automatically builds indexes on database.
- Fixes issue with record query.

**3.0.0** *(Mar 11 2017)*
- Adds player count records.
- Adds "serverTypesVisible" to hide PC/PE badges.
- Moves Minecraft protocol versions out of site.js and into minecraft.json.
- Design tweaks to remove fluff.
- Fixes various bugs.

**2.2.2** *(Jul 5 2016)*
- Now builds against mcpe-ping-fixed (requires a ```npm install```)!

**2.2.1** *(Jun 20 2016)*
- Design tweaks (sticky bar at top, updated header/footer)
- New favicon 

**2.2.0** *(Mar 6 2016)*
- Added supported versions per network (courtesy of [@forairan](https://github.com/forairan))
- Updated dependency version of ```mc-ping-updated``` to 0.1.0

**2.1.0** *(Feb 23 2016)*
- You can now categorize servers. Add a "category tag" to their entry in ```servers.json```.
- Define the tags in ```config.json```, such as below:

```
"serverCategories": {
	"major": "Major Networks",
	"midsized": "Midsized Networks",
	"small": "Small Networks"
}
```
- If you have no categories, it will create a (hidden) category named "default".
- You can control whether or not categories are visible by default using the "categoriesVisible" tag in ```config.json```. 
  - If true and there's >1 category, the browser will have an option to hide/show the categories. Otherwise the controls are always hidden.
- New endpoint (```publicConfig.json```) allows the browser to know system details before the socket connection is established.
- New header design to make it less annoying.
- Various bug fixes.

**2.0.0** *(Feb 1 2016)*
- Servers are now referenced by their name on the graph controls instead of their IP.
- Servers now display their name on hover instead of their IP.
- Graph controls are now saved and loaded automatically.
- Moved server configuration into servers.json from config.json.
