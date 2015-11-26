var minepack = angular.module('minepack', ['angular-flot']);

minepack.service('socket', function($rootScope){
	var self = this;
	var socket = io.connect();

	self.status = {
		connected: false,
		connecting: true,
		verb: 'connecting'
	}

	self.mojang = false;

	self.servers = {};

	socket.on('connect', function(){
		self.status.connected = true;
		self.status.connecting = false;
		$rootScope.$apply();
	});
	socket.on('reconnect', function(){
		self.status.connecting = false;
		self.status.connected = true;
		$rootScope.$apply();
	});
	socket.on('reconnecting', function(){
		self.status.connecting = true;
		$rootScope.$apply();
	});
	socket.on('disconnect', function(){
		self.status.connected = false
		$rootScope.$apply();
	});

	var handleUpdate = function(data, preventDigest){
		preventDigest = preventDigest || false;
		if(!self.servers[safeName(data.info.name)]){
			return; // maybe retry later, race condition?
		}
		self.servers[safeName(data.info.name)].error = false;
		if(data.error){
			self.servers[safeName(data.info.name)].error = data.error;
		}
        var players = 0;
		//self.servers[safeName(data.info.name)].updates.push(data);
		if(data.result){
			if(self.servers[safeName(data.info.name)].favicon !== data.result.favicon){
				self.servers[safeName(data.info.name)].favicon = data.result.favicon
			}
			var lastCount = 0;
			if(self.servers[safeName(data.info.name)].players){
				players = lastCount = self.servers[safeName(data.info.name)].players;
			}
			self.servers[safeName(data.info.name)].players = data.result.players.online;
			self.servers[safeName(data.info.name)].playerDiff = formatNumber(lastCount - self.servers[safeName(data.info.name)].players);
			if(self.servers[safeName(data.info.name)].playerDiff > 0){
				self.servers[safeName(data.info.name)].playerDiff = "+" + self.servers[safeName(data.info.name)].playerDiff;
			}
		}
		self.servers[safeName(data.info.name)].graph.push([data.info.timestamp || new Date().getTime(), players]);
        if (self.servers[safeName(data.info.name)].graph.length > 72) {
            self.servers[safeName(data.info.name)].graph.shift();
        }
		if(!preventDigest){
			$rootScope.$apply();
		}
	}

	socket.on('add', function(servers){
		// replace data
		var queuedUpdates = [],
			info = false;
		servers.forEach(function(server){
			server.forEach(function(update){
				if(update.info){
					update.info.graph = [];
					update.info.updates = [];
					update.info.favicon = MISSING_FAVICON_BASE64;
					self.servers[safeName(update.info.name)] = update.info;
					info = update.info;
				}
				queuedUpdates.push(update);
			});
			//safely handle updates now that we have the server info from the last reply
			queuedUpdates.forEach(function(update){
				update.info = info;
				handleUpdate(update, true);
			});
			$rootScope.$apply();
		});
	})
	socket.on('update', handleUpdate);
	socket.on('updateMojangServices', function(data){
		self.mojang = data;
		$rootScope.$apply();
	})

	self.getStatus = function(){
		return self.status;
	}
	self.getMojangStatus = function(){
		return self.mojang;
	}
	self.getServers = function(){
		return self.servers;
	}

});

minepack.controller('minepackHome', function($scope, socket){
	$scope.status = socket.getStatus();
	$scope.statusVerb = function(){
		var verb = null;
		if($scope.status.connected){
			verb = 'connected';
		}else if(!$scope.status.connected && $scope.status.connecting){
			verb = 'connecting';
		}else if(!$scope.status.connected && !$scope.status.connecting){
			verb = 'disconnected';
		}
		return verb;
	};
	$scope.mojang = socket.getMojangStatus();
	$scope.servers = socket.getServers();
	$scope.chartOpts = chartOpts;
});
minepack.filter('handlError', function(){
	return function(error) {
		if(!error){ // no error
	        return '';
	    }
	    if (error.description) {
	        return error.description;
	    } else if (error.errno) {
	        return error.errno;
	    } else {
	    	return 'Failed to ping';
	    }
	}
});
minepack.filter('sortServers', function(){
	return function(list) {
		var servers = [];
		angular.forEach(list, function(server){
			servers.push(server);
		});
		servers.sort(function(a, b){
			return a.players || 0 - b.players || 0;
		});
		return servers.reverse();
	}
});

function formatNumber(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

var safeName = function(name){
	return name.replace(/\s/g,'');
}

var MISSING_FAVICON_BASE64 = "data:image/png;base64,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";
var chartOpts = {
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