var mcpe_ping = require('mcpe-ping-fixed');
var mcpc_ping = require('mc-ping-updated');

var util = require('./util');

// This is a wrapper function for mc-ping-updated, mainly used to convert the data structure of the result.
function pingMinecraftPC(host, port, timeout, callback, version) {
    var startTime = util.getCurrentTimeMs();

	mcpc_ping(host, port, function(err, res) {
	    if (err) {
	        callback(err, null);
	    } else {
	    	// Remap our JSON into our custom structure.
	        callback(null, {
				players: {
					online: res.players.online,
					max: res.players.max
				},
				version: res.version.protocol,
				latency: util.getCurrentTimeMs() - startTime,
				favicon: res.favicon
			});
	    }
	}, timeout, version);
}

// This is a wrapper function for mcpe-ping, mainly used to convert the data structure of the result.
function pingMinecraftPE(host, port, timeout, callback) {
	var startTime = util.getCurrentTimeMs();

	mcpe_ping(host, port || 19132, function(err, res) {
		if (err) {
			callback(err, null);
		} else {
			// Remap our JSON into our custom structure.
			callback(err, {
				players: {
					online: parseInt(res.currentPlayers),
					max: parseInt(res.maxPlayers)
				},
				version: res.version,
				latency: util.getCurrentTimeMs() - startTime
			});
		}
	}, timeout);
}
// Allows MineTrack to ping Legacy Servers with the use of the MineQuery Plugin
function pingMineQuery(host, port, timeout, callback) {


	var s = require('net').Socket();
	let parts = host.split(":")
	s.connect(parts[1], parts[0]);
	s.write('QUERY_JSON\n\r');

	s.on('data', function (d) {
		try {
			response = JSON.parse(d.toString())

			callback("", {
				players: {
					online: parseInt(response.playerCount),
					max: parseInt("100")
				},
				version: 0,
				latency: parseInt(100)
			});
		} catch (err) {
			console.log(err)
		}

	});

	s.on('error', function (err) {
		console.log("Error: " + err.message);
	})
	s.end();

}

exports.ping = function(host, port, type, timeout, callback, version) {
	if (type === 'PC') {
		util.unfurlSRV(host, port, function(host, port){
			pingMinecraftPC(host, port || 25565, timeout, callback, version);
		})
	} else if (type === 'PE') {
		pingMinecraftPE(host, port || 19132, timeout, callback);
	} else if (type === 'MINEQUERY') {
		pingMineQuery(host, port || 19132, timeout, callback);
	} else {
		throw new Error('Unsupported type: ' + type);
	}
};
