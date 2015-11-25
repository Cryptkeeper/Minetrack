var server = require('./lib/server');
var ping = require('./lib/ping');
var logger = require('./lib/logger');
var mojang = require('./lib/mojang_services');
var util = require('./lib/util');

var config = require('./config.json');

var networkHistory = [];
var connectedClients = 0;

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
		}, 1);

		// Attach our listeners.
		client.on('disconnect', function(client) {
			connectedClients -= 1;

			logger.log('info', 'Client disconnected, total clients: %d', connectedClients);
		});
	});

	startMainLoop();
});