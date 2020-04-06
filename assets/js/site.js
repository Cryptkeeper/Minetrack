var graphs = [];

var historyPlot;
var displayedGraphData;
var hiddenGraphData = [];

var isConnected = false;

var sortServersTask;

var currentServerHover;

const tooltip = new Tooltip();

const serverRegistry = new ServerRegistry();
const pingTracker = new PingTracker();

function updateServerStatus(lastEntry) {
	var info = lastEntry.info;
	
	const serverId = serverRegistry.getOrAssign(info.name);

    var div = $('#status_' + serverId);
    var versionDiv = $('#version_' + serverId);

    if (lastEntry.versions) {
        var versions = '';

        for (var i = 0; i < lastEntry.versions.length; i++) {
            if (!lastEntry.versions[i]) continue;
            versions += '<span class="version">' + publicConfig.minecraftVersions[lastEntry.info.type][lastEntry.versions[i]] + '</span>&nbsp;';
        }

        versionDiv.html(versions);
    } else {
        versionDiv.html('');
    }

    if (lastEntry.result) {
        var result = lastEntry.result;
        var newStatus = 'Players: <span style="font-weight: 500;">' + formatNumber(result.players.online) + '</span>';

        var listing = graphs[lastEntry.info.name].listing;

        if (listing.length > 0) {
            newStatus += '<span class="color-gray"> (';

            var playerDifference = listing[listing.length - 1][1] - listing[0][1];

            if (playerDifference >= 0) {
                newStatus += '+';
            }

            newStatus += playerDifference + ')</span>';
        }

        div.html(newStatus);
    } else {
        var newStatus = '<span class="color-red">';

        if (findErrorMessage(lastEntry.error)) {
            newStatus += findErrorMessage(lastEntry.error);
        } else {
            newStatus += 'Failed to ping!';
        }

        div.html(newStatus + '</span>');
    }

    $("#stat_totalPlayers").text(formatNumber(pingTracker.getTotalPlayerCount()));
    $("#stat_networks").text(formatNumber(pingTracker.getActiveServerCount()));

    if (lastEntry.record) {
        $('#record_' + serverId).html('Record: ' + formatNumber(lastEntry.record));
    }

    updatePercentageBar();
}

function sortServers() {
	serverRegistry.getServerIds().sort(function(a, b) {
			return pingTracker.getPlayerCount(b) - pingTracker.getPlayerCount(a);
		}).forEach(function(serverId, i) {
			$('#container_' + serverId).appendTo('#server-container-list');
			$('#ranking_' + serverId).text('#' + (i + 1));
		});
}

function updatePercentageBar() {
	const totalPlayers = pingTracker.getTotalPlayerCount();

    var parent = $('#perc-bar');
	var leftPadding = 0;
	
	serverRegistry.getServerIds().sort(function(a, b) {
			return pingTracker.getPlayerCount(a) - pingTracker.getPlayerCount(b);
		}).forEach(function(serverId) {
			let playerCount = pingTracker.getPlayerCount(serverId);

			var div = $('#perc_bar_part_' + serverId);

			// Setup the base
			if (!div.length) {
				$('<div/>', {
					id: 'perc_bar_part_' + serverId,
					class: 'perc-bar-part',
					html: '',
					style: 'background: ' + serverRegistry.getColor(serverId) + ';'
				}).appendTo(parent);

				div = $('#perc_bar_part_' + serverId);

				div.mouseover(function() {
					currentServerHover = serverId;
				});

				div.mouseout(function() {
					tooltip.hide();
					currentServerHover = undefined;
				});
			}

			// Update our position/width
			var width = (playerCount / totalPlayers) * parent.width();

			div.css({
				width: width + 'px',
				left: leftPadding + 'px'
			});

			leftPadding += width;
		});
}

function setAllGraphVisibility(visible) {
    if (visible) {
        var keys = Object.keys(hiddenGraphData);

        for (var i = 0; i < keys.length; i++) {
            displayedGraphData[keys[i]] = hiddenGraphData[keys[i]];
        }

        hiddenGraphData = [];
    } else {
        var keys = Object.keys(displayedGraphData);

        for (var i = 0; i < keys.length; i++) {
            hiddenGraphData[keys[i]] = displayedGraphData[keys[i]];
        }

        displayedGraphData = [];
    }

    $('.graph-control').each(function(index, item) {
        item.checked = visible;
    });

    historyPlot.setData(convertGraphData(displayedGraphData));
    historyPlot.setupGrid();

    historyPlot.draw();

    // Update our localStorage
    if (visible) {
        resetGraphControls();
    } else {
        saveGraphControls(Object.keys(displayedGraphData));
    }
}

