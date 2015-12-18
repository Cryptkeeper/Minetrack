var server = require('./lib/server');
var ping = require('./lib/ping');
var logger = require('./lib/logger');
var mojang = require('./lib/mojang_services');
var util = require('./lib/util');
var db = require('./lib/database');

var config = require('./config.json');

var networkHistory = [];
var connectedClients = 0;

var graphData = [];
var lastGraphPush = [];

function pingAll() {
	var servers = config.servers;

	for (var i = 0; i < servers.length; i++) {
		// Make sure we lock our scope.
		(function(network) {
			ping.ping(network.ip, network.port, network.type, config.rates.connectTimeout, function(err, res) {
				// Handle our ping results, if it succeeded.
				if (err) {
					logger.log('error', 'Failed to ping ' + network.ip + ': ' + JSON.stringify(err));
				}

				// If we have favicon override specified, use it.
				if (res && config.faviconOverride && config.faviconOverride[network.name]) {
					res.favicon = config.faviconOverride[network.name];
				}

				var networkSnapshot = {
					info: {
						name: network.name,
						timestamp: util.getCurrentTimeMs()
					}
				};

				if (res) {
					networkSnapshot.result = res;
				} else if (err) {
					networkSnapshot.error = err;
				}

				server.io.sockets.emit('update', networkSnapshot);

				// Log our response.
				if (!networkHistory[network.name]) {
					networkHistory[network.name] = [];
				}

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
				if (!lastGraphPush[network.ip] || (timeMs - lastGraphPush[network.ip] >= 60 * 1000 && res) || timeMs - lastGraphPush[network.ip] >= 70 * 1000) {
					lastGraphPush[network.ip] = timeMs;

					// Don't have too much data!
					if (graphData[network.ip].length >= 24 * 60) {
						graphData[network.ip].shift();
					}

					graphData[network.ip].push([timeMs, res ? res.players.online : 0]);

					// Send the update.
					server.io.sockets.emit('updateHistoryGraph', {
						ip: network.ip,
						players: (res ? res.players.online : 0),
						timestamp: timeMs
					});
				}
			});
		})(servers[i]);
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

if (config.logToDatabase) {
	// Setup our database.
	db.setup();

	var timestamp = util.getCurrentTimeMs();

	db.queryPings(24 * 60 * 60 * 1000, function(data) {
		graphData = util.convertPingsToGraph(data);

		logger.log('info', 'Queried and parsed ping history in %sms', util.getCurrentTimeMs() - timestamp);
	});
} else {
	logger.warn('Database logging is not enabled. You can enable it by setting "logToDatabase" to true in config.json. This requires sqlite3 to be installed.');
}

server.start(function() {
	// Track how many people are currently connected.
	server.io.on('connect', function(client) {
        // If we haven't sent out at least one round of pings, disconnect them for now.
        if (Object.keys(networkHistory).length < config.servers.length) {
            client.disconnect();

            return;
        }

		// We're good to connect them!
		connectedClients += 1;

		logger.log('info', 'Accepted connection: %s, total clients: %d', client.request.connection.remoteAddress, connectedClients);

		setTimeout(function() {
			// Send them our previous data, so they have somewhere to start.
			client.emit('updateMojangServices', mojang.toMessage());

			// Remap our associative array into just an array.
			var networkHistoryKeys = Object.keys(networkHistory);

			networkHistoryKeys.sort();

			// Send each individually, this should look cleaner than waiting for one big array to transfer.
			for (var i = 0; i < networkHistoryKeys.length; i++) {
				client.emit('add', [networkHistory[networkHistoryKeys[i]]]);
			}

			// Send them the big 24h graph.
			client.emit('historyGraph', graphData);
		}, 1);

		// Attach our listeners.
		client.on('disconnect', function(client) {
			connectedClients -= 1;

			logger.log('info', 'Client disconnected, total clients: %d', connectedClients);
		});
	});

	startMainLoop();
});