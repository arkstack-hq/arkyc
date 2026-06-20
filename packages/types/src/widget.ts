import type { ProjectBranding } from './project';
import type { VerificationDecision, VerificationStatus } from './verification';

/** How the widget mounts into the host page. */
export type WidgetMode = 'overlay' | 'inline' | 'hosted';

/** The screens of the widget verification flow, in order. */
export type WidgetStep =
  | 'welcome'
  | 'document_selection'
  | 'front_capture'
  | 'back_capture'
  | 'ocr_processing'
  | 'selfie_capture'
  | 'passive_liveness'
  | 'face_match'
  | 'processing'
  | 'result';

/** The result handed to the widget's `onComplete` callback. */
export interface WidgetResult {
  status: VerificationStatus;
  decision: VerificationDecision | null;
}

/** Options for launching/mounting the embeddable widget. */
export interface WidgetOptions {
  /** Short-lived client token minted by the backend for this session. */
  token: string;
  mode?: WidgetMode;
  /** Element (or selector) to mount into when `mode` is `inline`. */
  container?: string | HTMLElement;
  branding?: ProjectBranding;
  baseUrl?: string;
  onComplete?: (result: WidgetResult) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}
