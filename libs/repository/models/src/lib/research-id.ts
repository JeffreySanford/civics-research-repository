/** Encode a canonical research-object identity as one URL-safe route segment. */
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
