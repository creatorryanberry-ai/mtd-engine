import { DetailSlideCloseProvider } from '~/features/mtd/components/DetailSlideLayout'
import { SlideFromRightScreen } from '~/features/mtd/components/SlideFromRightScreen'
import { SubmissionsOverviewScreen } from '~/features/mtd/screens/SubmissionsOverviewScreen'

export default function SubmissionsRoute() {
  return (
    <SlideFromRightScreen>
      {(requestClose) => (
        <DetailSlideCloseProvider requestClose={requestClose}>
          <SubmissionsOverviewScreen />
        </DetailSlideCloseProvider>
      )}
    </SlideFromRightScreen>
  )
}
