import { formatNumber, formatTimestamp, formatMinecraftServerAddress } from './util'

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
    minTickSize: 75,
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

  constructor (serverId, data) {
    this.serverId = serverId
    this.data = data
    this._graphData = []
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
    this._plotInstance = $.plot('#chart_' + this.serverId, this._graphData, SERVER_GRAPH_OPTIONS)
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
    } else {
      this.playerCount = 0
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

  updateServerPeak (time, playerCount, graphDuration) {
    const hourDuration = Math.floor(graphDuration / (60 * 60 * 1000))

    document.getElementById('peak_' + this.serverId).innerText = hourDuration + 'h Peak: ' + formatNumber(playerCount) + ' @ ' + formatTimestamp(time)
  }

  updateServerStatus (ping, isInitialUpdate, minecraftVersions) {
    // Only pushToGraph when initialUpdate === false
    // Otherwise the ping value is pushed into the graphData when already present
    this.handlePing(ping, !isInitialUpdate)

    // Remap version indexes into their formatted name equivalents
    const versionsElement = document.getElementById('version_' + this.serverId)

    if (ping.versions) {
      versionsElement.innerHTML = ping.versions.map(version => {
        return minecraftVersions[ping.info.type][version]
      }).join(' ')
    } else {
      versionsElement.innerHTML = ''
    }

    if (ping.record) {
      document.getElementById('record_' + this.serverId).innerText = 'Record: ' + formatNumber(ping.record)
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
    }
  }

  initServerStatus (latestPing, isServerTypeVisible) {
    const serverElement = document.createElement('div')

    serverElement.id = 'container_' + this.serverId
    serverElement.innerHTML = '<div id="server-' + this.serverId + '" class="column column-favicon">' +
        '<img class="server-favicon" src="' + (latestPing.favicon || MISSING_FAVICON) + '" id="favicon_' + this.serverId + '" title="' + this.data.name + '\n' + formatMinecraftServerAddress(this.data.ip, this.data.port) + '">' +
        '<span class="server-rank" id="ranking_' + this.serverId + '"></span>' +
      '</div>' +
      '<div class="column column-status">' +
        '<h3 class="server-name">' + this.data.name + (isServerTypeVisible ? '<span class="server-type">' + this.data.type + '</span>' : '') + '</h3>' +
        '<span id="status_' + this.serverId + '"></span>' +
        '<span class="server-versions" id="version_' + this.serverId + '"></span>' +
        '<span class="server-peak" id="peak_' + this.serverId + '"></span>' +
        '<span class="server-record" id="record_' + this.serverId + '"></span>' +
      '</div>' +
      '<div class="column column-graph" id="chart_' + this.serverId + '"></div>'

    serverElement.setAttribute('class', 'server')

    document.getElementById('server-list').appendChild(serverElement)
  }
}
