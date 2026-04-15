import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
})

export const api = {
  startSession: async (displayName, phoneNumber) => {
    const { data } = await http.post('/api/session/start', {
      display_name: displayName || null,
      phone_number: phoneNumber || null,
    })
    return data
  },

  listEvents: async () => {
    const { data } = await http.get('/api/events')
    return data
  },

  createEvent: async (name, description) => {
    const { data } = await http.post('/api/events', { name, description })
    return data
  },

  getEvent: async (eventCode) => {
    const { data } = await http.get(`/api/events/${eventCode}`)
    return data
  },

  uploadFile: async (file, sessionId, metadata, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    form.append('session_id', sessionId)
    if (metadata.clientTimestamp) form.append('client_timestamp', metadata.clientTimestamp)
    if (metadata.gpsLat != null) form.append('gps_lat', String(metadata.gpsLat))
    if (metadata.gpsLng != null) form.append('gps_lng', String(metadata.gpsLng))
    if (metadata.gpsAddress) form.append('gps_address', metadata.gpsAddress)
    if (metadata.deviceModel) form.append('device_model', metadata.deviceModel)
    if (metadata.osVersion) form.append('os_version', metadata.osVersion)
    if (metadata.browser) form.append('browser', metadata.browser)
    if (metadata.eventId) form.append('event_id', metadata.eventId)

    const { data } = await http.post('/api/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      },
    })
    return data
  },

  associateEvent: async (assetId, eventId) => {
    const { data } = await http.patch(`/api/uploads/${assetId}/event`, { event_id: eventId })
    return data
  },

  getReport: async (token) => {
    const { data } = await http.get(`/api/reports/${token}`)
    return data
  },

  // QR codes
  getEventQrCodeUrl: (eventCode) => `${BASE_URL}/api/events/${eventCode}/qrcode`,
  getAppQrCodeUrl: () => `${BASE_URL}/api/app-entry-qrcode`,

  // Admin (requires X-Admin-Secret header)
  adminStats: async (secret) => {
    const { data } = await http.get('/api/admin/stats', {
      headers: { 'X-Admin-Secret': secret },
    })
    return data
  },

  adminUploads: async (secret, params = {}) => {
    const { data } = await http.get('/api/admin/uploads', {
      headers: { 'X-Admin-Secret': secret },
      params,
    })
    return data
  },

  adminEvents: async (secret, params = {}) => {
    const { data } = await http.get('/api/admin/events', {
      headers: { 'X-Admin-Secret': secret },
      params,
    })
    return data
  },

  adminReports: async (secret, params = {}) => {
    const { data } = await http.get('/api/admin/reports', {
      headers: { 'X-Admin-Secret': secret },
      params,
    })
    return data
  },
}
