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

// Adapted version of https://leeoniya.github.io/uPlot/demos/zoom-ranger.html
// Designed to work using plugins instead of hardcoded hooks
// Used "sourceKey" to enable plugins to safely work between multiple uPlot instances

const UPLOT_SOURCE_RANGE = 'range'
const UPLOT_SOURCE_ZOOMED = 'zoomed'

const UPLOT_SOURCE = []

export function uPlotZoomedPlugin (sourceKey, rangePlotGetter) {
  return {
    hooks: {
      setScale: [
        (zoomedPlot, scale) => {
          const rangePlot = rangePlotGetter()

          if (!rangePlot) {
            return
          }

          if (scale === 'x' && UPLOT_SOURCE[sourceKey] !== UPLOT_SOURCE_RANGE) {
            UPLOT_SOURCE[sourceKey] = UPLOT_SOURCE_ZOOMED

            const seriesData = zoomedPlot.data[0]
            const isReset = zoomedPlot.scales.x.min === seriesData[0] && zoomedPlot.scales.x.max === seriesData[seriesData.length - 1]

            if (isReset) {
              rangePlot.setSelect({
                left: 0,
                width: 0
              })
            } else {
              const left = Math.round(rangePlot.valToPos(zoomedPlot.scales.x.min, 'x'))
              const right = Math.round(rangePlot.valToPos(zoomedPlot.scales.x.max, 'x'))

              rangePlot.setSelect({
                left,
                width: right - left
              })
            }

            delete UPLOT_SOURCE[sourceKey]
          }
        }
      ]
    }
  }
}

// TODO: hook hideSelect
// See https://github.com/leeoniya/uPlot/pull/228

export function uPlotRangePlugin (sourceKey, zoomedPlotGetter) {
  return {
    hooks: {
      setSelect: [
        rangePlot => {
          if (UPLOT_SOURCE[sourceKey] !== UPLOT_SOURCE_ZOOMED) {
            UPLOT_SOURCE[sourceKey] = UPLOT_SOURCE_RANGE

            const zoomedPlot = zoomedPlotGetter()

            const min = rangePlot.posToVal(rangePlot.select.left, 'x')
            const max = rangePlot.posToVal(rangePlot.select.left + rangePlot.select.width, 'x')

            zoomedPlot.setScale('x', {
              min,
              max
            })

            delete UPLOT_SOURCE[sourceKey]
          }
        }
      ],
      ready: [
        rangePlot => {
          // Pull the default display range from the zoomedPlot
          const defaultScale = zoomedPlotGetter().scales.x

          const left = Math.round(rangePlot.valToPos(defaultScale.min, 'x'))
          const width = Math.round(rangePlot.valToPos(defaultScale.max, 'x')) - left
          const height = rangePlot.root.querySelector('.over').getBoundingClientRect().height

          // Map to the local plot data and set selection
          // Mark source as SOURCE_ZOOMED to avoid the #setSelect updating the zoomedPlot
          UPLOT_SOURCE[sourceKey] = UPLOT_SOURCE_ZOOMED

          rangePlot.setSelect({
            left,
            width,
            height
          })

          // Release source lock
          delete UPLOT_SOURCE[sourceKey]
        }
      ]
    }
  }
}
