const tooltip = new Tooltip();
const caption = new Caption();

const serverRegistry = new ServerRegistry();
const graphDisplayManager = new GraphDisplayManager();

let publicConfig;

function updateServerStatus(serverId, ping, initialUpdate) {
	const serverGraph = serverRegistry.getServerGraph(serverId);

	// Only pushToGraph when initialUpdate === false
	// Otherwise the ping value is pushed into the graphData when already present
	serverGraph.handlePing(ping, !initialUpdate);
	
	// Remap version indexes into their formatted name equivalents
    if (ping.versions) {
		const versionNames = ping.versions.map(version => {
				const versionName = publicConfig.minecraftVersions[ping.info.type][version];
				return versionName;
			}).join(' ');

		document.getElementById('version_' + serverId).innerHTML = versionNames;
    } else {
		document.getElementById('version_' + serverId).innerHTML = '';
	}
	
	if (ping.record) {
		document.getElementById('record_' + serverId).innerText = 'Record: ' + formatNumber(ping.record);
	}

	let statusHTML;

    if (ping.result) {
		statusHTML = 'Players: <span class="server-player-count">' + formatNumber(ping.result.players.online) + '</span>';

		// If the data is defined, generate a player count difference and append
		const playerCountDifference = serverGraph.getPlayerCountDifference();

		if (playerCountDifference !== undefined) {
            statusHTML += '<span class="server-player-count-diff"> (' + (playerCountDifference >= 0 ? '+' : '') + formatNumber(playerCountDifference) + ')</span>';
		}
		
		// An updated favicon has been sent, update the src
		// Ignore calls from 'add' events since they will have explicitly manually handled the favicon update
		if (!initialUpdate && ping.result.favicon) {
			document.getElementById('favicon_' + serverId).setAttribute('src', ping.result.favicon);
		}
    } else {
		let errorMessage = 'Unknown error';
		if (ping.error) {
			// Attempt to find an error cause from documented options
			errorMessage = ping.error.description || ping.error.errno || errorMessage;
		}
		statusHTML = '<span class="server-error-message">' + errorMessage + '</span>';
	}

	document.getElementById('status_' + serverId).innerHTML = statusHTML;
}

function updateGlobalStats() {
	document.getElementById('stat_totalPlayers').innerText = formatNumber(serverRegistry.getTotalPlayerCount());
	document.getElementById('stat_networks').innerText = formatNumber(serverRegistry.getActiveServerCount());
}

