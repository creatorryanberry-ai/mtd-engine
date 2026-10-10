export function shouldAutoVerifyOtp(code: string, resending: boolean) {
  return !resending && code.length === 6
}
