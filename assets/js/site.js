var graphs = [];
var lastPlayerEntries = [];

var historyPlot;
var displayedGraphData;
var hiddenGraphData = [];

var isConnected = false;

var mojangServicesUpdater;
var sortServersTask;

var currentServerHover;

function updateServerStatus(lastEntry) {
    var info = lastEntry.info;

    var div = $('#status_' + safeName(info.name));
    var versionDiv = $('#version_' + safeName(info.name));

    if (lastEntry.versions) {
        var versions = '';

        for (var i = 0; i < lastEntry.versions.length; i++) {
            if (!lastEntry.versions[i]) continue;
            versions += '<span class="version">' + publicConfig.minecraftVersions[lastEntry.info.type][lastEntry.versions[i]] + '</span>&nbsp;';
        }

        versionDiv.html(versions);
    } else {
        versionDiv.html('');
    }

    if (lastEntry.result) {
        var result = lastEntry.result;
        var newStatus = 'Players: <span style="font-weight: 500;">' + formatNumber(result.players.online) + '</span>';

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

    if (lastEntry.record) {
        $('#record_' + safeName(info.name)).html('Record: ' + formatNumber(lastEntry.record));
    }

    updatePercentageBar();
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
                $('#container_' + safeName(keys[x])).appendTo('#server-container-' + categories[i]);
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
            $('#container_' + safeName(serverNames[i])).appendTo('#server-container-all');
            $('#ranking_' + safeName(serverNames[i])).text('#' + (i + 1));
        }
    }
}

function updatePercentageBar() {
    var keys = Object.keys(lastPlayerEntries);

    keys.sort(function(a, b) {
        return lastPlayerEntries[a] - lastPlayerEntries[b];
    });

    var totalPlayers = getCurrentTotalPlayers();

    var parent = $('#perc-bar');
    var leftPadding = 0;

    for (var i = 0; i < keys.length; i++) {
        (function(pos, server, length) {
            var safeNameCopy = safeName(server);
            var playerCount = lastPlayerEntries[server];

            var div = $('#perc_bar_part_' + safeNameCopy);

            // Setup the base
            if (!div.length) {
                $('<div/>', {
                    id: 'perc_bar_part_' + safeNameCopy,
                    class: 'perc-bar-part',
                    html: '',
                    style: 'background: ' + getServerColor(server) + ';'
                }).appendTo(parent);

                div = $('#perc_bar_part_' + safeNameCopy);

                div.mouseover(function(e) {
                    currentServerHover = server;
                });

                div.mouseout(function(e) {
                    hideTooltip();
                    currentServerHover = undefined;
                });
            }

            // Update our position/width
            var width = (playerCount / totalPlayers) * parent.width();

            div.css({
                width: width + 'px',
                left: leftPadding + 'px'
            });

            leftPadding += width;
        })(i, keys[i], keys.length);
    }
}

function getCurrentTotalPlayers() {
    var totalPlayers = 0;
    var keys = Object.keys(lastPlayerEntries);
    for (var i = 0; i < keys.length; i++) totalPlayers += lastPlayerEntries[keys[i]]
    return totalPlayers;
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
                showCaption('Failed to update! Refresh?');
            }
        });
    }
}

function printPort(port) {
  if(port == undefined || port == 25565) {
    return "";
  } else {
    return ":" + port;
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

        showCaption('Disconnected! Refresh?');

        lastPlayerEntries = {};
        graphs = {};

        $('#server-container-list').html('');

        createdCategories = false;

        $('#big-graph').html('');
        $('#big-graph-checkboxes').html('');
        $('#big-graph-controls').css('display', 'none');

        $('#perc-bar').html('');
        $('.mojang-status').css('background', 'transparent');
        $('.mojang-status-text').text('...');

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

            var typeString = publicConfig.serverTypesVisible ? '<span class="type">' + info.type + '</span>' : '';

            var safeNameCopy = safeName(info.name);

            $('<div/>', {
                id: 'container_' + safeNameCopy,
                class: 'server',
                'server-id': safeNameCopy,
                html: '<div id="server-' + safeNameCopy + '" class="column" style="width: 80px;">\
                            <img id="favicon_' + safeNameCopy + '" title="' + info.name + '\n' + info.ip + printPort(info.port) + '">\
                            <br />\
                            <p class="text-center-align rank" id="ranking_' + safeNameCopy + '"></p>\
                        </div>\
                        <div class="column" style="width: 220px;">\
                            <h3>' + info.name + '&nbsp;' + typeString + '</h3>\
                            <span id="status_' + safeNameCopy + '">Waiting</span>\
                            <div id="version_' + safeNameCopy + '" class="color-dark-gray server-meta versions"><span class="version"></span></div>\
                            <span id="record_' + safeNameCopy + '" class="color-dark-gray server-meta"></span>\
                        </div>\
                        <div class="column" style="float: right;">\
                            <div class="chart" id="chart_' + safeNameCopy + '"></div>\
                        </div>'
            }).appendTo("#server-container-" + getServerByIp(info.ip).category);

            var favicon = MISSING_FAVICON_BASE64;

            if (lastEntry.result && lastEntry.result.favicon) {
                favicon = lastEntry.result.favicon;
            }

            $('#favicon_' + safeName(info.name)).attr('src', favicon);

            graphs[lastEntry.info.name] = {
                listing: listing,
                plot: $.plot('#chart_' + safeNameCopy, [listing], smallChartOptions)
            };

            updateServerStatus(lastEntry);

            $('#chart_' + safeNameCopy).bind('plothover', handlePlotHover);
        }

        sortServers();
        updatePercentageBar();
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

    socket.on('syncComplete', function(data) {
        hideCaption();

        $(document).on('click', '.server', function(e) {
            var serverId = $(this).attr('server-id');
        });
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

    $(document).on('mousemove', function(e) {
        if (currentServerHover) {
            var totalPlayers = getCurrentTotalPlayers();
            var playerCount = lastPlayerEntries[currentServerHover];

            renderTooltip(e.pageX + 10, e.pageY + 10, '<strong>' + currentServerHover + '</strong>: ' + roundToPoint(playerCount / totalPlayers * 100, 10) + '% of ' + formatNumber(totalPlayers) + ' tracked players.<br />(' + formatNumber(playerCount) + ' online.)');
        }
    });

    $(window).on('resize', function() {
        updatePercentageBar();

        if (historyPlot) {
            historyPlot.resize();
            historyPlot.setupGrid();
            historyPlot.draw();
        }
    });
});
