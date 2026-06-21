import type { DocumentType, VerificationDecision, WidgetStep } from '@arkyc/types';
import { Camera } from './capture';
import type { Facing } from './capture';
import { Theme } from './theme';

/** High-level events the view raises back to the controller. */
export interface ViewHandlers {
  onClose(): void;
  onStart(): void;
  onDocumentSelected(type: DocumentType, country: string): void;
  /** A capture screen produced an image (or `null` when skipped in demo mode). */
  onImage(blob: Blob | null): void;
  /** The result screen was acknowledged ("Done"). */
  onAcknowledge(): void;
}

/** Per-render data the view needs for the current step. */
export interface ViewState {
  step: WidgetStep;
  documentType: DocumentType | null;
  decision?: VerificationDecision | null;
  statusLabel?: string;
  errorMessage?: string;
  /** Show a "Skip" affordance on capture screens (demo / mock-driver flows). */
  allowSkip?: boolean;
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  passport: 'Passport',
  id_card: 'ID Card',
  drivers_license: "Driver's License",
  residence_permit: 'Residence Permit',
};

interface ElProps {
  class?: string;
  text?: string;
  html?: string;
  type?: string;
  src?: string;
  accept?: string;
  placeholder?: string;
  value?: string;
  [attr: string]: string | undefined;
}

/**
 * Renders the widget's screens into a host element. DOM- and camera-injectable
 * so it can run under a fake DOM in tests. The view owns capture-screen camera
 * mechanics and raises only high-level events to the controller.
 */
export class WidgetView {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly footer: HTMLElement;
  private readonly camera: Camera;

  constructor(
    private readonly doc: Document,
    private readonly theme: Theme,
    private readonly handlers: ViewHandlers,
    nav: Navigator = globalThis.navigator,
  ) {
    this.camera = new Camera(doc, nav);
    this.root = this.el('div', { class: 'arkyc-root' });

    const style = this.el('style', { text: theme.stylesheet() });
    this.root.appendChild(style);

    const card = this.el('div', { class: 'arkyc-card' });
    const header = this.el('div', { class: 'arkyc-header' });
    if (theme.logoUrl) {
      header.appendChild(this.el('img', { class: 'arkyc-logo', src: theme.logoUrl }));
    } else {
      header.appendChild(this.el('p', { class: 'arkyc-title', text: 'Verify your identity' }));
    }
    const close = this.el('button', { class: 'arkyc-close', html: '&times;', 'aria-label': 'Close' });
    close.addEventListener('click', () => this.handlers.onClose());
    header.appendChild(close);

    this.body = this.el('div', { class: 'arkyc-body' });
    this.footer = this.el('div', { class: 'arkyc-footer' });

    card.appendChild(header);
    card.appendChild(this.body);
    card.appendChild(this.footer);
    this.root.appendChild(card);
  }

  /** The widget's root element — append this to the overlay / container. */
  get element(): HTMLElement {
    return this.root;
  }

  /** Release any active camera stream. */
  destroy(): void {
    this.camera.stop();
  }

  /** Render the screen for the given state. */
  render(state: ViewState): void {
    this.destroy();
    this.clear(this.body);
    this.clear(this.footer);

    switch (state.step) {
      case 'welcome':
        return this.renderWelcome();
      case 'document_selection':
        return this.renderDocumentSelection();
      case 'front_capture':
        return this.renderCapture('Front of document', 'environment', state.allowSkip);
      case 'back_capture':
        return this.renderCapture('Back of document', 'environment', state.allowSkip);
      case 'selfie_capture':
        return this.renderCapture('Take a selfie', 'user', state.allowSkip, true);
      case 'ocr_processing':
        return this.renderProcessing('Reading your document…');
      case 'passive_liveness':
        return this.renderProcessing('Checking liveness…');
      case 'face_match':
        return this.renderProcessing('Matching your face…');
      case 'processing':
        return this.renderProcessing(state.statusLabel ?? 'Finalising verification…');
      case 'result':
        return this.renderResult(state.decision ?? null, state.errorMessage);
    }
  }

  private renderWelcome(): void {
    this.body.appendChild(this.el('h2', { class: 'arkyc-h', text: 'Verify your identity' }));
    this.body.appendChild(
      this.el('p', {
        class: 'arkyc-p',
        text: 'You will need a government-issued ID and a moment to take a selfie. Your data is processed securely.',
      }),
    );
    this.footer.appendChild(this.button('Get started', () => this.handlers.onStart()));
  }

