
var graphs = [];
var lastPlayerEntries = [];

var historyPlot;
var displayedGraphData;
var hiddenGraphData = [];

var mcVersions = {
    'PC': {
        4: '1.7.2',
        5: '1.7.10',
        47: '1.8',
        107: '1.9'
    }
};

var isConnected = false;

var mojangServicesUpdater;
var sortServersTask;

function updateServerStatus(lastEntry) {
    var info = lastEntry.info;

    var div = $('#status_' + safeName(info.name));
    var versionDiv = $('#version_' + safeName(info.name));

    if (lastEntry.versions) {
        var versions = '';

        for (var i = 0; i < lastEntry.versions.length; i++) {
            versions += '<span class="version">' + mcVersions[lastEntry.info.type][lastEntry.versions[i]] + '</span>&nbsp;';
        }

        versionDiv.html(versions);
    } else {
        versionDiv.html('');
    }

    if (lastEntry.result) {
        var result = lastEntry.result;
        var newStatus = 'Players: ' + formatNumber(result.players.online);

        var listing = graphs[lastEntry.info.name].listing;

        if (listing.length > 0) {
            newStatus += '<span class="color-gray"> (';

            var playerDifference = listing[listing.length - 1][1] - listing[0][1];

            if (playerDifference >= 0) {
                newStatus += '+';
            }

            newStatus += playerDifference + ')</span>';
        }

        lastPlayerEntries[info.name] = result.players.online;

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

    var keys = Object.keys(lastPlayerEntries);
    var totalPlayers = 0;

    for (var i = 0; i < keys.length; i++) {
        totalPlayers += lastPlayerEntries[keys[i]];
    }

    $("#stat_totalPlayers").text(formatNumber(totalPlayers));
    $("#stat_networks").text(formatNumber(keys.length));
}

function sortServers() {
    if (categoriesVisible) {
        var byCategories = getServersByCategory();

        var categories = Object.keys(byCategories);

        for (var i = 0; i < categories.length; i++) {
            var relevantPlayers = [];

            for (var x = 0; x < byCategories[categories[i]].length; x++) {
                var server = byCategories[categories[i]][x];

                relevantPlayers[server.name] = lastPlayerEntries[server.name];
            }

            var keys = Object.keys(relevantPlayers);

            keys.sort(function(a, b) {
                return relevantPlayers[b] - relevantPlayers[a];
            });

            for (var x = 0; x < keys.length; x++) {
                $('#' + safeName(keys[x])).appendTo('#server-container-' + categories[i]);

                $('#ranking_' + safeName(keys[x])).text('#' + (x + 1));
            }
        }
    } else {
        var serverNames = [];

        var keys = Object.keys(lastPlayerEntries);

        for (var i = 0; i < keys.length; i++) {
            serverNames.push(keys[i]);
        }

        serverNames.sort(function(a, b) {
            return (lastPlayerEntries[b] || 0) - (lastPlayerEntries[a] || 0);
        });

        for (var i = 0; i < serverNames.length; i++) {
            $('#' + safeName(serverNames[i])).appendTo('#server-container-all');

            $('#ranking_' + safeName(serverNames[i])).text('#' + (i + 1));
        }
    }
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
        mojangServicesUpdater = setInterval(updateMojangServices, 1000);
        sortServersTask = setInterval(sortServers, 10000);
    } else {
        $('#tagline-text').text('Updating...');

        $.getScript('/publicConfig.json', function(data, textStatus, xhr) {
            if (xhr.status === 200) {
                validateBootTime(publicConfig.bootTime, socket);
            } else {
                $('#tagline').attr('class', 'status-offline');
                $('#tagline-text').text('Failed to update! Refresh?');
            }
        });
    }
}

