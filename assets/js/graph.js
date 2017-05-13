// Used by the individual server entries
var smallChartOptions = {
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

// Used by the one chart to rule them all
var bigChartOptions = {
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

function toggleControlsDrawer() {
    var div = $('#big-graph-controls-drawer');

    div.css('display', div.css('display') !== 'none' ? 'none' : 'block');
}

function saveGraphControls(displayedServers) {
	if (typeof(localStorage)) {
		var json = JSON.stringify(displayedServers);

		localStorage.setItem('displayedServers', json);
	}
}

function loadGraphControls() {
	if (typeof(localStorage)) {
		var item = localStorage.getItem('displayedServers');

		if (item) {
			return JSON.parse(item);
		}
	}
}

function resetGraphControls() {
	if (typeof(localStorage)) {
		localStorage.removeItem('displayedServers');
	}
}

// Called by flot.js when they hover over a data point.
function handlePlotHover(event, pos, item) {
    if (item) {
        var text = getTimestamp(item.datapoint[0] / 1000) + '\
            <br />\
            ' + formatNumber(item.datapoint[1]) + ' Players';

        if (item.series && item.series.label) {
            text = item.series.label + '<br />' + text;
        }

        renderTooltip(item.pageX + 5, item.pageY + 5, text);
    } else {
        hideTooltip();
    }
}

// Converts the backend data into the schema used by flot.js
function convertGraphData(rawData) {
    var data = [];

    var keys = Object.keys(rawData);

    for (var i = 0; i < keys.length; i++) {    
        data.push({
            data: rawData[keys[i]],
            yaxis: 1,
            label: keys[i],
            color: getServerColor(keys[i])
        });
    }

    return data;
}