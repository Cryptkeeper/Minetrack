import { formatNumber, formatTimestamp, isMobileBrowser } from './util'

import { FAVORITE_SERVERS_STORAGE_KEY } from './favorites'

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
    ticks: 20,
    minTickSize: 10,
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
const SHOW_FAVORITES_STORAGE_KEY = 'minetrack_show_favorites'

export class GraphDisplayManager {
  // Only emit graph data request if not on mobile due to graph data size
  isVisible = !isMobileBrowser()

  constructor (app) {
    this._app = app
    this._graphData = []
    this._hasLoadedSettings = false
    this._initEventListenersOnce = false
    this._showOnlyFavorites = false
  }

  addGraphPoint (serverId, timestamp, playerCount) {
    if (!this._hasLoadedSettings) {
      // _hasLoadedSettings is controlled by #setGraphData
      // It will only be true once the context has been loaded and initial payload received
      // #addGraphPoint should not be called prior to that since it means the data is racing
      // and the application has received updates prior to the initial state
      return
    }

    const graphData = this._graphData[serverId]

    // Push the new data from the method call request
    graphData.push([timestamp, playerCount])

    // Trim any outdated entries by filtering the array into a new array
    if (graphData.length > this._app.publicConfig.graphMaxLength) {
      graphData.shift()
    }
  }

  loadLocalStorage () {
    if (typeof localStorage !== 'undefined') {
      const showOnlyFavorites = localStorage.getItem(SHOW_FAVORITES_STORAGE_KEY)
      if (showOnlyFavorites) {
        this._showOnlyFavorites = true
      }

      // If only favorites mode is active, use the stored favorite servers data instead
      let serverNames
      if (this._showOnlyFavorites) {
        serverNames = localStorage.getItem(FAVORITE_SERVERS_STORAGE_KEY)
      } else {
        serverNames = localStorage.getItem(HIDDEN_SERVERS_STORAGE_KEY)
      }

      if (serverNames) {
        serverNames = JSON.parse(serverNames)

        // Iterate over all active serverRegistrations
        // This merges saved state with current state to prevent desyncs
        for (const serverRegistration of this._app.serverRegistry.getServerRegistrations()) {
          // isVisible will be true if showOnlyFavorites && contained in FAVORITE_SERVERS_STORAGE_KEY
          // OR, if it is NOT contains within HIDDEN_SERVERS_STORAGE_KEY
          // Checks between FAVORITE/HIDDEN keys are mutually exclusive
          if (this._showOnlyFavorites) {
            serverRegistration.isVisible = serverNames.indexOf(serverRegistration.data.name) >= 0
          } else {
            serverRegistration.isVisible = serverNames.indexOf(serverRegistration.data.name) < 0
          }
        }
      }
    }
  }

