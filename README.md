### Minetrack 
Minetrack is a Minecraft PC/PE server tracker that lets you focus on what's happening *now*. 
Built to be lightweight and durable, you can easily adapt it to monitor BungeeCord or server instances.

#### Migrating to Minetrack 5
See our Minetrack 5 [migration guide](docs/MIGRATING.md).

#### This project is not actively maintained!
This project and the offical website are not actively maintained anymore, but you are welcome to run your own instances of Minetrack.
I will however review and accept pull-requests, so please share any improvements you are making so everybody can benefit from them.

You can find a list of community hosted instances below:  
* https://minetrack.me
* https://trackedservers.com

Want to be listed here? Add yourself in a pull-request!

#### Try it out!
You can see an up-to-date copy of the production branch running on https://minetrack.me

"master" branch contains everything you need to start your own copy. "prod" and "prod-bedrock" branches are what is used in the production environment of the minetrack.me sites.

#### Usage
1. Make sure everything is correct in ```config.json```.
2. Add/remove servers by editing the ```servers.json``` file
3. Run ```npm install```
4. Run ```npm run build``` (this bundles `assets/` into `dist/`)
4. Run ```node main.js``` to boot the system (may need sudo!)

(There's also ```install.sh``` and ```start.sh```, but they may not work for your OS.)

Database logging is disabled by default. You can enable it in ```config.json``` by setting ```logToDatabase``` to true.
This requires sqlite3 drivers to be installed.

#### What's being changed?
For the changelog, check out the [CHANGELOG](docs/CHANGELOG.md) file.
