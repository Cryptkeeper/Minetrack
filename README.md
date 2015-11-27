### Minetrack 
Minetrack is a Minecraft PC/PE server tracker that lets you focus on what's happening *now*. 
Built to be lightweight and durable, you can easily adapt it to monitor BungeeCord or server instances.

#### Try it out!
You can see an up-to-date copy of the master branch running on http://rewrite.minetrack.me

#### Usage
1. Customize it by editing the ```config.json``` file.
2. Run ```npm install```.
2. Run ```node app.js``` to boot the system (may need sudo!)

(There's also ```install.sh``` and ```start.sh```, but they may not for your installations.)

#### Angular TODO
 - ~~Fix sorting problem on main ng-repeat~~
 - ~~Add icon list from left~~
 - ~~Fix flot to force data change to update graph~~
 - ~~Implement Mojang status to socket status~~
 - Implement graph hover (event isn't firing correctly)

#### TODO
- Add auto-reconnect to frontend.
- Add public API (similiar to old server.json)
- Add ingame server, similiar to old mc.minetrack.me
- History graphs (database?)
