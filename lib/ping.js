var mcpe_ping = require('mcpe-ping');
var mcpc_ping = require('mc-ping-updated');

function pingMinecraftPC(host, port, timeout, callback) {
	var milliseconds = (new Date).getTime();

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
				latency: (new Date).getTime() - milliseconds
			});
	    }
	}, timeout);	
}

// This is a wrapper function for mcpe-ping, mainly used to convert the data structure of the result.
function pingMinecraftPE(host, port, timeout, callback) {
	var milliseconds = (new Date).getTime();
		
	mcpe_ping(host, port || 19132, function(err, res) {
		if (err) {
			callback(err, null);
		} else {
			// Remap our JSON into our custom structure.
			callback(err, {
				players: {
					online: res.currentPlayers,
					max: res.maxPlayers
				},
				version: res.version,
				latency: (new Date).getTime() - milliseconds
			});
		}
	}, timeout);
}

exports.ping = function(host, port, type, timeout, callback) {
	if (type === 'PC') {
		pingMinecraftPC(host, port || 25565, timeout, callback);
	} else if (type === 'PE') {
		pingMinecraftPE(host, port || 19132, timeout, callback);
	} else {
		throw new Error('Unsupported type: ' + type);
	}
};