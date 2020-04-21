import { formatNumber, formatTimestamp, formatDate, formatMinecraftServerAddress, formatMinecraftVersions, isArrayEqual, isObjectEqual } from './util'

import MISSING_FAVICON from '../images/missing_favicon.svg'

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
  constructor (app) {
    this._app = app
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
    const serverRegistration = new ServerRegistration(this._app, serverId, serverData)
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
  isVisible = true
  isFavorite = false
  rankIndex
  lastRecordData
  lastVersions = []
  lastPeakData

  constructor (app, serverId, data) {
    this._app = app
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

  updateServerRankIndex (rankIndex) {
    this.rankIndex = rankIndex

    document.getElementById('ranking_' + this.serverId).innerText = '#' + (rankIndex + 1)
  }

  updateServerPeak (time, playerCount) {
    const peakLabelElement = document.getElementById('peak_' + this.serverId)

    // Always set label once any peak data has been received
    peakLabelElement.style.display = 'block'

    const peakValueElement = document.getElementById('peak-value_' + this.serverId)

    peakValueElement.innerText = formatNumber(playerCount)
    peakLabelElement.title = 'At ' + formatTimestamp(time)

    this.lastPeakData = {
      timestamp: time,
      playerCount: playerCount
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

      versionsElement.style.display = 'block'
      versionsElement.innerText = formatMinecraftVersions(ping.versions, minecraftVersions[this.data.type]) || ''
    }

    // Compare against a cached value to avoid empty updates
    if (ping.recordData !== undefined && !isObjectEqual(ping.recordData, this.lastRecordData, ['playerCount', 'timestamp'])) {
      this.lastRecordData = ping.recordData

      // Always set label once any record data has been received
      const recordLabelElement = document.getElementById('record_' + this.serverId)

      recordLabelElement.style.display = 'block'

      const recordValueElement = document.getElementById('record-value_' + this.serverId)

      const recordData = ping.recordData

      // Safely handle legacy recordData that may not include the timestamp payload
      if (recordData.timestamp > 0) {
        recordValueElement.innerHTML = formatNumber(recordData.playerCount) + ' (' + formatDate(recordData.timestamp) + ')'
        recordLabelElement.title = 'At ' + formatDate(recordData.timestamp) + ' ' + formatTimestamp(recordData.timestamp)
      } else {
        recordValueElement.innerText = formatNumber(recordData.playerCount)
      }
    }

    const playerCountLabelElement = document.getElementById('player-count_' + this.serverId)
    const errorElement = document.getElementById('error_' + this.serverId)

    if (ping.error) {
      // Hide any visible player-count and show the error element
      playerCountLabelElement.style.display = 'none'
      errorElement.style.display = 'block'

      errorElement.innerText = ping.error.message
    } else if (ping.result) {
      // Ensure the player-count element is visible and hide the error element
      playerCountLabelElement.style.display = 'block'
      errorElement.style.display = 'none'

      document.getElementById('player-count-value_' + this.serverId).innerText = formatNumber(ping.result.players.online)

      // An updated favicon has been sent, update the src
      // Ignore calls from 'add' events since they will have explicitly manually handled the favicon update
      if (!isInitialUpdate && ping.favicon) {
        document.getElementById('favicon_' + this.serverId).setAttribute('src', ping.favicon)
      }
    }
  }

  initServerStatus (latestPing) {
    const peakHourDuration = Math.floor(this._app.publicConfig.graphDuration / (60 * 60 * 1000)) + 'h Peak: '

    const serverElement = document.createElement('div')

    serverElement.id = 'container_' + this.serverId
    serverElement.innerHTML = '<div class="column column-favicon">' +
        '<img class="server-favicon" src="' + (latestPing.favicon || MISSING_FAVICON) + '" id="favicon_' + this.serverId + '" title="' + this.data.name + '\n' + formatMinecraftServerAddress(this.data.ip, this.data.port) + '">' +
        '<span class="server-rank" id="ranking_' + this.serverId + '"></span>' +
      '</div>' +
      '<div class="column column-status">' +
        '<h3 class="server-name"><span class="' + this._app.favoritesManager.getIconClass(this.isFavorite) + '" id="favorite-toggle_' + this.serverId + '"></span> ' + this.data.name + '</h3>' +
        '<span class="server-error" id="error_' + this.serverId + '"></span>' +
        '<span class="server-label" id="player-count_' + this.serverId + '">Players: <span class="server-value" id="player-count-value_' + this.serverId + '"></span></span>' +
        '<span class="server-label" id="peak_' + this.serverId + '">' + peakHourDuration + '<span class="server-value" id="peak-value_' + this.serverId + '">-</span></span>' +
        '<span class="server-label" id="record_' + this.serverId + '">Record: <span class="server-value" id="record-value_' + this.serverId + '">-</span></span>' +
        '<span class="server-label" id="version_' + this.serverId + '"></span>' +
      '</div>' +
      '<div class="column column-graph" id="chart_' + this.serverId + '"></div>'

    serverElement.setAttribute('class', 'server')

    document.getElementById('server-list').appendChild(serverElement)
  }

  updateHighlightedValue (selectedCategory) {
    ['player-count', 'peak', 'record'].forEach((category) => {
      const labelElement = document.getElementById(category + '_' + this.serverId)
      const valueElement = document.getElementById(category + '-value_' + this.serverId)

      if (selectedCategory && category === selectedCategory) {
        labelElement.setAttribute('class', 'server-highlighted-label')
        valueElement.setAttribute('class', 'server-highlighted-value')
      } else {
        labelElement.setAttribute('class', 'server-label')
        valueElement.setAttribute('class', 'server-value')
      }
    })
  }

  initEventListeners () {
    $('#chart_' + this.serverId).bind('plothover', this._app.graphDisplayManager.handlePlotHover)

    document.getElementById('favorite-toggle_' + this.serverId).addEventListener('click', () => {
      this._app.favoritesManager.handleFavoriteButtonClick(this)
    }, false)
  }
}
