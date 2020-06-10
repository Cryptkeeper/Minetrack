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
