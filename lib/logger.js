const winston = require('winston')

winston.remove(winston.transports.Console)

winston.add(winston.transports.File, {
  filename: 'minetrack.log'
})

winston.add(winston.transports.Console, {
  timestamp: () => {
    const date = new Date()
    return date.toLocaleTimeString() + ' ' + date.toLocaleDateString()
  },
  colorize: true
})

module.exports = winston
