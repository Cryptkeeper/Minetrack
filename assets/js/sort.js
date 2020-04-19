import { isArrayEqual } from './util'

const SORT_OPTIONS = [
  {
    getName: () => 'Players',
    func: (a, b) => b.playerCount - a.playerCount
  },
  {
    getName: (app) => {
      return Math.floor(app.publicConfig.graphDuration / (60 * 60 * 1000)) + 'h Peak'
    },
    func: (a, b) => {
      if (!a.lastPeakData && !b.lastPeakData) {
        return 0
      } else if (a.lastPeakData) {
        return -1
      } else if (b.lastPeakData) {
        return 1
      }
      return b.lastPeakData.playerCount - a.lastPeakData.playerCount
    },
    testFunc: (app) => {
      // Require at least one ServerRegistration to have a lastPeakData value defined
      for (const serverRegistration of app.serverRegistry.getServerRegistrations()) {
        if (serverRegistration.lastPeakData) {
          return true
        }
      }
      return false
    }
  },
  {
    getName: () => 'Record',
    func: (a, b) => {
      if (!a.lastRecordData && !b.lastRecordData) {
        return 0
      } else if (a.lastRecordData) {
        return -1
      } else if (b.lastRecordData) {
        return 1
      }
      return b.lastRecordData.playerCount - a.lastRecordData.playerCount
    },
    testFunc: (app) => {
      // Require at least one ServerRegistration to have a lastRecordData value defined
      for (const serverRegistration of app.serverRegistry.getServerRegistrations()) {
        if (serverRegistration.lastRecordData) {
          return true
        }
      }
      return false
    }
  }
]

export class SortController {
  constructor (app) {
    this._app = app
    this._buttonElement = document.getElementById('sort-by')
    this._textElement = document.getElementById('sort-by-text')
    this._sortOptionIndex = 0
  }

  reset () {
    this._lastSortedServers = undefined

    // Reset modified DOM structures
    this._buttonElement.style.display = 'none'
    this._textElement.innerText = '...'

    // Remove bound DOM event listeners
    this._buttonElement.removeEventListener('click', this.handleSortByButtonClick)
  }

  show () {
    this.updateSortOption()

    // Bind DOM event listeners
    // This is removed by #reset to avoid multiple listeners
    this._buttonElement.addEventListener('click', this.handleSortByButtonClick)

    // Show #sort-by element
    this._buttonElement.style.display = 'inline-block'
  }

  handleSortByButtonClick = () => {
    while (true) {
      // Increment to the next sort option, wrap around if needed
      this._sortOptionIndex = (this._sortOptionIndex + 1) % SORT_OPTIONS.length

      // Only break if the sortOption is supported
      // This can technically cause an infinite loop, but never should assuming
      // at least one sortOption does not implement the test OR always returns true
      const sortOption = SORT_OPTIONS[this._sortOptionIndex]

      if (!sortOption.testFunc || sortOption.testFunc(this._app)) {
        break
      }
    }

    // Redraw the button and sort the servers
    this.updateSortOption()
  }

  updateSortOption = () => {
    const sortOption = SORT_OPTIONS[this._sortOptionIndex]

    // Pass app instance so sortOption names can be dynamically generated
    this._textElement.innerText = sortOption.getName(this._app)

    this.sortServers()
  }

  sortServers = () => {
    const sortOption = SORT_OPTIONS[this._sortOptionIndex]

    const sortedServers = this._app.serverRegistry.getServerRegistrations().sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) {
        return -1
      } else if (b.isFavorite && !a.isFavorite) {
        return 1
      }

      return sortOption.func(a, b)
    })

    // Test if sortedServers has changed from the previous listing
    // This avoids DOM updates and graphs being redrawn
    if (isArrayEqual(sortedServers, this._lastSortedServers)) {
      return
    }

    this._lastSortedServers = sortedServers

    // Sort a ServerRegistration list by the sortOption ONLY
    // This is used to determine the ServerRegistration's rankIndex without #isFavorite skewing values
    const rankIndexSort = this._app.serverRegistry.getServerRegistrations().sort(sortOption.func)

    // Update the DOM structure
    sortedServers.forEach(function (serverRegistration) {
      $('#container_' + serverRegistration.serverId).appendTo('#server-list')

      // Set the ServerRegistration's rankIndex to its indexOf the normal sort
      serverRegistration.updateServerRankIndex(rankIndexSort.indexOf(serverRegistration))
    })
  }
}
