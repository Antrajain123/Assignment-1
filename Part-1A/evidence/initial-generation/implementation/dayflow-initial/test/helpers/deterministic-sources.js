export function createIdSource(prefix = "task") {
  let nextId = 1;

  return () => `${prefix}-${nextId++}`;
}

export function createClockSource(
  start = "2026-01-01T00:00:00.000Z",
  stepMilliseconds = 1,
) {
  const initialTime = Date.parse(start);

  if (!Number.isFinite(initialTime)) {
    throw new TypeError("Clock start must be a valid timestamp.");
  }
  if (!Number.isInteger(stepMilliseconds) || stepMilliseconds < 0) {
    throw new TypeError("Clock step must be a non-negative integer.");
  }

  let currentTime = initialTime;

  return () => {
    const value = new Date(currentTime).toISOString();
    currentTime += stepMilliseconds;
    return value;
  };
}
