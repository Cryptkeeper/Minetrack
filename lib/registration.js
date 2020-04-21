const minecraftVersions = require('../minecraft_versions.json')

class ServerRegistration {
  lastFavicon
  versions = []

  constructor (serverId, data) {
    this.serverId = serverId
    this.data = data
  }

  updateFavicon (favicon) {
    if (favicon && favicon !== this.lastFavicon) {
      this.lastFavicon = favicon
      return true
    }
    return false
  }

  getNextProtocolVersion () {
    const protocolVersions = minecraftVersions[this.data.type]
    if (typeof this._nextProtocolIndex === 'undefined' || this._nextProtocolIndex + 1 >= protocolVersions.length) {
      this._nextProtocolIndex = 0
    } else {
      this._nextProtocolIndex++
    }
    return {
      protocolId: protocolVersions[this._nextProtocolIndex].protocolId,
      protocolIndex: this._nextProtocolIndex
    }
  }
}

module.exports = {
  ServerRegistration
}
