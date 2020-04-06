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

// Called by flot.js when they hover over a data point.
function handlePlotHover(event, pos, item) {
    if (item) {
        var text = getTimestamp(item.datapoint[0]) + '\
            <br />\
            ' + formatNumber(item.datapoint[1]) + ' Players';

        if (item.series && item.series.label) {
            text = item.series.label + '<br />' + text;
        }

        tooltip.set(item.pageX + 5, item.pageY + 5, text);
    } else {
		tooltip.hide();
    }
}