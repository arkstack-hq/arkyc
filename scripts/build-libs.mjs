import { existsSync, readFileSync, readdirSync } from 'node:fs'

import { createRequire } from 'node:module'
/* eslint-disable no-undef */
/**
 * Build the workspace packages one at a time, dependencies first, each in its
 * own process. tsdown's workspace mode builds every package at once, which
 * peaks near 1 GB with declaration generation; one process per package stays
 * under 400 MB. Extra arguments are passed to tsdown.
 */
import { spawnSync } from 'node:child_process'

const tsdown = createRequire(import.meta.url).resolve('tsdown/run')

const manifests = readdirSync('packages', { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`packages/${entry.name}/package.json`))
  .map((entry) => JSON.parse(readFileSync(`packages/${entry.name}/package.json`, 'utf8')))

const names = new Set(manifests.map((manifest) => manifest.name))
const pending = new Map(
  manifests.map((manifest) => [
    manifest.name,
    Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies }).filter(
      (dep) => names.has(dep),
    ),
  ]),
)
const built = new Set()

while (pending.size) {
  const ready = [...pending].filter(([, deps]) => deps.every((dep) => built.has(dep))).map(([name]) => name)
  if (!ready.length) throw new Error(`Circular workspace dependencies: ${[...pending.keys()].join(', ')}`)

  for (const name of ready) {
    const result = spawnSync(process.execPath, [tsdown, '--filter', name, ...process.argv.slice(2)], {
      stdio: 'inherit',
    })
    if (result.status !== 0) process.exit(result.status ?? 1)
    built.add(name)
    pending.delete(name)
  }
}
