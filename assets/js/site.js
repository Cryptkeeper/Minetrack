const tooltip = new Tooltip();
const caption = new Caption();

const serverRegistry = new ServerRegistry();
const graphDisplayManager = new GraphDisplayManager();

function updateServerStatus(serverId, ping, initialUpdate) {
	const serverGraph = serverRegistry.getServerGraph(serverId);

	// Only pushToGraph when initialUpdate === false
	// Otherwise the ping value is pushed into the graphData when already present
	serverGraph.handlePing(ping, !initialUpdate);
	
	// Remap version indexes into their formatted name equivalents
    if (ping.versions) {
		const versionNames = ping.versions.map(version => {
				const versionName = publicConfig.minecraftVersions[ping.info.type][version];
				return '<span class="version">' + versionName + '</span>';
			}).join('&nbsp');
			
		$('#version_' + serverId).html(versionNames);
    } else {
		$('#version_' + serverId).empty();
	}
	
	if (ping.record) {
        $('#record_' + serverId).text('Record: ' + formatNumber(ping.record));
	}

	let statusHTML;

    if (ping.result) {
		statusHTML = 'Players: <span style="font-weight: 500;">' + formatNumber(ping.result.players.online) + '</span>';

		// If the data is defined, generate a player count difference and append
		const playerCountDifference = serverGraph.getPlayerCountDifference();

		if (playerCountDifference !== undefined) {
            statusHTML += '<span class="color-gray"> (' + (playerCountDifference >= 0 ? '+' : '') + formatNumber(playerCountDifference) + ')</span>';
		}
		
		// An updated favicon has been sent, update the src
		// Ignore calls from 'add' events since they will have explicitly manually handled the favicon update
		if (!initialUpdate && ping.result.favicon) {
			$('#favicon_' + serverId).attr('src', ping.result.favicon);
		}
    } else {
		let errorMessage = 'Unknown error';
		if (ping.error) {
			// Attempt to find an error cause from documented options
			errorMessage = ping.error.description || ping.error.errno || errorMessage;
		}
		statusHTML = '<span class="color-red">' + errorMessage + '</span>';
	}
	
	$('#status_' + serverId).html(statusHTML);
}

function updateGlobalStats() {
	$('#stat_totalPlayers').text(formatNumber(serverRegistry.getTotalPlayerCount()));
    $('#stat_networks').text(formatNumber(serverRegistry.getActiveServerCount()));
}

function sortServers() {
	serverRegistry.getServerIds().sort(function(a, b) {
			return serverRegistry.getPlayerCount(b) - serverRegistry.getPlayerCount(a);
		}).forEach(function(serverId, i) {
			$('#container_' + serverId).appendTo('#server-container-list');
			$('#ranking_' + serverId).text('#' + (i + 1));
		});
}

function updatePercentageBar() {
    const parent = $('#perc-bar');
	let leftPadding = 0;
	
	serverRegistry.getServerIds().sort(function(a, b) {
			return serverRegistry.getPlayerCount(a) - serverRegistry.getPlayerCount(b);
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
					const totalPlayers = serverRegistry.getTotalPlayerCount();
					const playerCount = serverRegistry.getPlayerCount(serverId);
					const serverName = serverRegistry.getServerName(serverId);

					const percentage = Math.round((playerCount / totalPlayers) * 100 * 10) / 10;
					const position = div.offset();

					tooltip.set(position.left + 10, position.top + parent.height() + 10, '<strong>' + serverName + '</strong><br>' + formatNumber(playerCount) + ' Players<br><em>' + percentage + '%</em>');
				});

				div.mouseout(tooltip.hide);
			}

			// Update position/width
			// leftPadding is a sum of previous iterations width value
			const totalPlayers = serverRegistry.getTotalPlayerCount();
			const playerCount = serverRegistry.getPlayerCount(serverId);
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

    if (graphDisplayManager.redrawIfNeeded()) {
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
	let favicon = '/images/missing_favicon.png';
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

	// Register into serverRegistry for downstream referencing
	serverRegistry.registerServerGraph(serverId, serverGraph);

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
		graphDisplayManager.reset();

		// Reset HTML structures that have been generated during runtime
		$('#server-container-list').empty();
        $('#big-graph').empty();
        $('#big-graph-checkboxes').empty();
        $('#big-graph-controls').empty();
		$('#perc-bar').empty();
		
		// Strip any mojang-status-* color classes from all mojang-status classes
		$('.mojang-status').attr('class', 'mojang-status');
		$('.mojang-status-text').text('...');
		
        $('#stat_totalPlayers').text(0);
        $('#stat_networks').text(0);
    });

    socket.on('historyGraph', function(data) {
		graphDisplayManager.setGraphData(data);

		// Explicitly define a height so flot.js can rescale the Y axis
		$('#big-graph').css('height', '400px');
		$('#big-graph').bind('plothover', handlePlotHover);

		graphDisplayManager.buildPlotInstance();

		// Build checkbox elements for graph controls
		let lastRowCounter = 0;
		let controlsHTML = '<table><tr>';

		Object.keys(data).sort().forEach(function(serverName) {
			const serverId = serverRegistry.getOrAssign(serverName);
			const isChecked = graphDisplayManager.isGraphDataVisible(serverId);

			controlsHTML += '<td>\
				<input type="checkbox" class="graph-control" minetrack-server-id="' + serverId + '" checked="' + isChecked + '">\
				' + serverName + '\
				</input></td>';

			// Occasionally break table rows using a magic number
			if (lastRowCounter++ >= 7) {
				lastRowCounter = 0;

				controlsHTML += '</tr><tr>';
			}
		});

		controlsHTML += '</tr></table>';

		// Apply generated HTML and show controls
        $('#big-graph-checkboxes').html(controlsHTML);
		$('#big-graph-controls').show();
    });

    socket.on('updateHistoryGraph', function(data) {
		const serverId = serverRegistry.getOrAssign(data.name);
		
		graphDisplayManager.addGraphPoint(serverId, data.timestamp, data.players);
		graphDisplayManager.redrawIfNeeded();
    });

	socket.on('add', function(data) {
		data.forEach(addServer);

		// Run a single bulk update to externally managed elements
        sortServers();
		updatePercentageBar();
		updateGlobalStats();
	});

	socket.on('update', function(data) {
		const serverId = serverRegistry.getOrAssign(data.info.name);

		// The backend may send "update" events prior to receiving all "add" events
		// A server has only been added once it's ServerGraph is defined
		// Checking undefined protects from this race condition
		if (serverRegistry.getServerGraph(serverId) !== undefined) {
			updateServerStatus(serverId, data, false);

			updatePercentageBar();
			updateGlobalStats();
		}
	});

	socket.on('updateMojangServices', function(data) {
		Object.keys(data).forEach(function(key) {
			const status = data[key];

			// HACK: ensure mojang-status is added for alignment, replace existing class to swap status color
			$('#mojang-status_' + status.name).attr('class', 'mojang-status mojang-status-' + status.title.toLowerCase());
			$('#mojang-status-text_' + status.name).text(status.title);
		});
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
		graphDisplayManager.redrawIfNeeded();
	});

    $(window).on('resize', function() {
		updatePercentageBar();

		// Delegate to GraphDisplayManager which can check if the resize is necessary
		graphDisplayManager.handleResizeRequest();
	});
	
	// Run the sortServers loop even if the frontend has not connected to the backend
	// It will safely handle the empty data and simplifies state logic
	setInterval(sortServers, 10000);
});
