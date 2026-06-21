import type { AlovaGenerics } from 'alova';
import type { ExportedState } from 'alova/client';
import type { ApiException } from '@/lib/Exceptions/ValidationException';

// Our alova `responded.onError` (see lib/requests/axios.ts) always throws a
// RequestException or its ValidationException subclass, never a bare Error.
// Narrow the exposed `error` state to that union so consumers can discriminate
// on `errors` (`if ('errors' in error)`) or via `ValidationException.is()`.
//
// Notes:
// - The type parameter MUST stay named `AG` to merge with alova's declaration.
// - Wrapping in `ExportedState<…, AG['StatesExport']>` keeps it framework-correct
//   and uses `AG`, avoiding the unused-param lint that would push toward a
//   rename that silently breaks the merge.
declare module 'alova/client' {
  interface UseHookExportedState<AG extends AlovaGenerics> {
    error: ExportedState<ApiException | undefined, AG['StatesExport']>;
  }
}
