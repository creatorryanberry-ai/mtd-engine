import { useEffect } from 'react'
import { Linking } from 'react-native'
import { useRouter, type Href } from 'one'

import { APP_SCHEME } from '~/features/auth/constants'
import { MTD_ROUTES } from '~/features/mtd/constants'

function handleUrl(url: string, navigate: (href: Href) => void) {
  if (url === `${APP_SCHEME}://home` || url === `${APP_SCHEME}://create-post`) {
    navigate(MTD_ROUTES.overview)
  }
}

export function useWidgetDeepLink() {
  const router = useRouter()

  useEffect(() => {
    const navigate = (href: Href) => {
      router.push(href)
    }

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url, navigate)
    })

    const sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url, navigate)
    })

    return () => sub.remove()
  }, [router])
}
