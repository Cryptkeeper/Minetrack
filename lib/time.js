class TimeTracker {
  constructor (app) {
    this._app = app
    this._points = []
  }

  newTimestamp () {
    const timestamp = new Date().getTime()

    this._points.push(timestamp)

    if (this._points.length > this._app.pingController.getMaxServerGraphDataLength()) {
      this._points.shift()
    }

    return timestamp
  }

  getPoints () {
    return this._points
  }
}

module.exports = TimeTracker
