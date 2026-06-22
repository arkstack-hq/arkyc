export type AppEnvironment = {
  apiEnvironment: 'development' | 'production' | 'staging'
  apiUrl: string
  appEnvironment: 'development' | 'production' | 'testing'
  androidPushEnabled: boolean
}

type ApiEnv = 'development' | 'staging' | 'production'
type EnvironmentSource = Record<string, unknown>

const required = (source: EnvironmentSource, name: string) => {
  const value = String(source[name] ?? '').trim()

  if (!value) throw new Error(`Missing required environment variable: ${name}`)

  return value
}

const oneOf = <T extends string>(value: string, name: string, values: readonly T[]): T => {
  if (!values.includes(value as T)) {
    throw new Error(`${name} must be one of: ${values.join(', ')}`)
  }

  return value as T
}

export function validateAppEnvironment(source: EnvironmentSource): AppEnvironment {
  const apiEnvironment = oneOf(required(source, 'VITE_API_ENV'), 'VITE_API_ENV', [
    'development',
    'staging',
    'production',
  ] as const)
  const appEnvironment = oneOf(required(source, 'VITE_APP_ENV'), 'VITE_APP_ENV', [
    'development',
    'testing',
    'production',
  ] as const)
  const apiUrlKey =
    apiEnvironment === 'development'
      ? 'VITE_DEV_API_URL'
      : apiEnvironment === 'staging'
        ? 'VITE_STAGING_API_URL'
        : 'VITE_API_URL'
  const apiUrl = required(source, apiUrlKey)

  try {
    new URL(apiUrl)
  } catch {
    throw new Error(`${apiUrlKey} must be a valid absolute URL`)
  }

  return {
    apiEnvironment,
    apiUrl,
    appEnvironment,
    androidPushEnabled: String(source.VITE_ANDROID_PUSH_ENABLED ?? 'false') === 'true',
  }
}

export function getApiUrl(defaultValue: string): string {
  const apiEnv = (import.meta.env.VITE_API_ENV as ApiEnv) || 'development'

  const DEFAULT = import.meta.env.VITE_API_URL || defaultValue || 'http://localhost:3000/api'

  if (import.meta.env.PROD) {
    return import.meta.env.VITE_PROD_API_URL || DEFAULT
  }

  switch (apiEnv) {
    case 'production':
      return import.meta.env.VITE_PROD_API_URL || DEFAULT

    case 'staging':
      return import.meta.env.VITE_STAGING_API_URL || DEFAULT

    case 'development':
    default:
      return import.meta.env.VITE_DEV_API_URL || DEFAULT
  }
}

/**
 * Read the .env file
 *
 * @param env
 * @param def
 * @returns
 */
export const env = <X = string, Y = undefined>(env: string, defaultValue?: Y): Y extends undefined ? X : Y => {
  if (!!env && env.includes('VITE_API_URL')) {
    return getApiUrl(defaultValue as never) as never
  }

  let val: string | number | boolean | undefined | null = import.meta.env[env] ?? ''

  if ([true, 'true', 'on', false, 'false', 'off'].includes(val as never)) {
    val = [true, 'true', 'on'].includes(val as never)
  }

  if (!isNaN(Number(val)) && typeof val !== 'boolean' && typeof val !== 'undefined' && val !== '') {
    val = Number(val)
  }

  if (val === '') {
    val = undefined
  }

  if (val === 'null') {
    val = null
  }

  val ??= defaultValue as typeof val

  return val as Y extends undefined ? X : Y
}
