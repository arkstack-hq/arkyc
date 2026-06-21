export interface GenericApiResponsePayload {
  status: string
  code: number
  message: string
  errors?: Record<string, string[]>
}
