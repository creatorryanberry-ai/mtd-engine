import { Redirect } from 'one'

import { MTD_ROUTES } from '~/features/mtd/constants'

export default function HomeIndexRedirect() {
  return <Redirect href={MTD_ROUTES.overview} />
}
