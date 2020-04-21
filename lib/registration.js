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
