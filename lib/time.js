const config = require('../config.json')

class TimeTracker {
  constructor (app) {
    this._app = app
    this._points = []
    this._historicalTimestamps = []
  }

  newPingTimestamp () {
    const timestamp = new Date().getTime()

    this._points.push(timestamp)

    if (this._points.length > TimeTracker.getMaxServerGraphDataLength()) {
      this._points.shift()
    }

    // Flag each group as history graph additions each minute
    // This is sent to the frontend for graph updates
    const updateHistoryGraph = config.logToDatabase && (!this._lastHistoryGraphUpdate || timestamp - this._lastHistoryGraphUpdate >= 60 * 1000)

    if (updateHistoryGraph) {
      this._lastHistoryGraphUpdate = timestamp

      // Push into timestamps array to update backend state
      this._historicalTimestamps.push(timestamp)

      if (this._historicalTimestamps.length > TimeTracker.getMaxGraphDataLength()) {
        this._historicalTimestamps.shift()
      }
    }

    return {
      timestamp,
      updateHistoryGraph
    }
  }

  loadHistoricalTimestamps (timestamps) {
    this._historicalTimestamps = timestamps
  }

  getHistoricalPointsSeconds () {
    return this._historicalTimestamps.map(value => Math.floor(value / 1000))
  }

  getHistoricalPointSeconds (index) {
    return Math.floor(this._historicalTimestamps[index] / 1000)
  }

  getServerPointsSeconds () {
    return this._points.map(value => Math.floor(value / 1000))
  }

  static getMaxServerGraphDataLength () {
    return Math.ceil(config.serverGraphDuration / config.rates.pingAll)
  }

  static getMaxGraphDataLength () {
    return Math.ceil(config.graphDuration / config.rates.pingAll)
  }
}

module.exports = TimeTracker