function validateBootTime(bootTime, socket) {
    $('#tagline-text').text('Validating...');

    console.log('Remote bootTime is ' + bootTime + ', local is ' + publicConfig.bootTime);

    if (bootTime === publicConfig.bootTime) {
        $('#tagline-text').text('Loading...');

        socket.emit('requestListing');

        if (!isMobileBrowser()) socket.emit('requestHistoryGraph');

        isConnected = true;

        // Start any special updating tasks.
        sortServersTask = setInterval(sortServers, 10000);
    } else {
        $('#tagline-text').text('Updating...');

        $.getScript('/publicConfig.json', function(data, textStatus, xhr) {
            if (xhr.status === 200) {
                validateBootTime(publicConfig.bootTime, socket);
            } else {
                showCaption('Failed to update! Refresh?');
            }
        });
    }
}

function updateServerPeak(name, time, playerCount) {
	// hack: strip the AM/PM suffix
	// Javascript doesn't have a nice way to format Dates with AM/PM, so we'll append it manually
	var timestamp = getTimestamp(time / 1000).split(':');
	var end = timestamp.pop().split(' ')[1];
	timestamp = timestamp.join(':');
	// end may be undefined for other timezones/24 hour times
	if (end) {
		timestamp += ' ' + end;
	}
	var timeLabel = msToTime(publicConfig.graphDuration);
	const serverId = serverRegistry.getOrAssign(name);
	$('#peak_' + serverId).html(timeLabel + ' Peak: ' + formatNumber(playerCount) + ' @ ' + timestamp);
}

