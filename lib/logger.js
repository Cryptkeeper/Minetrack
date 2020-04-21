const winston = require('winston')

winston.remove(winston.transports.Console)

winston.add(winston.transports.File, {
  filename: 'minetrack.log'
})

winston.add(winston.transports.Console, {
  timestamp: () => {
    const date = new Date()
    return date.toLocaleTimeString() + ' ' + date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear().toString().substring(2, 4)
  },
  colorize: true
})

module.exports = winston
