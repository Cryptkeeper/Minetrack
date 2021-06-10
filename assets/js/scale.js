export class RelativeScale {
  static scale (data, tickCount, maxFactor) {
    const { min, max } = RelativeScale.calculateBounds(data)

    let factor = 1

    while (true) {
      const scale = Math.pow(10, factor)

      const scaledMin = min - (min % scale)
      let scaledMax = max + (max % scale === 0 ? 0 : scale - (max % scale))

      // Prevent min/max from being equal (and generating 0 ticks)
      // This happens when all data points are products of scale value
      if (scaledMin === scaledMax) {
        scaledMax += scale
      }

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
    const nonNullData = data.flat().filter((val) => val !== null)

    // When used with the spread operator, large nonNullData arrays can reach the max call stack size.
    // Use `Function.apply` to pass the array as arguments.
    // https://stackoverflow.com/questions/63705432/maximum-call-stack-size-exceeded-when-using-the-dots-operator/63706516#63706516
    const max = Math.max.apply(null, nonNullData)

    return RelativeScale.scale(
      [0, RelativeScale.isFiniteOrZero(max)],
      tickCount,
      maxFactor
    )
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
      const nonNullData = data.filter((val) => val !== null)

      // See the note on #scaleMatrix for why we use Function.apply over the spread operator
      const min = Math.min.apply(null, nonNullData)
      const max = Math.max.apply(null, nonNullData)

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
