exports.setup = function() {
	var sqlite = require('sqlite3');

	var db = new sqlite.Database('database.sql');

	db.serialize(function() {
		db.run('CREATE TABLE IF NOT EXISTS pings (id INT AUTO INCREMENT PRIMARY KEY, timestamp BIGINT NOT NULL, ip TINYTEXT, player MEDIUMINT)');
	});

	exports.log = function(ip, timestamp, playerCount) {
		var insertStatement = db.prepare('INSERT INTO pings (timestamp, ip, player) VALUES (?, ?, ?)');

		insertStatement.run(timestamp, ip, playerCount);
	};
};