const key = 'tomohu.signed-out'

/** A denial preference, never a credential or permission to access cached data. */
export function locallySignedOut(): boolean {
  try {
    if (localStorage.getItem(key)) return true
  } catch {
    /* Try the tab marker. */
  }
  try {
    return Boolean(sessionStorage.getItem(key))
  } catch {
    return true
  }
}
export function rememberSignOut(value: boolean): void {
  for (const storage of [() => localStorage, () => sessionStorage]) {
    try {
      if (value) storage().setItem(key, 'true')
      else storage().removeItem(key)
    } catch {
      /* Server revocation remains authoritative when storage is unavailable. */
    }
  }
}
export const signOutPreferenceKey = key
