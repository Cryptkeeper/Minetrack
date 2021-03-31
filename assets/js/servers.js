import uPlot from 'uplot'

import { RelativeScale } from './scale'

import { formatNumber, formatTimestampSeconds, formatDate, formatMinecraftServerAddress, formatMinecraftVersions } from './util'
import { uPlotTooltipPlugin } from './plugins'

import MISSING_FAVICON from 'url:../images/missing_favicon.svg'

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

  createServerRegistration (serverId) {
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

  getServerRegistrations = () => Object.values(this._registeredServers)

  reset () {
    this._serverIdsByName = []
    this._serverDataById = []
    this._registeredServers = []

    // Reset modified DOM structures
    document.getElementById('server-list').innerHTML = ''
  }
}

export class ServerRegistration {
  playerCount = 0
  isVisible = true
  isFavorite = false
  rankIndex
  lastRecordData
  lastPeakData

  constructor (app, serverId, data) {
    this._app = app
    this.serverId = serverId
    this.data = data
    this._graphData = [[], []]
    this._failedSequentialPings = 0
  }

  getGraphDataIndex () {
    return this.serverId + 1
  }

  addGraphPoints (points, timestampPoints) {
    this._graphData = [
      timestampPoints.slice(),
      points
    ]
  }

  buildPlotInstance () {
    const tickCount = 4

    // eslint-disable-next-line new-cap
    this._plotInstance = new uPlot({
      plugins: [
        uPlotTooltipPlugin((pos, id) => {
          if (pos) {
            const playerCount = this._graphData[1][id]

            if (typeof playerCount !== 'number') {
              this._app.tooltip.hide()
            } else {
              this._app.tooltip.set(pos.left, pos.top, 10, 10, `${formatNumber(playerCount)} Players<br>${formatTimestampSeconds(this._graphData[0][id])}`)
            }
          } else {
            this._app.tooltip.hide()
          }
        })
      ],
      height: 100,
      width: 400,
      cursor: {
        y: false,
        drag: {
          setScale: false,
          x: false,
          y: false
        },
        sync: {
          key: 'minetrack-server',
          setSeries: true
        }
      },
      series: [
        {},
        {
          stroke: '#E9E581',
          width: 2,
          value: (_, raw) => `${formatNumber(raw)} Players`,
          spanGaps: true,
          points: {
            show: false
          }
        }
      ],
      axes: [
        {
          show: false
        },
        {
          ticks: {
            show: false
          },
          font: '14px "Open Sans", sans-serif',
          stroke: '#A3A3A3',
          size: 55,
          grid: {
            stroke: '#333',
            width: 1
          },
          split: () => {
            const { scaledMin, scaledMax, scale } = RelativeScale.scale(this._graphData[1], tickCount)
            const ticks = RelativeScale.generateTicks(scaledMin, scaledMax, scale)
            return ticks
          }
        }
      ],
      scales: {
        y: {
          auto: false,
          range: () => {
            const { scaledMin, scaledMax } = RelativeScale.scale(this._graphData[1], tickCount)
            return [scaledMin, scaledMax]
          }
        }
      },
      legend: {
        show: false
      }
    }, this._graphData, document.getElementById(`chart_${this.serverId}`))
  }

