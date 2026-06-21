export class StorageService {
  async set(key: string, value: unknown) {
    const stringValue =
      typeof value === 'string'
        ? value
        : JSON.stringify(value)

    localStorage.setItem(key, stringValue)
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = localStorage.getItem(key)

    if (value === null) return undefined

    try {
      return JSON.parse(value) as T
    } catch {
      return value as T
    }
  }

  async remove(key: string) {
    localStorage.removeItem(key)
  }

  async clear() {
    localStorage.clear()
  }
}
export const SecureStorage = new StorageService()
