var MISSING_FAVICON_BASE64 = "data:image/png;base64,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";

var tooltip = $('#tooltip');

var lastMojangServiceUpdate;
var publicConfig;

var createdCategories = false;
var categoriesVisible;

var colorsByStatus = {
    'Online': '#87D37C',
    'Unstable': '#f1c40f',
    'Offline': '#DE5749'
};

function showCaption(html) {
    var tagline = $('#tagline-text');
    tagline.stop(true, false);
    tagline.html(html);
    tagline.slideDown(100);
}

function hideCaption() {
    var tagline = $('#tagline-text');
    tagline.stop(true, false);
    tagline.slideUp(100);
}

function setPublicConfig(json) {
    publicConfig = json;

    $('#server-container-list').html('');

    createdCategories = false;

    createCategories();

    if (publicConfig.categoriesVisible) {
    	$('.category-header').css('display', 'block');
	    $('.server-container').css('margin', '10px auto');

	    sortServers();
    }
}

function createCategories() {
	if (!createdCategories) {
		createdCategories = true;

		var keys = Object.keys(publicConfig.categories);

		for (var i = 0; i < keys.length; i++) {
			var title = publicConfig.categories[keys[i]];

			$('#server-container-list').append('<div id="server-container-' + keys[i] + '" class="container server-container"><h3 class="category-header">' + title + '</h3></div>');
		}

		$('#server-container-list').append('<div id="server-container-all" class="container server-container"></div>');
	}
}

function getServersByCategory() {
	var byCategory = {};

	for (var i = 0; i < publicConfig.servers.length; i++) {
		var entry = publicConfig.servers[i];

		if (!byCategory[entry.category]) {
			byCategory[entry.category] = [];
		}

		byCategory[entry.category].push(entry);
	}

	return byCategory;
}

function getServerByField(id, value) {
	for (var i = 0; i < publicConfig.servers.length; i++) {
		var entry = publicConfig.servers[i];

		if (entry[id] === value) {
			return entry;
		}
	}
}

function getServerByIp(ip) {
	return getServerByField('ip', ip);
}

function getServerByName(name) {
	return getServerByField('name', name);
}

function getServerColor(name) {
	var server = getServerByName(name);

	return server ? server.color : stringToColor(name);
}

// Generate (and set) the HTML that displays Mojang status.
// If nothing is passed, re-render the last update.
// If something is passed, update and then re-render.
function updateMojangServices(currentUpdate) {
    if (currentUpdate) {
    	lastMojangServiceUpdate = currentUpdate;
    }

    if (!lastMojangServiceUpdate) {
    	return;
    }

    var keys = Object.keys(lastMojangServiceUpdate);

    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var status = lastMojangServiceUpdate[key];

        $('#mojang-status_' + status.name).css({background: colorsByStatus[status.title]});
        $('#mojang-status-text_' + status.name).text(status.title);
    }
}

function findErrorMessage(error) {
    if (error.description) {
        return error.description;
    } else if (error.errno) {
        return error.errno;
    }
}

function getTimestamp(ms, timeOnly) {
    var date = new Date(0);

    date.setUTCSeconds(ms);

    return date.toLocaleTimeString();
}

function safeName(name) {
    return name.replace(/ /g, '');
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

// From http://detectmobilebrowsers.com/
function isMobileBrowser() {
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
}

function trimOldPings(data, graphDuration) {
	var keys = Object.keys(data);

	var timeMs = new Date().getTime();

	for (var x = 0; x < keys.length; x++) {
		var listing = data[keys[x]];

		var toSplice = [];

		for (var i = 0; i < listing.length; i++) {
			var entry = listing[i];

			if (timeMs - entry[0] > graphDuration) {
				toSplice.push(i);
			}
		}

		for (var i = 0; i < toSplice.length; i++) {
			listing.splice(toSplice[i], 1);
		}
	}
}

function stringToColor(base) {
    var hash;

    for (var i = base.length - 1, hash = 0; i >= 0; i--) {
        hash = base.charCodeAt(i) + ((hash << 5) - hash);
    }

    color = Math.floor(Math.abs((Math.sin(hash) * 10000) % 1 * 16777216)).toString(16);

    return '#' + Array(6 - color.length + 1).join('0') + color;
}

function roundToPoint(val, scale) {
    return Math.round(val * scale) / scale;
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