  updateLocalStorage () {
    if (typeof localStorage !== 'undefined') {
      // Mutate the serverIds array into server names for storage use
      const serverNames = this._app.serverRegistry.getServerRegistrations()
        .filter(serverRegistration => !serverRegistration.isVisible)
        .map(serverRegistration => serverRegistration.data.name)

      // Only store if the array contains data, otherwise clear the item
      // If showOnlyFavorites is true, do NOT store serverNames since the state will be auto managed instead
      if (serverNames.length > 0 && !this._showOnlyFavorites) {
        localStorage.setItem(HIDDEN_SERVERS_STORAGE_KEY, JSON.stringify(serverNames))
      } else {
        localStorage.removeItem(HIDDEN_SERVERS_STORAGE_KEY)
      }

      // Only store SHOW_FAVORITES_STORAGE_KEY if true
      if (this._showOnlyFavorites) {
        localStorage.setItem(SHOW_FAVORITES_STORAGE_KEY, true)
      } else {
        localStorage.removeItem(SHOW_FAVORITES_STORAGE_KEY)
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

  buildPlotInstance (graphData) {
    // Lazy load settings from localStorage, if any and if enabled
    if (!this._hasLoadedSettings) {
      this._hasLoadedSettings = true

      this.loadLocalStorage()
    }

    this._graphData = graphData

    // Explicitly define a height so flot.js can rescale the Y axis
    document.getElementById('big-graph').style.height = '400px'

    this._plotInstance = $.plot('#big-graph', this.getVisibleGraphData(), HISTORY_GRAPH_OPTIONS)

    // Show the settings-toggle element
    document.getElementById('settings-toggle').style.display = 'inline-block'
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

      this._app.tooltip.set(item.pageX, item.pageY, 10, 10, text)
    }
  }

  initEventListeners () {
    if (!this._initEventListenersOnce) {
      this._initEventListenersOnce = true

      // These listeners should only be init once since they attach to persistent elements
      document.getElementById('settings-toggle').addEventListener('click', this.handleSettingsToggle, false)

      document.querySelectorAll('.graph-controls-show').forEach((element) => {
        element.addEventListener('click', this.handleShowButtonClick, false)
      })
    }

    $('#big-graph').bind('plothover', this.handlePlotHover)

    // These listeners should be bound each #initEventListeners call since they are for newly created elements
    document.querySelectorAll('.graph-control').forEach((element) => {
      element.addEventListener('click', this.handleServerButtonClick, false)
    })
  }

  handleServerButtonClick = (event) => {
    const serverId = parseInt(event.target.getAttribute('minetrack-server-id'))
    const serverRegistration = this._app.serverRegistry.getServerRegistration(serverId)

    if (serverRegistration.isVisible !== event.target.checked) {
      serverRegistration.isVisible = event.target.checked

      // Any manual changes automatically disables "Only Favorites" mode
      // Otherwise the auto management might overwrite their manual changes
      this._showOnlyFavorites = false

      this.redraw()
    }
  }

  handleShowButtonClick = (event) => {
    const showType = event.target.getAttribute('minetrack-show-type')

    // If set to "Only Favorites", set internal state so that
    // visible graphData is automatically updating when a ServerRegistration's #isVisible changes
    // This is also saved and loaded by #loadLocalStorage & #updateLocalStorage
    this._showOnlyFavorites = showType === 'favorites'

    let redraw = false

    this._app.serverRegistry.getServerRegistrations().forEach(function (serverRegistration) {
      let isVisible
      if (showType === 'all') {
        isVisible = true
      } else if (showType === 'none') {
        isVisible = false
      } else if (showType === 'favorites') {
        isVisible = serverRegistration.isFavorite
      }

      if (serverRegistration.isVisible !== isVisible) {
        serverRegistration.isVisible = isVisible
        redraw = true
      }
    })

    if (redraw) {
      this.redraw()
      this.updateCheckboxes()
    }
  }

  handleSettingsToggle = () => {
    const element = document.getElementById('big-graph-controls-drawer')

    if (element.style.display !== 'block') {
      element.style.display = 'block'
    } else {
      element.style.display = 'none'
    }
  }

  handleServerIsFavoriteUpdate = (serverRegistration) => {
    // When in "Only Favorites" mode, visibility is dependent on favorite status
    // Redraw and update elements as needed
    if (this._showOnlyFavorites && serverRegistration.isVisible !== serverRegistration.isFavorite) {
      serverRegistration.isVisible = serverRegistration.isFavorite

      this.redraw()
      this.updateCheckboxes()
    }
  }

  updateCheckboxes () {
    document.querySelectorAll('.graph-control').forEach((checkbox) => {
      const serverId = parseInt(checkbox.getAttribute('minetrack-server-id'))
      const serverRegistration = this._app.serverRegistry.getServerRegistration(serverId)

      checkbox.checked = serverRegistration.isVisible
    })
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

    // Reset modified DOM structures
    document.getElementById('big-graph-checkboxes').innerHTML = ''
    document.getElementById('big-graph-controls').style.display = 'none'

    document.getElementById('settings-toggle').style.display = 'none'

    const graphElement = document.getElementById('big-graph')

    graphElement.innerHTML = ''
    graphElement.removeAttribute('style')
  }
}
