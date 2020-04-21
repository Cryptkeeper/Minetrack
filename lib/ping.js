const dns = require('dns')

const minecraftJavaPing = require('mc-ping-updated')
const minecraftBedrockPing = require('mcpe-ping-fixed')

const logger = require('./logger')

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
    for (const serverRegistration of this._app.serverRegistrations) {
      const version = serverRegistration.getNextProtocolVersion()

      ping(serverRegistration.data.ip, serverRegistration.data.port, serverRegistration.data.type, config.rates.connectTimeout, (err, resp) => {
        if (err) {
          logger.log('error', 'Failed to ping %s: %s', serverRegistration.data.ip, err.message)
        }

        this.handlePing(serverRegistration, resp, err, version)
      }, version.protocolId)
    }
  }

  handlePing (serverRegistration, resp, err, version) {
    const timestamp = new Date().getTime()

    this._app.server.broadcast('update', serverRegistration.getUpdate(timestamp, resp, err, version))

    serverRegistration.addPing(timestamp, resp)

    if (config.logToDatabase) {
      const playerCount = resp ? resp.players.online : 0

      // Log to database
      this._app.database.insertPing(serverRegistration.data.ip, timestamp, playerCount)

      if (serverRegistration.addGraphPoint(resp !== undefined, playerCount, timestamp)) {
        this._app.server.broadcast('updateHistoryGraph', {
          name: serverRegistration.data.name,
          playerCount: playerCount,
          timestamp: timestamp
        })
      }

      // Update calculated graph peak regardless if the graph is being updated
      // This can cause a (harmless) desync between live and stored data, but it allows it to be more accurate for long surviving processes
      if (serverRegistration.findNewGraphPeak()) {
        const graphPeak = serverRegistration.getGraphPeak()

        this._app.server.broadcast('updatePeak', {
          name: serverRegistration.data.name,
          playerCount: graphPeak.playerCount,
          timestamp: graphPeak.timestamp
        })
      }
    }
  }
}

module.exports = PingController
