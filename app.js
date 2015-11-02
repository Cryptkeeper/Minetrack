var server = require('./lib/server');
var ping = require('./lib/ping');
var logger = require('./lib/logger');

var config = require('./config.json');

var networkHistory = [];
var connectedClients = 0;

// Start our main loop that fires off pings.
setInterval(function() {
	var servers = config.servers;

	for (var i = 0; i < servers.length; i++) {
		// Make sure we lock our scope.
		(function(network) {
			ping.ping(network.ip, network.port || 25565, network.type, 2500, function(err, result) {
				// Handle our ping results, if it succeeded.
				if (err) {
					logger.log('error', 'Failed to ping ' + network.ip + ': ' + err);
				}

				server.io.sockets.emit('update', result);

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
					err: err,
					result: result
				});

				// Make sure we never log too much.
				if (_networkHistory.length > 300) {
					_networkHistory.shift();
				}
			});
		})(servers[i]);
	}
}, 2500);

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
});