$(document).ready(function() {
	var socket = io.connect({
        reconnect: true,
        reconnectDelay: 1000,
        reconnectionAttempts: 10
    });

    socket.on('bootTime', function(bootTime) {
        validateBootTime(bootTime, socket);
    });

    socket.on('disconnect', function() {
        if (sortServersTask) clearInterval(sortServersTask);

		showCaption('Disconnected! Refresh?');
		
		serverRegistry.reset();
		pingTracker.reset();

        graphs = {};

        $('#server-container-list').html('');

        $('#big-graph').html('');
        $('#big-graph-checkboxes').html('');
        $('#big-graph-controls').css('display', 'none');

        $('#perc-bar').html('');
        $('.mojang-status').css('background', 'transparent');
        $('.mojang-status-text').text('...');

        $("#stat_totalPlayers").text(0);
        $("#stat_networks").text(0);

        isConnected = false;
    });

    socket.on('historyGraph', function(rawData) {
        var shownServers = loadGraphControls();

        if (shownServers) {
            var keys = Object.keys(rawData);

            hiddenGraphData = [];
            displayedGraphData = [];

            for (var i = 0; i < keys.length; i++) {
                var name = keys[i];

                if (shownServers.indexOf(name) !== -1) {
                    displayedGraphData[name] = rawData[name];
                } else {
                    hiddenGraphData[name] = rawData[name];
                }
            }
        } else {
            displayedGraphData = rawData;
        }

        $('#big-graph').css('height', '400px');

        historyPlot = $.plot('#big-graph', convertGraphData(displayedGraphData), bigChartOptions);

        $('#big-graph').bind('plothover', handlePlotHover);

        var keys = Object.keys(rawData);

        var sinceBreak = 0;
        var html = '<table><tr>';

        keys.sort();

        for (var i = 0; i < keys.length; i++) {
            var checkedString = '';

            if (displayedGraphData[keys[i]]) {
                checkedString = 'checked=checked';
            }

            html += '<td><input type="checkbox" class="graph-control" id="graph-controls" data-target-network="' + keys[i] + '" ' + checkedString + '> ' + keys[i] + '</input></td>';

            if (sinceBreak >= 7) {
                sinceBreak = 0;

                html += '</tr><tr>';
            } else {
                sinceBreak++;
            }
        }

        $('#big-graph-checkboxes').append(html + '</tr></table>');
        $('#big-graph-controls').css('display', 'block');
    });

    socket.on('updateHistoryGraph', function(rawData) {
        // Prevent race conditions.
        if (!displayedGraphData || !hiddenGraphData) {
            return;
        }

        // If it's not in our display group, use the hidden group instead.
        var targetGraphData = displayedGraphData[rawData.name] ? displayedGraphData : hiddenGraphData;

        trimOldPings(targetGraphData, publicConfig.graphDuration);

        targetGraphData[rawData.name].push([rawData.timestamp, rawData.players]);

        // Redraw if we need to.
        if (displayedGraphData[rawData.name]) {
            historyPlot.setData(convertGraphData(displayedGraphData));
            historyPlot.setupGrid();

            historyPlot.draw();
        }
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

			const serverId = serverRegistry.getOrAssign(info.name);

			pingTracker.handlePing(serverId, lastEntry);

            var typeString = publicConfig.serverTypesVisible ? '<span class="type">' + info.type + '</span>' : '';

            $('<div/>', {
                id: 'container_' + serverId,
                class: 'server',
                'server-id': serverId,
                html: '<div id="server-' + serverId + '" class="column" style="width: 80px;">\
                            <img class="server-favicon" id="favicon_' + serverId + '" title="' + info.name + '\n' + formatMinecraftServerAddress(info.ip, info.port) + '">\
                            <br />\
                            <p class="text-center-align rank" id="ranking_' + serverId + '"></p>\
                        </div>\
                        <div class="column" style="width: 282px;">\
                            <h3>' + info.name + '&nbsp;' + typeString + '</h3>\
                            <span id="status_' + serverId + '">Waiting</span>\
							<div id="version_' + serverId + '" class="color-dark-gray server-meta versions"><span class="version"></span></div>\
							<span id="peak_' + serverId + '" class="color-dark-gray server-meta"></span>\
                            <br><span id="record_' + serverId + '" class="color-dark-gray server-meta"></span>\
                        </div>\
                        <div class="column" style="float: right;">\
                            <div class="chart" id="chart_' + serverId + '"></div>\
                        </div>'
            }).appendTo("#server-container-list");

            var favicon = MISSING_FAVICON_BASE64;

            if (lastEntry.result && lastEntry.result.favicon) {
                favicon = lastEntry.result.favicon;
            }

            $('#favicon_' + serverId).attr('src', favicon);

            graphs[lastEntry.info.name] = {
                listing: listing,
                plot: $.plot('#chart_' + serverId, [listing], smallChartOptions)
            };

            updateServerStatus(lastEntry);

            $('#chart_' + serverId).bind('plothover', handlePlotHover);
        }

        sortServers();
        updatePercentageBar();
	});

	socket.on('update', function(update) {
        // Prevent weird race conditions.
        if (!graphs[update.info.name]) {
            return;
		}

        // We have a new favicon, update the old one.
        if (update.result && update.result.favicon) {
            $('#favicon_' + serverRegistry.getOrAssign(update.info.name)).attr('src', update.result.favicon);
        }

		var graph = graphs[update.info.name];
		
		const serverId = serverRegistry.getOrAssign(update.info.name);
		pingTracker.handlePing(serverId, update);

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
        updateMojangServices(data);
    });

    socket.on('syncComplete', function() {
        hideCaption();
	});
	
	socket.on('updatePeak', function(data) {
		updateServerPeak(data.name, data.timestamp, data.players);
	});

	socket.on('peaks', function(data) {
		var keys = Object.keys(data);
		for (var i = 0; i < keys.length; i++) {
			var val = data[keys[i]];
			updateServerPeak(keys[i], val[0], val[1]);
		}
	});

    $(document).on('click', '.graph-control', function(e) {
        var serverIp = $(this).attr('data-target-network');

        // Restore it, or delete it - either works.
        if (!this.checked) {
            hiddenGraphData[serverIp] = displayedGraphData[serverIp];

            delete displayedGraphData[serverIp];
        } else {
            displayedGraphData[serverIp] = hiddenGraphData[serverIp];

            delete hiddenGraphData[serverIp];
        }

        // Redraw the graph
        historyPlot.setData(convertGraphData(displayedGraphData));
        historyPlot.setupGrid();

        historyPlot.draw();

        // Update our localStorage
        if (Object.keys(hiddenGraphData).length === 0) {
            resetGraphControls();
        } else {
            saveGraphControls(Object.keys(displayedGraphData));
        }
    });

    $(document).on('mousemove', function(e) {
        if (currentServerHover !== undefined) {
			var totalPlayers = pingTracker.getTotalPlayerCount();
			var playerCount = pingTracker.getPlayerCount(currentServerHover);
			var perc = Math.round((playerCount / totalPlayers) * 100 * 10) / 10;

			let serverName = serverRegistry.getName(currentServerHover);

            tooltip.set(e.pageX + 10, e.pageY + 10, '<strong>' + serverName + '</strong>: ' + perc + '% of ' + formatNumber(totalPlayers) + ' tracked players.<br />(' + formatNumber(playerCount) + ' online.)');
        }
    });

    $(window).on('resize', function() {
        updatePercentageBar();

        if (historyPlot) {
            historyPlot.resize();
            historyPlot.setupGrid();
            historyPlot.draw();
        }
    });
});
