var minepack = angular.module('minepack', ['ngSanitize', 'angular-flot']);

minepack.service('socket', function($rootScope, $filter){
	var self = this;
	var socket = io.connect({
		reconnect: true,
		reconnectionDelay: 2500,
		reconnectionAttempts: 50
	});

	self.status = {
		connected: false,
		connecting: true,
		verb: 'connecting'
	}

	self.mojang = false;

	self.servers = {};

	socket.on('reconnect_failed', function(){
		console.log('socket reconnect failed');
	})

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
				lastCount = self.servers[safeName(data.info.name)].players;
			}
			players = self.servers[safeName(data.info.name)].players = data.result.players.online;
			if(lastCount !== players){
				self.servers[safeName(data.info.name)].playerDiff = $filter('number')(lastCount - players);
				if(self.servers[safeName(data.info.name)].playerDiff > 0){
					self.servers[safeName(data.info.name)].playerDiff = "+" + self.servers[safeName(data.info.name)].playerDiff;
				}
			}
		}
		if(!data.timestamp && data.info.timestamp){
			data.timestamp = data.info.timestamp;
		}
		self.servers[safeName(data.info.name)].graph.push([data.timestamp || new Date().getTime(), players]);
        if (self.servers[safeName(data.info.name)].graph.length > 72) {
            self.servers[safeName(data.info.name)].graph.shift();
        }
		if(!preventDigest){
			//$rootScope.$apply();
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

minepack.controller('minepackHome', function($scope, $filter, socket){
	$scope.mojang = socket.getMojangStatus();
	$scope.status = socket.getStatus();
	$scope.tooltip = {
		show: false,
		text: '',
		css: {}
	};
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
	$scope.mojangStatus = function(){
		var status = 'status-stable';
		angular.forEach($scope.mojang, function(status){
			if(status.status !== 'green'){
				status = 'status-unstable';
			}
		});
		return status;
	}
	$scope.mojangText = function(){
		var text = 'Mojang Services: ',
			status = 'All systems operational',
			problems = [],
			startTime = false;
		angular.forEach($scope.mojang, function(status){
			if(status.status !== 'green'){
				problems.push(status.name);
				// get the oldest problem start date
				if(status.startTime && (!startTime || status.startTime < startTime)){
					startTime = status.startTime;
				}
			}
		});
		if(problems.length > 0){
			status = problems.join(' & ') + ' are unstable';
			if(startTime){
				status = status + ' for ' + msToTime(startTime)
			}
		}
		return text + status;
	}
	$scope.servers = socket.getServers();
	$scope.chartOpts = {
		series:{
	    	shadowSize: 0,
	    },
	    xaxis: {
	        font: {
	            color: "#E3E3E3"
	        },
	        ticks: 3,
	        tickFormatter: function(value) {
	            return $filter('date')(value, "hh:mm:ss");
	        },
	        mode: 'time',
	        show: false
	    },
	    yaxis: {
	        minTickSize: 75,
	        tickDecimals: 0,
	        show: true,
	        tickLength: 10,
	        tickFormatter: function(value) {
	            return $filter('number')(value);
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
	    colors:  [
	    	"#E9E581"
	    ]
	};
	$scope.setTooltip = function(data){
		if(!data.item){
			return $scope.tooltip = {
				show: false,
				text: '',
				css: {}
			}
		}
		$scope.tooltip = {
			show: true,
			text: $filter('date')(new Date(data.item.datapoint[0]), "hh:mm:ss a") + "<br/>" + $filter('number')(data.item.datapoint[1]) + " Players",
			css: {
				left: data.pos.pageX + "px",
				top: data.pos.pageY + "px"
			}
		};
	}
	$scope.scrollTo = function(serverName){
        $('html, body').animate({
            scrollTop: $('#server-' + serverName).offset().top
        }, 100);
	}
});
minepack.filter('safeName', function(){
	return safeName;
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
			if(!a.players && !b.players){
				return 0;
			}else if(!a.players || a.players < b.players){
				return -1;
			}else if(!b.players || a.players > b.players){
				return 1;
			}else{
				return 0;
			}
		});
		return servers.reverse();
	}
});