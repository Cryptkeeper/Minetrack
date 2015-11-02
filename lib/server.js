var http = require('http');
var fs = require('fs');
var url = require('url');
var mime = require('mime');
var io = require('socket.io');

var logger = require('./logger');

var config = require('../config.json');

exports.start = function(callback) {
	var urlMapping = [];
	var routeKeys = Object.keys(config.routes);

	// Map the (static) routes from our config.
	for (var i = 0; i < routeKeys.length; i++) {
		urlMapping[routeKeys[i]] = config.routes[routeKeys[i]];
	}

	logger.log('info', Object.keys(config.routes));

	// Create our tiny little HTTP server.
	var server = http.createServer(function(req, res) {
		var requestUrl = url.parse(req.url).pathname;

		if (requestUrl in urlMapping) {
			var file = urlMapping[requestUrl];

			res.setHeader('Content-Type', mime.lookup(file));
			
			fs.createReadStream(file).pipe(res);
		} else {
			res.statusCode = 404;
			res.write('404');

			res.end();
		}
	});

	server.listen(config.site.port, config.site.ip);

	// I don't like this. But it works, I think.
	exports.io = (io = io.listen(server));

	// Since everything is loaded, do some final prep work.
	logger.log('info', 'Started on %s:%d', config.site.ip, config.site.port);

	callback();
};