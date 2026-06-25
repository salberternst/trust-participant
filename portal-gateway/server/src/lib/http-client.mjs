import { parsePayload } from './objects.mjs'
import { upstreamError } from './http-errors.mjs'

export async function fetchJson(url, { method = 'GET', headers = {}, body, upstreamName }) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...headers,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const responseText = await response.text()
  const payload = parsePayload(responseText)

  if (!response.ok) throw upstreamError(response.status, upstreamName, payload, responseText)
  return payload
}
