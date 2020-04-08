import { formatNumber, formatTimestamp } from './util'

export class Tooltip {
  constructor () {
    this._div = document.getElementById('tooltip')
  }

  set (x, y, html) {
    this._div.innerHTML = html
    this._div.style.top = y + 'px'
    this._div.style.left = x + 'px'
    this._div.style.display = 'block'
  }

  hide = () => {
    this._div.style.display = 'none'
  }
}

export class Caption {
  constructor () {
    this._div = document.getElementById('status-text')
  }

  set (text) {
    this._div.innerText = text
    this._div.style.display = 'block'
  }

  hide () {
    this._div.style.display = 'none'
  }
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

  // TODO: remove me
  getServerId = (serverName) => this._serverIdsByName[serverName]

  registerServer (serverRegistration) {
    serverRegistration.data = this._serverDataById[serverRegistration.serverId]
    this._registeredServers[serverRegistration.serverId] = serverRegistration
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
  serverId
  data
  playerCount = 0
  isVisible = true

  constructor (serverId, plotInstance) {
    this.serverId = serverId
    this._plotInstance = plotInstance
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
}
