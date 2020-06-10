export class RelativeScale {
  static scale (data, tickCount, maxFactor) {
    const { min, max } = RelativeScale.calculateBounds(data)

    let factor = 1

    while (true) {
      const scale = Math.pow(10, factor)

      const scaledMin = min - (min % scale)
      const scaledMax = max + (max % scale === 0 ? 0 : (scale - (max % scale)))

      const ticks = (scaledMax - scaledMin) / scale

      if (ticks <= tickCount || (typeof maxFactor === 'number' && factor === maxFactor)) {
        return {
          scaledMin,
          scaledMax,
          scale
        }
      } else {
        // Too many steps between min/max, increase factor and try again
        factor++
      }
    }
  }

  static scaleMatrix (data, tickCount, maxFactor) {
    const max = Math.max(...data.flat())

    return RelativeScale.scale([0, RelativeScale.isFiniteOrZero(max)], tickCount, maxFactor)
  }

  static generateTicks (min, max, step) {
    const ticks = []
    for (let i = min; i <= max; i += step) {
      ticks.push(i)
    }
    return ticks
  }

  static calculateBounds (data) {
    if (data.length === 0) {
      return {
        min: 0,
        max: 0
      }
    } else {
      const min = Math.min(...data)
      const max = Math.max(...data)

      return {
        min: RelativeScale.isFiniteOrZero(min),
        max: RelativeScale.isFiniteOrZero(max)
      }
    }
  }

  static isFiniteOrZero (val) {
    return Number.isFinite(val) ? val : 0
  }
}
