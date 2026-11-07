import { toSafeHttpUrl } from './url';

describe('toSafeHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(toSafeHttpUrl('https://github.com/a/b/issues/1')).toBe('https://github.com/a/b/issues/1');
    expect(toSafeHttpUrl('http://localhost:3000/x')).toBe('http://localhost:3000/x');
  });

  it('rejects other schemes, invalid values and empty input', () => {
    expect(toSafeHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(toSafeHttpUrl('data:text/html,hi')).toBeUndefined();
    expect(toSafeHttpUrl('not a url')).toBeUndefined();
    expect(toSafeHttpUrl('')).toBeUndefined();
    expect(toSafeHttpUrl(undefined)).toBeUndefined();
  });
});
