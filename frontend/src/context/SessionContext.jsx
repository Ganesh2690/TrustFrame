import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../services/api'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem('trustframe_session')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const startSession = async (displayName, phoneNumber) => {
    const data = await api.startSession(displayName, phoneNumber)
    const s = {
      sessionId: data.session_id,
      displayName: data.display_name,
      phoneNumber: data.phone_number,
    }
    localStorage.setItem('trustframe_session', JSON.stringify(s))
    setSession(s)
    return s
  }

  const clearSession = () => {
    localStorage.removeItem('trustframe_session')
    setSession(null)
  }

  return (
    <SessionContext.Provider value={{ session, startSession, clearSession }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
