export const PACKAGE_NAME = '@arkyc/widget'
export const VERSION = '0.1.0'

export type { WidgetController } from './controller'
export { ArkycClient, WidgetApiError } from './client'
export type { ClientSession, ClientRealtime, ProviderSignalHints, ArkycClientOptions } from './client'
export { createWidgetRealtimeClient } from './realtime'
export type { WidgetRealtimeClient, WidgetRealtimeFactory, WidgetRealtimeHandler } from './realtime'
export { Theme } from './theme'
export { Camera } from './capture'
export type { Facing } from './capture'
export { Flow } from './flow'
export type { FlowContext } from './flow'
export { createDefaultFaceAnalyzer, DEFAULT_TUNING, makeChallengeDetector, isSelfieReady } from './face'
export type { FaceAnalyzer, FaceSample, FaceTuning, ChallengeDetector } from './face'
export {
  createDefaultDocumentAnalyzer,
  DEFAULT_DOCUMENT_TUNING,
  analyzeDocumentGray,
  documentGuidance,
  isDocumentReady,
} from './document'
export type { DocumentAnalyzer, DocumentSample, DocumentTuning, DocRect } from './document'
export type { WidgetResult, ApiErrorKey } from '@arkyc/types'
export { ArkycWidget } from './ArkycWidget'
export { WidgetHandler } from './WidgetHandler'
export * from './types'
