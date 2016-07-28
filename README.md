### Minetrack 
Minetrack is a Minecraft PC/PE server tracker that lets you focus on what's happening *now*. 
Built to be lightweight and durable, you can easily adapt it to monitor BungeeCord or server instances.

#### Try it out!
You can see an up-to-date copy of the production branch running on http://minetrack.me

"master" branch contains everything you need to start your own copy. "production" branch is what's used in the production environment of the minetrack.me site.

#### Usage
1. Make sure everything is correct in ```config.json```.
2. Add/remove servers by editing the ```servers.json``` file.
3. Run ```npm install```.
4. Run ```node app.js``` to boot the system (may need sudo!)

(There's also ```install.sh``` and ```start.sh```, but they may not work for your OS.)

Database logging is disabled by default. You can enable it in ```config.json``` by setting ```logToDatabase``` to true.
This requires sqlite3 drivers to be installed.

#### What's being changed?
For the changelog, check out the [CHANGELOG](docs/CHANGELOG.md) file.