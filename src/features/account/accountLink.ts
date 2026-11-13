export interface AccountLink {
  purpose: 'verify' | 'reset' | 'private'
  token: string
}
export function readAccountLink(hash: string): AccountLink | null {
  const match = /^#account\/(verify|reset|private)\/([^/]{1,200})$/.exec(hash)
  return match
    ? { purpose: match[1] as AccountLink['purpose'], token: match[2] }
    : null
}
