exports.setup = function() {
	var sqlite = require('sqlite3');

	var db = new sqlite.Database('database.sql');

	db.serialize(function() {
		db.run('CREATE TABLE IF NOT EXISTS pings (timestamp BIGINT NOT NULL, ip TINYTEXT, playerCount MEDIUMINT)');
	});

	exports.log = function(ip, timestamp, playerCount) {
		var insertStatement = db.prepare('INSERT INTO pings (timestamp, ip, playerCount) VALUES (?, ?, ?)');

		insertStatement.run(timestamp, ip, playerCount);
	};
};