const http = require('http')

const finalHttpHandler = require('finalhandler')
const serveStatic = require('serve-static')
const io = require('socket.io')

const logger = require('./logger')

function getRemoteAddr (req) {
  return req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress
}

class Server {
  constructor (clientSocketHandler) {
    this._clientSocketHandler = clientSocketHandler
    this._connectedSockets = 0

    this._http = http.createServer(this.handleHttpRequest)

    this._distServeStatic = serveStatic('dist/')
    this._faviconsServeStatic = serveStatic('favicons/')
  }

  listen (host, port) {
    this._http.listen(port, host)

    this._io = io.listen(this._http)
    this._io.on('connect', this.handleClientSocket)

    logger.log('info', 'Started on %s:%d', host, port)
  }

  broadcast (event, payload) {
    this._io.sockets.emit(event, payload)
  }

  handleHttpRequest = (req, res) => {
    logger.log('info', '%s requested: %s', getRemoteAddr(req), req.url)

    // Attempt to handle req using distServeStatic, otherwise fail over to faviconServeStatic
    // If faviconServeStatic fails, pass to finalHttpHandler to terminate
    this._distServeStatic(req, res, () => {
      this._faviconsServeStatic(req, res, finalHttpHandler(req, res))
    })
  }

  handleClientSocket = (client) => {
    this._connectedSockets++

    logger.log('info', '%s connected, total clients: %d', getRemoteAddr(client.request), this._connectedSockets)

    // Bind disconnect event for logging
    client.on('disconnect', () => {
      this._connectedSockets--

      logger.log('info', '%s disconnected, total clients: %d', getRemoteAddr(client.request), this._connectedSockets)
    })

    // Pass client off to proxy handler
    this._clientSocketHandler(client)
  }
}

module.exports = Server
