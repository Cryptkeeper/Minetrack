class TimeTracker {
  constructor () {
    this._points = []
  }

  newTimestamp () {
    const timestamp = new Date().getTime()

    this._points.push(timestamp)

    if (this._points.length > 72) {
      this._points.shift()
    }

    return timestamp
  }

  getPoints () {
    return this._points
  }
}

module.exports = TimeTracker
