var mcpc = require('./mcpc_buffer');
var net = require('net');

function pingMinecraftPC(host, port, timeout, callback) {
	var client = new net.Socket();
	var milliseconds = (new Date).getTime();

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

            json.latency = (new Date).getTime() - milliseconds;

            // We parsed it, send it along!
            callback(null, json);
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

	// Make sure we don't go overtime.
	setTimeout(function() {
		client.end();
	}, timeout);
}

// Wraps our Buffer into another to fit the Minecraft protocol.
function writePCBuffer(client, buffer) {
	var length = mcpc.createBuffer();

	length.writeVarInt(buffer.buffer().length);

	client.write(Buffer.concat([length.buffer(), buffer.buffer()]));
}

exports.ping = function(host, port, type, timeout, callback) {
	if (type === 'PC') {
		pingMinecraftPC(host, port, timeout, callback);
	} else if (type === 'PE') {

	} else {
		throw new Error('Unsupported type: ' + type);
	}
};