var lastMojangServiceUpdate;

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
        minTickSize: 100,
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
        color: "#C4C4C4"
    },
    colors: [
        "#E9E581"
    ]
};

var graphs = {};
var lastLatencyEntries = {};
var lastPlayerEntries = {};

// Generate (and set) the HTML that displays Mojang status.
function updateMojangServices() {
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

function updateServerStatus(lastEntry) {
    var info = lastEntry.info;
    var div = $('#status_' + safeName(info.name));

    if (lastEntry.result) {
        var result = lastEntry.result;
        var newStatus = formatNumber(result.players.online) + '/' + formatNumber(result.players.max);

        if (lastPlayerEntries[info.name]) {
            newStatus += '<span class="color-gray"> (';

            var playerDifference = lastPlayerEntries[info.name] - result.players.online;

            if (playerDifference >= 0) {
                newStatus += '+';
            }

            newStatus += playerDifference + ')</span>';
        }

        if (lastLatencyEntries[info.name]) {
            newStatus += '<br />';

            var latencyDifference = lastLatencyEntries[info.name] - result.latency;

            if (latencyDifference >= 0) {
                newStatus += '+';
            }

            newStatus += latencyDifference + 'ms';
        }

        lastPlayerEntries[info.name] = result.players.online;
        lastLatencyEntries[info.name] = result.latency;

        div.html(newStatus);
    }
}

function safeName(name) {
    return name.replace(' ', '');
}

$(document).ready(function() {
	var socket = io.connect();
    var mojangServicesUpdater;

	socket.on('connect', function() {
        $('#tagline-text').text('Loading...');
	});

    socket.on('disconnect', function() {
        if (mojangServicesUpdater) {
            clearInterval(mojangServicesUpdater);
        }

        $('#tagline').attr('class', 'status-connecting');
        $('#tagline-text').text('Attempting reconnnect...');

        lastPlayerEntries = {};
        lastLatencyEntries = {};
        graphs = {};

        $('#server-container').html('');
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

            $('<div/>', {
                id: safeName(info.name),
                class: 'server',
                html: '<div class="column" style="width: 80px;">\
                            <img style="padding-top: 5px;" id="favicon_' + safeName(info.name) + '">\
                        </div>\
                        <div class="column" style="width: 280px;"><h3>' + info.name + '</h3>\
                            <span class="color-gray">' + info.ip + '</span>\
                            <br />\
                            <span id="status_' + safeName(info.name) + '">Waiting</span>\
                        </div>\
                        <div class="column" style="float: right;">\
                            <div class="chart" id="chart_' + safeName(info.name) + '"></div>\
                        </div>'
            }).appendTo("#server-container");

            if (lastEntry.result && lastEntry.result.favicon) {
                $('#favicon_' + safeName(info.name)).attr('src', lastEntry.result.favicon);
            }

            updateServerStatus(lastEntry);

            graphs[lastEntry.info.name] = {
                listing: listing,
                plot: $.plot('#chart_' + safeName(info.name), [listing], smallChartOptions)
            };

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
	});

	socket.on('update', function(update) {
        var graph = graphs[update.info.name];

        updateServerStatus(update);

        graph.listing.push([update.info.timestamp, update.result ? update.result.players.online : 0]);

        if (graph.listing.length > 72) {
            graph.listing.shift();
        }

        graph.plot.setData([graph.listing]);
        graph.plot.setupGrid();

        graph.plot.draw();
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
});