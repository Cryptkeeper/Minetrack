/**
 * THIS IS LEGACY, UNMAINTAINED CODE
 * IT MAY (AND LIKELY DOES) CONTAIN BUGS
 * USAGE IS NOT RECOMMENDED
 */
var server = require('./lib/server');
var ping = require('./lib/ping');
var logger = require('./lib/logger');
var mojang = require('./lib/mojang_services');
var util = require('./lib/util');
var db = require('./lib/database');

var config = require('./config.json');
var servers = require('./servers.json');
var minecraftVersions = require('./minecraft_versions.json');

var networkHistory = [];
var connectedClients = 0;

var networkVersions = [];

const lastFavicons = [];

var graphData = [];
var highestPlayerCount = {};
var lastGraphPush = [];
var graphPeaks = {};

const serverProtocolVersionIndexes = []

function getNextProtocolVersion (server) {
	// Minecraft Bedrock Edition does not have protocol versions
	if (server.type === 'PE') {
		return {
			protocolId: 0,
			protocolIndex: 0
		}
	}
	const protocolVersions = minecraftVersions[server.type]
	let nextProtocolVersion = serverProtocolVersionIndexes[server.name]
	if (typeof nextProtocolVersion === 'undefined' || nextProtocolVersion + 1 >= protocolVersions.length) {
		nextProtocolVersion = 0
	} else {
		nextProtocolVersion++
	}
	serverProtocolVersionIndexes[server.name] = nextProtocolVersion
	return {
		protocolId: protocolVersions[nextProtocolVersion].protocolId,
		protocolIndex: nextProtocolVersion
	}
}

function pingAll() {
	for (var i = 0; i < servers.length; i++) {
		// Make sure we lock our scope.
		(function(network) {
			// Asign auto generated color if not present
			if (!network.color) {
				network.color = util.stringToColor(network.name);
			}

			const attemptedVersion = getNextProtocolVersion(network)
			ping.ping(network.ip, network.port, network.type, config.rates.connectTimeout, function(err, res) {
				// Handle our ping results, if it succeeded.
				if (err) {
					logger.log('error', 'Failed to ping ' + network.ip + ': ' + err.message);
				}

				// If we have favicon override specified, use it.
				if (network.favicon) {
					res.favicon = network.favicon
				}

				handlePing(network, res, err, attemptedVersion);
			}, attemptedVersion.protocolId);
		})(servers[i]);
	}
}

