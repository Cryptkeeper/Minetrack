import { Tooltip, ServerRegistry, Caption } from './core.js'
import { GraphDisplayManager } from './graph.js'

import { formatNumber, formatTimestamp } from './util.js'

export class App {
  publicConfig

  constructor () {
    this.tooltip = new Tooltip()
    this.caption = new Caption()
    this.serverRegistry = new ServerRegistry()
    this.graphDisplayManager = new GraphDisplayManager(this)
  }

  getServerColor (serverName) {
    for (let i = 0; i < this.publicConfig.servers.length; i++) {
      const server = this.publicConfig.servers[i]
      if (server.name === serverName) {
        return server.color
      }
    }
  }

  reset () {
    // Reset individual tracker elements to flush any held data
    this.serverRegistry.reset()
    this.graphDisplayManager.reset()

    // Undefine publicConfig, resynced during the connection handshake
    this.publicConfig = undefined
  }

  updateServerPeak (serverId, time, playerCount) {
    const hourDuration = Math.floor(this.publicConfig.graphDuration / (60 * 60 * 1000))

    document.getElementById('peak_' + serverId).innerText = hourDuration + 'h Peak: ' + formatNumber(playerCount) + ' @ ' + formatTimestamp(time)
  }

  // Called by flot.js when they hover over a data point.
  handlePlotHover = (event, pos, item) => {
    if (!item) {
      this.tooltip.hide()
    } else {
      let text = formatNumber(item.datapoint[1]) + ' Players<br>' + formatTimestamp(item.datapoint[0])
      // Prefix text with the series label when possible
      if (item.series && item.series.label) {
        text = '<strong>' + item.series.label + '</strong><br>' + text
      }

      this.tooltip.set(item.pageX + 5, item.pageY + 5, text)
    }
  }
}
