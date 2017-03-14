var request = require('request');

var logger = require('./logger');
var util = require('./util');

var serviceNameLookup = {
	'sessionserver.mojang.com': 'Sessions',
	'authserver.mojang.com': 'Auth',
	'textures.minecraft.net': 'Skins',
	'api.mojang.com': 'API'
};

var serviceStates = {
	// Lazy populated.
};

function updateService(name, status) {
	// Only update if we need to.
	if (!(name in serviceStates) || serviceStates[name].status !== status) {
		var newEntry = {
			name: serviceNameLookup[name], // Send the clean name, not the URL.
			status: status
		};

		// If it's an outage, track when it started.
		if (status === 'yellow'|| status === 'red') {
			newEntry.startTime = util.getCurrentTimeMs();
		}

		// Generate a nice title from the color.
		if (status === 'green') {
			newEntry.title = 'Online';
		} else if (status === 'yellow') {
			newEntry.title = 'Unstable';
		} else if (status === 'red') {
			newEntry.title = 'Offline';
		} else {
			throw new Error('Unknown Mojang status: ' + status);
		}

		// Wipe the old status in favor of the new one.
		serviceStates[name] = newEntry;
	}
}

exports.update = function(timeout) {
	request({
		uri: 'http://status.mojang.com/check',
		method: 'GET',
		timeout: timeout
	}, function(err, res, body) {
		if (err) {
			logger.log('error', 'Failed to update Mojang services: %s', JSON.stringify(err));
		} else {
			try {
				body = JSON.parse(body);

                for (var i = 0; i < body.length; i++) {
                    var service = body[i];
                    var name = Object.keys(service)[0]; // Because they return an array of object, we have to do this :(

                    // If it's not in the lookup, we don't care about it.
                    if (name in serviceNameLookup) {
                        updateService(name, service[name]);
                    }
                }

				logger.log('debug', 'Updated Mojang services: %s', JSON.stringify(serviceStates));
			} catch(err) {
				// Catch anything weird that can happen, since things probably will.
				logger.log('error', 'Failed to parse Mojang\'s response: %s', JSON.stringify(err));
			}
		}
	});
};

exports.toMessage = function() {
	// This is what we send to the clients.
	return serviceStates;
};
