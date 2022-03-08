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

### Community Showcase
You can find a list of community hosted instances below. Want to be listed here? Add yourself in a pull request!

* https://minetrack.me
* https://bedrock.minetrack.me
* https://track.read-my-man.ga
* https://trackedservers.com
* https://suomimine.fi
* https://minetrack.geyserconnect.net
* https://minetrack.rmly.dev
* https://minetrack.fi
* https://livemcbe.ru
* https://ruminetrack.merded.xyz
* https://bleepotrack.xyz
* https://pvp-factions.fr

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

## Docker
Minetrack can be built and run with Docker from this repository in several ways:

### Build and deploy directly with Docker
```
# build image with name minetrack and tag latest
docker build . --tag minetrack:latest

# start container, delete on exit
# publish container port 8080 on host port 80
docker run --rm --publish 80:8080 minetrack:latest
```

The published port can be changed by modifying the parameter argument, e.g.:  
* Publish to host port 8080: `--publish 8080:8080`  
* Publish to localhost (thus prohibiting external access): `--publish 127.0.0.1:8080:8080`

### Build and deploy with docker-compose
```
# build and start service
docker-compose up --build

# stop service and remove artifacts
docker-compose down
```

## Nginx reverse proxy
The following configuration enables Nginx to act as reverse proxy for a Minetrack instance that is available at port 8080 on localhost:
```
server {
    server_name minetrack.example.net;
    listen 80;
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```
