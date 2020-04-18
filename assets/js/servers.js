import { formatNumber, formatTimestamp, formatDate, formatMinecraftServerAddress, formatMinecraftVersions, isArrayEqual, isObjectEqual } from './util'

import MISSING_FAVICON from '../images/missing_favicon.png'

export const SERVER_GRAPH_OPTIONS = {
  series: {
    shadowSize: 0
  },
  xaxis: {
    font: {
      color: '#E3E3E3'
    },
    show: false
  },
  yaxis: {
    minTickSize: 100,
    tickDecimals: 0,
    show: true,
    tickLength: 10,
    tickFormatter: formatNumber,
    font: {
      color: '#E3E3E3'
    },
    labelWidth: -10
  },
  grid: {
    hoverable: true,
    color: '#696969'
  },
  colors: [
    '#E9E581'
  ]
}

export class ServerRegistry {
  constructor () {
    this._serverIdsByName = []
    this._serverDataById = []
    this._registeredServers = []
  }

  assignServers (servers) {
    for (let i = 0; i < servers.length; i++) {
      const data = servers[i]
      this._serverIdsByName[data.name] = i
      this._serverDataById[i] = data
    }
  }

  createServerRegistration (serverName) {
    const serverId = this._serverIdsByName[serverName]
    const serverData = this._serverDataById[serverId]
    const serverRegistration = new ServerRegistration(serverId, serverData)
    this._registeredServers[serverId] = serverRegistration
    return serverRegistration
  }

  getServerRegistration (serverKey) {
    if (typeof serverKey === 'string') {
      const serverId = this._serverIdsByName[serverKey]
      return this._registeredServers[serverId]
    } else if (typeof serverKey === 'number') {
      return this._registeredServers[serverKey]
    }
  }

  getServerRankBy (serverRegistration, x, sort) {
    const records = Object.values(this._registeredServers)
      .map(x)
      .filter(val => val !== undefined)

    // Invalidate any results that do not account for all serverRegistrations
    if (records.length === this._registeredServers.length) {
      records.sort(sort)

      // Pull matching data from target serverRegistration
      // Assume indexOf cannot be -1 or val undefined since they have been pre-tested in the map call above
      const val = x(serverRegistration)
      const indexOf = records.indexOf(val)
      return indexOf + 1
    }
  }

  getServerRegistrations = () => Object.values(this._registeredServers)

  reset () {
    this._serverIdsByName = []
    this._serverDataById = []
    this._registeredServers = []

    // Reset modified DOM structures
    document.getElementById('server-list').innerHTML = ''
  }
}

const SERVER_GRAPH_DATA_MAX_LENGTH = 72

export class ServerRegistration {
  playerCount = 0
  maxPlayerCount = 0
  isVisible = true
  rankIndex
  lastRecordData
  lastVersions = []
  lastPeak

  constructor (serverId, data) {
    this.serverId = serverId
    this.data = data
    this._graphData = []
    this._failedSequentialPings = 0
  }

  addGraphPoints (points) {
    // Test if the first point contains error.placeholder === true
    // This is sent by the backend when the server hasn't been pinged yet
    // These points will be disregarded to prevent the graph starting at 0 player count
    points = points.filter(point => !point.error || !point.error.placeholder)

    // The backend should never return more data elements than the max
    // but trim the data result regardless for safety and performance purposes
    if (points.length > SERVER_GRAPH_DATA_MAX_LENGTH) {
      points.slice(points.length - SERVER_GRAPH_DATA_MAX_LENGTH, points.length)
    }

    this._graphData = points.map(point => point.result ? [point.timestamp, point.result.players.online] : [point.timestamp, 0])
  }

  buildPlotInstance () {
    this._plotInstance = $.plot('#chart_' + this.serverId, [this._graphData], SERVER_GRAPH_OPTIONS)

    return $('#chart_' + this.serverId)
  }

  handlePing (payload, pushToGraph) {
    if (payload.result) {
      this.playerCount = payload.result.players.online

      if (pushToGraph) {
        // Only update graph for successful pings
        // This intentionally pauses the server graph when pings begin to fail
        this._graphData.push([payload.info.timestamp, this.playerCount])

        // Trim graphData to within the max length by shifting out the leading elements
        if (this._graphData.length > SERVER_GRAPH_DATA_MAX_LENGTH) {
          this._graphData.shift()
        }

        this.redraw()
      }

      // Reset failed ping counter to ensure the next connection error
      // doesn't instantly retrigger a layout change
      this._failedSequentialPings = 0
    } else {
      // Attempt to retain a copy of the cached playerCount for up to N failed pings
      // This prevents minor connection issues from constantly reshuffling the layout
      if (++this._failedSequentialPings > 5) {
        this.playerCount = 0
      }
    }
  }

  redraw () {
    // Redraw the plot instance
    this._plotInstance.setData([this._graphData])
    this._plotInstance.setupGrid()
    this._plotInstance.draw()
  }

