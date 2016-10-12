var graphs = [];
var lastPlayerEntries = [];

var historyPlot;
var displayedGraphData;
var hiddenGraphData = [];

var body;

var mcVersions = {
    'PC': {
        4: '1.7.2',
        5: '1.7.10',
        47: '1.8',
        107: '1.9',
        210: '1.10'
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

        body = $('body');

        var bigGraph = $('#big-graph').css({
            height: 400,
            width: getGraphWidth()
        });

        historyPlot = $.plot('#big-graph', convertGraphData(displayedGraphData), bigChartOptions);

        bigGraph.bind('plothover', handlePlotHover);

        var keys = Object.keys(rawData);

        var sinceBreak = 0;
        var html = '<table><tr>';

        keys.sort();

        for (var i = 0; i < keys.length; i++) {
            var checkedString = '';

            if (displayedGraphData[keys[i]]) {
                checkedString = 'checked=checked';
            }

            html += '<td><input type="checkbox" class="graph-control" id="graph-controls" data-target-network="' + keys[i] + '" ' + checkedString + '> ' + keys[i] + '</input></td>';

            if (sinceBreak >= 7) {
                sinceBreak = 0;

                html += '</tr><tr>';
            } else {
                sinceBreak++;
            }
        }

        $('#big-graph-checkboxes').append(html + '</tr></table>');
        $('#big-graph-controls').css('display', 'block');

        var resizeEnd;

        $(window).on('resize', function() {
            var small = $(this).width() <= 1199;

            clearTimeout(resizeEnd);
            resizeEnd = setTimeout(resizeGraphs.bind(null, bigGraph, small), 100);
        });
    });

    socket.on('updateHistoryGraph', function(rawData) {
        // Prevent race conditions.
        if (!displayedGraphData || !hiddenGraphData) {
            return;
        }

        // If it's not in our display group, use the hidden group instead.
        var targetGraphData = displayedGraphData[rawData.name] ? displayedGraphData : hiddenGraphData;

        trimOldPings(targetGraphData, publicConfig.graphDuration);

        targetGraphData[rawData.name].push([rawData.timestamp, rawData.players]);

        // Redraw if we need to.
        if (displayedGraphData[rawData.name]) {
            historyPlot.setData(convertGraphData(displayedGraphData));
            historyPlot.setupGrid();

            historyPlot.draw();
        }
    });

	socket.on('add', function(servers) {
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

            var filteredName = safeName(info.name);

            var totalWidth = $('<div/>', {
                id: filteredName,
                class: 'server',
                html: '<div id="server-' + filteredName + '" class="column column-icon">\
                            <img id="favicon_' + filteredName + '">\
                            <br />\
                            <p class="text-center-align rank" id="ranking_' + filteredName + '"></p>\
                        </div>\
                        <div class="column column-info">\
                            <h3>' + info.name + '&nbsp;<span class="type">' + info.type + '</span></h3>\
                            <span class="color-gray url">' + info.ip + '</span>\
                            <div id="version_' + filteredName + '" class="versions"><span class="version"></span></div>\
                            <span id="status_' + filteredName + '">Waiting</span>\
                        </div>\
                        <div class="column column-chart">\
                            <div class="chart" id="chart_' + filteredName + '"></div>\
                        </div>'
            }).appendTo("#server-container-" + getServerByIp(info.ip).category).width();

            var favicon = MISSING_FAVICON_BASE64;

            if (lastEntry.result && lastEntry.result.favicon) {
                favicon = lastEntry.result.favicon;
            }

            $('#favicon_' + filteredName).attr('src', favicon);

            var id = '#chart_' + filteredName;

            // Remove widths from other elems
            $(id).css('width', totalWidth - 331);

            graphs[filteredName] = {
                listing: listing,
                plot: $.plot(id, [listing], smallChartOptions)
            };

            updateServerStatus(lastEntry);

            $('#chart_' + filteredName).bind('plothover', handlePlotHover);
        }

        sortServers();
	});

	socket.on('update', function(update) {
        // Prevent weird race conditions.
        var filtered = safeName(update.info.name);

        if (!graphs[filtered]) {
            return;
        }

        // We have a new favicon, update the old one.
        if (update.result && update.result.favicon) {
            $('#favicon_' + filtered).attr('src', update.result.favicon);
        }

        var graph = graphs[filtered];

        updateServerStatus(update);

        if (update.result) {
            graph.listing.push([update.info.timestamp, update.result ? update.result.players.online : 0]);

            if (graph.listing.length > 72) {
                graph.listing.shift();
            }

            graph.plot.setData([graph.listing]);
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
});
