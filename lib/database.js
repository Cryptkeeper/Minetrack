const sqlite = require('sqlite3')

class Database {
  constructor (app) {
    this._app = app
    this._sql = new sqlite.Database('database.sql')
  }

  ensureIndexes () {
    this._sql.serialize(() => {
      this._sql.run('CREATE TABLE IF NOT EXISTS pings (timestamp BIGINT NOT NULL, ip TINYTEXT, playerCount MEDIUMINT)')
      this._sql.run('CREATE INDEX IF NOT EXISTS ip_index ON pings (ip, playerCount)')
      this._sql.run('CREATE INDEX IF NOT EXISTS timestamp_index on PINGS (timestamp)')
    })
  }

  loadGraphPoints (graphDuration, callback) {
    // Query recent pings
    const endTime = new Date().getTime()
    const startTime = endTime - graphDuration

    this.getRecentPings(startTime, endTime, length, pingData => {
      const graphPointsByIp = []

      for (const row of pingData) {
        // Load into temporary array
        // This will be culled prior to being pushed to the serverRegistration
        let graphPoints = graphPointsByIp[row.ip]
        if (!graphPoints) {
          graphPoints = graphPointsByIp[row.ip] = []
        }

        graphPoints.push([row.timestamp, row.playerCount])
      }

      Object.keys(graphPointsByIp).forEach(ip => {
        // Match IPs to serverRegistration object
        for (const serverRegistration of this._app.serverRegistrations) {
          if (serverRegistration.data.ip === ip) {
            const graphPoints = graphPointsByIp[ip]

            // Push the data into the instance and cull if needed
            serverRegistration.loadGraphPoints(graphPoints)

            break
          }
        }
      })

      callback()
    })
  }

  loadRecords (callback) {
    let completedTasks = 0

    this._app.serverRegistrations.forEach(serverRegistration => {
      // Find graphPeaks
      // This pre-computes the values prior to clients connecting
      serverRegistration.findNewGraphPeak()

      // Query recordData
      // When complete increment completeTasks to know when complete
      this.getRecord(serverRegistration.data.ip, (playerCount, timestamp) => {
        serverRegistration.recordData = {
          playerCount: playerCount,
          timestamp: timestamp
        }

        // Check if completedTasks hit the finish value
        // Fire callback since #readyDatabase is complete
        if (++completedTasks === this._app.serverRegistrations.length) {
          callback()
        }
      })
    })
  }

  getRecentPings (startTime, endTime, callback) {
    this._sql.all('SELECT * FROM pings WHERE timestamp >= ? AND timestamp <= ?', [
      startTime,
      endTime
    ], (_, data) => callback(data))
  }

  getRecord (ip, callback) {
    this._sql.all('SELECT MAX(playerCount), timestamp FROM pings WHERE ip = ?', [
      ip
    ], (_, data) => callback(data[0]['MAX(playerCount)'], data[0].timestamp))
  }

  insertPing (ip, timestamp, playerCount) {
    const statement = this._sql.prepare('INSERT INTO pings (timestamp, ip, playerCount) VALUES (?, ?, ?)')
    this._sql.serialize(() => {
      statement.run(timestamp, ip, playerCount)
    })
    statement.finalize()
  }
}

module.exports = Database
