import { App } from './app'

const app = new App()

function dismissAlert () {
  document.getElementById('alert').style.display = 'none'
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('minetrack_alert_dismissed', true)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  app.init()

  window.addEventListener('resize', function () {
    app.percentageBar.redraw()

    // Delegate to GraphDisplayManager which can check if the resize is necessary
    app.graphDisplayManager.requestResize()
  }, false)

  document.getElementById('alert-dismiss').addEventListener('click', () => {
    dismissAlert()
  })

  if (typeof localStorage !== 'undefined') {
    const isDismissed = localStorage.getItem('minetrack_alert_dismissed') !== null
    if (!isDismissed) {
      document.getElementById('alert').style.display = 'block'

      setTimeout(() => {
        dismissAlert()
      }, 30 * 1000)
    }
  }
}, false)
