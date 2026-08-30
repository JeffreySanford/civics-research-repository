/**
 * Encodes a canonical research-object identity as the URL-safe Base64 token expected by
 * `/research/:researchId`.
 *
 * The canonical identity itself is not changed. This is only a routing representation so
 * federated identifiers containing complete URLs remain one Angular path segment.
 */
export function encodeResearchId(canonicalId: string): string {
  if (!canonicalId.trim()) {
    throw new Error('Research identity must not be blank.');
  }

  const bytes = new TextEncoder().encode(canonicalId);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}
