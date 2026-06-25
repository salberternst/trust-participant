export function isRecord(value) {
  return Boolean(value && typeof value === 'object')
}

export function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function parsePayload(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export function pruneUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}

export function text(value, fallback = '') {
  return String(value ?? fallback ?? '').trim()
}
