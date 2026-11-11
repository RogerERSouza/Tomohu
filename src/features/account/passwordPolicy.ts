export const passwordHint =
  'Use de 5 a 128 caracteres, com uma letra maiúscula, uma minúscula e um número.'
export function validNewPassword(value: string): boolean {
  return (
    value.length >= 5 &&
    value.length <= 128 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value)
  )
}
