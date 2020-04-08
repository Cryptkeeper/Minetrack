const http = require('http')

const io = require('socket.io')
const finalHandler = require('finalhandler')
const serveStatic = require('serve-static')

const util = require('./util')
const logger = require('./logger')

const config = require('../config.json')

exports.start = function () {
  const staticHandler = serveStatic('dist/')

  const server = http.createServer(function onRequest (req, res) {
    logger.log('info', '%s requested: %s', util.getRemoteAddr(req), req.url)

    staticHandler(req, res, finalHandler(req, res))
  })

  server.listen(config.site.port, config.site.ip)

  exports.io = io.listen(server)

  logger.log('info', 'Started on %s:%d', config.site.ip, config.site.port)
}
