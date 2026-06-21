import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        // Don't retry auth/permission/not-found errors.
        if (error instanceof ApiError && [401, 403, 404, 422].includes(error.status)) return false
        return count < 2
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})
