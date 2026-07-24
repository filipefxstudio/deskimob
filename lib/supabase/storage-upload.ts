/** Detects binary that was incorrectly round-tripped through UTF-8 (common upload bug). */
export function looksLikeUtf8CorruptedBinary(buffer: Buffer): boolean {
  if (buffer.length < 3) {
    return false;
  }

  return buffer[0] === 0xef && buffer[1] === 0xbf && buffer[2] === 0xbd;
}

export function isValidImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return true;
  }

  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return true;
  }

  if (buffer[0] === 0x47 && buffer[1] === 0x49) {
    return true;
  }

  return (
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  );
}

/** Supabase Storage expects Blob/ArrayBuffer — Node Buffer can be UTF-8 mangled on upload. */
export function bufferToUploadBody(buffer: Buffer): Blob {
  return new Blob([new Uint8Array(buffer)], { type: "application/octet-stream" });
}