  private renderDocumentSelection(): void {
    this.body.appendChild(this.el('h2', { class: 'arkyc-h', text: 'Select your document' }));
    const country = this.el('input', {
      class: 'arkyc-btn arkyc-btn-ghost',
      placeholder: 'Country code (e.g. US)',
      'aria-label': 'Country code',
    }) as HTMLInputElement;
    this.body.appendChild(country);

    const choices = this.el('div', { class: 'arkyc-choices' });
    (Object.keys(DOCUMENT_LABELS) as DocumentType[]).forEach((type) => {
      const btn = this.button(DOCUMENT_LABELS[type], () =>
        this.handlers.onDocumentSelected(type, (country.value || '').trim().toUpperCase()),
      );
      btn.classList.add('arkyc-btn-ghost');
      choices.appendChild(btn);
    });
    this.body.appendChild(choices);
  }

  private renderCapture(title: string, facing: Facing, allowSkip?: boolean, selfie = false): void {
    this.body.appendChild(this.el('h2', { class: 'arkyc-h', text: title }));
    this.body.appendChild(
      this.el('p', { class: 'arkyc-p', text: 'Position it clearly in frame, then capture.' }),
    );

    const fileInput = this.el('input', {
      type: 'file',
      accept: 'image/*',
      class: 'arkyc-hidden',
    }) as HTMLInputElement;
    fileInput.addEventListener('change', () => this.handlers.onImage(Camera.fileFromInput(fileInput)));
    this.body.appendChild(fileInput);

    if (this.camera.supported) {
      const video = this.el('video', { class: `arkyc-preview${selfie ? ' selfie' : ''}` }) as HTMLVideoElement;
      this.body.appendChild(video);
      void this.camera.start(video, facing).catch(() => {
        // Camera denied/unavailable — fall back to the file input.
        video.classList.add('arkyc-hidden');
        fileInput.click();
      });

      this.footer.appendChild(
        this.button('Capture', () => {
          void this.camera.grabFrame(video).then((blob) => this.handlers.onImage(blob));
        }),
      );
    } else {
      const upload = this.button('Upload photo', () => fileInput.click());
      this.footer.appendChild(upload);
    }

    if (allowSkip) {
      const skip = this.button('Skip (demo)', () => this.handlers.onImage(null));
      skip.classList.add('arkyc-btn-ghost');
      this.footer.appendChild(skip);
    }
  }

  private renderProcessing(label: string): void {
    this.body.appendChild(this.el('div', { class: 'arkyc-spinner' }));
    this.body.appendChild(this.el('p', { class: 'arkyc-p', text: label }));
  }

  private renderResult(decision: VerificationDecision | null, errorMessage?: string): void {
    if (errorMessage) {
      this.body.appendChild(this.el('div', { class: 'arkyc-badge err', html: '!' }));
      this.body.appendChild(this.el('h2', { class: 'arkyc-h', text: 'Something went wrong' }));
      this.body.appendChild(this.el('p', { class: 'arkyc-p', text: errorMessage }));
    } else {
      const map = {
        approved: { cls: 'ok', icon: '✓', title: 'Verified', copy: 'Your identity has been verified.' },
        requires_review: {
          cls: 'warn',
          icon: '⏳',
          title: 'Under review',
          copy: 'Your verification is being reviewed. We will be in touch shortly.',
        },
        rejected: {
          cls: 'err',
          icon: '✕',
          title: 'Not verified',
          copy: 'We could not verify your identity. Please try again.',
        },
      } as const;
      const r = map[decision ?? 'requires_review'] ?? map.requires_review;
      this.body.appendChild(this.el('div', { class: `arkyc-badge ${r.cls}`, text: r.icon }));
      this.body.appendChild(this.el('h2', { class: 'arkyc-h', text: r.title }));
      this.body.appendChild(this.el('p', { class: 'arkyc-p', text: r.copy }));
    }
    this.footer.appendChild(this.button('Done', () => this.handlers.onAcknowledge()));
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const btn = this.el('button', { class: 'arkyc-btn', text: label }) as HTMLButtonElement;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private clear(node: HTMLElement): void {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  private el<T extends HTMLElement = HTMLElement>(tag: string, props: ElProps = {}): T {
    const node = this.doc.createElement(tag) as T;
    for (const [key, value] of Object.entries(props)) {
      if (value == null) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'value' || key === 'src' || key === 'type' || key === 'accept' || key === 'placeholder') {
        (node as unknown as Record<string, string>)[key] = value;
      } else node.setAttribute(key, value);
    }
    return node;
  }
}
