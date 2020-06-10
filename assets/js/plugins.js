export function uPlotTooltipPlugin (onHover) {
  let element

  return {
    hooks: {
      init: u => {
        element = u.root.querySelector('.over')

        element.onmouseenter = () => onHover()
        element.onmouseleave = () => onHover()
      },
      setCursor: u => {
        const { left, top, idx } = u.cursor

        if (idx === null) {
          onHover()
        } else {
          const bounds = element.getBoundingClientRect()

          onHover({
            left: bounds.left + left + window.pageXOffset,
            top: bounds.top + top + window.pageYOffset
          }, idx)
        }
      }
    }
  }
}

export function uPlotIsZoomedPlugin (onZoomIn, onZoomOut) {
  return {
    hooks: {
      setSelect: u => {
        u._zoomPluginIgnoreNextSetScale = true

        if (onZoomIn) {
          onZoomIn(u)
        }
      },
      setScale: u => {
        if (typeof u._zoomPluginIgnoreNextSetScale !== 'boolean') {
          return
        }
        if (u._zoomPluginIgnoreNextSetScale) {
          u._zoomPluginIgnoreNextSetScale = false
        } else if (onZoomOut) {
          onZoomOut(u)
        }
      }
    }
  }
}
