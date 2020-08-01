<p align="center">
	<img width="120" height="120" src="assets/images/logo.svg">
</p>

# Minetrack
Minetrack makes it easy to keep an eye on your favorite Minecraft servers. Simple and hackable, Minetrack easily runs on any hardware. Use it for monitoring, analytics, or just for fun. [Check it out](https://minetrack.me).

### This project is not actively supported!
This project is not actively supported. Pull requests will be reviewed and merged (if accepted), but issues _might_ not be addressed outside of fixes provided by community members. Please share any improvements or fixes you've made so everyone can benefit from them.

### Features
- 🚀 Real time Minecraft server player count tracking with customizable update speed.
- 📝 Historical player count logging with 24 hour peak and player count record tracking.
- 📈 Historical graph with customizable time frame.
- 📦 Out of the box included dashboard with various customizable sorting and viewing options.
- 📱(Decent) mobile support.
- 🕹 Supports both Minecraft Java Edition and Minecraft Bedrock Edition.
- 🚨 [minecraft.net](https://minecraft.net) and [mojang.com](https://mojang.com) services status monitoring to watch for interruptions.

### Community Showcase
You can find a list of community hosted instances below. Want to be listed here? Add yourself in a pull request!

* https://minetrack.me
* https://bedrock.minetrack.me
* https://trackedservers.com
* https://ru-minetrack.merded.fun

## Updates
For updates and release notes, please read the [CHANGELOG](docs/CHANGELOG.md).

**Migrating to Minetrack 5?** See the [migration guide](docs/MIGRATING.md).

## Installation
1. Node 12.4.0+ is required (you can check your version using `node -v`)
2. Make sure everything is correct in ```config.json```.
3. Add/remove servers by editing the ```servers.json``` file
4. Run ```npm install```
5. Run ```npm run build``` (this bundles `assets/` into `dist/`)
6. Run ```node main.js``` to boot the system (may need sudo!)

(There's also ```install.sh``` and ```start.sh```, but they may not work for your OS.)

Database logging is disabled by default. You can enable it in ```config.json``` by setting ```logToDatabase``` to true.
This requires sqlite3 drivers to be installed.
