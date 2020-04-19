import { formatNumber, formatTimestamp, formatDate, formatPercent, formatMinecraftVersions } from './util'

export class FocusManager {
  constructor (app) {
    this._app = app
    this._createdElements = []
  }

  reset () {
    // Reset of modified DOM structures is handled by ServerRegistry#reset
    // This is because focus-box elements are appended inside #server-list
    this._createdElements = []
  }

  handleClick = (target, serverRegistration) => {
    const indexOf = this._createdElements.indexOf(serverRegistration.serverId)
    const focusElementId = 'focus-box_' + serverRegistration.serverId

    if (indexOf < 0) {
      // Change action icon
      target.setAttribute('class', 'icon-chevron-circle-up')

      // Create a focus-box element and generate its innerHTML
      const focusElement = document.createElement('div')

      focusElement.id = focusElementId
      focusElement.innerHTML = this.buildFocusHTML(serverRegistration)

      focusElement.setAttribute('class', 'focus-box')

      // Append the focus-box as a child of the serverRegistration's container
      // This automatically aligns it as needed
      document.getElementById('container_' + serverRegistration.serverId).appendChild(focusElement)

      // Track the created element for #reset logic
      this._createdElements.push(serverRegistration.serverId)
    } else {
      // Change action icon
      target.setAttribute('class', 'icon-chevron-circle-down')

      // Remove any appended focus-box element
      const focusElement = document.getElementById(focusElementId)

      if (focusElement) {
        focusElement.remove()

        // Remove from created elements since it is no longer in the DOM
        this._createdElements.splice(indexOf, 1)
      }
    }
  }

  redraw = () => {
    for (const serverId of this._createdElements) {
      const focusElement = document.getElementById('focus-box_' + serverId)

      const serverRegistration = this._app.serverRegistry.getServerRegistration(serverId)

      // If the DOM contains a div for this serverId, it is visible and open
      // Rebuild the inner HTML - this could be optimized
      if (focusElement) {
        focusElement.innerHTML = this.buildFocusHTML(serverRegistration)
      }
    }
  }

  buildRecordRow (serverRegistration) {
    if (!serverRegistration.lastRecordData) {
      return
    }

    let innerText = formatNumber(serverRegistration.lastRecordData.playerCount)

    if (serverRegistration.lastRecordData.timestamp !== -1) {
      innerText += ' (' + formatTimestamp(serverRegistration.lastRecordData.timestamp) + ' ' + formatDate(serverRegistration.lastRecordData.timestamp) + ')'
    }

    const rank = this._app.serverRegistry.getServerRankBy(serverRegistration, (serverRegistration) => {
      if (serverRegistration.lastRecordData) {
        return serverRegistration.lastRecordData.playerCount
      }
    }, (a, b) => b - a)

    return {
      name: 'Player count record',
      value: innerText,
      rank: rank
    }
  }

  buildPeakRow (serverRegistration) {
    if (!serverRegistration.lastPeakData) {
      return
    }

    const peakData = serverRegistration.lastPeakData

    const rank = this._app.serverRegistry.getServerRankBy(serverRegistration, (serverRegistration) => {
      if (serverRegistration.lastPeakData) {
        return serverRegistration.lastPeakData.playerCount
      }
    }, (a, b) => b - a)

    return {
      name: peakData.hourDuration + ' hour player count peak',
      value: formatNumber(peakData.playerCount) + ' (' + formatTimestamp(peakData.timestamp) + ')',
      rank: rank
    }
  }

  buildTotalPlayerCapacityRow (serverRegistration) {
    const rank = this._app.serverRegistry.getServerRankBy(serverRegistration, (serverRegistration) => {
      return serverRegistration.maxPlayerCount
    }, (a, b) => b - a)

    return {
      name: 'Total player capacity',
      value: formatNumber(serverRegistration.maxPlayerCount),
      rank: rank
    }
  }

  buildMarketShareRow (serverRegistration) {
    const totalPlayerCount = this._app.getTotalPlayerCount()

    const rank = this._app.serverRegistry.getServerRankBy(serverRegistration, (serverRegistration) => {
      return serverRegistration.playerCount / totalPlayerCount
    }, (a, b) => b - a)

    return {
      name: 'Market share',
      value: formatPercent(serverRegistration.playerCount, totalPlayerCount) + ' of ' + formatNumber(totalPlayerCount) + ' counted players',
      rank: rank
    }
  }

  buildMinecraftEditionRow (serverRegistration) {
    let minecraftEdition = '(Unknown)'

    if (serverRegistration.data.type === 'PC') {
      minecraftEdition = 'Java'

      if (serverRegistration.lastVersions.length > 0) {
        const versions = formatMinecraftVersions(serverRegistration.lastVersions, this._app.publicConfig.minecraftVersions[serverRegistration.data.type])

        if (versions) {
          minecraftEdition += ' (Compatible with ' + versions + ')'
        }
      }
    } else if (serverRegistration.data.type === 'PE') {
      minecraftEdition = 'Bedrock'
    }

    return {
      name: 'Minecraft Edition',
      value: minecraftEdition
    }
  }

  buildFocusHTML (serverRegistration) {
    const rows = [
      this.buildRecordRow(serverRegistration),
      this.buildPeakRow(serverRegistration),
      this.buildMarketShareRow(serverRegistration),
      this.buildTotalPlayerCapacityRow(serverRegistration),
      this.buildMinecraftEditionRow(serverRegistration)
    ]

    const innerHTML = rows
      .filter(row => row !== undefined)
      .map(row => {
        return '<tr>' +
          '<td>' + row.name + '</td>' +
          '<td>' + row.value + '</td>' +
          '</tr>'
      })
      .join('')

    return '<table>' +
      innerHTML +
      '</table>'
  }
}
