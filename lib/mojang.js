const request = require('request')

const logger = require('./logger')
const MessageOf = require('./message')

const config = require('../config')

const SERVICE_URL_LOOKUP = {
  'session.minecraft.net': 'Sessions',
  'authserver.mojang.com': 'Auth',
  'textures.minecraft.net': 'Skins',
  'api.mojang.com': 'API'
}

const TITLE_BY_MOJANG_COLOR = {
  red: 'Offline',
  yellow: 'Unstable',
  green: 'Online'
}

class MojangUpdater {
  constructor (app) {
    this._app = app
  }

  schedule () {
    setInterval(this.updateServices, config.rates.updateMojangStatus)

    this.updateServices()
  }

  updateServices = () => {
    request({
      uri: 'https://status.mojang.com/check',
      method: 'GET',
      timeout: config.rates.mojangStatusTimeout
    }, (err, _, body) => {
      if (err) {
        logger.log('error', 'Failed to update Mojang services: %s', err.message)

        // Set all services to offline
        // This may be incorrect, but if mojang.com is offline, it would never otherwise be reflected
        Object.keys(SERVICE_URL_LOOKUP).forEach(url => {
          this.handleServiceUpdate(url, 'red')
        })

        this.pushUpdate()
      } else {
        try {
          JSON.parse(body).forEach(service => {
            // Each service is formatted as an object with the 0 key being the URL
            const url = Object.keys(service)[0]
            this.handleServiceUpdate(url, service[url])
          })
        } catch (err) {
          logger.log('error', 'Failed to parse Mojang response: %s', err.message)
        }

        this.pushUpdate()
      }
    })
  }

  pushUpdate () {
    // Only fire callback when previous state is modified
    if (this._hasUpdated) {
      this._hasUpdated = false

      this._app.server.broadcast(MessageOf('updateMojangServices', this._services))
    }
  }

  getLastUpdate () {
    return this._services
  }

  handleServiceUpdate (url, color) {
    const service = SERVICE_URL_LOOKUP[url]

    if (service) {
      const requiredTitle = TITLE_BY_MOJANG_COLOR[color]

      if (!this._services) {
        this._services = {}
      }

      if (this._services[service] !== requiredTitle) {
        this._services[service] = requiredTitle
        this._hasUpdated = true
      }
    }
  }
}

module.exports = MojangUpdater
