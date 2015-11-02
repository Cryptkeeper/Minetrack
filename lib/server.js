var http = require('http');
var fs = require('fs');
var url = require('url');
var mime = require('mime');
var io = require('socket.io');

var urlMapping = [];

exports.start = function(ip, port, callback) {
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

	server.listen(port, ip);

	// I don't like this. But it works, I think.
	exports.io = (io = io.listen(server));

	// Since everything is loaded, do some final prep work.
	callback();
};

exports.urlMapping = urlMapping;