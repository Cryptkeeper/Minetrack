import { App } from './app.js'
import { ServerGraph } from './core.js'

import { SERVER_GRAPH_OPTIONS } from './graph.js'

import { formatNumber, getTimestamp, formatMinecraftServerAddress, isMobileBrowser } from './util.js'

import MISSING_FAVICON from '../images/missing_favicon.png'

const app = new App()

function updateServerStatus (serverId, ping, initialUpdate) {
  const serverGraph = app.serverRegistry.getServerGraph(serverId)

  // Only pushToGraph when initialUpdate === false
  // Otherwise the ping value is pushed into the graphData when already present
  serverGraph.handlePing(ping, !initialUpdate)

  // Remap version indexes into their formatted name equivalents
  const versionsElement = document.getElementById('version_' + serverId)

  if (ping.versions) {
    const versionNames = ping.versions.map(version => {
      const versionName = app.publicConfig.minecraftVersions[ping.info.type][version]
      return versionName
    }).join(' ')

    versionsElement.innerHTML = versionNames
  } else {
    versionsElement.innerHTML = ''
  }

  if (ping.record) {
    document.getElementById('record_' + serverId).innerText = 'Record: ' + formatNumber(ping.record)
  }

  const statusElement = document.getElementById('status_' + serverId)

  if (ping.result) {
    let statusHTML = 'Players: <span class="server-player-count">' + formatNumber(ping.result.players.online) + '</span>'

    // If the data is defined, generate a player count difference and append
    const playerCountDifference = serverGraph.getPlayerCountDifference()

    if (playerCountDifference !== undefined) {
      statusHTML += '<span class="server-player-count-diff"> (' + (playerCountDifference >= 0 ? '+' : '') + formatNumber(playerCountDifference) + ')</span>'
    }

    statusElement.innerHTML = statusHTML

    // An updated favicon has been sent, update the src
    // Ignore calls from 'add' events since they will have explicitly manually handled the favicon update
    if (!initialUpdate && ping.result.favicon) {
      document.getElementById('favicon_' + serverId).setAttribute('src', ping.result.favicon)
    }
  } else {
    let errorMessage = 'Unknown error'
    if (ping.error) {
      // Attempt to find an error cause from documented options
      errorMessage = ping.error.description || ping.error.errno || errorMessage
    }

    statusElement.innerHTML = '<span class="server-error-message">' + errorMessage + '</span>'
  }
}

function updateGlobalStats () {
  document.getElementById('stat_totalPlayers').innerText = formatNumber(app.serverRegistry.getTotalPlayerCount())
  document.getElementById('stat_networks').innerText = formatNumber(app.serverRegistry.getActiveServerCount())
}

function sortServers () {
  app.serverRegistry.getServerIds().sort(function (a, b) {
    return app.serverRegistry.getPlayerCount(b) - app.serverRegistry.getPlayerCount(a)
  }).forEach(function (serverId, i) {
    $('#container_' + serverId).appendTo('#server-list')

    document.getElementById('ranking_' + serverId).innerText = '#' + (i + 1)
  })
}

function updatePercentageBar () {
  const parent = document.getElementById('perc-bar')
  let leftPadding = 0

  app.serverRegistry.getServerIds().sort(function (a, b) {
    return app.serverRegistry.getPlayerCount(a) - app.serverRegistry.getPlayerCount(b)
  }).forEach(function (serverId) {
    let div = document.getElementById('perc_bar_part_' + serverId)

    // Test if an element has been previously created
    if (div === null) {
      div = document.createElement('div')

      div.id = 'perc_bar_part_' + serverId

      const serverName = app.serverRegistry.getServerName(serverId)
      div.style.background = app.getServerColor(serverName)

      div.setAttribute('class', 'perc-bar-part')

      parent.appendChild(div)

      // Define events once during creation
      div.addEventListener('mouseover', function () {
        const totalPlayers = app.serverRegistry.getTotalPlayerCount()
        const playerCount = app.serverRegistry.getPlayerCount(serverId)
        const serverName = app.serverRegistry.getServerName(serverId)

        const percentage = Math.round((playerCount / totalPlayers) * 100 * 10) / 10

        app.tooltip.set(div.offsetLeft + 10, div.offsetTop + parent.offsetTop + parent.offsetHeight + 10,
          '<strong>' + serverName + '</strong>' +
            '<br>' + formatNumber(playerCount) + ' Players<br>' +
            '<em>' + percentage + '%</em>')
      }, false)

      div.addEventListener('mouseout', app.tooltip.hide, false)
    }

    // Update position/width
    // leftPadding is a sum of previous iterations width value
    const totalPlayers = app.serverRegistry.getTotalPlayerCount()
    const playerCount = app.serverRegistry.getPlayerCount(serverId)
    const width = (playerCount / totalPlayers) * parent.offsetWidth

    div.style.width = width + 'px'
    div.style.left = leftPadding + 'px'

    leftPadding += width
  })
}