  getPlayerCountDifference () {
    if (this._graphData.length >= 2) {
      // [1] refers to playerCount data index
      // See constructor for data structure initialization
      const oldestPlayerCount = this._graphData[0][1]
      const newestPlayerCount = this._graphData[this._graphData.length - 1][1]

      return newestPlayerCount - oldestPlayerCount
    }
  }

  updateServerRankIndex (rankIndex) {
    this.rankIndex = rankIndex

    document.getElementById('ranking_' + this.serverId).innerText = '#' + (rankIndex + 1)
  }

  updateServerPeak (time, playerCount, graphDuration) {
    const hourDuration = Math.floor(graphDuration / (60 * 60 * 1000))
    const peakElement = document.getElementById('peak_' + this.serverId)

    peakElement.innerHTML = hourDuration + 'h Peak: ' + formatNumber(playerCount)
    peakElement.title = 'At ' + formatTimestamp(time)

    this.lastPeakData = {
      timestamp: time,
      playerCount: playerCount,
      hourDuration: hourDuration
    }
  }

  updateServerStatus (ping, isInitialUpdate, minecraftVersions) {
    // Only pushToGraph when initialUpdate === false
    // Otherwise the ping value is pushed into the graphData when already present
    this.handlePing(ping, !isInitialUpdate)

    // Compare against a cached value to avoid empty updates
    // Allow undefined ping.versions inside the if statement for text reset handling
    if (ping.versions && !isArrayEqual(ping.versions, this.lastVersions)) {
      this.lastVersions = ping.versions

      const versionsElement = document.getElementById('version_' + this.serverId)
      versionsElement.innerText = formatMinecraftVersions(ping.versions, minecraftVersions[ping.info.type]) || ''
    }

    // Compare against a cached value to avoid empty updates
    if (ping.recordData !== undefined && !isObjectEqual(ping.recordData, this.lastRecordData, ['playerCount', 'timestamp'])) {
      this.lastRecordData = ping.recordData

      const recordData = ping.recordData
      const recordElement = document.getElementById('record_' + this.serverId)

      // Safely handle legacy recordData that may not include the timestamp payload
      if (recordData.timestamp !== -1) {
        recordElement.innerHTML = 'Record: ' + formatNumber(recordData.playerCount) + ' &middot; ' + formatDate(recordData.timestamp)
        recordElement.title = 'At ' + formatDate(recordData.timestamp) + ' ' + formatTimestamp(recordData.timestamp)
      } else {
        recordElement.innerHTML = 'Record: ' + formatNumber(recordData.playerCount)
      }
    }

    const statusElement = document.getElementById('status_' + this.serverId)

    if (ping.error) {
      // Attempt to find an error cause from documented options
      const errorMessage = ping.error.description || ping.error.errno || 'Unknown error'
      statusElement.innerHTML = '<span class="server-error-message">' + errorMessage + '</span>'
    } else if (ping.result) {
      let statusHTML = 'Players: <span class="server-player-count">' + formatNumber(ping.result.players.online) + '</span>'

      // If the data is defined, generate a player count difference and append
      const playerCountDifference = this.getPlayerCountDifference()
      if (playerCountDifference !== undefined) {
        statusHTML += '<span class="server-player-count-diff"> (' + (playerCountDifference >= 0 ? '+' : '') + formatNumber(playerCountDifference) + ')</span>'
      }

      statusElement.innerHTML = statusHTML

      // An updated favicon has been sent, update the src
      // Ignore calls from 'add' events since they will have explicitly manually handled the favicon update
      if (!isInitialUpdate && ping.favicon) {
        document.getElementById('favicon_' + this.serverId).setAttribute('src', ping.favicon)
      }

      this.maxPlayerCount = ping.result.players.max
    }
  }

  initServerStatus (latestPing) {
    const serverElement = document.createElement('div')

    serverElement.id = 'container_' + this.serverId
    serverElement.innerHTML = '<div class="column column-favicon">' +
        '<img class="server-favicon" src="' + (latestPing.favicon || MISSING_FAVICON) + '" id="favicon_' + this.serverId + '" title="' + this.data.name + '\n' + formatMinecraftServerAddress(this.data.ip, this.data.port) + '">' +
        '<span class="server-rank" id="ranking_' + this.serverId + '"></span>' +
      '</div>' +
      '<div class="column column-status">' +
        '<h3 class="server-name">' + this.data.name + ' <span class="server-show-more icon-clock-o" id="show-more_' + this.serverId + '"></span></h3>' +
        '<span class="server-status" id="status_' + this.serverId + '"></span>' +
        '<span class="server-peak" id="peak_' + this.serverId + '"></span>' +
        '<span class="server-record" id="record_' + this.serverId + '"></span>' +
        '<span class="server-versions" id="version_' + this.serverId + '"></span>' +
      '</div>' +
      '<div class="column column-graph" id="chart_' + this.serverId + '"></div>'

    serverElement.setAttribute('class', 'server')

    document.getElementById('server-list').appendChild(serverElement)
  }
}
