var historyPlot;

const tooltip = new Tooltip();
const caption = new Caption();

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
		let errorMessage = 'Unknown error';
		if (ping.error) {
			// Attempt to find an error cause from documented options
			errorMessage = ping.error.description || ping.error.errno || errorMessage;
		}
        div.html('<span class="color-red">' + errorMessage + '</span>');
    }

    $("#stat_totalPlayers").text(formatNumber(pingTracker.getTotalPlayerCount()));
    $("#stat_networks").text(formatNumber(pingTracker.getActiveServerCount()));

    if (ping.record) {
        $('#record_' + serverId).html('Record: ' + formatNumber(ping.record));
	}
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
    const parent = $('#perc-bar');
	let leftPadding = 0;
	
	serverRegistry.getServerIds().sort(function(a, b) {
			return pingTracker.getPlayerCount(a) - pingTracker.getPlayerCount(b);
		}).forEach(function(serverId) {
			let div = $('#perc_bar_part_' + serverId);

			// Test if an element has been previously created
			if (!div.length) {
				$('<div/>', {
					id: 'perc_bar_part_' + serverId,
					class: 'perc-bar-part',
					html: '',
					style: 'background: ' + serverRegistry.getServerColor(serverId) + ';'
				}).appendTo(parent);

				div = $('#perc_bar_part_' + serverId);

				// Define events once during creation
				div.mouseover(function() {
					const totalPlayers = pingTracker.getTotalPlayerCount();
					const playerCount = pingTracker.getPlayerCount(serverId);
					const serverName = serverRegistry.getServerName(serverId);

					const percentage = Math.round((playerCount / totalPlayers) * 100 * 10) / 10;
					const position = div.offset();

					tooltip.set(position.left + 10, position.top + parent.height() + 10, '<strong>' + serverName + '</strong>: ' + percentage + '% of ' + formatNumber(totalPlayers) + ' tracked players.<br />(' + formatNumber(playerCount) + ' online.)');
				});

				div.mouseout(tooltip.hide);
			}

			// Update position/width
			// leftPadding is a sum of previous iterations width value
			const totalPlayers = pingTracker.getTotalPlayerCount();
			const playerCount = pingTracker.getPlayerCount(serverId);
			const width = (playerCount / totalPlayers) * parent.width();

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

function updateServerPeak(serverId, time, playerCount) {
	const hourDuration = Math.floor(publicConfig.graphDuration / (60 * 60 * 1000));

	$('#peak_' + serverId).html(hourDuration + 'h Peak: ' + formatNumber(playerCount) + ' @ ' + getTimestamp(time));
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
	const plotInstance = $.plot('#chart_' + serverId, [], SERVER_GRAPH_OPTIONS);

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
	const socket = io.connect({
        reconnect: true,
        reconnectDelay: 1000,
        reconnectionAttempts: 10
    });

    socket.on('bootTime', function(data) {
		// Ensure the publicConfig object has been successfully requested
		if (!publicConfig || !publicConfig.bootTime) {
			caption.set('Failed to load configuration.');

			return;
		}

		// Compare the bootTime sent by the socket.io connection against the bootTime provided by publicConfig.json during initial page setup
		// This prevents outdated frontends from being reconnected to updated backend instances
		if (data !== publicConfig.bootTime) {
			caption.set('Your page is outdated or the system has been rebooted. Please refresh.');
		} else {
			caption.set('Loading...');

			// requestListing starts the data sync process
			socket.emit('requestListing');

			// Only emit graph data request if not on mobile due to graph data size
			if (!isMobileBrowser()) {
				socket.emit('requestHistoryGraph');
			}
		}
    });

    socket.on('disconnect', function() {
		caption.set('Disconnected! Please refresh.');
		
		// Reset individual tracker elements to flush any held data
		serverRegistry.reset();
		pingTracker.reset();
		graphDisplayManager.reset();

		// Reset HTML structures that have been generated during runtime
        $('#server-container-list').html('');

        $('#big-graph').html('');
        $('#big-graph-checkboxes').html('');
        $('#big-graph-controls').hide();

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

        historyPlot = $.plot('#big-graph', graphDisplayManager.getVisibleGraphData(), HISTORY_GRAPH_OPTIONS);

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

    socket.on('updateHistoryGraph', function(data) {
		const serverId = serverRegistry.getOrAssign(data.name);
		
		graphDisplayManager.addGraphPoint(serverId, data.timestamp, data.players);
		graphDisplayManager.redrawIfNeeded(historyPlot);
    });

	socket.on('add', function(data) {
		data.forEach(addServer);

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
		const keys = Object.keys(data);

		for (let i = 0; i < keys.length; i++) {
			const status = data[keys[i]];

			// hack: ensure mojang-status is added for alignment, replace existing class to swap status color
			$('#mojang-status_' + status.name).attr('class', 'mojang-status mojang-status-' + status.title.toLowerCase());
			$('#mojang-status-text_' + status.name).text(status.title);
		}
    });

    socket.on('syncComplete', function() {
		// Fired once the backend has sent all requested data
        caption.hide();
	});
	
	socket.on('updatePeak', function(data) {
		updateServerPeak(data.name, data.timestamp, data.players);
	});

	socket.on('peaks', function(data) {
		const keys = Object.keys(data);

		keys.forEach(function(serverName) {
			const serverId = serverRegistry.getOrAssign(serverName);
			const graphData = data[serverName];

			// [0] and [1] indexes correspond to flot.js' graphing data structure
			updateServerPeak(serverId, graphData[0], graphData[1]);
		});
	});

    $(document).on('click', '.graph-control', function() {
		const serverId = parseInt($(this).attr('minetrack-server-id'));

		graphDisplayManager.setGraphDataVisible(serverId, this.checked);
		graphDisplayManager.redrawIfNeeded(historyPlot);
	});
	
	let graphResizeTask;

    $(window).on('resize', function() {
		updatePercentageBar();
		
		// Only resize historyPlot when defined
		// Set a timeout to resize after resize events have not been fired for some duration of time
		// This prevents burning CPU time for multiple, rapid resize events
		if (historyPlot) {
			if (graphResizeTask) {
				clearTimeout(graphResizeTask);
			}

			graphResizeTask = setTimeout(function() {
				historyPlot.resize();
				historyPlot.setupGrid();
				historyPlot.draw();

				// undefine value so #clearTimeout is not called
				graphResizeTask = undefined;
			}, 200);
		}
	});
	
	// Run the sortServers loop even if the frontend has not connected to the backend
	// It will safely handle the empty data and simplifies state logic
	setInterval(sortServers, 10000);
});
