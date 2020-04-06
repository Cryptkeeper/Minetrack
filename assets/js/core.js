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
		this._serverGraphs = [];
	}

	getServerIds = () => Object.keys(this._serverNamesById).map(Number);

	getOrAssign(name) {
		let serverId = this._serverIdsByName[name];
		if (serverId === undefined) {
			serverId = this._nextId++;
			this._serverIdsByName[name] = serverId;
			this._serverNamesById[serverId] = name;
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

	registerServerGraph(serverId, serverGraph) {
		this._serverGraphs[serverId] = serverGraph;
	}

	getServerGraph(serverId) {
		return this._serverGraphs[serverId];
	}

	// Helper method for safely defaulting value to 0
	getPlayerCount(serverId) {
		const serverGraph = this._serverGraphs[serverId];
		if (!serverGraph) return 0;
		return serverGraph._lastPlayerCount || 0;
	}

	getTotalPlayerCount() {
		return this._serverGraphs.map(serverGraph => serverGraph._lastPlayerCount)
			.filter(playerCount => playerCount !== undefined)
			.reduce((sum, current) => sum + current, 0);
	}

	getActiveServerCount() {
		return this._serverGraphs.map(serverGraph => serverGraph._lastPlayerCount)
			.filter(playerCount => playerCount !== undefined)
			.length;
	}

	reset() {
		this._serverIdsByName = [];
		this._serverNamesById = [];
		this._nextId = 0;
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
		// Test if the first point contains error.placeholder === true
		// This is sent by the backend when the server hasn't been pinged yet
		// These points will be disregarded to prevent the graph starting at 0 player count
		points = points.filter(point => !point.error || !point.error.placeholder);

		// The backend should never return more data elements than the max
		// but trim the data result regardless for safety and performance purposes
		if (points.length > SERVER_GRAPH_DATA_MAX_LENGTH) {
			points.slice(points.length - SERVER_GRAPH_DATA_MAX_LENGTH, points.length);
		}

		this._graphData = points.map(point => point.result ? [point.timestamp, point.result.players.online] : [point.timestamp, 0]);
	}

	handlePing(payload, pushToGraph) {
		if (payload.result) {
			this._lastPlayerCount = payload.result.players.online;

			if (pushToGraph) {
				// Only update graph for successful pings
				// This intentionally pauses the server graph when pings begin to fail
				this._graphData.push([payload.info.timestamp, this._lastPlayerCount]);

				// Trim graphData to within the max length by shifting out the leading elements
				if (this._graphData.length > SERVER_GRAPH_DATA_MAX_LENGTH) {
					this._graphData.shift();
				}

				this.redrawIfNeeded();
			}
		} else {
			this._lastPlayerCount = undefined;
		}
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