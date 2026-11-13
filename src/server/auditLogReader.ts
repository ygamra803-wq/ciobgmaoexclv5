import fs from 'fs';

const DEFAULT_MAX_TAIL_BYTES = 512 * 1024; // 512 KB bounded read window

/**
 * Reads the most recent valid JSONL entries from `auditFilePath` using a bounded
 * file-tail window (`O(1)` memory regardless of historical audit log size).
 *
 * @param auditFilePath - Absolute path to `gmao_audit.jsonl`.
 * @param limit - Maximum number of entries to return (ordered newest-first).
 * @param maxTailBytes - Maximum trailing bytes to read from disk (default 512 KB).
 */
export async function readRecentAuditEntries(
  auditFilePath: string,
  limit: number,
  maxTailBytes: number = DEFAULT_MAX_TAIL_BYTES
): Promise<Record<string, unknown>[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 100), 500);
  const safeTailBytes = Math.max(4096, Math.floor(maxTailBytes) || DEFAULT_MAX_TAIL_BYTES);

  let fileSize = 0;
  try {
    const stats = await fs.promises.stat(auditFilePath);
    fileSize = stats.size;
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return [];
    }
    throw err;
  }

  if (fileSize <= 0) {
    return [];
  }

  const bytesToRead = Math.min(fileSize, safeTailBytes);
  const startOffset = Math.max(0, fileSize - bytesToRead);
  const buffer = Buffer.allocUnsafe(bytesToRead);

  const handle = await fs.promises.open(auditFilePath, 'r');
  try {
    let totalRead = 0;
    while (totalRead < bytesToRead) {
      const { bytesRead } = await handle.read(
        buffer,
        totalRead,
        bytesToRead - totalRead,
        startOffset + totalRead
      );
      if (bytesRead <= 0) break;
      totalRead += bytesRead;
    }

    let rawTail = buffer.subarray(0, totalRead).toString('utf-8');
    // If reading from the middle of the file, discard the truncated leading line fragment
    if (startOffset > 0) {
      const firstNewline = rawTail.indexOf('\n');
      if (firstNewline === -1) {
        return [];
      }
      rawTail = rawTail.slice(firstNewline + 1);
    }

    const lines = rawTail
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed: Record<string, unknown>[] = [];
    for (let i = lines.length - 1; i >= 0 && parsed.length < safeLimit; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          parsed.push(entry as Record<string, unknown>);
        }
      } catch {
        // Skip malformed audit line without breaking the tail query
      }
    }

    return parsed;
  } finally {
    await handle.close();
  }
}
