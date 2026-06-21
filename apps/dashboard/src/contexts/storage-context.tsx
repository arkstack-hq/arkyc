import { SecureStorage, StorageService } from '@/lib/Storage/SecureStorage'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

const StorageContext = createContext<StorageService | undefined>(undefined)

export function StorageProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => SecureStorage, [])

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>
}

export function useStorage() {
  const context = useContext(StorageContext)

  if (!context) {
    throw new Error('useStorage must be used within StorageProvider')
  }

  return context
}

export default StorageService
