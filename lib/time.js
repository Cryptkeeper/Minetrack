const config = require('../config.json')

class TimeTracker {
  constructor (app) {
    this._app = app
    this._points = []
  }

  newTimestamp () {
    const timestamp = new Date().getTime()

    this._points.push(timestamp)

    if (this._points.length > TimeTracker.getMaxServerGraphDataLength()) {
      this._points.shift()
    }

    return timestamp
  }

  getPointsSeconds () {
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