// This is where the result of a ping is feed.
// This stores it and converts it to ship to the frontend.
function handlePing(network, res, err, attemptedVersion) {
	// Log our response.
	if (!networkHistory[network.name]) {
		networkHistory[network.name] = [];
	}

	// Update the version list
	if (!networkVersions[network.name]) {
		networkVersions[network.name] = [];
	}

	const serverVersionHistory = networkVersions[network.name]

	// If the result version matches the attempted version, the version is supported
	if (res && res.version !== undefined) {
		const indexOf = serverVersionHistory.indexOf(attemptedVersion.protocolIndex)

		// Test indexOf to avoid inserting previously recorded protocolIndex values
		if (res.version === attemptedVersion.protocolId && indexOf === -1) {
			serverVersionHistory.push(attemptedVersion.protocolIndex)
		} else if (res.version !== attemptedVersion.protocolId && indexOf >= 0) {
			serverVersionHistory.splice(indexOf, 1)
		}
	}

	const timestamp = util.getCurrentTimeMs()

	if (res) {
		const recordData = highestPlayerCount[network.ip]

		// Validate that we have logToDatabase enabled otherwise in memory pings
		// will create a record that's only valid for the runtime duration.
		if (config.logToDatabase && (!recordData || res.players.online > recordData.playerCount)) {
			highestPlayerCount[network.ip] = {
				playerCount: res.players.online,
				timestamp: timestamp
			}
		}
	}

	// Update the clients
	var networkSnapshot = {
		info: {
			name: network.name,
			timestamp: timestamp,
			type: network.type
		},
		versions: serverVersionHistory,
		recordData: highestPlayerCount[network.ip]
	};

	if (res) {
		networkSnapshot.result = res;

		// Only emit updated favicons
		// Favicons will otherwise be explicitly emitted during the handshake process
		if (res.favicon) {
			const lastFavicon = lastFavicons[network.name]
			if (lastFavicon !== res.favicon) {
				lastFavicons[network.name] = res.favicon
				networkSnapshot.favicon = res.favicon // Send updated favicon directly on object
			}
			delete res.favicon // Never store favicons in memory outside lastFavicons
		}
	} else if (err) {
		networkSnapshot.error = err;
	}

	server.io.sockets.emit('update', networkSnapshot);

	var _networkHistory = networkHistory[network.name];

	// Remove our previous data that we don't need anymore.
	for (var i = 0; i < _networkHistory.length; i++) {
		delete _networkHistory[i].versions
        delete _networkHistory[i].info;
	}

	_networkHistory.push({
		error: err,
		result: res,
		versions: serverVersionHistory,
		timestamp: timestamp,
        info: {
            ip: network.ip,
            port: network.port,
            type: network.type,
            name: network.name
        }
	});

	// Make sure we never log too much.
	if (_networkHistory.length > 72) { // 60/2.5 = 24, so 24 is one minute
		_networkHistory.shift();
	}

	// Log it to the database if needed.
	if (config.logToDatabase) {
		db.log(network.ip, timestamp, res ? res.players.online : 0);
	}


	// The same mechanic from trimUselessPings is seen here.
	// If we dropped the ping, then to avoid destroying the graph, ignore it.
	// However if it's been too long since the last successful ping, we'll send it anyways.
	if (config.logToDatabase) {
		if (!lastGraphPush[network.ip] || (timestamp - lastGraphPush[network.ip] >= 60 * 1000 && res) || timestamp - lastGraphPush[network.ip] >= 70 * 1000) {
			lastGraphPush[network.ip] = timestamp;

			// Don't have too much data!
			util.trimOldPings(graphData);

			if (!graphData[network.name]) {
				graphData[network.name] = [];
			}

			graphData[network.name].push([timestamp, res ? res.players.online : 0]);

			// Send the update.
			server.io.sockets.emit('updateHistoryGraph', {
				ip: network.ip,
				name: network.name,
				players: (res ? res.players.online : 0),
				timestamp: timestamp
			});
		}

		// Update calculated graph peak regardless if the graph is being updated
		// This can cause a (harmless) desync between live and stored data, but it allows it to be more accurate for long surviving processes
		var networkData = graphData[network.name];

		if (networkData) {
			var graphPeakIndex = -1;
			var graphPeakPlayerCount = 0;
			for (var i = 0; i < networkData.length; i++) {
				// [1] refers to the online player count
				var point = networkData[i][1];
				if (point > 0 && (graphPeakIndex === -1 || point > graphPeakPlayerCount)) {
					graphPeakIndex = i;
					graphPeakPlayerCount = point;
				}
			}
			// Test if a highest index has been selected and has changed from any previous selections
			var previousPeak = graphPeaks[network.name];
			// [1] refers to the online player count
			if (graphPeakIndex !== -1 && (!previousPeak || previousPeak[1] !== graphPeakPlayerCount)) {
				var graphPeakData = networkData[graphPeakIndex];
				graphPeaks[network.name] = graphPeakData;

				// Broadcast update event to clients
				server.io.sockets.emit('updatePeak', {
					ip: network.ip,
					name: network.name,
					players: graphPeakData[1],
					timestamp: graphPeakData[0]
				});
			}
		}
	}
}

// Start our main loop that does everything.
function startMainLoop() {
	util.setIntervalNoDelay(pingAll, config.rates.pingAll);

	util.setIntervalNoDelay(function() {
		mojang.update(config.rates.mojangStatusTimeout);

		server.io.sockets.emit('updateMojangServices', mojang.toMessage());
	}, config.rates.upateMojangStatus);
}

