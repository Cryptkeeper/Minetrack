import { App } from './app'

import io from 'socket.io-client'

const app = new App()

document.addEventListener('DOMContentLoaded', function () {
  const socket = io.connect('http://localhost:8080', {
    reconnect: true,
    reconnectDelay: 1000,
    reconnectionAttempts: 10
  })

  // The backend will automatically push data once connected
  socket.on('connect', function () {
    app.caption.set('Loading...')
  })

  socket.on('disconnect', function () {
    app.handleDisconnect()

    // Reset modified DOM structures
    document.getElementById('big-graph-mobile-load-request').style.display = 'none'
  })

  socket.on('historyGraph', function (data) {
    // Consider the graph visible since a payload has been received
    // This is used for the manual graph load request behavior
    app.graphDisplayManager.isVisible = true

    app.graphDisplayManager.buildPlotInstance(data)

    // Build checkbox elements for graph controls
    let lastRowCounter = 0
    let controlsHTML = ''

    app.serverRegistry.getServerRegistrations()
      .map(serverRegistration => serverRegistration.data.name)
      .sort()
      .forEach(serverName => {
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
    app.graphDisplayManager.initEventListeners()
  })

  socket.on('add', function (data) {
    data.forEach(app.addServer)
  })

  socket.on('update', function (data) {
    // The backend may send "update" events prior to receiving all "add" events
    // A server has only been added once it's ServerRegistration is defined
    // Checking undefined protects from this race condition
    const serverRegistration = app.serverRegistry.getServerRegistration(data.serverId)

    if (serverRegistration) {
      serverRegistration.updateServerStatus(data, false, app.publicConfig.minecraftVersions)
    }

    // Use update payloads to conditionally append data to graph
    // Skip any incoming updates if the graph is disabled
    if (data.updateHistoryGraph && app.graphDisplayManager.isVisible) {
      // Update may not be successful, safely append 0 points
      const playerCount = data.result ? data.result.players.online : 0

      app.graphDisplayManager.addGraphPoint(serverRegistration.serverId, data.timestamp, playerCount)

      // Only redraw the graph if not mutating hidden data
      if (serverRegistration.isVisible) {
        app.graphDisplayManager.requestRedraw()
      }
    }
  })

  socket.on('updateMojangServices', function (data) {
    app.mojangUpdater.updateStatus(data)
  })

  socket.on('setPublicConfig', function (data) {
    app.setPublicConfig(data)

    // Display the main page component
    // Called here instead of syncComplete so the DOM can be drawn prior to the graphs being drawn
    // Otherwise flot.js will cause visual alignment bugs
    app.setPageReady(true)

    // Allow the graphDisplayManager to control whether or not the historical graph is loaded
    // Defer to isGraphVisible from the publicConfig to understand if the frontend will ever receive a graph payload
    if (data.isGraphVisible) {
      if (app.graphDisplayManager.isVisible) {
        socket.emit('requestHistoryGraph')
      } else {
        document.getElementById('big-graph-mobile-load-request').style.display = 'block'
      }
    }
  })

  // Fired once the backend has sent all requested data
  socket.on('syncComplete', function () {
    app.handleSyncComplete()
  })

  window.addEventListener('resize', function () {
    app.percentageBar.redraw()

    // Delegate to GraphDisplayManager which can check if the resize is necessary
    app.graphDisplayManager.requestResize()
  }, false)

  document.getElementById('big-graph-mobile-load-request-button').addEventListener('click', function () {
    // Send a graph data request to the backend
    socket.emit('requestHistoryGraph')

    // Hide the activation link to avoid multiple requests
    document.getElementById('big-graph-mobile-load-request').style.display = 'none'
  }, false)
}, false)
