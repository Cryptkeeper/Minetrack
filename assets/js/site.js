var smallChartOptions = {
    series: {
        shadowSize: 0
    },
    xaxis: {
        font: {
            color: "#E3E3E3"
        },
        show: false
    },
    yaxis: {
        minTickSize: 75,
        tickDecimals: 0,
        show: true,
        tickLength: 10,
        tickFormatter: function(value) {
            return formatNumber(value);
        },
        font: {
            color: "#E3E3E3"
        },
        labelWidth: -10
    },
    grid: {
        hoverable: true,
        color: "#696969"
    },
    colors: [
        "#E9E581"
    ]
};

var lastMojangServiceUpdate;

var graphs = {};
var lastLatencyEntries = {};
var lastPlayerEntries = {};

// Generate (and set) the HTML that displays Mojang status.
function updateMojangServices() {
    if (!lastMojangServiceUpdate) {
        return;
    }

	var keys = Object.keys(lastMojangServiceUpdate);
    var newStatus = 'Mojang Services: ';
    var serviceCountByType = {
        Online: 0,
        Unstable: 0,
        Offline: 0
    };

    for (var i = 0; i < keys.length; i++) {
        var entry = lastMojangServiceUpdate[keys[i]];

        serviceCountByType[entry.title] += 1;
    }

    if (serviceCountByType['Online'] === keys.length) {
        $('#tagline').attr('class', 'status-online');

        newStatus += 'All systems operational.';
    } else {
        if (serviceCountByType['Unstable'] > serviceCountByType['Offline']) {
            $('#tagline').attr('class', 'status-unstable');
        } else {
            $('#tagline').attr('class', 'status-offline');
        }

        for (var i = 0; i < keys.length; i++) {
            var entry = lastMojangServiceUpdate[keys[i]];

            if (entry.startTime) {
                newStatus += entry.name + ' ' + entry.title.toLowerCase() + ' for ' + msToTime((new Date()).getTime() - entry.startTime);
            }
        }
    }

	$('#tagline-text').text(newStatus);
}

function findErrorMessage(error) {
    if (error.description) {
        return error.description;
    } else if (error.errno) {
        return error.errno;
    }
}

function updateServerStatus(lastEntry) {
    var info = lastEntry.info;
    var div = $('#status_' + safeName(info.name));

    if (lastEntry.result) {
        var result = lastEntry.result;
        var newStatus = '<br />Players: ' + formatNumber(result.players.online);

        var listing = graphs[lastEntry.info.name].listing;

        if (listing.length > 0) {
            newStatus += '<span class="color-gray"> (';

            var playerDifference = listing[listing.length - 1][1] - listing[0][1];

            if (playerDifference >= 0) {
                newStatus += '+';
            }

            newStatus += playerDifference + ')</span>';
        }

        /*if (lastLatencyEntries[info.name]) {
            newStatus += '<br />';

            var latencyDifference = lastLatencyEntries[info.name] - result.latency;

            if (latencyDifference >= 0) {
                newStatus += '+';
            }

            newStatus += latencyDifference + 'ms';
        }*/

        lastPlayerEntries[info.name] = result.players.online;
        lastLatencyEntries[info.name] = result.latency;

        div.html(newStatus);
    } else {
        var newStatus = '<br /><span class="color-red">';

        if (findErrorMessage(lastEntry.error)) {
            newStatus += findErrorMessage(lastEntry.error);
        } else {
            newStatus += 'Failed to ping!';
        }

        div.html(newStatus + '</span>');
    }

    var keys = Object.keys(lastPlayerEntries);
    var totalPlayers = 0;

    for (var i = 0; i < keys.length; i++) {
        totalPlayers += lastPlayerEntries[keys[i]];
    }

    $("#stat_totalPlayers").text(formatNumber(totalPlayers));
    $("#stat_networks").text(formatNumber(keys.length));
}

function sortServers() {
    var keys = Object.keys(lastPlayerEntries);
    var nameList = [];

    keys.sort(function(a, b) {
        return lastPlayerEntries[b] - lastPlayerEntries[a];
    });

    keys.reverse();

    for (var i = 0; i < keys.length; i++) {
        $('#' + safeName(keys[i])).prependTo('#server-container');

        $('#ranking_' + safeName(keys[i])).text('#' + (keys.length - i));
    }
}

function safeName(name) {
    return name.replace(/ /g, '');
}

