import { RequestException } from "./RequestException";

export type ApiException = (RequestException & { errors?: never }) | ValidationException;

export class ValidationException extends RequestException {
  public flat: Record<string, string>;
  public list: Record<string, Array<{ message?: string }>>;
  public errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>, statusCode: number = 422) {
    super(message, statusCode);
    this.name = 'ValidationException';
    this.errors = errors;

    this.flat = Object.keys(errors).reduce((acc, key) => {
      return Object.assign(acc, { [key]: errors[key]?.[0] });
    }, {} as Record<string, string>);

    this.list = Object.keys(errors).reduce((acc, key) => {
      return Object.assign(acc, { [key]: errors[key]?.map((message) => ({ message })) });
    }, {} as Record<string, Array<{ message?: string }>>);
  }

  /**
   * Discriminator guard. Narrows a thrown error (e.g. alova's exposed
   * `error: RequestException | undefined`) to a ValidationException — the
   * 422 case that carries field errors.
   *
   * @param error
   * @returns
   */
  static is(error: unknown): error is ValidationException {
    return error instanceof ValidationException;
  }

  /**
   * Return a copy without the given field's errors. Immutable so it can be
   * fed back into React/alova state to re-render (e.g. clear a field on edit):
   * `setError((prev) => prev?.delete('email'))`.
   *
   * @param key
   * @returns
   */
  delete(key: string): ValidationException {
    const errors = { ...this.errors };
    delete errors[key];
    return new ValidationException(this.message, errors, this.statusCode);
  }

  /**
   * Return a copy with all field errors cleared.
   *
   * @returns
   */
  reset(): ValidationException {
    return new ValidationException(this.message, {}, this.statusCode);
  }
}
