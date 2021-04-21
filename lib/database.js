const sqlite = require('sqlite3')

const logger = require('./logger')

const config = require('../config')
const { TimeTracker } = require('./time')

class Database {
  constructor (app) {
    this._app = app
    this._sql = new sqlite.Database('database.sql')
  }

  getDailyDatabase () {
    if (!config.createDailyDatabaseCopy) {
      return
    }

    const date = new Date()
    const fileName = `database_copy_${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}.sql`

    if (fileName !== this._currentDatabaseCopyFileName) {
      if (this._currentDatabaseCopyInstance) {
        this._currentDatabaseCopyInstance.close()
      }

      this._currentDatabaseCopyInstance = new sqlite.Database(fileName)
      this._currentDatabaseCopyFileName = fileName

      // Ensure the initial tables are created
      // This does not created indexes since it is only inserted to
      this._currentDatabaseCopyInstance.serialize(() => {
        this._currentDatabaseCopyInstance.run('CREATE TABLE IF NOT EXISTS pings (timestamp BIGINT NOT NULL, ip TINYTEXT, playerCount MEDIUMINT)', err => {
          if (err) {
            logger.log('error', 'Cannot create initial table for daily database')
            throw err
          }
        })
      })
    }

    return this._currentDatabaseCopyInstance
  }

  ensureIndexes (callback) {
    const handleError = err => {
      if (err) {
        logger.log('error', 'Cannot create table or table index')
        throw err
      }
    }

    this._sql.serialize(() => {
      this._sql.run('CREATE TABLE IF NOT EXISTS pings (timestamp BIGINT NOT NULL, ip TINYTEXT, playerCount MEDIUMINT)', handleError)
      this._sql.run('CREATE INDEX IF NOT EXISTS ip_index ON pings (ip, playerCount)', handleError)
      this._sql.run('CREATE INDEX IF NOT EXISTS timestamp_index on PINGS (timestamp)', [], err => {
        handleError(err)
        // Queries are executed one at a time; this is the last one.
        // Note that queries not scheduled directly in the callback function of
        // #serialize are not necessarily serialized.
        callback()
      })
    })
  }

  loadGraphPoints (graphDuration, callback) {
    // Query recent pings
    const endTime = TimeTracker.getEpochMillis()
    const startTime = endTime - graphDuration

    this.getRecentPings(startTime, endTime, pingData => {
      const relativeGraphData = []

      for (const row of pingData) {
        // Load into temporary array
        // This will be culled prior to being pushed to the serverRegistration
        let graphData = relativeGraphData[row.ip]
        if (!graphData) {
          relativeGraphData[row.ip] = graphData = [[], []]
        }

        // DANGER!
        // This will pull the timestamp from each row into memory
        // This is built under the assumption that each round of pings shares the same timestamp
        // This enables all timestamp arrays to have consistent point selection and graph correctly
        graphData[0].push(row.timestamp)
        graphData[1].push(row.playerCount)
      }

      Object.keys(relativeGraphData).forEach(ip => {
        // Match IPs to serverRegistration object
        for (const serverRegistration of this._app.serverRegistrations) {
          if (serverRegistration.data.ip === ip) {
            const graphData = relativeGraphData[ip]

            // Push the data into the instance and cull if needed
            serverRegistration.loadGraphPoints(startTime, graphData[0], graphData[1])

            break
          }
        }
      })

      // Since all timestamps are shared, use the array from the first ServerRegistration
      // This is very dangerous and can break if data is out of sync
      if (Object.keys(relativeGraphData).length > 0) {
        const serverIp = Object.keys(relativeGraphData)[0]
        const timestamps = relativeGraphData[serverIp][0]

        this._app.timeTracker.loadGraphPoints(startTime, timestamps)
      }

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
      this.getRecord(serverRegistration.data.ip, (hasRecord, playerCount, timestamp) => {
        if (hasRecord) {
          serverRegistration.recordData = {
            playerCount,
            timestamp: TimeTracker.toSeconds(timestamp)
          }
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
    ], (err, data) => {
      if (err) {
        logger.log('error', 'Cannot get recent pings')
        throw err
      }
      callback(data)
    })
  }

  getRecord (ip, callback) {
    this._sql.all('SELECT MAX(playerCount), timestamp FROM pings WHERE ip = ?', [
      ip
    ], (err, data) => {
      if (err) {
        logger.log('error', `Cannot get ping record for ${ip}`)
        throw err
      }

      // For empty results, data will be length 1 with [null, null]
      const playerCount = data[0]['MAX(playerCount)']
      const timestamp = data[0].timestamp

      // Allow null timestamps, the frontend will safely handle them
      // This allows insertion of free standing records without a known timestamp
      if (playerCount !== null) {
        // eslint-disable-next-line node/no-callback-literal
        callback(true, playerCount, timestamp)
      } else {
        // eslint-disable-next-line node/no-callback-literal
        callback(false)
      }
    })
  }

  insertPing (ip, timestamp, unsafePlayerCount) {
    this._insertPingTo(ip, timestamp, unsafePlayerCount, this._sql)

    // Push a copy of the data into the database copy, if any
    // This creates an "insert only" copy of the database for archiving
    const dailyDatabase = this.getDailyDatabase()
    if (dailyDatabase) {
      this._insertPingTo(ip, timestamp, unsafePlayerCount, dailyDatabase)
    }
  }

  _insertPingTo (ip, timestamp, unsafePlayerCount, db) {
    const statement = db.prepare('INSERT INTO pings (timestamp, ip, playerCount) VALUES (?, ?, ?)')
    statement.run(timestamp, ip, unsafePlayerCount, err => {
      if (err) {
        logger.error(`Cannot insert ping record of ${ip} at ${timestamp}`)
        throw err
      }
    })
    statement.finalize()
  }
}

module.exports = Database
