const SORT_OPTIONS = [
  {
    getName: () => 'Players',
    sortFunc: (a, b) => b.playerCount - a.playerCount,
    highlightedValue: 'player-count'
  },
  {
    getName: (app) => {
      return `${app.publicConfig.graphDurationLabel} Peak`
    },
    sortFunc: (a, b) => {
      if (!a.lastPeakData && !b.lastPeakData) {
        return 0
      } else if (a.lastPeakData && !b.lastPeakData) {
        return -1
      } else if (b.lastPeakData && !a.lastPeakData) {
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
    },
    highlightedValue: 'peak'
  },
  {
    getName: () => 'Record',
    sortFunc: (a, b) => {
      if (!a.lastRecordData && !b.lastRecordData) {
        return 0
      } else if (a.lastRecordData && !b.lastRecordData) {
        return -1
      } else if (b.lastRecordData && !a.lastRecordData) {
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
    },
    highlightedValue: 'record'
  }
]

const SORT_OPTION_INDEX_DEFAULT = 0
const SORT_OPTION_INDEX_STORAGE_KEY = 'minetrack_sort_option_index'

export class SortController {
  constructor (app) {
    this._app = app
    this._buttonElement = document.getElementById('sort-by')
    this._textElement = document.getElementById('sort-by-text')
    this._sortOptionIndex = SORT_OPTION_INDEX_DEFAULT
  }

  reset () {
    this._lastSortedServers = undefined

    // Reset modified DOM structures
    this._buttonElement.style.display = 'none'
    this._textElement.innerText = '...'

    // Remove bound DOM event listeners
    this._buttonElement.removeEventListener('click', this.handleSortByButtonClick)
  }

  loadLocalStorage () {
    if (typeof localStorage !== 'undefined') {
      const sortOptionIndex = localStorage.getItem(SORT_OPTION_INDEX_STORAGE_KEY)
      if (sortOptionIndex) {
        this._sortOptionIndex = parseInt(sortOptionIndex)
      }
    }
  }

  updateLocalStorage () {
    if (typeof localStorage !== 'undefined') {
      if (this._sortOptionIndex !== SORT_OPTION_INDEX_DEFAULT) {
        localStorage.setItem(SORT_OPTION_INDEX_STORAGE_KEY, this._sortOptionIndex)
      } else {
        localStorage.removeItem(SORT_OPTION_INDEX_STORAGE_KEY)
      }
    }
  }

  show () {
    // Load the saved option selection, if any
    this.loadLocalStorage()

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

    // Save the updated option selection
    this.updateLocalStorage()
  }

  updateSortOption = () => {
    const sortOption = SORT_OPTIONS[this._sortOptionIndex]

    // Pass app instance so sortOption names can be dynamically generated
    this._textElement.innerText = sortOption.getName(this._app)

    // Update all servers highlighted values
    for (const serverRegistration of this._app.serverRegistry.getServerRegistrations()) {
      serverRegistration.updateHighlightedValue(sortOption.highlightedValue)
    }

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

      return sortOption.sortFunc(a, b)
    })

    // Test if sortedServers has changed from the previous listing
    // This avoids DOM updates and graphs being redrawn
    const sortedServerIds = sortedServers.map(server => server.serverId)

    if (this._lastSortedServers) {
      let allMatch = true

      // Test if the arrays have actually changed
      // No need to length check, they are the same source data each time
      for (let i = 0; i < sortedServerIds.length; i++) {
        if (sortedServerIds[i] !== this._lastSortedServers[i]) {
          allMatch = false
          break
        }
      }

      if (allMatch) {
        return
      }
    }

    this._lastSortedServers = sortedServerIds

    // Sort a ServerRegistration list by the sortOption ONLY
    // This is used to determine the ServerRegistration's rankIndex without #isFavorite skewing values
    const rankIndexSort = this._app.serverRegistry.getServerRegistrations().sort(sortOption.sortFunc)

    // Update the DOM structure
    sortedServers.forEach(function (serverRegistration) {
      const parentElement = document.getElementById('server-list')
      const serverElement = document.getElementById(`container_${serverRegistration.serverId}`)

      parentElement.appendChild(serverElement)

      // Set the ServerRegistration's rankIndex to its indexOf the normal sort
      serverRegistration.updateServerRankIndex(rankIndexSort.indexOf(serverRegistration))
    })
  }
}
