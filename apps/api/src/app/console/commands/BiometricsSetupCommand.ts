import { Command } from '@h3ravel/musket'
import { Logger } from '@arkstack/common'
import { LOCAL_MODELS, ModelStore, type LocalModelName } from '@arkyc/vision'
import { biometricModelDirectory } from '@app/services/providers'

/**
 * `ark biometrics:setup`: download and verify the open models the `local`
 * face-match and liveness drivers run on, into `BIOMETRICS_MODEL_DIR`.
 */
export class BiometricsSetupCommand extends Command {
  signature = 'biometrics:setup'

  description = 'Download the models for the local face-match and liveness drivers'

  async handle() {
    const store = new ModelStore(biometricModelDirectory)

    for (const name of Object.keys(LOCAL_MODELS) as LocalModelName[]) {
      const spec = LOCAL_MODELS[name]
      const downloaded = await store.ensure(name)

      Logger.success(`${spec.file} (${spec.license}) ${downloaded ? 'downloaded' : 'already present'}.`)
    }

    Logger.success(`Models are in ${biometricModelDirectory}.`)
  }
}