$(document).ready(function() {
	var socket = io.connect({
        reconnect: true,
        reconnectDelay: 1000,
        reconnectionAttempts: 10
    });

    var mojangServicesUpdater;
    var sortServersTask;

	socket.on('connect', function() {
        $('#tagline-text').text('Loading...');
	});

    socket.on('disconnect', function() {
        if (mojangServicesUpdater) {
            clearInterval(mojangServicesUpdater);
        }

        if (sortServersTask) {
            clearInterval(sortServersTask);
        }

        $('#tagline').attr('class', 'status-offline');
        $('#tagline-text').text('Disconnected! Refresh?');

        lastPlayerEntries = {};
        lastLatencyEntries = {};
        graphs = {};

        $('#server-container').html('');
        $('#quick-jump-container').html('');
    });

	socket.on('add', function(servers) {
        for (var i = 0; i < servers.length; i++) {
            var history = servers[i];
            var listing = [];

            for (var x = 0; x < history.length; x++) {
                var point = history[x];

                if (point.result) {
                    listing.push([point.timestamp, point.result.players.online]);
                } else if (point.error) {
                    listing.push([point.timestamp, 0]);
                }
            }

            var lastEntry = history[history.length - 1];
            var info = lastEntry.info;

            if (lastEntry.error) {
                lastPlayerEntries[info.name] = 0;
                lastLatencyEntries[info.name] = 0;
            } else if (lastEntry.result) {
                lastPlayerEntries[info.name] = lastEntry.result.players.online;
                lastLatencyEntries[info.name] = lastEntry.result.latency;
            }

            $('<div/>', {
                id: safeName(info.name),
                class: 'server',
                html: '<div id="server-' + safeName(info.name) + '" class="column" style="width: 80px;">\
                            <img style="padding-top: 5px;" id="favicon_' + safeName(info.name) + '">\
                            <br />\
                            <p class="text-center-align" style="width: 64px; padding-top: 3px;" id="ranking_' + safeName(info.name) + '"></p>\
                        </div>\
                        <div class="column" style="width: 280px;">\
                            <h3>' + info.name + '&nbsp;<span class="type">' + info.type + '</span></h3>\
                            <span class="color-gray">' + info.ip + '</span>\
                            <br />\
                            <span id="status_' + safeName(info.name) + '">Waiting</span>\
                        </div>\
                        <div class="column" style="float: right;">\
                            <div class="chart" id="chart_' + safeName(info.name) + '"></div>\
                        </div>'
            }).appendTo("#server-container");

            var favicon = MISSING_FAVICON_BASE64;

            if (lastEntry.result && lastEntry.result.favicon) {
                favicon = lastEntry.result.favicon;
            }

            $('#favicon_' + safeName(info.name)).attr('src', favicon);

            $('#quick-jump-container').append('<img id="quick-jump-' + safeName(info.name) + '" data-target-network="' + safeName(info.name) + '" title="' + info.name + '" alt="' + info.name + '" class="quick-jump-icon" src="' + favicon + '">');

            graphs[lastEntry.info.name] = {
                listing: listing,
                plot: $.plot('#chart_' + safeName(info.name), [listing], smallChartOptions)
            };

            updateServerStatus(lastEntry);

            $('#chart_' + safeName(info.name)).bind('plothover', function(event, pos, item) {
                if (item) {
                    renderTooltip(item.pageX + 5, item.pageY + 5, getTimestamp(item.datapoint[0] / 1000) + '\
                        <br />\
                        ' + formatNumber(item.datapoint[1]) + ' Players');
                } else {
                    hideTooltip();
                }
            });
        }

        sortServers();
	});

	socket.on('update', function(update) {
        // Prevent weird race conditions.
        if (!graphs[update.info.name]) {
            return;
        }

        // We have a new favicon, update the old one.
        if (update.result && update.result.favicon) {
            $('#favicon_' + safeName(update.info.name)).attr('src', update.result.favicon);
            $('#quick-jump-' + safeName(update.info.name)).attr('src', update.result.favicon);
        }

        var graph = graphs[update.info.name];

        updateServerStatus(update);

        if (update.result) {
            graph.listing.push([update.info.timestamp, update.result ? update.result.players.online : 0]);

            if (graph.listing.length > 72) {
                graph.listing.shift();
            }

            graph.plot.setData([graph.listing]);
            graph.plot.setupGrid();

            graph.plot.draw();
        }
	});

	socket.on('updateMojangServices', function(data) {
		// Store the update and force an update.
		lastMojangServiceUpdate = data;

		updateMojangServices();
	});

	// Start any special updating tasks.
	mojangServicesUpdater = setInterval(function() {
		updateMojangServices();
	}, 1000);

    sortServersTask = setInterval(function() {
        sortServers();
    }, 30 * 1000);

    // Our super fancy scrolly thing!
    $(document).on('click', '.quick-jump-icon', function(e) {
        var serverName = $(this).attr('data-target-network');
        var target = $('#server-' + serverName);

        $('html, body').animate({
            scrollTop: target.offset().top
        }, 100);
    });
});
