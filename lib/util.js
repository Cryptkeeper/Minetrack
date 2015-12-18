// This method is a monstrosity.
// Since we loaded ALL pings from the database, we need to filter out the pings so each entry is a minute apart.
// This is done by iterating over the list, since the time between each ping can be completely arbitrary.
function trimUselessPings(data) {
	var keys = Object.keys(data);

	for (var i = 0; i < keys.length; i++) {
		var listing = data[keys[i]];
		var lastTimestamp = 0;

		var filteredListing = [];

		for (var x = 0; x < listing.length; x++) {
			var entry = listing[x];

			// 0 is the index of the timestamp.
			// See the convertPingsToGraph method.
			if (entry[0] - lastTimestamp >= 60 * 1000) {
				filteredListing.push(entry);

				lastTimestamp = entry[0];
			}
		}

		data[keys[i]] = filteredListing;
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

		if (!graphData[entry.ip]) {
			graphData[entry.ip] = [];
		}

		graphData[entry.ip].push([entry.timestamp, entry.playerCount]);
	}

	// Break it into minutes.
	trimUselessPings(graphData);

	return graphData;
};