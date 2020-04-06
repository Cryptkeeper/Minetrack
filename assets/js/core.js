class Tooltip {
	constructor() {
		this._div = $('#tooltip');
	}

	set(x, y, html) {
		this._div.html(html).css({
			top: y,
			left: x
		}).fadeIn(0);
	}

	hide = () => this._div.hide();
}

class Caption {
	constructor() {
		this._div = $('#tagline-text');
	}

	set(text) {
		this._div.text(text);
		this._div.show();
	}

	hide = () => this._div.hide();
}

class ServerRegistry {
	constructor() {
		this._serverIdsByName = [];
		this._serverNamesById = [];
		this._nextId = 0;
	}

	getServerIds = () => Object.keys(this._serverNamesById).map(Number);

	getOrAssign(name) {
		let serverId = this._serverIdsByName[name];
		if (serverId === undefined) {
			serverId = this._nextId++;
			this._serverIdsByName[name] = serverId;
			this._serverNamesById[serverId] = name;

			console.log('Assigning server name %s to id %d', name, serverId);
		}
		return serverId;
	}

	getServerName = (serverId) => this._serverNamesById[serverId];

	getServerColor(serverId) {
		const serverName = this.getServerName(serverId);
		for (let i = 0; i < publicConfig.servers.length; i++) {
			if (publicConfig.servers[i].name === serverName) {
				return publicConfig.servers[i].color;
			}
		}
		return stringToColor(name);
	}

	reset() {
		this._serverIdsByName = [];
		this._serverNamesById = [];
		this._nextId = 0;
	}
}

class PingTracker {
	constructor() {
		this._lastPlayerCounts = [];
		this._serverGraphs = [];
	}

	registerServerGraph(serverId, serverGraph) {
		this._serverGraphs[serverId] = serverGraph;
	}

	getServerGraph(serverId) {
		return this._serverGraphs[serverId];
	}

	handlePing(serverId, payload, pushToGraph) {
		if (payload.result) {
			const playerCount = payload.result.players.online;
			
			this._lastPlayerCounts[serverId] = playerCount;

			if (pushToGraph) {
				// Only update graph for successful pings
				// This intentionally pauses the server graph when pings begin to fail
				const serverGraph = this._serverGraphs[serverId];
				serverGraph.handlePing(payload.info.timestamp, playerCount);
			}
		} else {
			delete this._lastPlayerCounts[serverId];
		}
	}

	getPlayerCount(serverId) {
		return this._lastPlayerCounts[serverId] || 0;
	}

	getTotalPlayerCount = () => this._lastPlayerCounts.reduce((sum, current) => sum + current, 0);

	getActiveServerCount = () => this._lastPlayerCounts.length;

	reset() {
		this._lastPlayerCounts = [];
		this._serverGraphs = [];
	}
}

const SERVER_GRAPH_DATA_MAX_LENGTH = 72;

class ServerGraph {
	constructor(plotInstance) {
		this._plotInstance = plotInstance;
		this._graphData = [];
	}

	addGraphPoints(points)  {
		// The backend should never return more data elements than the max
		// but trim the data result regardless for safety and performance purposes
		if (points.length > SERVER_GRAPH_DATA_MAX_LENGTH) {
			points.slice(points.length - SERVER_GRAPH_DATA_MAX_LENGTH, points.length);
		}

		this._graphData = points.map(point => point.result ? [point.timestamp, point.result.players.online] : [point.timestamp, 0]);
	}

	handlePing(timestamp, playerCount) {
		// #handlePing should not be fired in bulk or by the constructor
		// Each #handlePing call redraws the flot.js plot instance
		this._graphData.push([timestamp, playerCount]);

		// Trim graphData to within the max length by shifting out the leading elements
		if (this._graphData.length > SERVER_GRAPH_DATA_MAX_LENGTH) {
			this._graphData.shift();
		}

		this.redrawIfNeeded();
	}

	redrawIfNeeded() {
		// Redraw the plot instance
		this._plotInstance.setData([this._graphData]);
		this._plotInstance.setupGrid();
		this._plotInstance.draw();
	}

	getPlayerCountDifference() {
		if (this._graphData.length >= 2) {
			// [1] refers to playerCount data index
			// See constructor for data structure initialization
			let oldestPlayerCount = this._graphData[0][1];
			let newestPlayerCount = this._graphData[this._graphData.length - 1][1];
			
			return newestPlayerCount - oldestPlayerCount;
		}
	}
}

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

	isGraphDataVisible = (serverId) => !this._hiddenServerIds.includes(serverId);

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

	redrawIfNeeded(graphInstance) {
		if (this._mustRedraw) {
			this._mustRedraw = false;

			// Fire calls to the provided graph instance
			// This allows flot.js to manage redrawing and creates a helper method to reduce code duplication
			graphInstance.setData(this.getVisibleGraphData());
			graphInstance.setupGrid();
			graphInstance.draw();
			
			// Return was redrawn for downstream context specific handling
			return true;
		}

		return false;
	}

	reset() {
		this._graphData = [];
		this._hiddenServerIds = [];
		this._hasLoadedSettings = false;
		this._mustRedraw = false;
	}
}