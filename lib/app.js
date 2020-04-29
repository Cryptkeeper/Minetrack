const Database = require('./database')
const MojangUpdater = require('./mojang')
const PingController = require('./ping')
const Server = require('./server')

const config = require('../config')
const minecraftVersions = require('../minecraft_versions')

class App {
  serverRegistrations = []

  constructor () {
    this.mojangUpdater = new MojangUpdater(this)
    this.pingController = new PingController(this)
    this.server = new Server(this.handleClientConnection)
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
      client.on('requestHistoryGraph', () => {
        // Send historical graphData built from all serverRegistrations
        const graphData = {}

        this.serverRegistrations.forEach((serverRegistration) => {
          graphData[serverRegistration.serverId] = serverRegistration.graphData
        })

        client.emit('historyGraph', graphData)
      })
    }

    client.emit('setPublicConfig', (() => {
      // Remap minecraftVersion entries into name values
      const minecraftVersionNames = {}
      Object.keys(minecraftVersions).forEach(function (key) {
        minecraftVersionNames[key] = minecraftVersions[key].map(version => version.name)
      })

      // Send configuration data for rendering the page
      return {
        graphDuration: config.graphDuration,
        servers: this.serverRegistrations.map(serverRegistration => serverRegistration.data),
        minecraftVersions: minecraftVersionNames,
        isGraphVisible: config.logToDatabase
      }
    })())

    // Send last Mojang update, if any
    this.mojangUpdater.sendLastUpdate(client)

    // Send pingHistory of all ServerRegistrations
    client.emit('add', this.serverRegistrations.map(serverRegistration => serverRegistration.getPingHistory()))

    // Always send last
    // This tells the frontend to do final processing and render
    client.emit('syncComplete')
  }
}

module.exports = App
