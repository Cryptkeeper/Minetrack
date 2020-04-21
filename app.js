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

const { ServerRegistration } = require('./lib/registration')

const serverRegistrations = []

var connectedClients = 0;

function pingAll() {
	for (var i = 0; i < servers.length; i++) {
		// Make sure we lock our scope.
		(function(network) {
			const serverRegistration = serverRegistrations[i]

			// Asign auto generated color if not present
			if (!network.color) {
				network.color = util.stringToColor(network.name);
			}

			const attemptedVersion = serverRegistration.getNextProtocolVersion()
			ping.ping(network.ip, network.port, network.type, config.rates.connectTimeout, function(err, res) {
				// Handle our ping results, if it succeeded.
				if (err) {
					logger.log('error', 'Failed to ping ' + network.ip + ': ' + err.message);
				}

				handlePing(network.serverId, res, err, attemptedVersion);
			}, attemptedVersion.protocolId);
		})(servers[i]);
	}
}

function handlePing (serverId, resp, err, version) {
  const serverRegistration = serverRegistrations[serverId]

  const timestamp = new Date().getTime()

  server.io.sockets.emit('update', serverRegistration.getUpdate(timestamp, resp, err, version))

  serverRegistration.addPing(timestamp, resp)

  if (config.logToDatabase) {
    const playerCount = resp ? resp.players.online : 0

    // Log to database
    db.log(serverRegistration.data.ip, timestamp, playerCount)

    if (serverRegistration.addGraphPoint(resp !== undefined, playerCount, timestamp)) {
      // Broadcast update event to clients
      server.io.sockets.emit('updateHistoryGraph', {
        name: serverRegistration.data.name,
        players: playerCount, // TODO: players -> playerCount
        timestamp: timestamp
      })
    }

    // Update calculated graph peak regardless if the graph is being updated
    // This can cause a (harmless) desync between live and stored data, but it allows it to be more accurate for long surviving processes
    if (serverRegistration.findNewGraphPeak()) {
      const graphPeak = serverRegistration.getGraphPeak()

      // Broadcast update event to clients
      server.io.sockets.emit('updatePeak', {
        name: serverRegistration.data.name,
        players: graphPeak.playerCount, // TODO: players -> playerCount
        timestamp: graphPeak.timestamp
      })
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

    client.on('requestHistoryGraph', () => {
      if (config.logToDatabase) {
        // Send historical graphData built from all serverRegistrations
        const graphData = {}
        const graphPeaks = {}

        serverRegistrations.forEach((serverRegistration) => {
          graphData[serverRegistration.data.name] = serverRegistration.graphData

          // Send current peak, if any
          const graphPeak = serverRegistration.getGraphPeak()
          if (graphPeak) {
            // TODO: convert structure into object
            graphPeaks[serverRegistration.data.name] = [graphPeak.timestamp, graphPeak.playerCount]
          }
        })

        client.emit('historyGraph', graphData)

        // Send current peaks, if any
        if (Object.keys(graphPeaks).length > 0) {
          client.emit('peaks', graphPeaks)
        }
      }
    })

    // TODO: use reduce
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

    const pingHistory = Object.values(serverRegistrations).map(serverRegistration => serverRegistration.getPingHistory())

    client.emit('add', pingHistory)

		client.emit('syncComplete');
	});

	startMainLoop();
}

logger.log('info', 'Booting, please wait...');

servers.forEach((data, i) => {
	data.serverId = i // TODO: remove me, legacy port hack
	serverRegistrations[i] = new ServerRegistration(i, data)
})

if (config.logToDatabase) {
	// Setup our database.
	db.setup();

	var timestamp = util.getCurrentTimeMs();

	db.queryPings(config.graphDuration, function(data) {
    const graphData = util.convertServerHistory(data)
		completedQueries = 0;

		logger.log('info', 'Queried and parsed ping history in %sms', util.getCurrentTimeMs() - timestamp);

		for (var i = 0; i < servers.length; i++) {
      const serverRegistration = serverRegistrations[i]

      serverRegistration.graphData = graphData[serverRegistration.data.name]

      if (serverRegistration.findNewGraphPeak()) {
        const graphPeak = serverRegistration.getGraphPeak()

        logger.log('info', 'Selected graph peak %d (%s)', graphPeak.playerCount, serverRegistration.data.name)
      }

			(function(server) {
				db.getTotalRecord(server.ip, function(playerCount, timestamp) {
          logger.log('info', 'Computed total record %s (%d) @ %d', server.ip, playerCount, timestamp);
          
          serverRegistration.recordData = {
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
