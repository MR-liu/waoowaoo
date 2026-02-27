export async function readOptionalValue<T>(params: {
  read: () => Promise<T>
  fallback: T
  onError?: (error: unknown) => void
}): Promise<T> {
  try {
    return await params.read()
  } catch (error: unknown) {
    params.onError?.(error)
    return params.fallback
  }
}
