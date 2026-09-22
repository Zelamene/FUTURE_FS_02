const registry = new Set();
const MAX_CONNECTIONS = 5;
const HEARTBEAT_INTERVAL_MS = 25_000;

function formatFrame(type, payload) {
  const data = JSON.stringify({ type, payload, at: new Date().toISOString() });
  return `event: ${type}\ndata: ${data}\n\n`;
}

export function addConnection(res) {
  registry.add(res);
  res._heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      removeConnection(res);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export function removeConnection(res) {
  registry.delete(res);
  if (res._heartbeat) {
    clearInterval(res._heartbeat);
    res._heartbeat = null;
  }
}

export function getConnectionCount() {
  return registry.size;
}

export function _resetForTests() {
  for (const res of [...registry]) {
    try {
      if (res._heartbeat) {
        clearInterval(res._heartbeat);
        res._heartbeat = null;
      }
      if (!res.writableEnded) res.end();
    } catch {
      // ignore cleanup errors in tests
    }
  }
  registry.clear();
}

export function emit(type, payload) {
  const frame = formatFrame(type, payload);
  for (const res of [...registry]) {
    try {
      res.write(frame);
    } catch {
      removeConnection(res);
    }
  }
}

export { MAX_CONNECTIONS };
