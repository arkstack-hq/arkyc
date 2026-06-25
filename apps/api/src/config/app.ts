export default () => {
  return {
    env: env<string>('APP_ENV', 'local'),
    key: env<string>('APP_KEY', 'change-me'),
    url: env<string>('APP_URL', 'http://localhost'),
    name: env<string>('APP_NAME', 'Arkstack'),
    frontend_url: env<string>('FRONTEND_URL', 'http://localhost:3000'),
    website_url: env<string>('WEBSITE_URL', 'http://localhost:3000'),
  }
}
