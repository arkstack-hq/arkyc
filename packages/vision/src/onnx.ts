/** A loaded ONNX model: named float32 inputs in, named float32 outputs out. */
export class OnnxModel {
  private constructor(private readonly session: OrtSession) {}

  /**
   * Load a model from disk with onnxruntime-node.
   *
   * @param path
   * @returns
   */
  static async load(path: string): Promise<OnnxModel> {
    const ort = await OnnxModel.runtime()

    return new OnnxModel(await ort.InferenceSession.create(path))
  }

  get inputName(): string {
    return this.session.inputNames[0]!
  }

  /**
   * Run the model on one input tensor.
   *
   * @param data
   * @param dims
   * @returns Each output's data by name.
   */
  async run(data: Float32Array, dims: number[]): Promise<Record<string, Float32Array>> {
    const ort = await OnnxModel.runtime()
    const outputs = await this.session.run({ [this.inputName]: new ort.Tensor('float32', data, dims) })

    return Object.fromEntries(Object.entries(outputs).map(([name, tensor]) => [name, tensor.data as Float32Array]))
  }

  private static runtime(): Promise<OrtModule> {
    return import('onnxruntime-node').catch(() => {
      throw new Error('Local biometrics need the `onnxruntime-node` package installed')
    }) as Promise<OrtModule>
  }
}

interface OrtSession {
  inputNames: readonly string[]
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: unknown }>>
}

interface OrtModule {
  InferenceSession: { create(path: string): Promise<OrtSession> }
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown
}
