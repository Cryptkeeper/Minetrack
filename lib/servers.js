const config = require('../config')
const minecraftVersions = require('../minecraft_versions')

class ServerRegistration {
  serverId
  lastFavicon
  versions = []
  recordData
  graphData = []

  constructor (app, serverId, data) {
    this._app = app
    this.serverId = serverId
    this.data = data
    this._pingHistory = []
  }

  handlePing (timestamp, resp, err, version) {
    // Store into in-memory ping data
    this.addPing(resp)

    // Only notify the frontend to append to the historical graph
    // if both the graphing behavior is enabled and the backend agrees
    // that the ping is eligible for addition
    let updateHistoryGraph = false

    if (config.logToDatabase) {
      const playerCount = resp ? resp.players.online : 0

      if (this.addGraphPoint(resp !== undefined, playerCount, timestamp)) {
        updateHistoryGraph = true
      }
    }

    // Delegate out update payload generation
    return this.getUpdate(timestamp, resp, err, version, updateHistoryGraph)
  }

  getUpdate (timestamp, resp, err, version, updateHistoryGraph) {
    const update = {}

    if (resp) {
      if (resp.version && this.updateProtocolVersionCompat(resp.version, version.protocolId, version.protocolIndex)) {
        // Append an updated version listing
        update.versions = this.versions
      }

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

      if (config.logToDatabase) {
        // Update calculated graph peak regardless if the graph is being updated
        // This can cause a (harmless) desync between live and stored data, but it allows it to be more accurate for long surviving processes
        if (this.findNewGraphPeak()) {
          update.graphPeakData = this.getGraphPeak()
        }

        // Handled inside logToDatabase to validate logic from #getUpdate call
        // Only append when true since an undefined value == false
        if (updateHistoryGraph) {
          update.updateHistoryGraph = true
        }
      }
    } else if (err) {
      // Append a filtered copy of err
      // This ensures any unintended data is not leaked
      update.error = this.filterError(err)
    }

    return update
  }

  addPing (resp) {
    const ping = {}

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
    if (this._pingHistory.length > this._app.pingController.getMaxServerGraphDataLength()) {
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
      // This is a mutated copy of the last update to contain live metadata
      // The metadata is used by the frontend for rendering
      const lastPing = this._pingHistory[this._pingHistory.length - 1]

      const payload = {
        versions: this.versions,
        recordData: this.recordData,
        favicon: this.lastFavicon
      }

      // Only append graphPeakData if defined
      // The value is lazy computed and conditional that config->logToDatabase == true
      const graphPeakData = this.getGraphPeak()

      if (graphPeakData) {
        payload.graphPeakData = graphPeakData
      }

      // Conditionally append to avoid defining fields with undefined values
      if (lastPing.result) {
        payload.result = lastPing.result
      } else if (lastPing.error) {
        payload.error = lastPing.error
      }

      // Insert the reconstructed update as the last entry
      // pingHistory is already sorted during its copy from _pingHistory
      pingHistory.push(payload)

      return pingHistory
    }

    return [{
      error: {
        message: 'Waiting...',
        placeholder: true
      },
      recordData: this.recordData,
      graphPeakData: this.getGraphPeak()
    }]
  }

  loadGraphPoints (points) {
    // Filter pings so each result is a minute apart
    const minutePoints = []
    let lastTimestamp = 0

    for (const point of points) {
      // 0 is the index of the timestamp
      if (point[0] - lastTimestamp >= 60 * 1000) {
        // This check tries to smooth out randomly dropped pings
        // By default only filter pings that are online (playerCount > 0)
        // This will keep looking forward until it finds a ping that is online
        // If it can't find one within a reasonable timeframe, it will select a failed ping
        if (point[0] - lastTimestamp >= 120 * 1000 || point[1] > 0) {
          minutePoints.push(point)
          lastTimestamp = point[0]
        }
      }
    }

    if (minutePoints.length > 0) {
      this.graphData = minutePoints

      // Select the last entry to use for lastGraphDataPush
      this._lastGraphDataPush = minutePoints[minutePoints.length - 1][0]
    }
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

    // Trim old graphPoints according to #getMaxGraphDataLength
    if (this.graphData.length > this._app.pingController.getMaxGraphDataLength()) {
      this.graphData.shift()
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

      // Sort versions in ascending order
      // This matches protocol ids to Minecraft versions release order
      this.versions.sort((a, b) => a - b)

      return true
    } else if (!isSuccess && indexOf >= 0) {
      this.versions.splice(indexOf, 1)
      return true
    }
    return false
  }

  getNextProtocolVersion () {
    // Minecraft Bedrock Edition does not have protocol versions
    if (this.data.type === 'PE') {
      return {
        protocolId: 0,
        protocolIndex: 0
      }
    }
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

  filterError (err) {
    let message = 'Unknown error'

    // Attempt to match to the first possible value
    for (const key of ['message', 'description', 'errno']) {
      if (err[key]) {
        message = err[key]
        break
      }
    }

    // Trim the message if too long
    if (message.length > 28) {
      message = message.substring(0, 28) + '...'
    }

    return {
      message: message
    }
  }
}

module.exports = ServerRegistration
