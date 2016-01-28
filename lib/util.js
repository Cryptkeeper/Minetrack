var config = require('../config.json');

// Checks if we have a server in config.json with the IP.
function serverWithIpExists(ip) {
	for (var i = 0; i < config.servers.length; i++) {
		var entry = config.servers[i];

		if (entry.ip === ip) {
			return true;
		}
	}

	return false;
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

		var listing = data[keys[i]].data;
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

		data[keys[i]].data = filteredListing;
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
		var listing = data[keys[x]].data;
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
};

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

		if (!graphData[entry.ip]) {
			graphData[entry.ip] = {};
			graphData[entry.ip].data = [];
            graphData[entry.ip].color = exports.serverColorFromIP(entry.ip);
		}

		graphData[entry.ip].data.push([entry.timestamp, entry.playerCount]);
	}
    
	// Break it into minutes.
	trimUselessPings(graphData);
	// Drop old data.
	exports.trimOldPings(graphData);

	return graphData;
};

exports.stringToColor = function(base) {
	var hash;

	for (var i = 0, hash = 0; i < base.length; i++) {
		hash = base.charCodeAt(i) + ((hash << 5) - hash);
	}

	color = Math.floor(Math.abs((Math.sin(hash) * 10000) % 1 * 16777216)).toString(16);

	return '#' + Array(6 - color.length + 1).join('0') + color;
};

var ipToColor = {};

exports.loadServerColors = function(){
    for (var i = 0; i < config.servers.length; i++) {
        // Make sure we lock our scope.
        (function(network) {
            ipToColor[network.ip] = ((/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(network.color)) ? network.color : exports.stringToColor(network.ip));
        })(config.servers[i]);
    }
};

exports.serverColorFromIP = function(server) {
    return ipToColor[server];
};
