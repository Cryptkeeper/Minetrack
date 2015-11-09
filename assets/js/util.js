var MISSING_FAVICON_BASE64 = "data:image/png;base64,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";

var tooltip = $('#tooltip');

function getTimestamp(ms, timeOnly) {
    var date = new Date(0);

    date.setUTCSeconds(ms);

    return date.toLocaleTimeString();
}

function renderTooltip(x, y, html) {
	tooltip.html(html).css({
		top: y,
		left: x
	}).fadeIn(0);
}

function hideTooltip() {
	tooltip.hide();
}

function formatNumber(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function msToTime(timer) {
	var milliseconds = timer % 1000;
	timer = (timer - milliseconds) / 1000;

	var seconds = timer % 60;
	timer = (timer - seconds) / 60;

	var minutes = timer % 60;
	var hours = (timer - minutes) / 60;

	var string = '';

	if (hours > 0) {
		string += hours + 'h';
	}
	if (minutes > 0) {
		string += minutes + 'm';
	}
	if (seconds > 0) {
		string += seconds + 's';
	}

	return string;
}