  handlePing (payload, timestamp) {
    if (typeof payload.playerCount === 'number') {
      this.playerCount = payload.playerCount

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

    // Use payload.playerCount so nulls WILL be pushed into the graphing data
    this._graphData[0].push(timestamp)
    this._graphData[1].push(payload.playerCount)

    // Trim graphData to within the max length by shifting out the leading elements
    for (const series of this._graphData) {
      if (series.length > this._app.publicConfig.serverGraphMaxLength) {
        series.shift()
      }
    }

    // Redraw the plot instance
    this._plotInstance.setData(this._graphData)
  }

  updateServerRankIndex (rankIndex) {
    this.rankIndex = rankIndex

    document.getElementById(`ranking_${this.serverId}`).innerText = `#${rankIndex + 1}`
  }

  _renderValue (prefix, handler) {
    const labelElement = document.getElementById(`${prefix}_${this.serverId}`)

    labelElement.style.display = 'block'

    const valueElement = document.getElementById(`${prefix}-value_${this.serverId}`)
    const targetElement = valueElement || labelElement

    if (targetElement) {
      if (typeof handler === 'function') {
        handler(targetElement)
      } else {
        targetElement.innerText = handler
      }
    }
  }

  _hideValue (prefix) {
    const element = document.getElementById(`${prefix}_${this.serverId}`)

    element.style.display = 'none'
  }

  updateServerStatus (ping, minecraftVersions) {
    if (ping.versions) {
      this._renderValue('version', formatMinecraftVersions(ping.versions, minecraftVersions[this.data.type]) || '')
    }

    if (ping.recordData) {
      this._renderValue('record', (element) => {
        if (ping.recordData.timestamp > 0) {
          element.innerText = `${formatNumber(ping.recordData.playerCount)} (${formatDate(ping.recordData.timestamp)})`
          element.title = `At ${formatDate(ping.recordData.timestamp)} ${formatTimestampSeconds(ping.recordData.timestamp)}`
        } else {
          element.innerText = formatNumber(ping.recordData.playerCount)
        }
      })

      this.lastRecordData = ping.recordData
    }

    if (ping.graphPeakData) {
      this._renderValue('peak', (element) => {
        element.innerText = formatNumber(ping.graphPeakData.playerCount)
        element.title = `At ${formatTimestampSeconds(ping.graphPeakData.timestamp)}`
      })

      this.lastPeakData = ping.graphPeakData
    }

    if (ping.error) {
      this._hideValue('player-count')
      this._renderValue('error', ping.error.message)
    } else if (typeof ping.playerCount !== 'number') {
      this._hideValue('player-count')

      // If the frontend has freshly connection, and the server's last ping was in error, it may not contain an error object
      // In this case playerCount will safely be null, so provide a generic error message instead
      this._renderValue('error', 'Failed to ping')
    } else if (typeof ping.playerCount === 'number') {
      this._hideValue('error')
      this._renderValue('player-count', formatNumber(ping.playerCount))
    }

    // An updated favicon has been sent, update the src
    if (ping.favicon) {
      const faviconElement = document.getElementById(`favicon_${this.serverId}`)

      // Since favicons may be URLs, only update the attribute when it has changed
      // Otherwise the browser may send multiple requests to the same URL
      if (faviconElement.getAttribute('src') !== ping.favicon) {
        faviconElement.setAttribute('src', ping.favicon)
      }
    }
  }

  initServerStatus (latestPing) {
    const serverElement = document.createElement('div')

    serverElement.id = `container_${this.serverId}`
    serverElement.innerHTML = `<div class="column column-favicon">
        <img class="server-favicon" src="${latestPing.favicon || MISSING_FAVICON}" id="favicon_${this.serverId}" title="${this.data.name}\n${formatMinecraftServerAddress(this.data.ip, this.data.port)}">
        <span class="server-rank" id="ranking_${this.serverId}"></span>
      </div>
      <div class="column column-status">
        <h3 class="server-name"><span class="${this._app.favoritesManager.getIconClass(this.isFavorite)}" id="favorite-toggle_${this.serverId}"></span> ${this.data.name}</h3>
        <span class="server-error" id="error_${this.serverId}"></span>
        <span class="server-label" id="player-count_${this.serverId}">Players: <span class="server-value" id="player-count-value_${this.serverId}"></span></span>
        <span class="server-label" id="peak_${this.serverId}">${this._app.publicConfig.graphDurationLabel} Peak: <span class="server-value" id="peak-value_${this.serverId}">-</span></span>
        <span class="server-label" id="record_${this.serverId}">Record: <span class="server-value" id="record-value_${this.serverId}">-</span></span>
        <span class="server-label" id="version_${this.serverId}"></span>
      </div>
      <div class="column column-graph" id="chart_${this.serverId}"></div>`

    serverElement.setAttribute('class', 'server')

    document.getElementById('server-list').appendChild(serverElement)
  }

  updateHighlightedValue (selectedCategory) {
    ['player-count', 'peak', 'record'].forEach((category) => {
      const labelElement = document.getElementById(`${category}_${this.serverId}`)
      const valueElement = document.getElementById(`${category}-value_${this.serverId}`)

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
    document.getElementById(`favorite-toggle_${this.serverId}`).addEventListener('click', () => {
      this._app.favoritesManager.handleFavoriteButtonClick(this)
    }, false)
  }
}
