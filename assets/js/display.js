const DISPLAY_OPTIONS = [
  {
    name: 'Count'
  },
  {
    name: 'Percentage'
  }
]

const DISPLAY_OPTION_INDEX_DEFAULT = 0
const DISPLAY_OPTION_INDEX_STORAGE_KEY = 'minetrack_display_option_index'

export class DisplayController {
  constructor (app) {
    this._app = app
    this._buttonElement = document.getElementById('display-format')
    this._textElement = document.getElementById('display-format-text')
    this._displayOptionIndex = DISPLAY_OPTION_INDEX_DEFAULT
  }

  reset () {
    // Reset modified DOM structures
    this._buttonElement.style.display = 'none'
    this._textElement.innerText = '...'

    // Remove bound DOM event listeners
    this._buttonElement.removeEventListener('click', this.handleDisplayFormatButtonClick)
  }

  loadLocalStorage () {
    if (typeof localStorage !== 'undefined') {
      const displayOptionIndex = localStorage.getItem(DISPLAY_OPTION_INDEX_STORAGE_KEY)
      if (displayOptionIndex) {
        this._displayOptionIndex = parseInt(displayOptionIndex)
      }
    }
  }

  updateLocalStorage () {
    if (typeof localStorage !== 'undefined') {
      if (this._displayOptionIndex !== DISPLAY_OPTION_INDEX_DEFAULT) {
        localStorage.setItem(DISPLAY_OPTION_INDEX_STORAGE_KEY, this._displayOptionIndex)
      } else {
        localStorage.removeItem(DISPLAY_OPTION_INDEX_STORAGE_KEY)
      }
    }
  }

  show () {
    // Load the saved option selection, if any
    this.loadLocalStorage()

    this.updateDisplayOption()

    // Bind DOM event listeners
    // This is removed by #reset to avoid multiple listeners
    this._buttonElement.addEventListener('click', this.handleDisplayFormatButtonClick)

    // Show #display-format element
    this._buttonElement.style.display = 'inline-block'
  }

  isShowing = (key) => {
    return DISPLAY_OPTIONS[this._displayOptionIndex].name === key
  }

  handleDisplayFormatButtonClick = () => {
    while (true) {
      // Increment to the next sort option, wrap around if needed
      this._displayOptionIndex = (this._displayOptionIndex + 1) % DISPLAY_OPTIONS.length

      // Only break if the displayOption is supported
      // This can technically cause an infinite loop, but never should assuming
      // at least one displayOption does not implement the test OR always returns true
      const displayOption = DISPLAY_OPTIONS[this._displayOptionIndex]

      if (!displayOption.testFunc || displayOption.testFunc(this._app)) {
        break
      }
    }

    // Redraw the button and the graph
    this.updateDisplayOption()

    // Save the updated option selection
    this.updateLocalStorage()
  }

  updateDisplayOption = () => {
    const displayOption = DISPLAY_OPTIONS[this._displayOptionIndex]

    this._textElement.innerText = displayOption.name

    const graph = this._app.graphDisplayManager
    this._app.graphDisplayManager.buildPlotInstance(graph._graphTimestamps, graph._graphData, graph._percentageGraphData)
  }
}