function updateServerPeak (serverId, time, playerCount) {
  const hourDuration = Math.floor(app.publicConfig.graphDuration / (60 * 60 * 1000))

  document.getElementById('peak_' + serverId).innerText = hourDuration + 'h Peak: ' + formatNumber(playerCount) + ' @ ' + getTimestamp(time)
}

function addServer (serverData) {
  // Even if the backend has never pinged the server, the frontend is promised a placeholder object.
  // result = undefined
  // error = defined with "Waiting" description
  // info = safely defined with configured data
  const ping = serverData[serverData.length - 1]

  const serverId = app.serverRegistry.getOrCreateId(ping.info.name)

  // Conditional formatting given configuration
  const serverTypeHTML = app.publicConfig.serverTypesVisible ? '<span class="server-type">' + ping.info.type + '</span>' : ''

  // Safely default to a missing placeholder if not present
  // If a favicon is later provided in an update, it will be handled by #updateServerStatus
  let favicon = MISSING_FAVICON
  if (ping.result && ping.result.favicon) {
    favicon = ping.result.favicon
  }

  // Build a placeholder element with empty data first
  const serverElement = document.createElement('div')

  serverElement.id = 'container_' + serverId
  serverElement.innerHTML = '<div id="server-' + serverId + '" class="column column-favicon">' +
      '<img class="server-favicon" src="' + favicon + '" id="favicon_' + serverId + '" title="' + ping.info.name + '\n' + formatMinecraftServerAddress(ping.info.ip, ping.info.port) + '">' +
      '<span class="server-rank" id="ranking_' + serverId + '"></span>' +
    '</div>' +
    '<div class="column column-status">' +
      '<h3 class="server-name">' + ping.info.name + serverTypeHTML + '</h3>' +
      '<span id="status_' + serverId + '"></span>' +
      '<span class="server-versions" id="version_' + serverId + '"></span>' +
      '<span class="server-peak" id="peak_' + serverId + '"></span>' +
      '<span class="server-record" id="record_' + serverId + '"></span>' +
    '</div>' +
    '<div class="column column-graph" id="chart_' + serverId + '"></div>'

  serverElement.setAttribute('class', 'server')

  document.getElementById('server-list').appendChild(serverElement)

  // Create an empty plot instance
  const plotInstance = $.plot('#chart_' + serverId, [], SERVER_GRAPH_OPTIONS)

  $('#chart_' + serverId).bind('plothover', app.handlePlotHover)

  // Populate and redraw the ServerGraph
  const serverGraph = new ServerGraph(plotInstance)

  serverGraph.addGraphPoints(serverData)
  serverGraph.redrawIfNeeded()

  // Register into serverRegistry for downstream referencing
  app.serverRegistry.registerServerGraph(serverId, serverGraph)

  // Handle the last known state (if any) as an incoming update
  // This triggers the main update pipeline and enables centralized update handling
  updateServerStatus(serverId, ping, true)
}

