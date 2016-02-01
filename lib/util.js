var logger = require('./logger');

var config = require('../config.json');
var servers = require('../servers.json');

var serverNameLookup = {};

// Checks if we have a server in config.json with the IP.
function serverWithIpExists(ip) {
	for (var i = 0; i < servers.length; i++) {
		var entry = servers[i];

		if (entry.ip === ip) {
			return true;
		}
	}

	return false;
}

function getServerNameByIp(ip) {
	var lookupName = serverNameLookup[ip];

	if (lookupName) {
		return lookupName;
	}

	for (var i = 0; i < servers.length; i++) {
		var entry = servers[i];

		if (entry.ip === ip) {
			lookupName[entry.ip] = entry.name;

			return entry.name;
		}
	}
}

// This method is a monstrosity.
// Since we loaded ALL pings from the database, we need to filter out the pings so each entry is a minute apart.
// This is done by iterating over the list, since the time between each ping can be completely arbitrary.
function trimUselessPings(data) {
	var keys = Object.keys(data);

	var keysToRemove = [];

	for (var i = 0; i < keys.length; i++) {
		// Don't bother we servers we deleted from config.json
		if (!serverWithIpExists(keys[i])) {
			keysToRemove.push(keys[i]);

			continue;
		}

		var listing = data[keys[i]];
		var lastTimestamp = 0;

		var filteredListing = [];

		for (var x = 0; x < listing.length; x++) {
			var entry = listing[x];

			// 0 is the index of the timestamp.
			// See the convertPingsToGraph method.
			if (entry[0] - lastTimestamp >= 60 * 1000) {
				// This second check tries to smooth out randomly dropped pings.
				// By default we only want entries that are online (playerCount > 0).
				// This way we'll keep looking forward until we find one that is online.
				// However if we can't find one within a reasonable timeframe, select the sucky one.
				if (entry[0] - lastTimestamp >= 120 * 1000 || entry[1] > 0) {
					filteredListing.push(entry);

					lastTimestamp = entry[0];
				}
			}
		}

		data[keys[i]] = filteredListing;
	}

	// Delete data for any networks we don't care about anymore.
	for (var i = 0; i < keysToRemove.length; i++) {
		delete data[keysToRemove[i]];
	}
}

exports.trimOldPings = function(data) {
	var keys = Object.keys(data);

	var timeMs = exports.getCurrentTimeMs();

	for (var x = 0; x < keys.length; x++) {
		var listing = data[keys[x]];
		var toSplice = [];

		for (var i = 0; i < listing.length; i++) {
			var entry = listing[i];

			if (timeMs - entry[0] > config.graphDuration) {
				toSplice.push(i);
			}
		}

		for (var i = 0; i < toSplice.length; i++) {
			listing.splice(toSplice[i], 1);
		}
	}
}

exports.getCurrentTimeMs = function() {
    return new Date().getTime();
};

exports.setIntervalNoDelay = function(func, delay) {
	var task = setInterval(func, delay);

	func();

	return task;
};

exports.convertPingsToGraph = function(sqlData) {
	var graphData = {};

	for (var i = 0; i < sqlData.length; i++) {
		var entry = sqlData[i];

		var name = getServerNameByIp(entry.ip);

		if (!name) {
			logger.warn('Missing name for ' + entry.ip);

			continue;
		}

		if (!graphData[name]) {
			graphData[name] = [];
		}

		graphData[name].push([entry.timestamp, entry.playerCount]);
	}

	// Break it into minutes.
	trimUselessPings(graphData);

	// Drop old data.
	exports.trimOldPings(graphData);

	return graphData;
};