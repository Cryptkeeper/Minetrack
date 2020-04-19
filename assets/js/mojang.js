const MOJANG_STATUS_BASE_CLASS = 'header-button header-button-group'

export class MojangUpdater {
  updateServiceStatus (status) {
    // HACK: ensure mojang-status is added for alignment, replace existing class to swap status color
    document.getElementById('mojang-status_' + status.name).setAttribute('class', MOJANG_STATUS_BASE_CLASS + ' mojang-status-' + status.title.toLowerCase())
    document.getElementById('mojang-status-text_' + status.name).innerText = status.title
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
