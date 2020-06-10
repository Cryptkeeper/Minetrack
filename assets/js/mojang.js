const MOJANG_STATUS_BASE_CLASS = 'header-button header-button-group'

const MOJANG_SERVICE_NAMES = ['Auth', 'Sessions', 'API', 'Skins']

export class MojangUpdater {
  updateStatus (services) {
    for (const name of MOJANG_SERVICE_NAMES) {
      if (services[name]) {
        this.updateServiceStatus(name, services[name])
      }
    }
  }

  updateServiceStatus (name, title) {
    // HACK: ensure mojang-status is added for alignment, replace existing class to swap status color
    document.getElementById(`mojang-status_${name}`).setAttribute('class', `${MOJANG_STATUS_BASE_CLASS} mojang-status-${title.toLowerCase()}`)
    document.getElementById(`mojang-status-text_${name}`).innerText = title
  }

  reset () {
    // Strip any mojang-status-* color classes from all mojang-status classes
    document.querySelectorAll('.mojang-status').forEach(function (element) {
      element.setAttribute('class', MOJANG_STATUS_BASE_CLASS)
    })

    document.querySelectorAll('.mojang-status-text').forEach(function (element) {
      element.innerText = '...'
    })
  }
}
