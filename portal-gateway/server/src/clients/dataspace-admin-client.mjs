import { config } from '../config/index.mjs'
import { fetchJson } from '../lib/http-client.mjs'

export function dataspaceFetch(path, options = {}) {
  return fetchJson(`${config.dataspaceAdminApiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: participantHeaders(options.token),
    body: options.body,
    upstreamName: 'dataspace-admin',
  })
}

function participantHeaders(token) {
  return token ? { 'x-participant-token': token } : {}
}
