export class RelativeScale {
  static scale (data, tickCount) {
    const [min, max] = RelativeScale.calculateBounds(data)

    let factor = 1

    while (true) {
      const scale = Math.pow(10, factor)

      const scaledMin = min - (min % scale)
      const scaledMax = max + (max % scale === 0 ? 0 : (scale - (max % scale)))

      const ticks = (scaledMax - scaledMin) / scale

      if (ticks + 1 <= tickCount) {
        return [scaledMin, scaledMax, scale]
      } else {
        // Too many steps between min/max, increase factor and try again
        factor++
      }
    }
  }

  static scaleMatrix (data, tickCount) {
    let max = Number.MIN_VALUE

    for (const row of data) {
      let testMax = Number.MIN_VALUE

      for (const point of row) {
        if (point > testMax) {
          testMax = point
        }
      }

      if (testMax > max) {
        max = testMax
      }
    }

    return RelativeScale.scale([0, max], tickCount)
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
      return [0, 0]
    } else {
      let min = Number.MAX_VALUE
      let max = Number.MIN_VALUE

      for (const point of data) {
        if (point > max) {
          max = point
        }
        if (point < min) {
          min = point
        }
      }

      return [min, max]
    }
  }
}
