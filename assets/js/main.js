import { App } from './app'

const app = new App()

document.addEventListener('DOMContentLoaded', function () {
  const webSocket = new WebSocket('ws://' + location.host)

  // The backend will automatically push data once connected
  webSocket.onopen = () => {
    app.caption.set('Loading...')
  }

  webSocket.onclose = (event) => {
    app.handleDisconnect()

    // Modify page state to display loading overlay
    // Code 1006 denotes "Abnormal closure", most likely from the server or client losing connection
    // See https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
    // Treat other codes as active errors (besides connectivity errors) when displaying the message
    if (event.code === 1006) {
      app.caption.set('Lost connection!')
    } else {
      app.caption.set('Disconnected due to error.')
    }

    // Reset modified DOM structures
    document.getElementById('big-graph-mobile-load-request').style.display = 'none'

    // TODO: Reconnect behavior
  }

  webSocket.onmessage = (message) => {
    const payload = JSON.parse(message.data)

    switch (payload.message) {
      case 'init':
        app.setPublicConfig(payload.config)

        // Display the main page component
        // Called here instead of syncComplete so the DOM can be drawn prior to the graphs being drawn
        // Otherwise flot.js will cause visual alignment bugs
        app.setPageReady(true)

        // Allow the graphDisplayManager to control whether or not the historical graph is loaded
        // Defer to isGraphVisible from the publicConfig to understand if the frontend will ever receive a graph payload
        if (app.publicConfig.isGraphVisible) {
          if (app.graphDisplayManager.isVisible) {
            // Send request as a plain text string to avoid the server needing to parse JSON
            // This is mostly to simplify the backend server's need for error handling
            webSocket.send('requestHistoryGraph')
          } else {
            document.getElementById('big-graph-mobile-load-request').style.display = 'block'
          }
        }

        payload.servers.forEach(app.addServer)

        if (payload.mojangServices) {
          app.mojangUpdater.updateStatus(payload.mojangServices)
        }

        // Init payload contains all data needed to render the page
        // Alert the app it is ready
        app.handleSyncComplete()

        break

      case 'updateServer': {
        // The backend may send "update" events prior to receiving all "add" events
        // A server has only been added once it's ServerRegistration is defined
        // Checking undefined protects from this race condition
        const serverRegistration = app.serverRegistry.getServerRegistration(payload.serverId)

        if (serverRegistration) {
          serverRegistration.updateServerStatus(payload, false, app.publicConfig.minecraftVersions)
        }

        // Use update payloads to conditionally append data to graph
        // Skip any incoming updates if the graph is disabled
        if (payload.updateHistoryGraph && app.graphDisplayManager.isVisible) {
          // Update may not be successful, safely append 0 points
          const playerCount = payload.result ? payload.result.players.online : 0

          app.graphDisplayManager.addGraphPoint(serverRegistration.serverId, payload.timestamp, playerCount)

          // Only redraw the graph if not mutating hidden data
          if (serverRegistration.isVisible) {
            app.graphDisplayManager.requestRedraw()
          }
        }
        break
      }

      case 'updateMojangServices': {
        app.mojangUpdater.updateStatus(payload)
        break
      }

      case 'historyGraph': {
        // Consider the graph visible since a payload has been received
        // This is used for the manual graph load request behavior
        app.graphDisplayManager.isVisible = true

        app.graphDisplayManager.buildPlotInstance(payload.graphData)

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
        break
      }
    }
  }

  window.addEventListener('resize', function () {
    app.percentageBar.redraw()

    // Delegate to GraphDisplayManager which can check if the resize is necessary
    app.graphDisplayManager.requestResize()
  }, false)

  document.getElementById('big-graph-mobile-load-request-button').addEventListener('click', function () {
    // Send a graph data request to the backend
    // Send request as a plain text string to avoid the server needing to parse JSON
    // This is mostly to simplify the backend server's need for error handling
    webSocket.send('requestHistoryGraph')

    // Hide the activation link to avoid multiple requests
    document.getElementById('big-graph-mobile-load-request').style.display = 'none'
  }, false)
}, false)
