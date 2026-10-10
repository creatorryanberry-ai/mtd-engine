import { EstimatedTaxFlowScreen } from '~/features/taxEstimate/components/EstimatedTaxFlowScreen'
import { createRoute } from 'one'

const route = createRoute<'/(app)/home/(tabs)/estimated-tax/[category]'>()

export default EstimatedTaxFlowScreen
export { route }
