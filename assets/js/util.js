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