// Minimal ZIP writer, "stored" method only (no compression).
// Instagram media is already JPEG/MP4/WebP, so deflate would cost CPU for ~0% gain.
// No ZIP64: entries and the archive must stay under 4 GiB.

export interface ZipEntry {
    name: string;
    data: Blob | string;
}

let crcTable: Uint32Array | undefined;

function crc32(bytes: Uint8Array): number {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            crcTable[n] = c >>> 0;
        }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): [time: number, date: number] {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return [time, date];
}

export async function createZip(entries: ZipEntry[]): Promise<Blob> {
    const encoder = new TextEncoder();
    const [time, date] = dosDateTime(new Date());
    const parts: BlobPart[] = [];
    const central: Uint8Array<ArrayBuffer>[] = [];
    let offset = 0;

    for (const entry of entries) {
        const name = encoder.encode(entry.name);
        const data = typeof entry.data === 'string'
            ? encoder.encode(entry.data)
            : new Uint8Array(await entry.data.arrayBuffer());
        const crc = crc32(data);

        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true); // local file header signature
        local.setUint16(4, 20, true);         // version needed
        local.setUint16(6, 0x0800, true);     // flags: UTF-8 names
        local.setUint16(8, 0, true);          // method: stored
        local.setUint16(10, time, true);
        local.setUint16(12, date, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, data.length, true); // compressed size
        local.setUint32(22, data.length, true); // uncompressed size
        local.setUint16(26, name.length, true);
        local.setUint16(28, 0, true);           // extra length
        parts.push(local.buffer, name, data);

        const cd = new DataView(new ArrayBuffer(46 + name.length));
        cd.setUint32(0, 0x02014b50, true);    // central directory signature
        cd.setUint16(4, 20, true);            // version made by
        cd.setUint16(6, 20, true);            // version needed
        cd.setUint16(8, 0x0800, true);
        cd.setUint16(10, 0, true);
        cd.setUint16(12, time, true);
        cd.setUint16(14, date, true);
        cd.setUint32(16, crc, true);
        cd.setUint32(20, data.length, true);
        cd.setUint32(24, data.length, true);
        cd.setUint16(28, name.length, true);
        // extra len, comment len, disk start, internal attrs, external attrs: all 0
        cd.setUint32(42, offset, true);       // local header offset
        const cdBytes = new Uint8Array(cd.buffer);
        cdBytes.set(name, 46);
        central.push(cdBytes);

        offset += 30 + name.length + data.length;
    }

    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);       // end of central directory signature
    end.setUint16(8, entries.length, true);   // entries on this disk
    end.setUint16(10, entries.length, true);  // total entries
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);          // central directory offset

    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
