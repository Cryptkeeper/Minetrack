/**
 * THIS IS LEGACY, UNMAINTAINED CODE
 * IT MAY (AND LIKELY DOES) CONTAIN BUGS
 * USAGE IS NOT RECOMMENDED
 */
var mcpe_ping = require('mcpe-ping-fixed');
var mcpc_ping = require('mc-ping-updated');

var logger = require('./logger');
var util = require('./util');

// This is a wrapper function for mc-ping-updated, mainly used to convert the data structure of the result.
function pingMinecraftPC(host, port, timeout, callback, version) {
    var startTime = util.getCurrentTimeMs();

	mcpc_ping(host, port, function(err, res) {
	    if (err) {
	        callback(err, null);
	    } else {
			// Remap our JSON into our custom structure.
			var favicon;

			// Ensure the returned favicon is a data URI
			if (res.favicon && res.favicon.indexOf('data:image/') === 0) {
				favicon = res.favicon;
			}

	        callback(null, {
				players: {
					online: capPlayerCount(host, parseInt(res.players.online)),
					max: parseInt(res.players.max)
				},
				version: parseInt(res.version.protocol),
				latency: util.getCurrentTimeMs() - startTime,
				favicon: favicon
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
					online: capPlayerCount(host, parseInt(res.currentPlayers)),
					max: parseInt(res.maxPlayers)
				},
				latency: util.getCurrentTimeMs() - startTime
			});
		}
	}, timeout);
}

// player count can be up to 1^32-1, which is a massive scale and destroys browser performance when rendering graphs
// Artificially cap and warn to prevent propogating garbage
function capPlayerCount(host, playerCount) {
	const maxPlayerCount = 250000;
	if (playerCount !== Math.min(playerCount, maxPlayerCount)) {
		logger.log('warn', '%s returned a player count of %d, Minetrack has capped it to %d to prevent browser performance issues with graph rendering. If this is in error, please edit maxPlayerCount in ping.js!', host, playerCount, maxPlayerCount);
		return maxPlayerCount;
	} else if (playerCount !== Math.max(playerCount, 0)) {
		logger.log('warn', '%s returned an invalid player count of %d, setting to 0.', host, playerCount);
		return 0;
	}
	return playerCount;
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
