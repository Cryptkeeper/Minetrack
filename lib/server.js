var http = require('http'),
	express = require('express'),
	io = require('socket.io');

var logger = require('./logger');

var config = require('../config.json');

module.exports = {
	server: null,
	app: null,
	io: null,
	start: function(callback){
		var self = this;
		// setup basic server
		self.server = http.createServer();
		self.server.listen(config.site.port, config.site.ip, function(err){
			if(err){
				return callback(err);
			}
			var address = self.server.address();
			logger.log('info', 'Started on %s:%d', address.address, address.port);
		});

		// pass express and socket io to it
		self.app = express();
		self.server.on('request', self.app);
		self.io = io.listen(self.server);

		// configure express to do some heavy lifting
		self.app.use(express.static('./assets'));

		// in the future we might use the template system rather than sending html files :)
		self.app.all('/', function(req, res){
			res.sendFile('html/index.html', {
				root: './assets'
			}, function(err){
				if(err){
					res.status(500).end('Failed to find index file!')
					logger.log('error', err);
				}
			});
		});

		self.app.use(function(req, res, next){
			res.status(404).end('404');
		});
	}
}