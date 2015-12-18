var util = require('./util');

exports.setup = function() {
	var sqlite = require('sqlite3');

	var db = new sqlite.Database('database.sql');

	db.serialize(function() {
		db.run('CREATE TABLE IF NOT EXISTS pings (timestamp BIGINT NOT NULL, ip TINYTEXT, playerCount MEDIUMINT)');
	});

	exports.log = function(ip, timestamp, playerCount) {
		var insertStatement = db.prepare('INSERT INTO pings (timestamp, ip, playerCount) VALUES (?, ?, ?)');

		db.serialize(function() {
			insertStatement.run(timestamp, ip, playerCount);
		});

		insertStatement.finalize();
	};

	exports.queryPings = function(duration, callback) {
		var currentTime = util.getCurrentTimeMs();

		db.all("SELECT * FROM pings WHERE timestamp >= ? AND timestamp <= ?", [
			currentTime - duration,
			currentTime
		], function(err, data) {
			callback(data);
		});
	};
};