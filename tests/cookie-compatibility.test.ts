import { expect, it } from 'vitest';
import { parse, serialize } from 'cookie';

// SvelteKit uses these two APIs. Its scoped cookie override supplies the patched
// validation while retaining the valid cookie behavior the framework expects.
it('round trips a valid encoded cookie with SvelteKit-style options', () => {
  const header = serialize('session', 'a b', { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 });
  expect(header).toBe('session=a%20b; Max-Age=60; Path=/; HttpOnly; Secure; SameSite=Lax');
  expect(parse(header).session).toBe('a b');
});

it('rejects cookie field injection through names, paths, and domains', () => {
  expect(() => serialize('session; injected', 'value')).toThrow();
  expect(() => serialize('session', 'value', { path: '/; HttpOnly' })).toThrow();
  expect(() => serialize('session', 'value', { domain: 'example.com\r\nInjected: true' })).toThrow();
});
