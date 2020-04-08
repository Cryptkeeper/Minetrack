import { App } from './app'

import { isMobileBrowser } from './util'

const app = new App()

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
  })

  socket.on('historyGraph', function (data) {
    app.graphDisplayManager.setGraphData(data)

    // Explicitly define a height so flot.js can rescale the Y axis
    document.getElementById('big-graph').style.height = '400px'

    $('#big-graph').bind('plothover', app.graphDisplayManager.handlePlotHover)

    app.graphDisplayManager.buildPlotInstance()

    // Build checkbox elements for graph controls
    let lastRowCounter = 0
    let controlsHTML = '<table><tr>'

    Object.keys(data).sort().forEach(function (serverName) {
      const serverRegistration = app.serverRegistry.getServerRegistration(serverName)
      const isChecked = serverRegistration.isVisible ? 'checked' : ''

      controlsHTML += '<td>' +
        '<input type="checkbox" class="graph-control" minetrack-server-id="' + serverRegistration.serverId + '" ' + isChecked + '>' +
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
        const serverRegistration = app.serverRegistry.getServerRegistration(serverId)

        if (serverRegistration.isVisible !== event.target.checked) {
          serverRegistration.isVisible = event.target.checked

          app.graphDisplayManager.redraw()
        }
      }, false)
    })
  })

  socket.on('updateHistoryGraph', function (data) {
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

  socket.on('syncComplete', function () {
    // Fired once the backend has sent all requested data
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

  document.getElementById('graph-controls-toggle').addEventListener('click', () => {
    const element = document.getElementById('big-graph-controls-drawer')
    if (element.style.display !== 'block') {
      element.style.display = 'block'
    } else {
      element.style.display = 'none'
    }
  }, false)

  document.querySelectorAll('.graph-controls-show').forEach((element) => {
    element.addEventListener('click', (event) => {
      const visible = event.target.getAttribute('minetrack-showall') === 'true'

      let redraw = false

      app.serverRegistry.getServerRegistrations().forEach(function (serverRegistration) {
        if (serverRegistration.isVisible !== visible) {
          serverRegistration.isVisible = visible

          redraw = true
        }
      })

      if (redraw) {
        app.graphDisplayManager.redraw()

        document.querySelectorAll('.graph-control').forEach(function (checkbox) {
          checkbox.checked = visible
        })
      }
    }, false)
  })
}, false)
