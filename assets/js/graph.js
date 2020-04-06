const SERVER_GRAPH_OPTIONS = {
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

const HISTORY_GRAPH_OPTIONS = {
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
        show: true,
        tickSize: 2000,
        tickLength: 10,
        tickFormatter: function(value) {
            return formatNumber(value);
        },
        font: {
            color: "#E3E3E3"
        },
        labelWidth: -5,
        min: 0
    },
    grid: {
        hoverable: true,
        color: "#696969"
    },
    legend: {
        show: false
    }
};

const HIDDEN_SERVERS_STORAGE_KEY = 'minetrack_hidden_servers';

class GraphDisplayManager {
	constructor() {
		this._graphData = [];
		this._hiddenServerIds = [];
		this._hasLoadedSettings = false;
		this._mustRedraw = false;
	}

	addGraphPoint(serverId, timestamp, playerCount) {
		if (!this._hasLoadedSettings) {
			// _hasLoadedSettings is controlled by #setGraphData
			// It will only be true once the context has been loaded and initial payload received
			// #addGraphPoint should not be called prior to that since it means the data is racing
			// and the application has received updates prior to the initial state
			return;
		}

		// Trim any outdated entries by filtering the array into a new array
		const startTimestamp = new Date().getTime();
		const newGraphData = this._graphData[serverId].filter(point => startTimestamp - point[0] <= publicConfig.graphDuration);

		// Push the new data from the method call request
		newGraphData.push([timestamp, playerCount]);

		this._graphData[serverId] = newGraphData;

		// Mark mustRedraw flag if the updated graphData is to be rendered
		if (this.isGraphDataVisible(serverId)) {
			this._mustRedraw = true;
		}
	}

	setGraphDataVisible(serverId, visible) {
		const indexOf = this._hiddenServerIds.indexOf(serverId);

		if (!visible && indexOf < 0) {
			this._hiddenServerIds.push(serverId);
			this._mustRedraw = true;
		} else if (visible && indexOf >= 0) {
			this._hiddenServerIds.splice(indexOf, 1);
			this._mustRedraw = true;
		}

		// Use mustRedraw as a hint to update settings
		// This may cause unnessecary localStorage updates, but its a rare and harmless outcome
		if (this._mustRedraw) {
			this.updateLocalStorage();
		}
	}

	setAllGraphDataVisible(visible) {
		if (visible && this._hiddenServerIds.length > 0) {
			this._hiddenServerIds = [];
			this._mustRedraw = true;
		} else if (!visible) {
			this._hiddenServerIds = Object.keys(this._graphData).map(Number);
			this._mustRedraw = true;
		}

		// Use mustRedraw as a hint to update settings
		// This may cause unnessecary localStorage updates, but its a rare and harmless outcome
		if (this._mustRedraw) {
			this.updateLocalStorage();
		}
	}

	setGraphData(graphData) {
		// Lazy load settings from localStorage, if any and if enabled
		if (!this._hasLoadedSettings) {
			this._hasLoadedSettings = true;

			this.loadLocalStorage();
		}

		const keys = Object.keys(graphData);

		for (let i = 0; i < keys.length; i++) {
			const serverName = keys[i];
			const serverId = serverRegistry.getOrAssign(serverName);
			this._graphData[serverId] = graphData[serverName];
		}

		// This isn't nessecary since #setGraphData is manually called, but it ensures
		// consistent behavior which will make any future changes easier.
		this._mustRedraw = true;
	}

	loadLocalStorage() {
		if (typeof(localStorage)) {
			let serverNames = localStorage.getItem(HIDDEN_SERVERS_STORAGE_KEY);
			if (serverNames) {
				serverNames = JSON.parse(serverNames);

				// Mutate the server name array into serverIds for active use
				this._hiddenServerIds = [...new Set(serverNames.map(serverName => serverRegistry.getOrAssign(serverName)))];
			}
		}
	}

	updateLocalStorage() {
		if (typeof(localStorage)) {
			// Mutate the serverIds array into server names for storage use
			const serverNames = [...new Set(this._hiddenServerIds.map(serverRegistry.getServerName))];

			if (serverNames.length > 0) {
				// Only save if the array contains data, otherwise clear the item
				localStorage.setItem(HIDDEN_SERVERS_STORAGE_KEY, JSON.stringify(serverNames));
			} else {
				localStorage.removeItem(HIDDEN_SERVERS_STORAGE_KEY);
			}
		}
	}

	isGraphDataVisible(serverId) {
		return !this._hiddenServerIds.includes(serverId);
	}
	
	// Converts the backend data into the schema used by flot.js
	getVisibleGraphData() {
		const keys = Object.keys(this._graphData).map(Number);
		const visibleGraphData = [];

		for (let i = 0; i < keys.length; i++) {
			const serverId = keys[i];

			if (this.isGraphDataVisible(serverId)) {
				visibleGraphData.push({
					data: this._graphData[serverId],
					yaxis: 1,
					label: serverRegistry.getServerName(serverId),
					color: serverRegistry.getServerColor(serverId)
				});
			}
		}

		return visibleGraphData;
	}

	buildPlotInstance() {
		this._plotInstance = $.plot('#big-graph', this.getVisibleGraphData(), HISTORY_GRAPH_OPTIONS);
	}

	redrawIfNeeded() {
		if (this._mustRedraw) {
			this._mustRedraw = false;

			// Fire calls to the provided graph instance
			// This allows flot.js to manage redrawing and creates a helper method to reduce code duplication
			this._plotInstance.setData(this.getVisibleGraphData());
			this._plotInstance.setupGrid();
			this._plotInstance.draw();
			
			// Return was redrawn for downstream context specific handling
			return true;
		}

		return false;
	}

	handleResizeRequest() {
		// Only resize when _plotInstance is defined
		// Set a timeout to resize after resize events have not been fired for some duration of time
		// This prevents burning CPU time for multiple, rapid resize events
		if (this._plotInstance) {
			if (this._resizeRequestTimeout) {
				clearTimeout(this._resizeRequestTimeout);
			}

			// Schedule new delayed resize call
			// This can be cancelled by #handleResizeRequest, #resize and #reset
			this._resizeRequestTimeout = setTimeout(this.resize, 200);
		}
	}

	resize = () => {
		if (this._plotInstance) {
			this._plotInstance.resize();
			this._plotInstance.setupGrid();
			this._plotInstance.draw();
		}

		// undefine value so #clearTimeout is not called
		// This is safe even if #resize is manually called since it removes the pending work
		this._resizeRequestTimeout = undefined;
	}

	reset() {
		this._graphData = [];
		this._hiddenServerIds = [];
		this._hasLoadedSettings = false;
		this._mustRedraw = false;
		this._plotInstance = undefined;

		// Fire #clearTimeout if the timeout is currently defined
		if (this._resizeRequestTimeout) {
			clearTimeout(this._resizeRequestTimeout);
			this._resizeRequestTimeout = undefined;
		}
	}
}

// Called by flot.js when they hover over a data point.
function handlePlotHover(event, pos, item) {
	if (!item) {
		tooltip.hide();
	} else {
		let text = formatNumber(item.datapoint[1]) + ' Players<br>' + getTimestamp(item.datapoint[0]);
		if (item.series && item.series.label) {
			// Prefix text with the series label when possible
			text = '<strong>' + item.series.label + '</strong><br>' + text;
		}
		tooltip.set(item.pageX + 5, item.pageY + 5, text);
	}
}