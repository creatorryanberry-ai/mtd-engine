import { sleep } from '@mtd/helpers'

import { authClient } from './authClient'
import { standardizeBetterAuthError } from './betterAuthErrors'

type Result =
  | { success: true; error?: undefined }
  | {
      success: false
      error: { code: string; title: string; message: string }
    }

/**
 * Asks the server to send a login OTP code to the given email.
 */
export function validateLoginOtpCode(to: string, timeoutAfterMs = 8000): Promise<Result> {
  return Promise.race([
    validateLoginOtpCodeInfinite(to),
    sleep(timeoutAfterMs).then(() => {
      return {
        error: {
          code: `TIMEOUT`,
          title: `Timed out`,
          message: `Timed out verifying OTP code.`,
        },
        success: false,
      } satisfies Result
    }),
  ])
}

async function validateLoginOtpCodeInfinite(to: string): Promise<Result> {
  const { data, error } = await authClient.emailOtp.sendVerificationOtp({
    email: to,
    type: 'sign-in',
  })

  if (data?.success) {
    return { success: true }
  }

  const { code, message } = standardizeBetterAuthError(error)

  switch (code) {
    case 'INVALID_EMAIL':
      return {
        success: false,
        error: {
          code,
          title: 'Invalid Email',
          message: `The email address "${to}" is not valid. Please check and try again.`,
        },
      }

    case 'TOO_MANY_REQUESTS':
    case 'RATE_LIMIT_EXCEEDED':
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          title: 'Too Many Attempts',
          message: 'Please wait a minute before trying again.',
        },
      }

    default:
      return {
        success: false,
        error: {
          code,
          title: 'An Error Occurred',
          message: `Failed to send OTP: "${message}" (${code}). Please try again.`,
        },
      }
  }
}

/**
 * Login with an OTP code sent to the given email.
 */
export async function otpLogin(email: string, otp: string): Promise<Result> {
  const { error } = await authClient.signIn.emailOtp({
    email,
    otp,
  })

  if (!error) {
    return { success: true }
  }

  const { code, message } = standardizeBetterAuthError(error)

  switch (code) {
    case 'INVALID_OTP': {
      return {
        success: false,
        error: {
          code,
          title: 'Invalid OTP',
          message: `The OTP you entered is invalid. Please check the code and try again.`,
        },
      }
    }

    case 'OTP_EXPIRED': {
      return {
        success: false,

        error: {
          code,
          title: 'OTP Expired',
          message: `Your OTP has expired. Please request a new one.`,
        },
      }
    }

    case 'TOO_MANY_REQUESTS':
    case 'RATE_LIMIT_EXCEEDED': {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          title: 'Too Many Attempts',
          message: 'Please wait a minute before trying again.',
        },
      }
    }

    default: {
      return {
        success: false,

        error: {
          code,
          title: 'An Error Occurred',
          message: `Failed to log in: "${message}" (${code}). Please try again.`,
        },
      }
    }
  }
}
