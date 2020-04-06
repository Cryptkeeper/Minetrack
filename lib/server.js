var http = require('http');
var fs = require('fs');
var url = require('url');
var mime = require('mime');
var io = require('socket.io');

var util = require('./util');
var logger = require('./logger');

var config = require('../config.json');

var urlMapping = [];

function setupRoutes() {
	var routeKeys = Object.keys(config.routes);

	// Map the (static) routes from our config.
	for (var i = 0; i < routeKeys.length; i++) {
		urlMapping[routeKeys[i]] = config.routes[routeKeys[i]];
	}

	logger.log('info', 'Routes: %s', routeKeys);
}

function handleRequest(req, res) {
	var requestUrl = url.parse(req.url).pathname;

	logger.log('info', '%s requested: %s', util.getRemoteAddr(req), requestUrl);

	if (requestUrl in urlMapping) {
		var file = urlMapping[requestUrl];

		res.setHeader('Content-Type', mime.getType(file));

		fs.createReadStream(file).pipe(res);
	} else {
		res.statusCode = 404;

		res.write('404');

		res.end();
	}
}

exports.start = function() {
	setupRoutes();

	// Create our tiny little HTTP server.
	var server = http.createServer(handleRequest);

	server.listen(config.site.port, config.site.ip);

	// I don't like this. But it works, I think.
	exports.io = io.listen(server);

	// Since everything is loaded, let's celebrate!
	logger.log('info', 'Started on %s:%d', config.site.ip, config.site.port);
};
