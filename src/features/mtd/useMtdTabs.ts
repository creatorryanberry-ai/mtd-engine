import { useBusinessSettings } from '~/features/business/useBusinessSettings'
import { getMtdTabs } from '~/features/mtd/constants'

export function useMtdTabs() {
  const { settings, isLoading } = useBusinessSettings()
  const showMileage = settings?.vehicleClaimMethod === 'mileage'

  return {
    tabs: getMtdTabs(),
    showMileage,
    isLoading,
  }
}
