const logger = require('./logger')
const request = require('request')

const serviceUrlLookup = {
  'sessionserver.mojang.com': 'Sessions',
  'authserver.mojang.com': 'Auth',
  'textures.minecraft.net': 'Skins',
  'api.mojang.com': 'API'
}

const colorToTitle = {
  red: 'Offline',
  yellow: 'Unstable',
  green: 'Online'
}

const currentServices = {}

function setServiceColor (url, color) {
  const service = serviceUrlLookup[url]

  if (service) {
    const requiredTitle = colorToTitle[color]

    if (currentServices[service] !== requiredTitle) {
      currentServices[service] = requiredTitle
      return true
    }
  }
  return false
}

function updateAll (timeout, callback) {
  request({
    uri: 'https://status.mojang.com/check',
    method: 'GET',
    timeout: timeout
  }, (err, _, body) => {
    if (err) {
      logger.log('error', 'Failed to update Mojang services: %s', err.message)

      let fireCallback = false

      // Set all services to offline
      // This may be incorrect, but if mojang.com is offline, it would never otherwise be reflected
      Object.keys(serviceUrlLookup).forEach(url => {
        fireCallback |= setServiceColor(url, 'red')
      })

      // Only fire callback when previous state is modified
      if (fireCallback) {
        callback(currentServices)
      }
    } else {
      try {
        let fireCallback = false

        JSON.parse(body).forEach(service => {
          // Each service is formatted as an object with the 0 key being the URL
          const url = Object.keys(service)[0]

          fireCallback |= setServiceColor(url, service[url])
        })

        // Only fire callback when previous state is modified
        if (fireCallback) {
          callback(currentServices)
        }
      } catch (err) {
        logger.log('error', 'Failed to parse Mojang response: %s', err.message)
      }
    }
  })
}

function getLastUpdate () {
  return currentServices
}

module.exports = {
  updateAll,
  getLastUpdate
}
