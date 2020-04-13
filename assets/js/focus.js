import { formatNumber, formatTimestamp, formatDate, formatPercent, isObjectEqual } from './util'

export class FocusManager {
  constructor (app) {
    this._app = app
    this._currentFocus = undefined
  }

  reset () {
    this.clearFocus()
  }

  setFocus = (serverRegistration) => {
    if (isObjectEqual(this._currentFocus, serverRegistration, ['serverId'])) {
      this.clearFocus()
    } else {
      // Ensure the old focusElement is removed
      this.clearFocus()

      this._currentFocus = serverRegistration

      // Create a focus-box element and generate its innerHTML
      const focusElement = document.createElement('div')

      focusElement.id = 'focus-box'
      focusElement.innerHTML = this.buildFocusHTML()

      // Append the focus-box as a child of the serverRegistration's container
      // This automatically aligns it as needed
      document.getElementById('container_' + serverRegistration.serverId).appendChild(focusElement)
    }
  }

  clearFocus = () => {
    if (this._currentFocus) {
      this._currentFocus = undefined

      // Remove any appended focus-box element
      // It is manually initialized by #setFocus
      const focusElement = document.getElementById('focus-box')

      if (focusElement) {
        focusElement.remove()
      }
    }
  }

  updateFocusIfSet = () => {
    if (this._currentFocus) {
      document.getElementById('focus-box').innerHTML = this.buildFocusHTML()
    }
  }

  buildRecordRow () {
    if (!this._currentFocus.lastRecordData) {
      return
    }

    let innerText = formatNumber(this._currentFocus.lastRecordData.playerCount)

    if (this._currentFocus.lastRecordData.timestamp !== -1) {
      innerText += ' (' + formatTimestamp(this._currentFocus.lastRecordData.timestamp) + ' ' + formatDate(this._currentFocus.lastRecordData.timestamp) + ')'
    }

    const rank = this._app.serverRegistry.getServerRankBy(this._currentFocus, (serverRegistration) => {
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

  buildPeakRow () {
    if (!this._currentFocus.lastPeakData) {
      return
    }

    const peakData = this._currentFocus.lastPeakData

    const rank = this._app.serverRegistry.getServerRankBy(this._currentFocus, (serverRegistration) => {
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

  buildTotalPlayerCapacityRow () {
    const rank = this._app.serverRegistry.getServerRankBy(this._currentFocus, (serverRegistration) => {
      return serverRegistration.maxPlayerCount
    }, (a, b) => b - a)

    return {
      name: 'Total player capacity',
      value: formatNumber(this._currentFocus.maxPlayerCount),
      rank: rank
    }
  }

  buildMarketShareRow () {
    const totalPlayerCount = this._app.getTotalPlayerCount()

    const rank = this._app.serverRegistry.getServerRankBy(this._currentFocus, (serverRegistration) => {
      return serverRegistration.playerCount / totalPlayerCount
    }, (a, b) => b - a)

    return {
      name: 'Market share',
      value: formatPercent(this._currentFocus.playerCount, totalPlayerCount) + ' of ' + formatNumber(totalPlayerCount) + ' counted players',
      rank: rank
    }
  }

  buildMinecraftEditionRow () {
    let minecraftEdition = '(Unknown)'

    if (this._currentFocus.data.type === 'PC') {
      minecraftEdition = 'Java'
    } else if (this._currentFocus.data.type === 'PE') {
      minecraftEdition = 'Bedrock'
    }

    return {
      name: 'Minecraft Edition',
      value: minecraftEdition
    }
  }

  buildFocusHTML () {
    const rows = [
      this.buildRecordRow(),
      this.buildPeakRow(),
      this.buildMarketShareRow(),
      this.buildTotalPlayerCapacityRow(),
      this.buildMinecraftEditionRow()
    ]

    const innerHTML = rows
      .filter(row => row !== undefined)
      .map(row => {
        let rankHTML = ''
        if (row.rank !== undefined) {
          rankHTML = '#' + row.rank
        }

        return '<tr>' +
          '<td>' + row.name + '</td>' +
          '<td>' + row.value + '</td>' +
          '<td>' + rankHTML + '</td>' +
          '</tr>'
      })
      .join('')

    return '<table>' +
      innerHTML +
      '</table>'
  }
}
