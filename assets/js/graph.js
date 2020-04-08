import { formatNumber, formatTimestamp } from './util.js'

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

export const HISTORY_GRAPH_OPTIONS = {
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
    show: true,
    tickSize: 2000,
    tickLength: 10,
    tickFormatter: formatNumber,
    font: {
      color: '#E3E3E3'
    },
    labelWidth: -5,
    min: 0
  },
  grid: {
    hoverable: true,
    color: '#696969'
  },
  legend: {
    show: false
  }
}

const HIDDEN_SERVERS_STORAGE_KEY = 'minetrack_hidden_servers'

export class GraphDisplayManager {
  constructor (app) {
    this._app = app
    this._graphData = []
    this._hasLoadedSettings = false
  }

  addGraphPoint (serverId, timestamp, playerCount) {
    if (!this._hasLoadedSettings) {
      // _hasLoadedSettings is controlled by #setGraphData
      // It will only be true once the context has been loaded and initial payload received
      // #addGraphPoint should not be called prior to that since it means the data is racing
      // and the application has received updates prior to the initial state
      return
    }

    // Trim any outdated entries by filtering the array into a new array
    const startTimestamp = new Date().getTime()
    const newGraphData = this._graphData[serverId].filter(point => startTimestamp - point[0] <= this._app.publicConfig.graphDuration)

    // Push the new data from the method call request
    newGraphData.push([timestamp, playerCount])

    this._graphData[serverId] = newGraphData
  }

  setGraphData (graphData) {
    // Lazy load settings from localStorage, if any and if enabled
    if (!this._hasLoadedSettings) {
      this._hasLoadedSettings = true

      this.loadLocalStorage()
    }

    const keys = Object.keys(graphData)

    for (let i = 0; i < keys.length; i++) {
      const serverName = keys[i]
      const serverRegistration = this._app.serverRegistry.getServerRegistration(serverName)
      this._graphData[serverRegistration.serverId] = graphData[serverName]
    }

    // This isn't nessecary since #setGraphData is manually called, but it ensures
    // consistent behavior which will make any future changes easier.
    this._mustRedraw = true
  }

  loadLocalStorage () {
    if (typeof (localStorage) !== 'undefined') {
      let serverNames = localStorage.getItem(HIDDEN_SERVERS_STORAGE_KEY)
      if (serverNames) {
        serverNames = JSON.parse(serverNames)

        for (let i = 0; i < serverNames.length; i++) {
          const serverRegistration = this._app.serverRegistry.getServerRegistration(serverNames[i])

          // The serverName may not exist in the backend configuration anymore
          // Ensure serverRegistration is defined before mutating data or considering valid
          if (serverRegistration) {
            serverRegistration.isVisible = false
          }
        }
      }
    }
  }

  updateLocalStorage () {
    if (typeof (localStorage) !== 'undefined') {
      // Mutate the serverIds array into server names for storage use
      const serverNames = this._app.serverRegistry.getServerRegistrations()
        .filter(serverRegistration => !serverRegistration.isVisible)
        .map(serverRegistration => serverRegistration.data.name)

      if (serverNames.length > 0) {
        // Only save if the array contains data, otherwise clear the item
        localStorage.setItem(HIDDEN_SERVERS_STORAGE_KEY, JSON.stringify(serverNames))
      } else {
        localStorage.removeItem(HIDDEN_SERVERS_STORAGE_KEY)
      }
    }
  }

  // Converts the backend data into the schema used by flot.js
  getVisibleGraphData () {
    return Object.keys(this._graphData)
      .map(Number)
      .map(serverId => this._app.serverRegistry.getServerRegistration(serverId))
      .filter(serverRegistration => serverRegistration !== undefined && serverRegistration.isVisible)
      .map(serverRegistration => {
        return {
          data: this._graphData[serverRegistration.serverId],
          yaxis: 1,
          label: serverRegistration.data.name,
          color: serverRegistration.data.color
        }
      })
  }

  buildPlotInstance () {
    this._plotInstance = $.plot('#big-graph', this.getVisibleGraphData(), HISTORY_GRAPH_OPTIONS)
  }

  // requestRedraw allows usages to request a redraw that may be performed, or cancelled, sometime later
  // This allows multiple rapid, but individual updates, to clump into a single redraw instead
  requestRedraw () {
    if (this._redrawRequestTimeout) {
      clearTimeout(this._redrawRequestTimeout)
    }

    // Schedule new delayed redraw call
    // This can be cancelled by #requestRedraw, #redraw and #reset
    this._redrawRequestTimeout = setTimeout(this.redraw, 1000)
  }

  redraw = () => {
    // Use drawing as a hint to update settings
    // This may cause unnessecary localStorage updates, but its a rare and harmless outcome
    this.updateLocalStorage()

    // Fire calls to the provided graph instance
    // This allows flot.js to manage redrawing and creates a helper method to reduce code duplication
    this._plotInstance.setData(this.getVisibleGraphData())
    this._plotInstance.setupGrid()
    this._plotInstance.draw()

    // undefine value so #clearTimeout is not called
    // This is safe even if #redraw is manually called since it removes the pending work
    if (this._redrawRequestTimeout) {
      clearTimeout(this._redrawRequestTimeout)
    }

    this._redrawRequestTimeout = undefined
  }

  requestResize () {
    // Only resize when _plotInstance is defined
    // Set a timeout to resize after resize events have not been fired for some duration of time
    // This prevents burning CPU time for multiple, rapid resize events
    if (this._plotInstance) {
      if (this._resizeRequestTimeout) {
        clearTimeout(this._resizeRequestTimeout)
      }

      // Schedule new delayed resize call
      // This can be cancelled by #requestResize, #resize and #reset
      this._resizeRequestTimeout = setTimeout(this.resize, 200)
    }
  }

  resize = () => {
    if (this._plotInstance) {
      this._plotInstance.resize()
      this._plotInstance.setupGrid()
      this._plotInstance.draw()
    }

    // undefine value so #clearTimeout is not called
    // This is safe even if #resize is manually called since it removes the pending work
    if (this._resizeRequestTimeout) {
      clearTimeout(this._resizeRequestTimeout)
    }

    this._resizeRequestTimeout = undefined
  }

  // Called by flot.js when they hover over a data point.
  handlePlotHover = (event, pos, item) => {
    if (!item) {
      this._app.tooltip.hide()
    } else {
      let text = formatNumber(item.datapoint[1]) + ' Players<br>' + formatTimestamp(item.datapoint[0])
      // Prefix text with the series label when possible
      if (item.series && item.series.label) {
        text = '<strong>' + item.series.label + '</strong><br>' + text
      }

      this._app.tooltip.set(item.pageX + 5, item.pageY + 5, text)
    }
  }

  reset () {
    this._graphData = []
    this._plotInstance = undefined
    this._hasLoadedSettings = false

    // Fire #clearTimeout if the timeout is currently defined
    if (this._resizeRequestTimeout) {
      clearTimeout(this._resizeRequestTimeout)

      this._resizeRequestTimeout = undefined
    }

    if (this._redrawRequestTimeout) {
      clearTimeout(this._redrawRequestTimeout)

      this._redrawRequestTimeout = undefined
    }

    // Reset modified DOM structures
    document.getElementById('big-graph-checkboxes').innerHTML = ''
    document.getElementById('big-graph-controls').style.display = 'none'

    const graphElement = document.getElementById('big-graph')

    graphElement.innerHTML = ''
    graphElement.removeAttribute('style')
  }
}
