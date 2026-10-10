import { useRouter } from 'one'
import { Platform } from 'react-native'

import { authClient, clearAllAuth } from '~/features/auth/client/authClient'
import { queryClient } from '~/features/api/client/queryClient'
import { alertController } from '~/interface/alert/controller'
import { dialogConfirm, showError } from '~/interface/dialogs/actions'

export const useLogout = () => {
  const router = useRouter()

  const logout = async (options?: { skipConfirm?: boolean }) => {
    if (!options?.skipConfirm) {
      // android sheet overlays eat the opening tap and cancel confirm
      const confirmed =
        process.env.VITE_NATIVE && Platform.OS === 'android'
          ? await alertController.confirmAsync(
              'Log Out',
              'Are you sure you want to log out?',
              'Log Out',
            )
          : await dialogConfirm({
              title: 'Log Out',
              description: 'Are you sure you want to log out?',
            })

      if (!confirmed) return false
    }

    try {
      // start server sign-out first so the request still has the session cookie,
      // then drop local state immediately. a hung android fetch must not block logout.
      void authClient.$fetch('/sign-out', { method: 'POST' }).catch(() => {})
      clearAllAuth()
      queryClient.clear()
      // auth layout stays mounted while logged in and Redirects to /home/feed.
      // wait for logged-out to commit or onboarding sends you straight back.
      setTimeout(() => {
        router.replace('/auth/login')
      }, 0)
      return true
    } catch (error) {
      console.error('logout error:', error)
      showError(error, 'Logout')
      return false
    }
  }

  return { logout }
}
