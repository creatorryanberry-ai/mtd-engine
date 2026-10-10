import { router, type Href } from 'one'

import { CaretLeftIcon } from '../icons/phosphor/CaretLeftIcon'
import { HeaderButton, type HeaderButtonProps } from './HeaderButton'

type HeaderBackButtonProps = Omit<HeaderButtonProps, 'icon' | 'onPress'> & {
  /** fallback when there is no history to pop */
  backHref?: Href | string
}

export const HeaderBackButton = ({ backHref, ...props }: HeaderBackButtonProps) => {
  return (
    <HeaderButton
      icon={<CaretLeftIcon size={24} />}
      onPress={() => {
        if (router.canGoBack()) {
          router.back()
          return
        }
        if (backHref) router.replace(backHref as Href)
      }}
      aria-label="Go back"
      {...props}
    />
  )
}
