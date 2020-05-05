import { App } from './app'

const app = new App()

document.addEventListener('DOMContentLoaded', () => {
  app.init()

  window.addEventListener('resize', function () {
    app.percentageBar.redraw()

    // Delegate to GraphDisplayManager which can check if the resize is necessary
    app.graphDisplayManager.requestResize()
  }, false)

  document.getElementById('big-graph-mobile-load-request-button').addEventListener('click', function () {
    // Send a graph data request to the backend
    app.socketManager.sendHistoryGraphRequest()

    // Hide the activation link to avoid multiple requests
    document.getElementById('big-graph-mobile-load-request').style.display = 'none'
  }, false)
}, false)
