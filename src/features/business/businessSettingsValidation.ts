export type BusinessType = 'self-employed' | 'landlord'
export type VehicleClaimMethod = 'mileage' | 'actual'

export type BusinessSettingsPatch = {
  businessName: string
  businessStartDate: string
  businessDescription: string
  businessType: BusinessType
  cisRegistered?: boolean | null
  vehicleClaimMethod: VehicleClaimMethod
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validateBusinessSettingsPatch(patch: BusinessSettingsPatch): void {
  if (!patch.businessName.trim()) {
    throw new Error('Business name is required')
  }

  if (!ISO_DATE_RE.test(patch.businessStartDate)) {
    throw new Error('Business start date must be YYYY-MM-DD')
  }

  const parsed = new Date(`${patch.businessStartDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Business start date is invalid')
  }

  if (!patch.businessDescription.trim()) {
    throw new Error('Business description is required')
  }

  if (patch.businessType !== 'self-employed' && patch.businessType !== 'landlord') {
    throw new Error('Business type must be self-employed or landlord')
  }

  if (
    patch.businessType === 'self-employed' &&
    typeof patch.cisRegistered !== 'boolean'
  ) {
    throw new Error('CIS registration status is required for self-employed')
  }

  if (patch.vehicleClaimMethod !== 'mileage' && patch.vehicleClaimMethod !== 'actual') {
    throw new Error('Vehicle claim method must be mileage or actual')
  }
}

export function normalizeBusinessSettingsPatch(patch: BusinessSettingsPatch) {
  return {
    businessName: patch.businessName.trim(),
    businessStartDate: patch.businessStartDate,
    businessDescription: patch.businessDescription.trim(),
    businessType: patch.businessType,
    cisRegistered: patch.businessType === 'self-employed' ? patch.cisRegistered! : null,
    vehicleClaimMethod: patch.vehicleClaimMethod,
    updatedAt: new Date().toISOString(),
  }
}
