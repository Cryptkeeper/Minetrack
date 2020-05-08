const dns = require('dns')

const minecraftJavaPing = require('mc-ping-updated')
const minecraftBedrockPing = require('mcpe-ping-fixed')

const logger = require('./logger')
const MessageOf = require('./message')

const config = require('../config')

function ping (host, port, type, timeout, callback, version) {
  switch (type) {
    case 'PC':
      unfurlSrv(host, port, (host, port) => {
        minecraftJavaPing(host, port || 25565, (err, res) => {
          if (err) {
            callback(err)
          } else {
            const payload = {
              players: {
                online: capPlayerCount(host, parseInt(res.players.online))
              },
              version: parseInt(res.version.protocol)
            }

            // Ensure the returned favicon is a data URI
            if (res.favicon && res.favicon.startsWith('data:image/')) {
              payload.favicon = res.favicon
            }

            callback(null, payload)
          }
        }, timeout, version)
      })
      break

    case 'PE':
      minecraftBedrockPing(host, port || 19132, (err, res) => {
        if (err) {
          callback(err)
        } else {
          callback(null, {
            players: {
              online: capPlayerCount(host, parseInt(res.currentPlayers))
            }
          })
        }
      }, timeout)
      break

    default:
      throw new Error('Unsupported type: ' + type)
  }
}

function unfurlSrv (hostname, port, callback) {
  if (config.performance && config.performance.skipUnfurlSrv) {
    callback(hostname, port)
    return
  }

  dns.resolveSrv('_minecraft._tcp.' + hostname, (_, records) => {
    if (!records || records.length < 1) {
      callback(hostname, port)
    } else {
      callback(records[0].name, records[0].port)
    }
  })
}

// player count can be up to 1^32-1, which is a massive scale and destroys browser performance when rendering graphs
// Artificially cap and warn to prevent propogating garbage
function capPlayerCount (host, playerCount) {
  const maxPlayerCount = 250000

  if (playerCount !== Math.min(playerCount, maxPlayerCount)) {
    logger.log('warn', '%s returned a player count of %d, Minetrack has capped it to %d to prevent browser performance issues with graph rendering. If this is in error, please edit maxPlayerCount in ping.js!', host, playerCount, maxPlayerCount)

    return maxPlayerCount
  } else if (playerCount !== Math.max(playerCount, 0)) {
    logger.log('warn', '%s returned an invalid player count of %d, setting to 0.', host, playerCount)

    return 0
  }
  return playerCount
}

class PingController {
  constructor (app) {
    this._app = app
  }

  schedule () {
    setInterval(this.pingAll, config.rates.pingAll)

    this.pingAll()
  }

  pingAll = () => {
    const timestamp = this._app.timeTracker.newTimestamp()

    this.startPingTasks(results => {
      const updates = []

      for (const serverRegistration of this._app.serverRegistrations) {
        const result = results[serverRegistration.serverId]

        // Log to database if enabled
        if (config.logToDatabase) {
          const playerCount = result.resp ? result.resp.players.online : 0
          this._app.database.insertPing(serverRegistration.data.ip, timestamp, playerCount)
        }

        // Generate a combined update payload
        // This includes any modified fields and flags used by the frontend
        // This will not be cached and can contain live metadata
        const update = serverRegistration.handlePing(timestamp, result.resp, result.err, result.version)
        updates[serverRegistration.serverId] = update
      }

      // Send object since updates uses serverIds as keys
      // Send a single timestamp entry since it is shared
      this._app.server.broadcast(MessageOf('updateServers', {
        timestamp,
        updates
      }))
    })
  }

  startPingTasks = (callback) => {
    const results = []
    let remainingTasks = this._app.serverRegistrations.length

    for (const serverRegistration of this._app.serverRegistrations) {
      const version = serverRegistration.getNextProtocolVersion()

      ping(serverRegistration.data.ip, serverRegistration.data.port, serverRegistration.data.type, config.rates.connectTimeout, (err, resp) => {
        if (err) {
          logger.log('error', 'Failed to ping %s: %s', serverRegistration.data.ip, err.message)
        }

        results[serverRegistration.serverId] = {
          resp,
          err,
          version
        }

        if (--remainingTasks === 0) {
          callback(results)
        }
      }, version.protocolId)
    }
  }

  getMaxServerGraphDataLength () {
    return Math.ceil(config.serverGraphDuration / config.rates.pingAll)
  }

  getMaxGraphDataLength () {
    return Math.ceil(config.graphDuration / config.rates.pingAll)
  }
}

module.exports = PingController
