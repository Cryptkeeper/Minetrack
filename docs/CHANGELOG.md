**5.4.0** *(May 8 2020)*
- Adds "graphDurationLabel" to `config.json` which allows you to manually modify the "24h Peak" label to a custom time duration.
- Adds "serverGraphDuration" to `config.json` which allows you to specify the max time duration for the individual server player count graphs.
- Adds "performance.skipUnfurlSrv" to `config.json` which allows you to skip SRV unfurling when pinging. For those who aren't pinging servers that use SRV records, this should help speed up ping times.
- Ping timestamps are now shared between all server pings. This means less data transfer when loading or updating the page, less memory usage by the backend and frontend, and less hectic updates on the frontend.
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
