/**
 * PM2 process definitions for self-hosting Arkyc in production.
 *
 * The deploy workflow (.github/workflows/deploy.yml) builds the app, runs
 * migrations, then `pm2 startOrReload ecosystem.config.cjs --update-env`.
 * The API loads `apps/api/.env` at startup, so only NODE_ENV is set here.
 */
module.exports = {
  apps: [
    {
      name: 'arkyc-api',
      cwd: './apps/api',
      // Production server entry emitted by `ark build` (apps/api `build` script).
      script: '.arkstack/build/server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
    },

    // Durable queue worker — only needed when QUEUE_CONNECTION is `database` or
    // `redis` (the default `sync` runs jobs inline). Uncomment to run it; the
    // deploy's `pm2 startOrReload ecosystem.config.cjs` picks it up automatically.
    // {
    //   name: 'arkyc-worker',
    //   cwd: './apps/api',
    //   script: 'node_modules/.bin/ark',
    //   args: 'queue:work',
    //   autorestart: true,
    //   env: { NODE_ENV: 'production' },
    // },
  ],
}
