import { createContext, useContext, useState, useEffect } from 'react'
import { loadCommas } from '../utils/commaUtils'

const CommaContext = createContext(null)

export function CommaProvider({ children }) {
  const [commas, setCommas] = useState(null)

  useEffect(() => {
    loadCommas().then(setCommas)
  }, [])

  return (
    <CommaContext.Provider value={commas}>
      {children}
    </CommaContext.Provider>
  )
}

export function useCommas() {
  return useContext(CommaContext)
}
