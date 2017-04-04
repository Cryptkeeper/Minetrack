var server = require('./lib/server');
var ping = require('./lib/ping');
var logger = require('./lib/logger');
var mojang = require('./lib/mojang_services');
var util = require('./lib/util');
var db = require('./lib/database');

var config = require('./config.json');
var servers = require('./servers.json');

var networkHistory = [];
var connectedClients = 0;

var currentVersionIndex = {
	'PC': 0,
	'PE': 0
};

var networkVersions = [];

var graphData = [];
var highestPlayerCount = {};
var lastGraphPush = [];

function pingAll() {
	for (var i = 0; i < servers.length; i++) {
		// Make sure we lock our scope.
		(function(network) {
			// Asign auto generated color if not present
			if (!network.color) {
				network.color = util.stringToColor(network.name);
			}

			var attemptedVersion = config.versions[network.type][currentVersionIndex[network.type]];
			ping.ping(network.ip, network.port, network.type, config.rates.connectTimeout, function(err, res) {
				// Handle our ping results, if it succeeded.
				if (err) {
					logger.log('error', 'Failed to ping ' + network.ip + ': ' + err.message);
				}

				// If we have favicon override specified, use it.
				if (res && config.faviconOverride && config.faviconOverride[network.name]) {
					res.favicon = config.faviconOverride[network.name];
				}

				handlePing(network, res, err, attemptedVersion);
			}, attemptedVersion);
		})(servers[i]);
	}

	currentVersionIndex['PC']++;
	currentVersionIndex['PE']++;

	if (currentVersionIndex['PC'] >= config.versions['PC'].length) {
		// Loop around
		currentVersionIndex['PC'] = 0;
	}

	if (currentVersionIndex['PE'] >= config.versions['PE'].length) {
		// Loop around
		currentVersionIndex['PE'] = 0;
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

	// If the result version matches the attempted version, the version is supported
	var _networkVersions = networkVersions[network.name];
	if (res) {
		if (res.version == attemptedVersion) {
			if (_networkVersions.indexOf(res.version) == -1) {
				_networkVersions.push(res.version);
			}
		} else {
			// Mismatch, so remove the version from the supported version list
			var index = _networkVersions.indexOf(attemptedVersion);
			if (index != -1) {
				_networkVersions.splice(index, 1);
			}
		}
	}

	// Update the clients
	var networkSnapshot = {
		info: {
			name: network.name,
			timestamp: util.getCurrentTimeMs(),
			type: network.type
		},
		versions: _networkVersions,
		record: highestPlayerCount[network.ip]
	};

	if (res) {
		networkSnapshot.result = res;

		// Validate that we have logToDatabase enabled otherwise in memory pings
		// will create a record that's only valid for the runtime duration.
		if (config.logToDatabase && res.players.online > highestPlayerCount[network.ip]) {
			highestPlayerCount[network.ip] = res.players.online;
		}
	} else if (err) {
		networkSnapshot.error = err;
	}

	server.io.sockets.emit('update', networkSnapshot);

	var _networkHistory = networkHistory[network.name];

	// Remove our previous data that we don't need anymore.
	for (var i = 0; i < _networkHistory.length; i++) {
        delete _networkHistory[i].info;

        if (_networkHistory[i].result) {
        	delete _networkHistory[i].result.favicon;
        }
	}

	_networkHistory.push({
		error: err,
		result: res,
		versions: _networkVersions,
		timestamp: util.getCurrentTimeMs(),
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
		db.log(network.ip, util.getCurrentTimeMs(), res ? res.players.online : 0);
	}

	// Push it to our graphs.
	var timeMs = util.getCurrentTimeMs();

	// The same mechanic from trimUselessPings is seen here.
	// If we dropped the ping, then to avoid destroying the graph, ignore it.
	// However if it's been too long since the last successful ping, we'll send it anyways.
	if (config.logToDatabase) {
		if (!lastGraphPush[network.ip] || (timeMs - lastGraphPush[network.ip] >= 60 * 1000 && res) || timeMs - lastGraphPush[network.ip] >= 70 * 1000) {
			lastGraphPush[network.ip] = timeMs;

			// Don't have too much data!
			util.trimOldPings(graphData);

			if (!graphData[network.name]) {
				graphData[network.name] = [];
			}

			graphData[network.name].push([timeMs, res ? res.players.online : 0]);

			// Send the update.
			server.io.sockets.emit('updateHistoryGraph', {
				ip: network.ip,
				name: network.name,
				players: (res ? res.players.online : 0),
				timestamp: timeMs
			});
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

		logger.log('info', '%s connected, total clients: %d', client.request.connection.remoteAddress, connectedClients);

		// We send the boot time (also sent in publicConfig.json) to the frontend to validate they have the same config.
		// If so, they'll send back "requestListing" event, otherwise they will pull the new config and retry.
		client.emit('bootTime', util.getBootTime());

		// Attach our listeners.
		client.on('disconnect', function() {
			connectedClients -= 1;

			logger.log('info', '%s disconnected, total clients: %d', client.request.connection.remoteAddress, connectedClients);
		});

		client.on('requestHistoryGraph', function() {
			if (config.logToDatabase) {
				// Send them the big 24h graph.
				client.emit('historyGraph', graphData);
			}
		});

		client.on('requestListing', function() {
			// Send them our previous data, so they have somewhere to start.
			client.emit('updateMojangServices', mojang.toMessage());

			// Remap our associative array into just an array.
			var networkHistoryKeys = Object.keys(networkHistory);

			networkHistoryKeys.sort();

			// Send each individually, this should look cleaner than waiting for one big array to transfer.
			for (var i = 0; i < servers.length; i++) {
				var server = servers[i];

				if (!(server.name in networkHistory) || networkHistory[server.name].length < 1) {
					// This server hasn't been ping'd yet. Send a hacky placeholder.
					client.emit('add', [[{
						error: {
							description: 'Waiting'
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
					client.emit('add', [networkHistory[networkHistoryKeys[i]]]);
				}
			}

			client.emit('syncComplete');
		});
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
			(function(server) {
				db.getTotalRecord(server.ip, function(record) {
					logger.log('info', 'Completed query for %s', server.ip);

					highestPlayerCount[server.ip] = record;

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
