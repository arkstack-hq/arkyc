import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** A downloadable model, pinned by checksum. */
export interface ModelSpec {
  file: string
  url: string
  sha256: string
  license: string
  source: string
}

/** The models the local drivers use. Every licence permits commercial use in an MIT project. */
export const LOCAL_MODELS = {
  yunet: {
    file: 'face_detection_yunet_2023mar.onnx',
    url: 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx',
    sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
    license: 'MIT',
    source: 'https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet',
  },
  sface: {
    file: 'face_recognition_sface_2021dec.onnx',
    url: 'https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx',
    sha256: '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79',
    license: 'Apache-2.0',
    source: 'https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface',
  },
  minifasnet: {
    file: 'MiniFASNetV2.onnx',
    url: 'https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV2.onnx',
    sha256: 'b32929adc2d9c34b9486f8c4c7bc97c1b69bc0ea9befefc380e4faae4e463907',
    license: 'Apache-2.0',
    source: 'https://github.com/yakhyo/face-anti-spoofing',
  },
} satisfies Record<string, ModelSpec>

export type LocalModelName = keyof typeof LOCAL_MODELS

/** Model files in one directory, downloaded on request and verified by checksum. */
export class ModelStore {
  constructor(readonly directory: string) {}

  /**
   * The model's path, failing when it hasn't been downloaded.
   *
   * @param name
   * @returns
   */
  path(name: LocalModelName): string {
    const path = join(this.directory, LOCAL_MODELS[name].file)
    if (!existsSync(path)) {
      throw new Error(`Model "${name}" is missing from ${this.directory}. Run \`ark biometrics:setup\` first.`)
    }

    return path
  }

  /**
   * Download the model unless a verified copy is already present.
   *
   * @param name
   * @returns Whether it was downloaded.
   */
  async ensure(name: LocalModelName): Promise<boolean> {
    const spec = LOCAL_MODELS[name]
    const path = join(this.directory, spec.file)
    if (existsSync(path) && sha256(await readFile(path)) === spec.sha256) return false

    const res = await fetch(spec.url)
    if (!res.ok) throw new Error(`Downloading ${spec.file} failed with status ${res.status}`)

    const bytes = new Uint8Array(await res.arrayBuffer())
    const digest = sha256(bytes)
    if (digest !== spec.sha256) throw new Error(`${spec.file} checksum mismatch: got ${digest}`)

    await mkdir(this.directory, { recursive: true })
    await writeFile(`${path}.part`, bytes)
    await rename(`${path}.part`, path)

    return true
  }
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
