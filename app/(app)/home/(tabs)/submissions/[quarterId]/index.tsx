import { Redirect, createRoute } from 'one'

import { QuarterDetailScreen } from '~/features/mtd/screens/QuarterDetailScreen'
import { MTD_ROUTES } from '~/features/mtd/constants'
import { parseQuarterId } from '~/features/mtd/utils/quarterPeriods'

const route = createRoute<'/(app)/home/(tabs)/submissions/[quarterId]'>()

export default function QuarterDetailRoute() {
  const { quarterId: quarterIdParam } = route.useParams()
  const quarterId = parseQuarterId(quarterIdParam)

  if (!quarterId) {
    return <Redirect href={MTD_ROUTES.submissions} />
  }

  return <QuarterDetailScreen quarterId={quarterId} />
}
