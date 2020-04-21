/**
 * THIS IS LEGACY, UNMAINTAINED CODE
 * IT MAY (AND LIKELY DOES) CONTAIN BUGS
 * USAGE IS NOT RECOMMENDED
 */
var dns = require('dns');

// This method is a monstrosity.
// Since we loaded ALL pings from the database, we need to filter out the pings so each entry is a minute apart.
// This is done by iterating over the list, since the time between each ping can be completely arbitrary.
exports.trimUselessPings = function(data) {
	var lastTimestamp = 0;

	var filteredListing = [];

	for (var x = 0; x < data.length; x++) {
		var entry = data[x];

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

	return filteredListing
}

exports.getCurrentTimeMs = function() {
    return new Date().getTime();
};

exports.stringToColor = function(base) {
    var hash;

    for (var i = base.length - 1, hash = 0; i >= 0; i--) {
        hash = base.charCodeAt(i) + ((hash << 5) - hash);
    }

    color = Math.floor(Math.abs((Math.sin(hash) * 10000) % 1 * 16777216)).toString(16);

    return '#' + Array(6 - color.length + 1).join('0') + color;
}

/**
 * Attempts to resolve Minecraft PC SRV records from DNS, otherwise falling back to the old hostname.
 *
 * @param hostname hostname to check
 * @param port port to pass to callback if required
 * @param callback function with a hostname and port parameter
 */
exports.unfurlSRV = function(hostname, port, callback) {
	dns.resolveSrv("_minecraft._tcp."+hostname, function (err, records) {
		if(!records||records.length<=0) {
			callback(hostname, port);
			return;
		}
		callback(records[0].name, records[0].port);
	})
};

exports.getRemoteAddr = function(req) {
	let remoteAddress = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	return remoteAddress;
};