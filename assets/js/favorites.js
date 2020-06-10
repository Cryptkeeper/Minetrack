export const FAVORITE_SERVERS_STORAGE_KEY = 'minetrack_favorite_servers'

export class FavoritesManager {
  constructor (app) {
    this._app = app
  }

  loadLocalStorage () {
    if (typeof localStorage !== 'undefined') {
      let serverNames = localStorage.getItem(FAVORITE_SERVERS_STORAGE_KEY)
      if (serverNames) {
        serverNames = JSON.parse(serverNames)

        for (let i = 0; i < serverNames.length; i++) {
          const serverRegistration = this._app.serverRegistry.getServerRegistration(serverNames[i])

          // The serverName may not exist in the backend configuration anymore
          // Ensure serverRegistration is defined before mutating data or considering valid
          if (serverRegistration) {
            serverRegistration.isFavorite = true

            // Update icon since by default it is unfavorited
            document.getElementById(`favorite-toggle_${serverRegistration.serverId}`).setAttribute('class', this.getIconClass(serverRegistration.isFavorite))
          }
        }
      }
    }
  }

  updateLocalStorage () {
    if (typeof localStorage !== 'undefined') {
      // Mutate the serverIds array into server names for storage use
      const serverNames = this._app.serverRegistry.getServerRegistrations()
        .filter(serverRegistration => serverRegistration.isFavorite)
        .map(serverRegistration => serverRegistration.data.name)

      if (serverNames.length > 0) {
        // Only save if the array contains data, otherwise clear the item
        localStorage.setItem(FAVORITE_SERVERS_STORAGE_KEY, JSON.stringify(serverNames))
      } else {
        localStorage.removeItem(FAVORITE_SERVERS_STORAGE_KEY)
      }
    }
  }

  handleFavoriteButtonClick = (serverRegistration) => {
    serverRegistration.isFavorite = !serverRegistration.isFavorite

    // Update the displayed favorite icon
    document.getElementById(`favorite-toggle_${serverRegistration.serverId}`).setAttribute('class', this.getIconClass(serverRegistration.isFavorite))

    // Request the app controller instantly re-sort the server listing
    // This handles the favorite sorting logic internally
    this._app.sortController.sortServers()

    this._app.graphDisplayManager.handleServerIsFavoriteUpdate(serverRegistration)

    // Write an updated settings payload
    this.updateLocalStorage()
  }

  getIconClass (isFavorite) {
    if (isFavorite) {
      return 'icon-star server-is-favorite'
    } else {
      return 'icon-star-o server-is-not-favorite'
    }
  }
}
