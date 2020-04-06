var historyPlot;

var sortServersTask;

const tooltip = new Tooltip();

const serverRegistry = new ServerRegistry();
const pingTracker = new PingTracker();
const graphDisplayManager = new GraphDisplayManager();

function updateServerStatus(serverId, ping, isAddEvent) {
	// Only pushTograph when isAddedEvent == false
	pingTracker.handlePing(serverId, ping, !isAddEvent);
	
    var div = $('#status_' + serverId);
    var versionDiv = $('#version_' + serverId);

    if (ping.versions) {
        var versions = '';

        for (var i = 0; i < ping.versions.length; i++) {
            if (!ping.versions[i]) continue;
            versions += '<span class="version">' + publicConfig.minecraftVersions[ping.info.type][ping.versions[i]] + '</span>&nbsp;';
        }

        versionDiv.html(versions);
    } else {
        versionDiv.html('');
    }

    if (ping.result) {
        var result = ping.result;
        var newStatus = 'Players: <span style="font-weight: 500;">' + formatNumber(result.players.online) + '</span>';

		const serverGraph = pingTracker.getServerGraph(serverId);
		const playerCountDifference = serverGraph.getPlayerCountDifference();

		if (playerCountDifference !== undefined) {
            newStatus += '<span class="color-gray"> (';
            if (playerCountDifference >= 0) {
                newStatus += '+';
            }
            newStatus += playerCountDifference + ')</span>';
        }

		div.html(newStatus);
		
		// An updated favicon has been sent, update the src
		// Ignore calls from 'add' events since they will have explicitly manually handled the favicon update
		if (!isAddEvent && ping.result.favicon) {
			$('#favicon_' + serverId).attr('src', ping.result.favicon);
		}
    } else {
        var newStatus = '<span class="color-red">';

        if (findErrorMessage(ping.error)) {
            newStatus += findErrorMessage(ping.error);
        } else {
            newStatus += 'Failed to ping!';
        }

        div.html(newStatus + '</span>');
    }

    $("#stat_totalPlayers").text(formatNumber(pingTracker.getTotalPlayerCount()));
    $("#stat_networks").text(formatNumber(pingTracker.getActiveServerCount()));

    if (ping.record) {
        $('#record_' + serverId).html('Record: ' + formatNumber(ping.record));
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
					var totalPlayers = pingTracker.getTotalPlayerCount();
					var playerCount = pingTracker.getPlayerCount(serverId);
					var perc = Math.round((playerCount / totalPlayers) * 100 * 10) / 10;

					let serverName = serverRegistry.getName(serverId);

					let position = div.offset();

					tooltip.set(position.left + 10, position.top + parent.height() + 10, '<strong>' + serverName + '</strong>: ' + perc + '% of ' + formatNumber(totalPlayers) + ' tracked players.<br />(' + formatNumber(playerCount) + ' online.)');
				});

				div.mouseout(function() {
					tooltip.hide();
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
	graphDisplayManager.setAllGraphDataVisible(visible);

    if (graphDisplayManager.redrawIfNeeded(historyPlot)) {
		$('.graph-control').each(function(index, item) {
			item.checked = visible;
		});
	}
}

function validateBootTime(bootTime, socket) {
    $('#tagline-text').text('Validating...');

    console.log('Remote bootTime is ' + bootTime + ', local is ' + publicConfig.bootTime);

    if (bootTime === publicConfig.bootTime) {
        $('#tagline-text').text('Loading...');

        socket.emit('requestListing');

        if (!isMobileBrowser()) {
			socket.emit('requestHistoryGraph');
		}

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

function addServer(serverData) {
	// Even if the backend has never pinged the server, the frontend is promised a placeholder object.
	// result = undefined
	// error = defined with "Waiting" description
	// info = safely defined with configured data
	const ping = serverData[serverData.length - 1];

	const serverId = serverRegistry.getOrAssign(ping.info.name);

	// Conditional formatting given configuration
	let typeMarker = '';
	if (publicConfig.serverTypesVisible) {
		typeMarker = '<span class="type">' + ping.info.type + '</span>';
	}

	// Safely default to a missing placeholder if not present
	// If a favicon is later provided in an update, it will be handled by #updateServerStatus
	let favicon = MISSING_FAVICON_BASE64;
	if (ping.result && ping.result.favicon) {
		favicon = ping.result.favicon;
	}

	// Build a placeholder element with empty data first
	$('<div/>', {
		id: 'container_' + serverId,
		class: 'server',
		'server-id': serverId,
		html: '<div id="server-' + serverId + '" class="column" style="width: 80px;">\
					<img class="server-favicon" src="' + favicon + '" id="favicon_' + serverId + '" title="' + ping.info.name + '\n' + formatMinecraftServerAddress(ping.info.ip, ping.info.port) + '">\
					<br />\
					<p class="text-center-align rank" id="ranking_' + serverId + '"></p>\
				</div>\
				<div class="column" style="width: 282px;">\
					<h3>' + ping.info.name + '&nbsp;' + typeMarker + '</h3>\
					<span id="status_' + serverId + '">Waiting</span>\
					<div id="version_' + serverId + '" class="color-dark-gray server-meta versions"><span class="version"></span></div>\
					<span id="peak_' + serverId + '" class="color-dark-gray server-meta"></span>\
					<br><span id="record_' + serverId + '" class="color-dark-gray server-meta"></span>\
				</div>\
				<div class="column" style="float: right;">\
					<div class="chart" id="chart_' + serverId + '"></div>\
				</div>'
	}).appendTo("#server-container-list");

	// Create an empty plot instance
	const plotInstance = $.plot('#chart_' + serverId, [], smallChartOptions);

	$('#chart_' + serverId).bind('plothover', handlePlotHover);

	// Populate and redraw the ServerGraph
	const serverGraph = new ServerGraph(plotInstance);

	serverGraph.addGraphPoints(serverData);
	serverGraph.redrawIfNeeded();

	// Register into pingTracker for downstream referencing
	pingTracker.registerServerGraph(serverId, serverGraph);

	// Handle the last known state (if any) as an incoming update
	// This triggers the main update pipeline and enables centralized update handling
	updateServerStatus(serverId, ping, true);
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
		graphDisplayManager.reset();

        $('#server-container-list').html('');

        $('#big-graph').html('');
        $('#big-graph-checkboxes').html('');
        $('#big-graph-controls').css('display', 'none');

        $('#perc-bar').html('');
        $('.mojang-status').css('background', 'transparent');
        $('.mojang-status-text').text('...');

        $("#stat_totalPlayers").text(0);
        $("#stat_networks").text(0);
    });

	// TODO: var naming
    socket.on('historyGraph', function(rawData) {
		graphDisplayManager.setGraphData(rawData);

		$('#big-graph').css('height', '400px');

        historyPlot = $.plot('#big-graph', graphDisplayManager.getVisibleGraphData(), bigChartOptions);

        $('#big-graph').bind('plothover', handlePlotHover);

        var keys = Object.keys(rawData);

        var sinceBreak = 0;
        var html = '<table><tr>';

		keys.sort();

        for (var i = 0; i < keys.length; i++) {
			const serverId = serverRegistry.getOrAssign(keys[i]);

			var checkedString = '';

            if (graphDisplayManager.isGraphDataVisible(serverId, 'checkboxes')) {
                checkedString = 'checked=checked';
            }

            html += '<td><input type="checkbox" class="graph-control" id="graph-controls" minetrack-server-id="' + serverId + '" ' + checkedString + '> ' + keys[i] + '</input></td>';

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

    socket.on('updateHistoryGraph', function(update) {
		const serverId = serverRegistry.getOrAssign(update.name);
		
		graphDisplayManager.addGraphPoint(serverId, update.timestamp, update.players);
		graphDisplayManager.redrawIfNeeded(historyPlot);
    });

	socket.on('add', function(servers) {
		servers.forEach(addServer);

		// Run a single bulk update to externally managed elements
        sortServers();
        updatePercentageBar();
	});

	socket.on('update', function(data) {
		const serverId = serverRegistry.getOrAssign(data.info.name);

		// The backend may send "update" events prior to receiving all "add" events
		// A server has only been added once it's ServerGraph is defined
		// Checking undefined protects from this race condition
		if (pingTracker.getServerGraph(serverId) !== undefined) {
			updateServerStatus(serverId, data, false);

			updatePercentageBar();
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

    $(document).on('click', '.graph-control', function() {
		const serverId = parseInt($(this).attr('minetrack-server-id'));

		graphDisplayManager.setGraphDataVisible(serverId, this.checked);
		graphDisplayManager.redrawIfNeeded(historyPlot);
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
