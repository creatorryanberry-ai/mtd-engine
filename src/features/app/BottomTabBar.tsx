import { type Href } from 'one'
import { View, XStack } from 'tamagui'

import { Link } from '~/interface/app/Link'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'

type TabRoute = {
  name: string
  href: Href
  icon: any
}

const routes: TabRoute[] = [{ name: 'home', href: '/home/feed', icon: HouseIcon }]

export function BottomTabBar() {
  return (
    <View
      position="fixed"
      b={0}
      l={0}
      r={0}
      bg="$background08"
      boxShadow="0 0 10px $shadow4"
      display="flex"
      $lg={{ display: 'none' }}
      z={100}
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <XStack justify="space-around" height={60} items="center" px="$4">
        {routes.map((route) => {
          const Icon = route.icon

          return (
            <Link key={route.name} href={route.href} items="center" p="$2" rounded="$4">
              <Icon size={24} />
            </Link>
          )
        })}
      </XStack>
    </View>
  )
}
