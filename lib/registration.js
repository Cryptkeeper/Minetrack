const config = require('../config.json')
const minecraftVersions = require('../minecraft_versions.json')

class ServerRegistration {
  lastFavicon
  versions = []
  recordData
  graphData = []

  constructor (serverId, data) {
    this.serverId = serverId
    this.data = data
    this._pingHistory = []
  }

  getUpdate (timestamp, resp, err, version) {
    const update = {
      info: {
        name: this.data.name,
        timestamp: timestamp
      }
    }

    if (resp) {
      if (resp.version && this.updateProtocolVersionCompat(resp.version, version.protocolId, version.protocolIndex)) {
        // Append an updated version listing
        update.versions = this.versions
      }

      // Validate that we have logToDatabase enabled otherwise in memory pings
      // will create a record that's only valid for the runtime duration.
      if (config.logToDatabase && (!this.recordData || resp.players.online > this.recordData.playerCount)) {
        this.recordData = {
          playerCount: resp.players.online,
          timestamp: timestamp
        }

        // Append an updated recordData
        update.recordData = this.recordData
      }

      // Compare against this.data.favicon to support favicon overrides
      const newFavicon = resp.favicon || this.data.favicon
      if (this.updateFavicon(newFavicon)) {
        // Append an updated favicon
        update.favicon = newFavicon
      }

      // Append a result object
      // This filters out unwanted data from resp
      update.result = {
        players: resp.players
      }
    } else if (err) {
      // Append error object directly
      // This does NOT filter data from err
      update.error = err
    }

    return update
  }

  addPing (timestamp, resp) {
    const ping = {
      info: {
        name: this.data.name
      },
      timestamp: timestamp
    }

    if (resp) {
      // Append a result object
      // This filters out unwanted data from resp
      ping.result = {
        players: {
          online: resp.players.online
        }
      }
    }

    this._pingHistory.push(ping)

    // Trim pingHistory to avoid memory leaks
    if (this._pingHistory.length > 72) {
      this._pingHistory.shift()
    }
  }

  getPingHistory () {
    if (this._pingHistory.length > 0) {
      const pingHistory = []

      for (let i = 0; i < this._pingHistory.length - 1; i++) {
        pingHistory[i] = this._pingHistory[i]
      }

      // Insert the latest update manually into the array
      // This contains live metadata for the frontend
      const lastPing = this._pingHistory[this._pingHistory.length - 1]

      pingHistory[this._pingHistory.length - 1] = {
        info: lastPing.info,
        versions: this.versions,
        recordData: this.recordData,
        favicon: this.lastFavicon,
        result: lastPing.result,
        error: lastPing.error
      }

      return pingHistory
    }

    return [{
      error: {
        description: 'Waiting...',
        placeholder: true
      },
      timestamp: new Date().getTime(),
      info: {
        name: this.data.name
      }
    }]
  }

  addGraphPoint (isSuccess, playerCount, timestamp) {
    // If the ping failed, then to avoid destroying the graph, ignore it
    // However if it's been too long since the last successful ping, push it anyways
    if (this._lastGraphDataPush) {
      const timeSince = timestamp - this._lastGraphDataPush
      if ((isSuccess && timeSince < 60 * 1000) || (!isSuccess && timeSince < 70 * 1000)) {
        return false
      }
    }

    this.graphData.push([timestamp, playerCount])
    this._lastGraphDataPush = timestamp

    // Trim old graphPoints according to graphDuration
    for (let i = 1; i < this.graphData.length; i++) {
      // Find a break point where i - 1 is too old and i is new
      if (timestamp - this.graphData[i - 1][0] > config.graphDuration && timestamp - this.graphData[i] <= config.graphDuration) {
        this.graphData.splice(0, i)
        break
      }
    }

    return true
  }

  findNewGraphPeak () {
    let index = -1
    for (let i = 0; i < this.graphData.length; i++) {
      const point = this.graphData[i]
      if (index === -1 || point[1] > this.graphData[index][1]) {
        index = i
      }
    }
    if (index >= 0) {
      const lastGraphPeakIndex = this._graphPeakIndex
      this._graphPeakIndex = index
      return index !== lastGraphPeakIndex
    } else {
      this._graphPeakIndex = undefined
      return false
    }
  }

  getGraphPeak () {
    if (this._graphPeakIndex === undefined) {
      return
    }
    const graphPeak = this.graphData[this._graphPeakIndex]
    return {
      playerCount: graphPeak[1],
      timestamp: graphPeak[0]
    }
  }

  updateFavicon (favicon) {
    if (favicon && favicon !== this.lastFavicon) {
      this.lastFavicon = favicon
      return true
    }
    return false
  }

  updateProtocolVersionCompat (incomingId, outgoingId, protocolIndex) {
    // If the result version matches the attempted version, the version is supported
    const isSuccess = incomingId === outgoingId
    const indexOf = this.versions.indexOf(protocolIndex)

    // Test indexOf to avoid inserting previously recorded protocolIndex values
    if (isSuccess && indexOf < 0) {
      this.versions.push(protocolIndex)
      return true
    } else if (!isSuccess && indexOf >= 0) {
      this.versions.splice(indexOf, 1)
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
