var server = require('./lib/server');
var ping = require('./lib/ping');
var logger = require('./lib/logger');
var mojang = require('./lib/mojang_services');

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

				server.io.sockets.emit('update', res);

				// Log our response.
				if (!networkHistory[network.ip]) {
					networkHistory[network.ip] = [];
				}

				var _networkHistory = networkHistory[network.ip];

				// Remove our previous entrie's favicons, we don't need them, just the latest one.
				for (var i = 0; i < _networkHistory.length; i++) {
					delete _networkHistory[i].favicon;
				}

				_networkHistory.push({
					error: err,
					result: res
				});

				// Make sure we never log too much.
				if (_networkHistory.length > 300) {
					_networkHistory.shift();
				}
			});
		})(servers[i]);
	}
}

// Start our main loop that does everything.
function startMainLoop() {
	setInterval(pingAll, config.rates.pingAll);

	setInterval(function() {
		mojang.update(config.rates.mojangStatusTimeout);

		server.io.sockets.emit('updateMojangServices', mojang.toMessage());
	}, config.rates.upateMojangStatus);

	// Manually fire the first round of our tasks.
	mojang.update(config.rates.mojangStatusTimeout);
	server.io.sockets.emit('updateMojangServices', mojang.toMessage());

	pingAll();
}

server.start(function() {
	// Track how many people are currently connected.
	server.io.on('connect', function(client) {
		// We're good to connect them!
		connectedClients += 1;

		logger.log('info', 'Accepted connection: %s, total clients: %d', client.request.connection.remoteAddress, connectedClients);

		// Remap our associative array into just an array.
		var networkHistoryList = [];
		var networkHistoryKeys = Object.keys(networkHistory);

		for (var i = 0; i < networkHistoryKeys.length; i++) {
			networkHistoryList.push(networkHistory[networkHistoryKeys[i]]);
		}

		// Send them our previous data, so they have somewhere to start.
		client.emit('add', networkHistoryList);

		// Attach our listeners.
		client.on('disconnect', function(client) {
			connectedClients -= 1;

			logger.log('info', 'Client disconnected, total clients: %d', connectedClients);
		});
	});

	startMainLoop();
});