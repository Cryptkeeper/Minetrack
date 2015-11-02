var net = require('net');
var mcpe_ping = require('mcpe-ping');

var mcpc = require('./mcpc_buffer');

function pingMinecraftPC(host, port, timeout, callback) {
	var client = new net.Socket();
	var milliseconds = (new Date).getTime();

	client.setTimeout(timeout, function() {
		client.destroy();

		callback(new Error('timeout'), null);
	});

	client.connect(port, host, function() {
		// Write out handshake packet.
		var handshakeBuffer = mcpc.createBuffer();

		handshakeBuffer.writeVarInt(0);
		handshakeBuffer.writeVarInt(47);
		handshakeBuffer.writeString(host);
		handshakeBuffer.writeUShort(port);
		handshakeBuffer.writeVarInt(1);

		writePCBuffer(client, handshakeBuffer);

		// Write the set connection state packet, we should get the MOTD after this.
		var setModeBuffer = mcpc.createBuffer();

		setModeBuffer.writeVarInt(0);

		writePCBuffer(client, setModeBuffer);
	});

	var readingBuffer = new Buffer(0);

    client.on('data', function(data) {
        readingBuffer = Buffer.concat([readingBuffer, data]);

        var buffer = mcpc.createBuffer(readingBuffer);
        var length;

        try {
            length = buffer.readVarInt();
        } catch(err) {
        	// The buffer isn't long enough yet, wait for more data!
            return;
        }

        // Make sure we have the data we need!
        if (readingBuffer.length < length - buffer.offset() ) {
            return;
        }

        // Read the packet ID, throw it away.
        buffer.readVarInt();

        try {
            var json = JSON.parse(buffer.readString());

            // Remap our JSON into our custom structure.
            var res = {
            	players: json.players,
            	version: json.version.protocol,
            	latency: (new Date).getTime() - milliseconds
            };

            if (json.favicon) {
            	res.favicon = json.favicon;
            }

            // We parsed it, send it along!
            callback(null, res);
        } catch (err) {
        	// Our data is corrupt? Fail hard.
        	callback(err, null);

            return;
        }

        // We're done here.
        client.destroy();
    });

	client.on('error', function(err) {
		callback(err, null);
	});
}

// Wraps our Buffer into another to fit the Minecraft protocol.
function writePCBuffer(client, buffer) {
	var length = mcpc.createBuffer();

	length.writeVarInt(buffer.buffer().length);

	client.write(Buffer.concat([length.buffer(), buffer.buffer()]));
}

// This is a wrapper function for mcpe-ping, mainly used to convert the data structure of the result.
function pingMinecraftPE(host, port, timeout, callback) {
	var milliseconds = (new Date).getTime();
		
	mcpe_ping(host, port || 19132, function(err, res) {
		if (err) {
			callback(err, null);
		} else {
			// Remap our JSON into our custom structure.
			callback(err, {
				players: {
					online: res.currentPlayers,
					max: res.maxPlayers
				},
				version: res.version,
				latency: (new Date).getTime() - milliseconds
			});
		}
	}, timeout);
}

exports.ping = function(host, port, type, timeout, callback) {
	if (type === 'PC') {
		pingMinecraftPC(host, port || 25565, timeout, callback);
	} else if (type === 'PE') {
		pingMinecraftPE(host, port || 19132, timeout, callback);
	} else {
		throw new Error('Unsupported type: ' + type);
	}
};