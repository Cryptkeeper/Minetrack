const SERVER_GRAPH_DATA_MAX_LENGTH = require('./servers').SERVER_GRAPH_DATA_MAX_LENGTH

class TimeTracker {
  constructor () {
    this._points = []
  }

  newTimestamp () {
    const timestamp = new Date().getTime()

    this._points.push(timestamp)

    if (this._points.length > SERVER_GRAPH_DATA_MAX_LENGTH) {
      this._points.shift()
    }

    return timestamp
  }

  getPoints () {
    return this._points
  }
}

module.exports = TimeTracker
