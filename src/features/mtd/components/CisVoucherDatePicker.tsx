import { isoToDate } from '~/features/business/businessDateFormat'
import { toCisVoucherIsoDate } from '~/features/bankAccounts/utils/cisVoucher'
import { MtdDatePicker } from '~/interface/forms/MtdDatePicker'

type CisVoucherDatePickerProps = {
  value: string
  onChange: (isoDate: string) => void
  placeholder?: string
}

export function CisVoucherDatePicker({
  value,
  onChange,
  placeholder = '05/MM/YYYY',
}: CisVoucherDatePickerProps) {
  return (
    <MtdDatePicker
      value={value}
      placeholder={placeholder}
      title="Tax month end"
      onChange={(isoDate) => {
        const next = isoToDate(isoDate)
        if (Number.isNaN(next.getTime())) return
        onChange(toCisVoucherIsoDate(next.getFullYear(), next.getMonth() + 1))
      }}
    />
  )
}
