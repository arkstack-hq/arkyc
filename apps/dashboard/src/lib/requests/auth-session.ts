import { SecureStorage } from "../Storage/SecureStorage";

const authPreferenceKeys = [
  'authToken',
  'pendingTwoFactorToken',
  'pendingTwoFactorEmail',
  'emailVerified',
  'onboardingComplete',
  'pendingEmail',
  'pendingPhone',
  'phoneVerified',
  'facialVerified',
  'addressVerified',
] as const;

type UnauthorizedHandler = () => Promise<void> | void;

let unauthorizedHandler: UnauthorizedHandler | undefined;
let unauthorizedPromise: Promise<void> | null = null;

export async function clearPersistedAuthState() {
  await Promise.all(
    authPreferenceKeys.map((key) => SecureStorage.remove(key)),
  );
}

export function setUnauthorizedHandler(handler?: UnauthorizedHandler) {
  unauthorizedHandler = handler;
}

export async function handleUnauthorized() {
  if (unauthorizedPromise) {
    await unauthorizedPromise;
    return;
  }

  unauthorizedPromise = (async () => {
    const authToken = await SecureStorage.get('arkyc:authToken')

    if (!authToken) {
      return;
    }

    if (unauthorizedHandler) {
      await unauthorizedHandler();
      return;
    }

    await clearPersistedAuthState();
  })();

  try {
    await unauthorizedPromise;
  } finally {
    unauthorizedPromise = null;
  }
}
