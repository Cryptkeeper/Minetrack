import { ServerRegistry } from './servers'
import { FocusManager } from './focus'
import { GraphDisplayManager } from './graph'
import { MojangUpdater } from './mojang'
import { PercentageBar } from './percbar'
import { Tooltip, Caption, formatNumber } from './util'

export class App {
  publicConfig

  constructor () {
    this.tooltip = new Tooltip()
    this.caption = new Caption()
    this.serverRegistry = new ServerRegistry()
    this.focusManager = new FocusManager(this)
    this.graphDisplayManager = new GraphDisplayManager(this)
    this.mojangUpdater = new MojangUpdater()
    this.percentageBar = new PercentageBar(this)

    this._taskIds = []
  }

  setPageReady (isReady) {
    document.getElementById('push').style.display = isReady ? 'block' : 'none'
    document.getElementById('footer').style.display = isReady ? 'block' : 'none'
    document.getElementById('status-overlay').style.display = isReady ? 'none' : 'block'
  }

  setPublicConfig (publicConfig) {
    this.publicConfig = publicConfig

    this.serverRegistry.assignServers(publicConfig.servers)

    // Start repeating frontend tasks once it has received enough data to be considered active
    // This simplifies management logic at the cost of each task needing to safely handle empty data
    this.initTasks()
  }

  initTasks () {
    this._taskIds.push(setInterval(this.sortServers, 10000))
    this._taskIds.push(setInterval(this.updateGlobalStats, 1000))
    this._taskIds.push(setInterval(this.focusManager.redraw, 1000))
    this._taskIds.push(setInterval(this.percentageBar.redraw, 1000))
  }

  handleDisconnect () {
    this.tooltip.hide()

    // Reset individual tracker elements to flush any held data
    this.serverRegistry.reset()
    this.focusManager.reset()
    this.graphDisplayManager.reset()
    this.mojangUpdater.reset()
    this.percentageBar.reset()

    // Undefine publicConfig, resynced during the connection handshake
    this.publicConfig = undefined

    // Clear all task ids, if any
    this._taskIds.forEach(clearInterval)

    this._taskIds = []

    // Reset hidden values created by #updateGlobalStats
    this._lastTotalPlayerCount = undefined
    this._lastServerRegistrationCount = undefined

    // Reset modified DOM structures
    document.getElementById('stat_totalPlayers').innerText = 0
    document.getElementById('stat_networks').innerText = 0

    // Modify page state to display loading overlay
    this.caption.set('Lost connection!')

    this.setPageReady(false)
  }

  getTotalPlayerCount () {
    return this.serverRegistry.getServerRegistrations()
      .map(serverRegistration => serverRegistration.playerCount)
      .reduce((sum, current) => sum + current, 0)
  }

  addServer = (pings) => {
    // Even if the backend has never pinged the server, the frontend is promised a placeholder object.
    // result = undefined
    // error = defined with "Waiting" description
    // info = safely defined with configured data
    const latestPing = pings[pings.length - 1]
    const serverRegistration = this.serverRegistry.createServerRegistration(latestPing.info.name)

    serverRegistration.initServerStatus(latestPing)

    // Bind to the DOM element for proxying click events and ServerRegistrations to FocusManager
    document.getElementById('show-more_' + serverRegistration.serverId).addEventListener('click', (event) => {
      this.focusManager.handleClick(event.target, serverRegistration)
    }, false)

    // Push the historical data into the graph
    // This will trim and format the data so it is ready for the graph to render once init
    serverRegistration.addGraphPoints(pings)

    // Create the plot instance internally with the restructured and cleaned data
    // #buildPlotInstance returns a selector for easily binding events
    const plotInstance = serverRegistration.buildPlotInstance()

    plotInstance.bind('plothover', this.graphDisplayManager.handlePlotHover)

    // Handle the last known state (if any) as an incoming update
    // This triggers the main update pipeline and enables centralized update handling
    serverRegistration.updateServerStatus(latestPing, true, this.publicConfig.minecraftVersions)
  }

  updateGlobalStats = () => {
    // Only redraw when needed
    // These operations are relatively cheap, but the site already does too much rendering
    const totalPlayerCount = this.getTotalPlayerCount()

    if (totalPlayerCount !== this._lastTotalPlayerCount) {
      this._lastTotalPlayerCount = totalPlayerCount
      document.getElementById('stat_totalPlayers').innerText = formatNumber(totalPlayerCount)
    }

    // Only redraw when needed
    // These operations are relatively cheap, but the site already does too much rendering
    const serverRegistrationCount = this.serverRegistry.getServerRegistrations().length

    if (serverRegistrationCount !== this._lastServerRegistrationCount) {
      this._lastServerRegistrationCount = serverRegistrationCount
      document.getElementById('stat_networks').innerText = serverRegistrationCount
    }
  }

  sortServers = () => {
    this.serverRegistry.getServerRegistrations().sort(function (a, b) {
      return b.playerCount - a.playerCount
    }).forEach(function (serverRegistration, i) {
      $('#container_' + serverRegistration.serverId).appendTo('#server-list')

      serverRegistration.updateServerRankIndex(i)
    })
  }
}
