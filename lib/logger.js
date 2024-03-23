const winston = require('winston')
const path = require('path')

winston.remove(winston.transports.Console)

winston.add(winston.transports.File, {
  filename: path.resolve(__dirname, '..', 'data', 'minetrack.log')
})

winston.add(winston.transports.Console, {
  timestamp: () => {
    const date = new Date()
    return date.toLocaleTimeString() + ' ' + date.toLocaleDateString()
  },
  colorize: true
})

module.exports = winston
