const config = require('../config.json')

class TimeTracker {
  constructor (app) {
    this._app = app
    this._serverGraphPoints = []
    this._graphPoints = []
  }

  newPointTimestamp () {
    const timestamp = new Date().getTime()

    TimeTracker.pushAndShift(this._serverGraphPoints, timestamp, TimeTracker.getMaxServerGraphDataLength())

    // Flag each group as history graph additions each minute
    // This is sent to the frontend for graph updates
    const updateHistoryGraph = config.logToDatabase && (!this._lastHistoryGraphUpdate || timestamp - this._lastHistoryGraphUpdate >= 60 * 1000)

    if (updateHistoryGraph) {
      this._lastHistoryGraphUpdate = timestamp

      // Push into timestamps array to update backend state
      TimeTracker.pushAndShift(this._graphPoints, timestamp, TimeTracker.getMaxGraphDataLength())
    }

    return {
      timestamp,
      updateHistoryGraph
    }
  }

  loadGraphPoints (startTime, timestamps) {
    // This is a copy of ServerRegistration#loadGraphPoints
    // relativeGraphData contains original timestamp data and needs to be filtered into minutes
    let lastTimestamp = startTime

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i]

      if (timestamp - lastTimestamp >= 60 * 1000) {
        lastTimestamp = timestamp

        this._graphPoints.push(timestamp)
      }
    }
  }

  getGraphPointAt (i) {
    return TimeTracker.toSeconds(this._graphPoints[i])
  }

  getServerGraphPoints () {
    return this._serverGraphPoints.map(TimeTracker.toSeconds)
  }

  getGraphPoints () {
    return this._graphPoints.map(TimeTracker.toSeconds)
  }

  static toSeconds = (timestamp) => {
    return Math.floor(timestamp / 1000)
  }

  static getMaxServerGraphDataLength () {
    return Math.ceil(config.serverGraphDuration / config.rates.pingAll)
  }

  static getMaxGraphDataLength () {
    return Math.ceil(config.graphDuration / config.rates.pingAll)
  }

  static pushAndShift (array, value, maxLength) {
    array.push(value)

    if (array.length > maxLength) {
      array.shift()
    }
  }
}

module.exports = TimeTracker
