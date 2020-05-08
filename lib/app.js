const Database = require('./database')
const MojangUpdater = require('./mojang')
const PingController = require('./ping')
const Server = require('./server')
const TimeTracker = require('./time')
const MessageOf = require('./message')

const config = require('../config')
const minecraftVersions = require('../minecraft_versions')

class App {
  serverRegistrations = []

  constructor () {
    this.mojangUpdater = new MojangUpdater(this)
    this.pingController = new PingController(this)
    this.server = new Server(this.handleClientConnection)
    this.timeTracker = new TimeTracker(this)
  }

  loadDatabase (callback) {
    this.database = new Database(this)

    // Setup database instance
    this.database.ensureIndexes()

    this.database.loadGraphPoints(config.graphDuration, () => {
      this.database.loadRecords(callback)
    })
  }

  handleReady () {
    this.server.listen(config.site.ip, config.site.port)

    // Allow individual modules to manage their own task scheduling
    this.mojangUpdater.schedule()
    this.pingController.schedule()
  }

  handleClientConnection = (client) => {
    if (config.logToDatabase) {
      client.on('message', (message) => {
        if (message === 'requestHistoryGraph') {
          // Send historical graphData built from all serverRegistrations
          const graphData = {}

          this.serverRegistrations.forEach((serverRegistration) => {
            graphData[serverRegistration.serverId] = serverRegistration.graphData
          })

          // Send graphData in object wrapper to avoid needing to explicity filter
          // any header data being appended by #MessageOf since the graph data is fed
          // directly into the flot.js graphing system
          client.send(MessageOf('historyGraph', {
            graphData: graphData
          }))
        }
      })
    }

    const initMessage = {
      config: (() => {
        // Remap minecraftVersion entries into name values
        const minecraftVersionNames = {}
        Object.keys(minecraftVersions).forEach(function (key) {
          minecraftVersionNames[key] = minecraftVersions[key].map(version => version.name)
        })

        // Send configuration data for rendering the page
        return {
          graphDurationLabel: config.graphDurationLabel || (Math.floor(config.graphDuration / (60 * 60 * 1000)) + 'h'),
          graphMaxLength: TimeTracker.getMaxGraphDataLength(),
          serverGraphMaxLength: TimeTracker.getMaxServerGraphDataLength(),
          servers: this.serverRegistrations.map(serverRegistration => serverRegistration.data),
          minecraftVersions: minecraftVersionNames,
          isGraphVisible: config.logToDatabase
        }
      })(),
      mojangServices: this.mojangUpdater.getLastUpdate(),
      timestampPoints: this.timeTracker.getPoints(),
      servers: this.serverRegistrations.map(serverRegistration => serverRegistration.getPingHistory())
    }

    client.send(MessageOf('init', initMessage))
  }
}

module.exports = App
