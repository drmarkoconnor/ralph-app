/* global self */
import { getDDTable } from '../lib/ddsWasm.js'

// Worker: computes makeable contracts via DDS
self.onmessage = async (ev) => {
  const { id, action, deal } = ev.data || {}
  if (action !== 'compute' || !deal) {
    self.postMessage({ id, ok: false, error: 'bad_request' })
    return
  }
  try {
    const table = await getDDTable(deal)
    if (!table) {
      self.postMessage({ id, ok: false, error: 'unavailable' })
      return
    }
    self.postMessage({ id, ok: true, table })
  } catch (e) {
    self.postMessage({ id, ok: false, error: String((e && e.message) || e) })
  }
}