function startServices() {
	server.start();

	// Track how many people are currently connected.
	server.io.on('connect', function(client) {
		// We're good to connect them!
		connectedClients += 1;

		logger.log('info', '%s connected, total clients: %d', util.getRemoteAddr(client.request), connectedClients);

		// Attach our listeners.
		client.on('disconnect', function() {
			connectedClients -= 1;

			logger.log('info', '%s disconnected, total clients: %d', util.getRemoteAddr(client.request), connectedClients);
		});

		client.on('requestHistoryGraph', function() {
			if (config.logToDatabase) {
				// Send them the big 24h graph.
				client.emit('historyGraph', graphData);

				// Send current peaks, if any
				if (Object.keys(graphPeaks).length > 0) {
					client.emit('peaks', graphPeaks);
				}
			}
		});

		const minecraftVersionNames = {}
		Object.keys(minecraftVersions).forEach(function (key) {
			minecraftVersionNames[key] = minecraftVersions[key].map(version => version.name)
		})

		// Send configuration data for rendering the page
		client.emit('setPublicConfig', {
			graphDuration: config.graphDuration,
			servers: servers,
			minecraftVersions: minecraftVersionNames,
			isGraphVisible: config.logToDatabase
		});

		// Send them our previous data, so they have somewhere to start.
		client.emit('updateMojangServices', mojang.toMessage());

		// Send each individually, this should look cleaner than waiting for one big array to transfer.
		for (var i = 0; i < servers.length; i++) {
			var server = servers[i];

			if (!(server.name in networkHistory) || networkHistory[server.name].length < 1) {
				// This server hasn't been ping'd yet. Send a hacky placeholder.
				client.emit('add', [[{
					error: {
						description: 'Waiting...',
						placeholder: true
					},
					result: null,
					timestamp: util.getCurrentTimeMs(),
					info: {
						ip: server.ip,
						port: server.port,
						type: server.type,
						name: server.name
					}
				}]]);
			} else {
				// Append the lastFavicon to the last ping entry
				const serverHistory = networkHistory[server.name];
				const lastFavicon = lastFavicons[server.name];
				if (lastFavicon) {
					serverHistory[serverHistory.length - 1].favicon = lastFavicon
				}
				client.emit('add', [serverHistory])
			}
		}

		client.emit('syncComplete');
	});

	startMainLoop();
}

logger.log('info', 'Booting, please wait...');

if (config.logToDatabase) {
	// Setup our database.
	db.setup();

	var timestamp = util.getCurrentTimeMs();

	db.queryPings(config.graphDuration, function(data) {
		graphData = util.convertServerHistory(data);
		completedQueries = 0;

		logger.log('info', 'Queried and parsed ping history in %sms', util.getCurrentTimeMs() - timestamp);

		for (var i = 0; i < servers.length; i++) {
			// Compute graph peak from historical data
			var networkData = graphData[servers[i].name];
			if (networkData) {
				var graphPeakIndex = -1;
				var graphPeakPlayerCount = 0;
				for (var x = 0; x < networkData.length; x++) {
					// [1] refers to the online player count
					var point = networkData[x][1];
					if (point > 0 && (graphPeakIndex === -1 || point > graphPeakPlayerCount)) {
						graphPeakIndex = x;
						graphPeakPlayerCount = point;
					}
				}
				if (graphPeakIndex !== -1) {
					graphPeaks[servers[i].name] = networkData[graphPeakIndex];
					logger.log('info', 'Selected graph peak %d (%s)', networkData[graphPeakIndex][1], servers[i].name);
				}
			}

			(function(server) {
				db.getTotalRecord(server.ip, function(playerCount, timestamp) {
					logger.log('info', 'Computed total record %s (%d) @ %d', server.ip, playerCount, timestamp);

					highestPlayerCount[server.ip] = {
						playerCount: playerCount,
						timestamp: timestamp
					};

					completedQueries += 1;

					if (completedQueries === servers.length) {
						startServices();
					}
				});
			})(servers[i]);
		}
	});
} else {
	logger.log('warn', 'Database logging is not enabled. You can enable it by setting "logToDatabase" to true in config.json. This requires sqlite3 to be installed.');

	startServices();
}