$(document).ready(function() {
	var socket = io.connect({
        reconnect: true,
        reconnectDelay: 1000,
        reconnectionAttempts: 10
    });

    var mojangServicesUpdater;
    var sortServersTask;

    var graphDuration;

	socket.on('connect', function() {
        $('#tagline-text').text('Loading...');

        if (!isMobileBrowser()) {
            socket.emit('requestHistoryGraph');
        } else {
            $('#graph-request').show();
        }
	});
    socket.on('bootTime', function(bootTime) {
        validateBootTime(bootTime, socket);
    });

    socket.on('disconnect', function() {
        if (mojangServicesUpdater) clearInterval(mojangServicesUpdater);
        if (sortServersTask) clearInterval(sortServersTask);
        
        lastMojangServiceUpdate = undefined;

        $('#tagline').attr('class', 'status-offline');
        $('#tagline-text').text('Disconnected! Refresh?');

        lastPlayerEntries = {};
        graphs = {};

        $('#server-container-list').html('');

        createdCategories = false;

        $('#big-graph').html('');
        $('#big-graph-checkboxes').html('');
        $('#big-graph-controls').css('display', 'none');

        $('#category-controller').css('display', 'none');

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
        var html = '';

        keys.sort();

        for (var i = 0; i < keys.length; i++) {
            var checkedString = '';

            if (displayedGraphData[keys[i]]) {
                checkedString = 'checked=checked';
            }
            html += '<div class="graph-control-option"><p><input type="checkbox" class="graph-control" id="graph-controls" data-target-network="' + keys[i] + '" '+checkedString+'> ' + keys[i] + '</input></p></div>';
        }

        $('#big-graph-checkboxes').append(html);
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

        targetGraphData[rawData.name].data.push([rawData.timestamp, rawData.players]);

        // Redraw if we need to.
        if (displayedGraphData[rawData.name]) {
            historyPlot.setData(convertGraphData(displayedGraphData));
            historyPlot.setupGrid();

            historyPlot.draw();
        }
    });

    var nameToColor = {};

	socket.on('add', function(servers) {
        if (Object.keys(publicConfig.categories).length > 1) {
            $('#category-controller').css('display', 'block');
        }

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

            if (lastEntry.error) {
                lastPlayerEntries[info.name] = 0;
            } else if (lastEntry.result) {
                lastPlayerEntries[info.name] = lastEntry.result.players.online;
            }

            $('<div/>', {
                id: safeName(info.name),
                class: 'server',
                html: '<div id="server-' + safeName(info.name) + '" class="column left-column">\
                            <img id="favicon_' + safeName(info.name) + '">\
                            <br />\
                            <p class="text-center-align rank" id="ranking_' + safeName(info.name) + '"></p>\
                        </div>\
                        <div class="column middle-column" style="width: 220px;">\
                            <h3>' + info.name + '&nbsp;<span class="type">' + info.type + '</span></h3>\
                            <span class="color-gray url">' + info.ip + '</span>\
                            <div id="version_' + safeName(info.name) + '" class="versions"><span class="version"></span></div>\
                            <span id="status_' + safeName(info.name) + '">Waiting</span>\
                        </div>\
                        <div class="column right-column">\
                            <div class="chart" id="chart_' + safeName(info.name) + '"></div>\
                        </div>'
            }).appendTo("#server-container-" + getServerByIp(info.ip).category);

            var favicon = MISSING_FAVICON_BASE64;

            if (lastEntry.result && lastEntry.result.favicon) {
                favicon = lastEntry.result.favicon;
            }

            $('#favicon_' + safeName(info.name)).attr('src', favicon);

            graphs[lastEntry.info.name] = {
                listing: listing,
                plot: $.plot('#chart_' + safeName(info.name), [{data: listing, color: info.color}], smallChartOptions)
            };

            updateServerStatus(lastEntry);

            $('#chart_' + safeName(info.name)).bind('plothover', handlePlotHover);

            nameToColor[info.name] = info.color;
        }

        sortServers();
	});

	socket.on('update', function(update) {
        // Prevent weird race conditions.
        if (!graphs[update.info.name]) {
            return;
        }

        // We have a new favicon, update the old one.
        if (update.result && update.result.favicon) {
            $('#favicon_' + safeName(update.info.name)).attr('src', update.result.favicon);
        }

        var graph = graphs[update.info.name];

        updateServerStatus(update);

        if (update.result) {
            graph.listing.push([update.info.timestamp, update.result ? update.result.players.online : 0]);

            if (graph.listing.length > 72) {
                graph.listing.shift();
            }

            graph.plot.setData([{data: graph.listing, color: nameToColor[update.info.name]}]);
            graph.plot.setupGrid();

            graph.plot.draw();
        }
	});

	socket.on('updateMojangServices', function(data) {
        if (isConnected) {
            updateMojangServices(data);
        }
    });

    $(document).on('click', '.graph-control', function(e) {
        var serverIp = $(this).attr('data-target-network');
        var checked = $(this).attr('checked');

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

    var preventClick = false;
    $("[data-request-graph]").first().click(function() {
        if(preventClick) return;
        $(this)
            .css('cursor', 'default')
            .css('text-decoration', 'none')
            .css('color', 'green')
            .css('border-bottom', 'none')
            .text('Loading...');
        socket.emit('requestHistoryGraph');
        preventClick = true;
        var temp = this;
        window.setTimeout(function() {
            $(temp).css('color', 'red').text("If nothing happens graphs may be disabled for this Minetrack! (logToDatabase must be enabled!)");
        }, 2000);
    });

    var  bigHeader = true;
    var switcher = $("[data-toggle-header]").first();
    var displayBigHeader = function(){
        switcher.html("&#8593;")
        $("[data-small-header]").hide();
        $("[data-big-header]").show();
        bigHeader = true;
    };
    var displaySmallHeader = function(){
        switcher.html("&#8595;")
        $("[data-big-header]").hide();
        $("[data-small-header]").show();
        bigHeader = false;
    };

    switcher.click(function(){
        if(bigHeader) {
            displaySmallHeader();
        } else {
            displayBigHeader();
        }
    });
    var w = $(window).width();
    if(w > 960) {
        displayBigHeader();
    } else {
        displaySmallHeader();
    }
    var one_column_switch_width = 960;
    $(window).resize(function () {
        var newWidth = $(window).width();
        if(w > one_column_switch_width && newWidth < one_column_switch_width) {
            displaySmallHeader();
        }
        if(w < one_column_switch_width && newWidth > one_column_switch_width) {
            displayBigHeader();
        }
        w = newWidth;
    });

    var stickyToggler = $("[data-toggle-sticky]");
    var tagline = $("#tagline").first();
    var sticky;
    var header = $("#header").first();
    var makeSticky = function (toState){
        if(toState == sticky) return;
        if(toState) { //Become Stick
            header.before(tagline.detach());
            header.css('padding-top', '42px');
            tagline.css('position', 'fixed');
            tagline.css('z-index', '100');
            stickyToggler.addClass("pin-down");
            stickyToggler.css('margin-top', '-4px');
            stickyToggler.css('margin-bottom', '-3px');
        } else  {
            header.after(tagline.detach());
            header.css('padding-top', '');
            tagline.css('position', '');
            tagline.css('z-index', '');
            stickyToggler.removeClass("pin-down");
            stickyToggler.css('margin-top', '');
            stickyToggler.css('margin-bottom', '');
        }
        sticky = toState;
    };
    makeSticky(!isMobileBrowser());
    stickyToggler.click(function(){
        makeSticky(!sticky);

    })
});
