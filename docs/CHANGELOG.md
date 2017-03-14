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