function sortServers() {
	serverRegistry.getServerIds().sort(function(a, b) {
			return serverRegistry.getPlayerCount(b) - serverRegistry.getPlayerCount(a);
		}).forEach(function(serverId, i) {
			$('#server_' + serverId).appendTo('#server-list');

			document.getElementById('ranking_' + serverId).innerText = '#' + (i + 1);
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

	document.getElementById('peak_' + serverId).innerText = hourDuration + 'h Peak: ' + formatNumber(playerCount) + ' @ ' + getTimestamp(time);
}

function addServer(serverData) {
	// Even if the backend has never pinged the server, the frontend is promised a placeholder object.
	// result = undefined
	// error = defined with "Waiting" description
	// info = safely defined with configured data
	const ping = serverData[serverData.length - 1];

	const serverId = serverRegistry.getOrCreateId(ping.info.name);

	// Conditional formatting given configuration
	let typeMarker = '';
	if (publicConfig.serverTypesVisible) {
		typeMarker = '<span class="server-type">' + ping.info.type + '</span>';
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
		html: '<div id="server-' + serverId + '" class="column column-favicon">\
					<img class="server-favicon" src="' + favicon + '" id="favicon_' + serverId + '" title="' + ping.info.name + '\n' + formatMinecraftServerAddress(ping.info.ip, ping.info.port) + '">\
					<span class="server-rank" id="ranking_' + serverId + '"></span>\
				</div>\
				<div class="column column-status">\
					<h3 class="server-name">' + ping.info.name + typeMarker + '</h3>\
					<span id="status_' + serverId + '"></span>\
					<span class="server-versions" id="version_' + serverId + '"></span>\
					<span class="server-peak" id="peak_' + serverId + '"></span>\
					<span class="server-record" id="record_' + serverId + '"></span>\
				</div>\
				<div class="column column-graph" id="chart_' + serverId + '"></div>'
	}).appendTo("#server-list");

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

	// The backend will automatically push data once connected
    socket.on('connect', function() {
		caption.set('Loading...');

		// Only emit graph data request if not on mobile due to graph data size
		if (!isMobileBrowser()) {
			socket.emit('requestHistoryGraph');
		}
    });

    socket.on('disconnect', function() {
		caption.set('Disconnected! Please refresh.');
		
		// Reset individual tracker elements to flush any held data
		serverRegistry.reset();
		graphDisplayManager.reset();

		// Reset HTML structures that have been generated during runtime
		document.getElementById('server-list').innerHTML = '';
		document.getElementById('big-graph-checkboxes').innerHTML = '';
		document.getElementById('perc-bar').innerHTML = '';
		document.getElementById('big-graph-controls').style.display = 'none';
		
		const graphElement = document.getElementById('big-graph');
		graphElement.innerHTML = '';
		graphElement.removeAttribute('style');
		
		// Strip any mojang-status-* color classes from all mojang-status classes
		const mojangStatusElements = document.getElementsByClassName('mojang-status');
		for (let i = 0; i < mojangStatusElements.length; i++) {
			mojangStatusElements[i].setAttribute('class', 'mojang-status');
		}

		const mojangStatusTextElements = document.getElementsByClassName('mojang-status-text');
		for (let i = 0; i < mojangStatusTextElements.length; i++) {
			mojangStatusTextElements[i].innerText = '...';
		}

		document.getElementById('stat_totalPlayers').innerText = 0;
		document.getElementById('stat_networks').innerText = 0;

		// Undefine publicConfig, resynced during the connection handshake
		publicConfig = undefined;
    });

    socket.on('historyGraph', function(data) {
		graphDisplayManager.setGraphData(data);

		// Explicitly define a height so flot.js can rescale the Y axis
		document.getElementById('big-graph').style.height = '400px';
		
		$('#big-graph').bind('plothover', handlePlotHover);

		graphDisplayManager.buildPlotInstance();

		// Build checkbox elements for graph controls
		let lastRowCounter = 0;
		let controlsHTML = '<table><tr>';

		Object.keys(data).sort().forEach(function(serverName) {
			const serverId = serverRegistry.getOrCreateId(serverName);
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
		document.getElementById('big-graph-checkboxes').innerHTML = controlsHTML;
		document.getElementById('big-graph-controls').style.display = 'block';
    });

    socket.on('updateHistoryGraph', function(data) {
		const serverId = serverRegistry.getOrCreateId(data.name);
		
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
		const serverId = serverRegistry.getOrCreateId(data.info.name);

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
			document.getElementById('mojang-status_' + status.name).setAttribute('class', 'mojang-status mojang-status-' + status.title.toLowerCase());
			document.getElementById('mojang-status-text_' + status.name).innerText = status.title;
		});
	});
	
	socket.on('setPublicConfig', function(data) {
		publicConfig = data;
	});

    socket.on('syncComplete', function() {
		// Fired once the backend has sent all requested data
        caption.hide();
	});
	
	socket.on('updatePeak', function(data) {
		const serverId = serverRegistry.getOrCreateId(data.name);

		updateServerPeak(serverId, data.timestamp, data.players);
	});

	socket.on('peaks', function(data) {
		const keys = Object.keys(data);

		keys.forEach(function(serverName) {
			const serverId = serverRegistry.getOrCreateId(serverName);
			const graphData = data[serverName];

			// [0] and [1] indexes correspond to flot.js' graphing data structure
			updateServerPeak(serverId, graphData[0], graphData[1]);
		});
	});

    $(document).on('click', '.graph-control', function() {
		const serverId = parseInt(this.getAttribute('minetrack-server-id'));

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
