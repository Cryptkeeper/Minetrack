var http = require('http');
var fs = require('fs');
var url = require('url');
var mime = require('mime');
var io = require('socket.io');

var util = require('./util');
var logger = require('./logger');

var config = require('../config.json');
var minecraft = require('../minecraft.json');
var servers = require('../servers.json');

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

	logger.log('info', '%s requested: %s', req.connection.remoteAddress, requestUrl);

	if (requestUrl === '/status.json') {
		res.setHeader('Content-Type', 'text/plain');

		res.write(JSON.stringify({
			error: true,
			message: 'API deprecated.'
		}));

		res.end();
	} else if (requestUrl === '/publicConfig.json') {
		res.setHeader('Content-Type', 'application/javascript');

		var categories = config.serverCategories;

		// Legacy support for people without categories configured.
		if (!categories || Object.keys(categories).length === 0) {
			categories = {
				'default': 'All Networks'
			};
		}

		for (var i = 0; i < servers.length; i++) {
			var entry = servers[i];

			if (!entry.category) {
				entry.category = 'default';

				logger.warn('%s has no category, defaulting!', entry.name);
			} else if (!categories[entry.category]) {
				logger.warn('%s has an unknown category (%s), defaulting!', entry.name, entry.category);

				entry.category = 'default';
			}
		}

		var publicConfig = {
			categories: categories,
			graphDuration: config.graphDuration,
			servers: servers,
			bootTime: util.getBootTime(),
			categoriesVisible: config.categoriesVisible || false,
			serverTypesVisible: config.serverTypesVisible || false,
			minecraftVersions: minecraft.versions
		};

		res.write('setPublicConfig(' + JSON.stringify(publicConfig) + ');');

		res.end();
	} else if (requestUrl in urlMapping) {
		var file = urlMapping[requestUrl];

		res.setHeader('Content-Type', mime.lookup(file));

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
