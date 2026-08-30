import { encodeResearchId } from './research-id';

function decodeResearchId(token: string): string {
  const base64 = token.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

describe('encodeResearchId', () => {
  it('keeps a URL-bearing federated identity in one URL-safe segment', () => {
    const identity =
      'DATA_GOV:https://data.transportation.gov/api/views/abcd-1234?agency=DOT&year=2026';

    const token = encodeResearchId(identity);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(token).not.toMatch(/[+/=]/u);
    expect(decodeResearchId(token)).toBe(identity);
  });

  it('round trips UTF-8 identities', () => {
    const identity = 'OPENALEX:https://openalex.org/W123/Überblick';

    expect(decodeResearchId(encodeResearchId(identity))).toBe(identity);
  });

  it('is deterministic', () => {
    const identity = 'tiger-line-north-dakota-2025';

    expect(encodeResearchId(identity)).toBe(encodeResearchId(identity));
  });

  it('rejects blank identities', () => {
    expect(() => encodeResearchId('   ')).toThrow(
      'Research identity must not be blank.',
    );
  });
});
