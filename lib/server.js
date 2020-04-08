const http = require('http')

const io = require('socket.io')
const finalHandler = require('finalhandler')
const serveStatic = require('serve-static')

const util = require('./util')
const logger = require('./logger')

const config = require('../config.json')

const distHandler = serveStatic('dist/')
const faviconsHandler = serveStatic('favicons/')

function onRequest (req, res) {
  logger.log('info', '%s requested: %s', util.getRemoteAddr(req), req.url)
  distHandler(req, res, function () {
    faviconsHandler(req, res, finalHandler(req, res))
  })
}

exports.start = function () {
  const server = http.createServer(onRequest)
  server.listen(config.site.port, config.site.ip)
  exports.io = io.listen(server)
  logger.log('info', 'Started on %s:%d', config.site.ip, config.site.port)
}
