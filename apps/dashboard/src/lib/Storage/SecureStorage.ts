export class StorageService {
  async set(key: string, value: string) {
    localStorage.setItem(key, value)
  }
  async get<T>(key: string): Promise<T | undefined> {
    return (localStorage.getItem(key) ?? undefined) as T
  }
  async remove(key: string) {
    localStorage.removeItem(key)
  }
  async clear() {
    localStorage.clear()
  }
}

export const SecureStorage = new StorageService()
