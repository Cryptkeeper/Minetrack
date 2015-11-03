var logger = require('./logger');

var timestamps = {};

function getCurrentTimeMs() {
    return (new Date).getTime();
};

exports.track = function(name) {
    if (timestamps[name]) {
        throw new Error(name + ' is already being profiled!');
    }

    timestamps[name] = getCurrentTimeMs();
};

exports.untrack = function(name) {
    if (!timestamps[name]) {
        throw new Error(name + ' isn\'t being profiled!');
    }

    var timestamp = getCurrentTimeMs() - timestamps[name];

    delete timestamps[name];

    logger.log('debug', name + ' took ' + timestamp + 'ms');

    return timestamp;
};

exports.getCurrentTimeMs = getCurrentTimeMs;