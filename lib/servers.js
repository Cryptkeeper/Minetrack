const crypto = require('crypto')
const dns = require('dns')

const TimeTracker = require('./time')
const Server = require('./server')

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

  handlePing (timestamp, resp, err, version, updateHistoryGraph) {
    // Use null to represent a failed ping
    const playerCount = resp ? resp.players.online : null

    // Store into in-memory ping data
    this._pingHistory.push(playerCount)

    // Trim pingHistory to avoid memory leaks
    if (this._pingHistory.length > TimeTracker.getMaxServerGraphDataLength()) {
      this._pingHistory.shift()
    }

    // Only notify the frontend to append to the historical graph
    // if both the graphing behavior is enabled and the backend agrees
    // that the ping is eligible for addition
    if (updateHistoryGraph) {
      this.graphData.push(playerCount)

      // Trim old graphPoints according to #getMaxGraphDataLength
      if (this.graphData.length > TimeTracker.getMaxGraphDataLength()) {
        this.graphData.shift()
      }
    }

    // Delegate out update payload generation
    return this.getUpdate(timestamp, resp, err, version)
  }

  getUpdate (timestamp, resp, err, version) {
    const update = {}

    if (resp) {
      if (resp.version && this.updateProtocolVersionCompat(resp.version, version.protocolId, version.protocolIndex)) {
        // Append an updated version listing
        update.versions = this.versions
      }

      if (config.logToDatabase && (!this.recordData || resp.players.online > this.recordData.playerCount)) {
        this.recordData = {
          playerCount: resp.players.online,
          timestamp: Math.floor(timestamp / 1000)
        }

        // Append an updated recordData
        update.recordData = this.recordData
      }

      if (this.updateFavicon(resp.favicon)) {
        update.favicon = this.getFaviconUrl()
      }

      // Append a result object
      // This filters out unwanted data from resp
      update.playerCount = resp.players.online

      if (config.logToDatabase) {
        // Update calculated graph peak regardless if the graph is being updated
        // This can cause a (harmless) desync between live and stored data, but it allows it to be more accurate for long surviving processes
        if (this.findNewGraphPeak()) {
          update.graphPeakData = this.getGraphPeak()
        }
      }
    } else if (err) {
      // Append a filtered copy of err
      // This ensures any unintended data is not leaked
      update.error = this.filterError(err)
    }

    return update
  }

  getPingHistory () {
    if (this._pingHistory.length > 0) {
      const payload = {
        versions: this.versions,
        recordData: this.recordData,
        favicon: this.getFaviconUrl()
      }

      // Only append graphPeakData if defined
      // The value is lazy computed and conditional that config->logToDatabase == true
      const graphPeakData = this.getGraphPeak()

      if (graphPeakData) {
        payload.graphPeakData = graphPeakData
      }

      // Assume the ping was a success and define result
      // pingHistory does not keep error references, so its impossible to detect if this is an error
      // It is also pointless to store that data since it will be short lived
      payload.playerCount = this._pingHistory[this._pingHistory.length - 1]

      // Send a copy of pingHistory
      // Include the last value even though it is contained within payload
      // The frontend will only push to its graphData from playerCountHistory
      payload.playerCountHistory = this._pingHistory

      return payload
    }

    return {
      error: {
        message: 'Pinging...'
      },
      recordData: this.recordData,
      graphPeakData: this.getGraphPeak(),
      favicon: this.data.favicon
    }
  }

  loadGraphPoints (startTime, timestamps, points) {
    // Filter pings so each result is a minute apart
    let lastTimestamp = startTime

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i]

      if (timestamp - lastTimestamp >= 60 * 1000) {
        lastTimestamp = timestamp

        this.graphData.push(points[i])
      }
    }
  }

  findNewGraphPeak () {
    let index = -1
    for (let i = 0; i < this.graphData.length; i++) {
      const point = this.graphData[i]
      if (index === -1 || point > this.graphData[index]) {
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
    return {
      playerCount: this.graphData[this._graphPeakIndex],
      timestamp: this._app.timeTracker.getHistoricalPointSeconds(this._graphPeakIndex)
    }
  }

  updateFavicon (favicon) {
    // If data.favicon is defined, then a favicon override is present
    // Disregard the incoming favicon, regardless if it is different
    if (this.data.favicon) {
      return false
    }

    if (favicon && favicon !== this.lastFavicon) {
      this.lastFavicon = favicon

      // Generate an updated hash
      // This is used by #getFaviconUrl
      this.faviconHash = crypto.createHash('md5').update(favicon).digest('hex').toString()

      return true
    }

    return false
  }

  getFaviconUrl () {
    if (this.faviconHash) {
      return Server.getHashedFaviconUrl(this.faviconHash)
    } else if (this.data.favicon) {
      return this.data.favicon
    }
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

  getPublicData () {
    // Return a custom object instead of data directly to avoid data leakage
    return {
      name: this.data.name,
      ip: this.data.ip,
      type: this.data.type,
      color: this.data.color
    }
  }

  unfurlSrv (callback) {
    // Skip unfurling SRV, instantly return pre-configured data
    if (config.performance && config.performance.skipUnfurlSrv) {
      callback(this.data.ip, this.data.port)
      return
    }

    const timestamp = new Date().getTime()

    // If a cached copy exists and is within its TTL, instantly return
    if (this._lastUnfurlSrv && timestamp - this._lastUnfurlSrv.timestamp <= config.performance.unfurlSrvCacheTtl) {
      callback(this._lastUnfurlSrv.ip, this._lastUnfurlSrv.port)
      return
    }

    // Group callbacks into an array
    // Once resolved, fire callbacks sequentially
    // This avoids callbacks possibly executing out of order
    if (!this._unfurlSrvCallbackQueue) {
      this._unfurlSrvCallbackQueue = []
    }

    this._unfurlSrvCallbackQueue.push(callback)

    // Prevent multiple #resolveSrv calls per ServerRegistration
    if (!this._isUnfurlingSrv) {
      this._isUnfurlingSrv = true

      dns.resolveSrv('_minecraft._tcp' + this.data.ip, (_, records) => {
        this._lastUnfurlSrv = {
          timestamp
        }

        if (records && records.length > 0) {
          this._lastUnfurlSrv.ip = records[0].name
          this._lastUnfurlSrv.port = records[0].port
        } else {
          // Provide fallback to pre-configured data
          this._lastUnfurlSrv.ip = this.data.ip
          this._lastUnfurlSrv.port = this.data.port
        }

        // Fire the waiting callbacks in queue
        // Release blocking flag to allow new #resolveSrv calls
        this._isUnfurlingSrv = false

        for (const callback of this._unfurlSrvCallbackQueue) {
          callback(this._lastUnfurlSrv.ip, this._lastUnfurlSrv.port)
        }

        // Reset the callback queue
        this._unfurlSrvCallbackQueue = []
      })
    }
  }
}

module.exports = ServerRegistration
