var util = require('./util');
var config = require('../config.json');

exports.setup = function() {
	var sqlite = require('sqlite3');

	var db = new sqlite.Database('database.sql');

	db.serialize(function() {
		db.run('CREATE TABLE IF NOT EXISTS pings (name TINYTEXT, ip TINYTEXT, type TINYTEXT, timestamp BIGINT NOT NULL, playerCount MEDIUMINT, maxPlayers MEDIUMINT, protocol SMALLINT, latency SMALLINT, favicon BLOB)');
	});

	exports.log = function(name, ip, type, timestamp, playerCount, maxPlayers, protocol, latency, favicon) {
		var insertStatement = db.prepare('INSERT INTO pings (name, ip, type, timestamp, playerCount, maxPlayers, protocol, latency, favicon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

		db.serialize(function() {
			insertStatement.run(name, ip, type, timestamp, playerCount, maxPlayers, protocol, latency, favicon);
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
	
	exports.apiQuery = function(duration, callback) {
 		var currentTime = util.getCurrentTimeMs();
 
 		db.all("SELECT * FROM pings WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC LIMIT ?", [
 			currentTime - duration,
 			currentTime,
 			config.servers.length
 		], function(err, data) {
 			callback(data);
 		});
 	};
};