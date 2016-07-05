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

exports.ping = function(host, port, type, timeout, callback, version) {
	if (type === 'PC') {
		util.unfurlSRV(host, port, function(host, port){
			pingMinecraftPC(host, port || 25565, timeout, callback, version);
		})
	} else if (type === 'PE') {
		pingMinecraftPE(host, port || 19132, timeout, callback);
	} else {
		throw new Error('Unsupported type: ' + type);
	}
};
