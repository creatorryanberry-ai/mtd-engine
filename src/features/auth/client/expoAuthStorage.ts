/** Web has no expo cookie jar; document cookies are cleared in better-auth-utils. */
export function createExpoAuthStorage() {
  return {
    getItem: (_key: string) => null,
    setItem: (_key: string, _value: string) => {},
  }
}

export function clearExpoAuthStorage() {}
