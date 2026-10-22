import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Command } from '@h3ravel/musket'
import { Logger } from '@arkstack/common'
import { faceMatchDriver, livenessDriver } from '@app/services/providers'

interface Pair {
  a: string
  b: string
  same: boolean
}

/**
 * `ark biometrics:benchmark <pairs>`: run the configured face-match driver over
 * labelled image pairs (`a.jpg,b.jpg,same|different` per line, paths relative to
 * the file) and report accuracy and latency. With `--liveness`, also time the
 * liveness driver on every image.
 */
export class BiometricsBenchmarkCommand extends Command {
  signature = `biometrics:benchmark
        {pairs : Path to a CSV of labelled image pairs}
        {--liveness : Also time the liveness driver on each image}
    `

  description = 'Measure face-match accuracy and biometric latency on a labelled test set'

  async handle() {
    const file = resolve(String(this.argument('pairs')))
    const pairs = await this.pairs(file)

    if (!pairs.length) {
      Logger.error('No pairs found.')

      return
    }

    const timings: number[] = []
    let falseAccepts = 0
    let falseRejects = 0
    let same = 0

    for (const pair of pairs) {
      const [documentPortrait, selfie] = await Promise.all([readFile(pair.a), readFile(pair.b)])
      const started = performance.now()
      const result = await faceMatchDriver.compare({ documentPortrait, selfie })

      timings.push(performance.now() - started)

      if (pair.same) same += 1

      if (pair.same && !result.passed) falseRejects += 1

      if (!pair.same && result.passed) falseAccepts += 1
    }

    const different = pairs.length - same

    Logger.success(`Face match (${faceMatchDriver.name}) on ${pairs.length} pairs:`)
    Logger.success(`  accuracy ${percent(1 - (falseAccepts + falseRejects) / pairs.length)}`)
    Logger.success(`  false accepts ${falseAccepts}/${different} (${percent(falseAccepts / (different || 1))})`)
    Logger.success(`  false rejects ${falseRejects}/${same} (${percent(falseRejects / (same || 1))})`)
    Logger.success(`  latency ${summary(timings)}`)

    if (this.option('liveness')) {
      const liveness: number[] = []

      for (const path of new Set(pairs.flatMap((pair) => [pair.a, pair.b]))) {
        const selfie = await readFile(path)
        const started = performance.now()

        await livenessDriver.check({ selfie })
        liveness.push(performance.now() - started)
      }
      Logger.success(`Liveness (${livenessDriver.name}) latency ${summary(liveness)}`)
    }
  }

  private async pairs(file: string): Promise<Pair[]> {
    const base = dirname(file)

    return (await readFile(file, 'utf8'))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const [a, b, label] = line.split(',').map((part) => part.trim())

        return { a: resolve(base, a!), b: resolve(base, b!), same: label === 'same' }
      })
  }
}

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`

/** Median and p95 in milliseconds, after the first (model loading) run. */
function summary(timings: number[]): string {
  const warm = (timings.length > 1 ? timings.slice(1) : timings).sort((a, b) => a - b)
  const at = (q: number) => warm[Math.min(warm.length - 1, Math.floor(q * warm.length))]!.toFixed(0)

  return `median ${at(0.5)} ms, p95 ${at(0.95)} ms, first ${timings[0]!.toFixed(0)} ms`
}
