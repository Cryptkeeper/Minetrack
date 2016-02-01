### Minetrack 
Minetrack is a Minecraft PC/PE server tracker that lets you focus on what's happening *now*. 
Built to be lightweight and durable, you can easily adapt it to monitor BungeeCord or server instances.

#### Try it out!
You can see an up-to-date copy of the master branch running on http://minetrack.me

#### Usage
1. Customize it by editing the ```config.json``` file.
2. Run ```npm install```.
2. Run ```node app.js``` to boot the system (may need sudo!)

(There's also ```install.sh``` and ```start.sh```, but they may not work for your OS.)

Database logging is disabled by default. You can enable it in ```config.json``` by setting ```logToDatabase``` to true.
This requires sqlite3 drivers to be installed.

#### How do I get added?
At the moment, the main "minetrack.me" site is only accepting networks that average roughly 1,000 players at peak for **PC** servers, and 100 players at peak for **PE** servers. This is due to limited capacity and it's functionality. If you fit this description, you're welcome to open a Pull Request adding the network to ```config.json```.

#### TODO
- Add public API (similiar to old server.json)
- Add ingame server, similiar to old mc.minetrack.me
