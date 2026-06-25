export function httpError(status, message, details) {
  const error = new Error(message)
  error.status = status
  if (details !== undefined) error.details = details
  return error
}

export function upstreamError(status, upstreamName, payload, responseText) {
  const message =
    payload && typeof payload === 'object'
      ? payload.error || payload.message || `${upstreamName} returned ${status}`
      : responseText || `${upstreamName} returned ${status}`
  return httpError(status >= 400 && status < 500 ? status : 502, message, payload)
}
