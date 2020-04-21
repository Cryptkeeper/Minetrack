var server = require('./lib/server');
var ping = require('./lib/ping');
var logger = require('./lib/logger');
var mojang = require('./lib/mojang_services');
var db = require('./lib/database');

// CLEAN IMPORTS ONLY BELOW
const config = require('./config.json')
const servers = require('./servers.json')
const minecraftVersions = require('./minecraft_versions.json')

const { ServerRegistration } = require('./lib/registration')

const util = require('./lib/util')

const serverRegistrations = []

let connectedClients = 0

function pingAll () {
  for (const serverRegistration of Object.values(serverRegistrations)) {
    const version = serverRegistration.getNextProtocolVersion()

    ping.ping(serverRegistration.data.ip, serverRegistration.data.port, serverRegistration.data.type, config.rates.connectTimeout, (err, resp) => {
      if (err) {
        logger.log('error', 'Failed to ping %s: %s', serverRegistration.data.ip, err.message)
      }

      handlePing(serverRegistration, resp, err, version)
    }, version.protocolId)
  }
}

function handlePing (serverRegistration, resp, err, version) {
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

function startAppLoop () {
  setInterval(pingAll, config.rates.pingAll)
  pingAll()

  setInterval(updateMojangServices, config.rates.updateMojangStatus)
  updateMojangServices()
}

function updateMojangServices () {
  // TODO: diff updates
  mojang.update(config.rates.mojangStatusTimeout)

  server.io.sockets.emit('updateMojangServices', mojang.toMessage())
}

function startServices () {
  server.start()

  server.io.on('connect', client => {
    connectedClients++

    logger.log('info', '%s connected, total clients: %d', util.getRemoteAddr(client.request), connectedClients);

    client.on('disconnect', () => {
      connectedClients--

      logger.log('info', '%s disconnected, total clients: %d', util.getRemoteAddr(client.request), connectedClients);
    })

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
			minecraftVersions: minecraftVersions,
			isGraphVisible: config.logToDatabase
		});

    client.emit('updateMojangServices', mojang.toMessage())

    // Send pingHistory of all ServerRegistrations
    client.emit('add', Object.values(serverRegistrations).map(serverRegistration => serverRegistration.getPingHistory()))

    // Always send last
    // This tells the frontend to do final processing and render
    client.emit('syncComplete',)
  })

  startAppLoop()
}

function readyDatabase (callback) {
  if (!config.logToDatabase) {
    logger.log('warn', 'Database logging is not enabled. You can enable it by setting "logToDatabase" to true in config.json. This requires sqlite3 to be installed.')
    callback()
    return
  }

  // Setup database instance
  db.setup()

  const startTime = new Date().getTime()

  db.queryPings(config.graphDuration, pingData => {
    const graphPointsByIp = []

    for (const row of pingData) {
      // Avoid loading outdated records
      // This shouldn't happen and is mostly a sanity measure
      if (startTime - row.timestamp <= config.graphDuration) {
        // Load into temporary array
        // This will be culled prior to being pushed to the serverRegistration
        let graphPoints = graphPointsByIp[row.ip]
        if (!graphPoints) {
          graphPoints = graphPointsByIp[row.ip] = []
        }
        graphPoints.push([row.timestamp, row.playerCount])
      }
    }

    Object.keys(graphPointsByIp).forEach(ip => {
      let serverId = -1

      // Match IPs to serverRegistration object
      for (let i = 0; i < servers.length; i++) {
        if (servers[i].ip === ip) {
          serverId = i
          break
        }
      }

      // Ensure the database query does not return outdated values
      // Server is no longer tracked
      if (serverId !== -1) {
        const graphPoints = graphPointsByIp[ip]
        const serverRegistration = serverRegistrations[serverId]

        // Push the data into the instance and cull if needed
        serverRegistration.loadGraphPoints(graphPoints)
      }
    })

    logger.log('info', 'Queried and parsed ping history in %sms', new Date().getTime() - startTime)

    let completedTasks = 0

    Object.values(serverRegistrations).forEach(serverRegistration => {
      // Find graphPeaks
      // This pre-computes the values prior to clients connecting
      if (serverRegistration.findNewGraphPeak()) {
        const graphPeak = serverRegistration.getGraphPeak()

        logger.log('info', 'Selected graph peak %d (%s)', graphPeak.playerCount, serverRegistration.data.name)
      }

      // Query recordData
      // When complete increment completeTasks to know when complete
      db.getTotalRecord(serverRegistration.data.ip, (playerCount, timestamp) => {
        logger.log('info', 'Computed total record %s (%d) @ %d', serverRegistration.data.ip, playerCount, timestamp)

        serverRegistration.recordData = {
          playerCount: playerCount,
          timestamp: timestamp
        }

        // Check if completedTasks hit the finish value
        // Fire callback since #readyDatabase is complete
        if (++completedTasks === Object.keys(serverRegistrations).length) {
          callback()
        }
      })
    })
  })
}

logger.log('info', 'Booting, please wait...')

servers.forEach((data, i) => {
  data.color = util.stringToColor(data.name) // TODO: remove me, legacy port hack
  serverRegistrations[i] = new ServerRegistration(i, data)
})

readyDatabase(startServices)
