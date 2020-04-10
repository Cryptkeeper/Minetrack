import { App } from './app'

const app = new App()

document.addEventListener('DOMContentLoaded', function () {
  // eslint-disable-next-line no-undef
  const socket = io.connect('http://localhost:8080', {
    reconnect: true,
    reconnectDelay: 1000,
    reconnectionAttempts: 10
  })

  // The backend will automatically push data once connected
  socket.on('connect', function () {
    app.caption.set('Loading...')

    // Allow the graphDisplayManager to control whether or not the historical graph is loaded
    if (app.graphDisplayManager.isVisible()) {
      socket.emit('requestHistoryGraph')
    }
  })

  socket.on('disconnect', function () {
    app.handleDisconnect()
  })

  socket.on('historyGraph', function (data) {
    app.graphDisplayManager.buildPlotInstance(data)

    // Build checkbox elements for graph controls
    let lastRowCounter = 0
    let controlsHTML = ''

    Object.keys(data).sort().forEach(function (serverName) {
      const serverRegistration = app.serverRegistry.getServerRegistration(serverName)

      controlsHTML += '<td>' +
        '<input type="checkbox" class="graph-control" minetrack-server-id="' + serverRegistration.serverId + '" ' + (serverRegistration.isVisible ? 'checked' : '') + '>' +
        ' ' + serverName +
        '</input></td>'

      // Occasionally break table rows using a magic number
      if (++lastRowCounter % 6 === 0) {
        controlsHTML += '</tr><tr>'
      }
    })

    // Apply generated HTML and show controls
    document.getElementById('big-graph-checkboxes').innerHTML = '<table><tr>' +
      controlsHTML +
      '</tr></table>'

    document.getElementById('big-graph-controls').style.display = 'block'

    // Bind click event for updating graph data
    document.querySelectorAll('.graph-control').forEach(function (element) {
      element.addEventListener('click', app.graphDisplayManager.handleServerButtonClick, false)
    })
  })

  socket.on('updateHistoryGraph', function (data) {
    // Skip any incoming updates if the graph is disabled
    // The backend shouldn't send these anyways
    if (!app.graphDisplayManager.isVisible()) {
      return
    }

    const serverRegistration = app.serverRegistry.getServerRegistration(data.name)

    if (serverRegistration) {
      app.graphDisplayManager.addGraphPoint(serverRegistration.serverId, data.timestamp, data.players)

      // Only redraw the graph if not mutating hidden data
      if (serverRegistration.isVisible) {
        app.graphDisplayManager.requestRedraw()
      }
    }
  })

  socket.on('add', function (data) {
    data.forEach(app.addServer)
  })

  socket.on('update', function (data) {
    // The backend may send "update" events prior to receiving all "add" events
    // A server has only been added once it's ServerRegistration is defined
    // Checking undefined protects from this race condition
    const serverRegistration = app.serverRegistry.getServerRegistration(data.info.name)

    if (serverRegistration) {
      serverRegistration.updateServerStatus(data, false, app.publicConfig.minecraftVersions)
    }
  })

  socket.on('updateMojangServices', function (data) {
    Object.values(data).forEach(app.mojangUpdater.updateServiceStatus)
  })

  socket.on('setPublicConfig', function (data) {
    app.setPublicConfig(data)
  })

  // Fired once the backend has sent all requested data
  socket.on('syncComplete', function () {
    // Display the main page component
    app.setPageReady(true)

    app.caption.hide()

    // Run a single bulk server sort instead of per-add event since there may be multiple
    app.sortServers()
  })

  socket.on('updatePeak', function (data) {
    const serverRegistration = app.serverRegistry.getServerRegistration(data.name)

    if (serverRegistration) {
      serverRegistration.updateServerPeak(data.timestamp, data.players, app.publicConfig.graphDuration)
    }
  })

  socket.on('peaks', function (data) {
    Object.keys(data).forEach(function (serverName) {
      const serverRegistration = app.serverRegistry.getServerRegistration(serverName)

      if (serverRegistration) {
        const graphData = data[serverName]

        // [0] and [1] indexes correspond to flot.js' graphing data structure
        serverRegistration.updateServerPeak(graphData[0], graphData[1], app.publicConfig.graphDuration)
      }
    })
  })

  window.addEventListener('resize', function () {
    app.percentageBar.redraw()

    // Delegate to GraphDisplayManager which can check if the resize is necessary
    app.graphDisplayManager.requestResize()
  }, false)

  document.getElementById('settings-toggle').addEventListener('click', app.graphDisplayManager.handleSettingsToggle, false)

  document.querySelectorAll('.graph-controls-show').forEach((element) => {
    element.addEventListener('click', app.graphDisplayManager.handleShowButtonClick, false)
  })
}, false)