document.addEventListener('DOMContentLoaded', function () {
  // eslint-disable-next-line no-undef
  const socket = io.connect({
    reconnect: true,
    reconnectDelay: 1000,
    reconnectionAttempts: 10
  })

  // The backend will automatically push data once connected
  socket.on('connect', function () {
    app.caption.set('Loading...')

    // Only emit graph data request if not on mobile due to graph data size
    if (!isMobileBrowser()) {
      socket.emit('requestHistoryGraph')
    }
  })

  socket.on('disconnect', function () {
    app.caption.set('Disconnected! Please refresh.')

    app.reset()

    // Reset HTML structures that have been generated during runtime
    document.getElementById('server-list').innerHTML = ''
    document.getElementById('big-graph-checkboxes').innerHTML = ''
    document.getElementById('perc-bar').innerHTML = ''
    document.getElementById('big-graph-controls').style.display = 'none'

    const graphElement = document.getElementById('big-graph')
    graphElement.innerHTML = ''
    graphElement.removeAttribute('style')

    // Strip any mojang-status-* color classes from all mojang-status classes
    document.querySelectorAll('.mojang-status').forEach(function (element) {
      element.setAttribute('class', 'mojang-status')
    })

    document.querySelectorAll('.mojang-status-text').forEach(function (element) {
      element.innerText = '...'
    })

    document.getElementById('stat_totalPlayers').innerText = 0
    document.getElementById('stat_networks').innerText = 0
  })

  socket.on('historyGraph', function (data) {
    app.graphDisplayManager.setGraphData(data)

    // Explicitly define a height so flot.js can rescale the Y axis
    document.getElementById('big-graph').style.height = '400px'

    $('#big-graph').bind('plothover', app.handlePlotHover)

    app.graphDisplayManager.buildPlotInstance()

    // Build checkbox elements for graph controls
    let lastRowCounter = 0
    let controlsHTML = '<table><tr>'

    Object.keys(data).sort().forEach(function (serverName) {
      const serverId = app.serverRegistry.getOrCreateId(serverName)
      const isChecked = app.graphDisplayManager.isGraphDataVisible(serverId) ? 'checked' : ''

      controlsHTML += '<td>' +
        '<input type="checkbox" class="graph-control" minetrack-server-id="' + serverId + '" ' + isChecked + '>' +
        serverName +
        '</input></td>'

      // Occasionally break table rows using a magic number
      if (lastRowCounter++ >= 7) {
        lastRowCounter = 0

        controlsHTML += '</tr><tr>'
      }
    })

    controlsHTML += '</tr></table>'

    // Apply generated HTML and show controls
    document.getElementById('big-graph-checkboxes').innerHTML = controlsHTML
    document.getElementById('big-graph-controls').style.display = 'block'

    // Bind click event for updating graph data
    document.querySelectorAll('.graph-control').forEach(function (element) {
      element.addEventListener('click', function (event) {
        const serverId = parseInt(event.target.getAttribute('minetrack-server-id'))

        app.graphDisplayManager.setGraphDataVisible(serverId, event.target.checked)
        app.graphDisplayManager.redrawIfNeeded()
      }, false)
    })
  })

  socket.on('updateHistoryGraph', function (data) {
    const serverId = app.serverRegistry.getOrCreateId(data.name)

    app.graphDisplayManager.addGraphPoint(serverId, data.timestamp, data.players)
    app.graphDisplayManager.redrawIfNeeded()
  })

  socket.on('add', function (data) {
    data.forEach(addServer)

    // Run a single bulk update to externally managed elements
    sortServers()
    updatePercentageBar()
    updateGlobalStats()
  })

  socket.on('update', function (data) {
    const serverId = app.serverRegistry.getOrCreateId(data.info.name)

    // The backend may send "update" events prior to receiving all "add" events
    // A server has only been added once it's ServerGraph is defined
    // Checking undefined protects from this race condition
    if (app.serverRegistry.getServerGraph(serverId) !== undefined) {
      updateServerStatus(serverId, data, false)

      updatePercentageBar()
      updateGlobalStats()
    }
  })

  socket.on('updateMojangServices', function (data) {
    Object.keys(data).forEach(function (key) {
      const status = data[key]

      // HACK: ensure mojang-status is added for alignment, replace existing class to swap status color
      document.getElementById('mojang-status_' + status.name).setAttribute('class', 'mojang-status mojang-status-' + status.title.toLowerCase())
      document.getElementById('mojang-status-text_' + status.name).innerText = status.title
    })
  })

  socket.on('setPublicConfig', function (data) {
    app.publicConfig = data
  })

  socket.on('syncComplete', function () {
    // Fired once the backend has sent all requested data
    app.caption.hide()
  })

  socket.on('updatePeak', function (data) {
    const serverId = app.serverRegistry.getOrCreateId(data.name)

    updateServerPeak(serverId, data.timestamp, data.players)
  })

  socket.on('peaks', function (data) {
    const keys = Object.keys(data)

    keys.forEach(function (serverName) {
      const serverId = app.serverRegistry.getOrCreateId(serverName)
      const graphData = data[serverName]

      // [0] and [1] indexes correspond to flot.js' graphing data structure
      updateServerPeak(serverId, graphData[0], graphData[1])
    })
  })

  window.addEventListener('resize', function () {
    updatePercentageBar()

    // Delegate to GraphDisplayManager which can check if the resize is necessary
    app.graphDisplayManager.handleResizeRequest()
  }, false)

  // Run the sortServers loop even if the frontend has not connected to the backend
  // It will safely handle the empty data and simplifies state logic
  setInterval(sortServers, 10000)
}, false)
