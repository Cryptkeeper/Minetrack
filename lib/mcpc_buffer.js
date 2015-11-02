function CustomBuffer(existingBuffer) {
    var buffer = existingBuffer || new Buffer(48);
    var offset = 0;

    this.writeVarInt = function(val) {
        while (true) {
            if ((val & 0xFFFFFF80) == 0) {
                this.writeUByte(val);

                return;
            }

            this.writeUByte(val & 0x7F | 0x80);

            val = val >>> 7;
        }
    };

    this.writeString = function(string) {
        this.writeVarInt(string.length);

        if (offset + string.length >= buffer.length) {
            Buffer.concat([buffer, new Buffer(string.length)]);
        }

        buffer.write(string, offset, string.length, "UTF-8");

        offset += string.length;
    };

    this.writeUShort = function(val) {
        this.writeUByte(val >> 8);
        this.writeUByte(val & 0xFF);
    };

    this.writeUByte = function(val) {
        if (offset + 1 >= buffer.length) {
            Buffer.concat([buffer, new Buffer(50)]);
        }

        buffer.writeUInt8(val, offset++);
    };

    this.readVarInt = function() {
        var val = 0;
        var count = 0;

        while (true) {
            var i = buffer.readUInt8(offset++);

            val |= (i & 0x7F) << count++ * 7;

            if ((i & 0x80) != 128) {
                break
            }
        }

        return val;
    };

    this.readString = function() {
        var length = this.readVarInt();
        var str = buffer.toString("UTF-8", offset, offset + length);

        offset += length;
        
        return str;
    };

    this.buffer = function() {
        return buffer.slice(0, offset);
    };

    this.offset = function() {
        return offset;
    };
}

exports.createBuffer = function(buffer) {
    return new CustomBuffer(buffer);
};