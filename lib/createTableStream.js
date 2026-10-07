/** Split an SSE byte stream into JSON events. Incomplete frames stay in `rest`. */
export function parseSseBuffer(rest, chunk) {
  const buffer = `${rest || ""}${chunk || ""}`;
  const parts = buffer.split("\n\n");
  const nextRest = parts.pop() ?? "";
  const events = [];
  for (const part of parts) {
    const line = part
      .split("\n")
      .map((item) => item.trim())
      .find((item) => item.startsWith("data:"));
    if (!line) continue;
    events.push(JSON.parse(line.slice(5).trim()));
  }
  return { rest: nextRest, events };
}

/**
 * EventSource fires onerror when the server closes the stream, including after
 * a real error frame, and then reconnects. A terminal frame must win; otherwise
 * the dialog replaces「欄位建立失敗」with「連線失敗」and a second create starts.
 * Returns null when the dialog should keep the message it already has.
 */
export function disconnectMessage(progress) {
  if (!progress || progress.isComplete || progress.isError) return null;
  if (progress.message && progress.message !== "正在連線...") {
    return `連線中斷：${progress.message}`;
  }
  return "連線失敗";
}
