const http = require('http')

const WebSocket = require('ws')
const finalHttpHandler = require('finalhandler')
const serveStatic = require('serve-static')

const logger = require('./logger')

const HASHED_FAVICON_URL = '/hashedfavicon_'
const HASHED_FAVICON_EXTENSION = '.png'

function getRemoteAddr (req) {
  return req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress
}

class Server {
  constructor (app) {
    this._app = app

    this.createHttpServer()
    this.createWebSocketServer()
  }

  createHttpServer () {
    const distServeStatic = serveStatic('dist/')
    const faviconsServeStatic = serveStatic('favicons/')

    this._http = http.createServer((req, res) => {
      logger.log('info', '%s requested: %s', getRemoteAddr(req), req.url)

      if (req.url.startsWith(HASHED_FAVICON_URL) && req.url.endsWith(HASHED_FAVICON_EXTENSION)) {
        this.handleFaviconRequest(req, res)
      } else {
        // Attempt to handle req using distServeStatic, otherwise fail over to faviconServeStatic
        // If faviconServeStatic fails, pass to finalHttpHandler to terminate
        distServeStatic(req, res, () => {
          faviconsServeStatic(req, res, finalHttpHandler(req, res))
        })
      }
    })
  }

  handleFaviconRequest = (req, res) => {
    let hash = req.url.substring(HASHED_FAVICON_URL.length)
    hash = hash.substring(0, hash.length - HASHED_FAVICON_EXTENSION.length)

    for (const serverRegistration of this._app.serverRegistrations) {
      if (serverRegistration.faviconHash && serverRegistration.faviconHash === hash) {
        const buf = Buffer.from(serverRegistration.lastFavicon.split(',')[1], 'base64')

        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': buf.length,
          'Cache-Control': 'max-age=604800' // Cache hashed favicon for 7 days
        }).end(buf)

        return
      }
    }

    // Terminate request, no match
    res.writeHead(404)
    res.end()
  }

  createWebSocketServer () {
    this._wss = new WebSocket.Server({
      server: this._http
    })

    this._wss.on('connection', (client, req) => {
      logger.log('info', '%s connected, total clients: %d', getRemoteAddr(req), this.getConnectedClients())

      // Bind disconnect event for logging
      client.on('close', () => {
        logger.log('info', '%s disconnected, total clients: %d', getRemoteAddr(req), this.getConnectedClients())
      })

      // Pass client off to proxy handler
      this._app.handleClientConnection(client)
    })
  }

  listen (host, port) {
    this._http.listen(port, host)

    logger.log('info', 'Started on %s:%d', host, port)
  }

  broadcast (payload) {
    this._wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    })
  }

  getConnectedClients () {
    let count = 0
    this._wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        count++
      }
    })
    return count
  }
}

module.exports = Server
