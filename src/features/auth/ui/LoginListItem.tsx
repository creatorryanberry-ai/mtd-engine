import { useAuth } from '~/features/auth/client/authClient'
import { UserIcon } from '~/interface/icons/phosphor/UserIcon'
import { Link } from '~/interface/app/Link'
import { ListItem, type ListItemProps } from '~/interface/lists/ListItem'

export const LoginListItem = (props: ListItemProps) => {
  const { loginText, loginLink } = useAuth()

  return (
    <Link href={loginLink} asChild>
      <ListItem {...props}>
        <ListItem.Icon>
          <UserIcon />
        </ListItem.Icon>
        <ListItem.Text>{loginText}</ListItem.Text>
      </ListItem>
    </Link>
  )
}
