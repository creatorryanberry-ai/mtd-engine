export type PrivateUseSuggestion = {
  percent: number
  chipLabel: string
  preferredHmrcCategory: 'office_costs' | 'car_van_travel' | 'rent_rates_power'
}

type CatalogEntry = {
  match: string
  preferredHmrcCategory: PrivateUseSuggestion['preferredHmrcCategory']
  percent: number
  /** longer / more specific matches win */
  priority: number
}

const DEFAULT_PERCENT = 50

function entry(
  match: string,
  preferredHmrcCategory: PrivateUseSuggestion['preferredHmrcCategory'],
  priority = match.length,
  percent = DEFAULT_PERCENT,
): CatalogEntry {
  return {
    match: match.toLowerCase(),
    preferredHmrcCategory,
    priority,
    percent,
  }
}

/** uk merchants and keywords that commonly have private use — higher priority first */
const CATALOG: CatalogEntry[] = [
  // mobile / phone → office_costs
  entry('tesco mobile', 'office_costs'),
  entry('sky mobile', 'office_costs'),
  entry('id mobile', 'office_costs'),
  entry('giffgaff', 'office_costs'),
  entry('vodafone', 'office_costs'),
  entry('lebara', 'office_costs'),
  entry('smarty', 'office_costs'),
  entry('voxi', 'office_costs'),
  entry('lycamobile', 'office_costs'),
  entry('lyca mobile', 'office_costs'),
  entry('asda mobile', 'office_costs'),
  entry('superdrug mobile', 'office_costs'),
  entry('1p mobile', 'office_costs'),
  entry('freedompop', 'office_costs'),
  entry('spusu', 'office_costs'),
  entry('three.co', 'office_costs'),
  entry('3 mobile', 'office_costs'),
  entry('sim only', 'office_costs'),
  entry('sim-only', 'office_costs'),
  entry('o2.uk', 'office_costs'),
  entry('ee.co', 'office_costs'),
  entry('airtime', 'office_costs', 12),
  entry('handset', 'office_costs', 12),
  entry('mobile', 'office_costs', 10),
  entry('phone', 'office_costs', 10),
  // short network names matched as whole tokens
  entry('o2', 'office_costs', 18),
  entry('ee', 'office_costs', 16),
  entry('three', 'office_costs', 14),

  // broadband / internet → office_costs
  entry('virgin media', 'office_costs'),
  entry('sky broadband', 'office_costs'),
  entry('now broadband', 'office_costs'),
  entry('community fibre', 'office_costs'),
  entry('community fiber', 'office_costs'),
  entry('talktalk', 'office_costs'),
  entry('talk talk', 'office_costs'),
  entry('plusnet', 'office_costs'),
  entry('hyperoptic', 'office_costs'),
  entry('zen internet', 'office_costs'),
  entry('andrews & arnold', 'office_costs'),
  entry('andrews and arnold', 'office_costs'),
  entry('utility warehouse', 'office_costs'),
  entry('vodafone broadband', 'office_costs'),
  entry('ee broadband', 'office_costs'),
  entry('bt broadband', 'office_costs'),
  entry('bt internet', 'office_costs'),
  entry('bt.com', 'office_costs'),
  entry('openreach', 'office_costs'),
  entry('kcom', 'office_costs'),
  entry('toob', 'office_costs'),
  entry('youfibre', 'office_costs'),
  entry('youfiber', 'office_costs'),
  entry('gigaclear', 'office_costs'),
  entry('trooli', 'office_costs'),
  entry('broadband', 'office_costs', 14),
  entry('internet', 'office_costs', 12),
  entry('fibre', 'office_costs', 10),
  entry('fiber', 'office_costs', 10),
  entry('wifi', 'office_costs', 8),
  entry('wi-fi', 'office_costs', 8),
  entry('bt', 'office_costs', 14),

  // utilities → rent_rates_power
  entry('british gas', 'rent_rates_power'),
  entry('scottish power', 'rent_rates_power'),
  entry('scottishpower', 'rent_rates_power'),
  entry('octopus energy', 'rent_rates_power'),
  entry('octopus', 'rent_rates_power', 16),
  entry('e.on next', 'rent_rates_power'),
  entry('eon next', 'rent_rates_power'),
  entry('e.on', 'rent_rates_power'),
  entry('eon energy', 'rent_rates_power'),
  entry('edf energy', 'rent_rates_power'),
  entry('ovo energy', 'rent_rates_power'),
  entry('bulb energy', 'rent_rates_power'),
  entry('shell energy', 'rent_rates_power'),
  entry('so energy', 'rent_rates_power'),
  entry('utilita', 'rent_rates_power'),
  entry('outfox the market', 'rent_rates_power'),
  entry('foxglove energy', 'rent_rates_power'),
  entry('good energy', 'rent_rates_power'),
  entry('ecotricity', 'rent_rates_power'),
  entry('together energy', 'rent_rates_power'),
  entry('boost energy', 'rent_rates_power'),
  entry('pomelo energy', 'rent_rates_power'),
  entry('thames water', 'rent_rates_power'),
  entry('severn trent', 'rent_rates_power'),
  entry('united utilities', 'rent_rates_power'),
  entry('yorkshire water', 'rent_rates_power'),
  entry('anglian water', 'rent_rates_power'),
  entry('south west water', 'rent_rates_power'),
  entry('southern water', 'rent_rates_power'),
  entry('welsh water', 'rent_rates_power'),
  entry('dwr cymru', 'rent_rates_power'),
  entry('affinity water', 'rent_rates_power'),
  entry('castle water', 'rent_rates_power'),
  entry('business stream', 'rent_rates_power'),
  entry('waterplus', 'rent_rates_power'),
  entry('wave water', 'rent_rates_power'),
  entry('everflow', 'rent_rates_power'),
  entry('sse energy', 'rent_rates_power'),
  entry('npower', 'rent_rates_power'),
  entry('council tax', 'rent_rates_power', 16),
  entry('electricity', 'rent_rates_power', 12),
  entry('electric', 'rent_rates_power', 10),
  entry('energy', 'rent_rates_power', 8),
  entry('water', 'rent_rates_power', 8),
  entry('edf', 'rent_rates_power', 14),
  entry('ovo', 'rent_rates_power', 12),
  entry('bulb', 'rent_rates_power', 12),
  entry('gas', 'rent_rates_power', 10),

  // vehicle / fuel / travel → car_van_travel
  entry('tesco fuel', 'car_van_travel'),
  entry('tesco petrol', 'car_van_travel'),
  entry("sainsbury's fuel", 'car_van_travel'),
  entry('sainsburys fuel', 'car_van_travel'),
  entry('asda fuel', 'car_van_travel'),
  entry('morrisons fuel', 'car_van_travel'),
  entry('motor fuel', 'car_van_travel'),
  entry('applegreen', 'car_van_travel'),
  entry('euro garages', 'car_van_travel'),
  entry('eg group', 'car_van_travel'),
  entry('jet petrol', 'car_van_travel'),
  entry('gulf oil', 'car_van_travel'),
  entry('total energies', 'car_van_travel'),
  entry('certas energy', 'car_van_travel'),
  entry('ringgo', 'car_van_travel'),
  entry('ncp parking', 'car_van_travel'),
  entry('justpark', 'car_van_travel'),
  entry('yourparking', 'car_van_travel'),
  entry('parkingeye', 'car_van_travel'),
  entry('euro car parks', 'car_van_travel'),
  entry('mot test', 'car_van_travel'),
  entry('kwik fit', 'car_van_travel'),
  entry('kwik-fit', 'car_van_travel'),
  entry('national tyre', 'car_van_travel'),
  entry('ats euromaster', 'car_van_travel'),
  entry('enterprise rent', 'car_van_travel'),
  entry('enterprise car', 'car_van_travel'),
  entry('uber trip', 'car_van_travel'),
  entry('bolt.eu', 'car_van_travel'),
  entry('congestion charge', 'car_van_travel'),
  entry('dart charge', 'car_van_travel'),
  entry('car wash', 'car_van_travel'),
  entry('halfords', 'car_van_travel', 14),
  entry('texaco', 'car_van_travel'),
  entry('murco', 'car_van_travel'),
  entry('apcoa', 'car_van_travel'),
  entry('zipcar', 'car_van_travel'),
  entry('petrol', 'car_van_travel', 12),
  entry('diesel', 'car_van_travel', 12),
  entry('parking', 'car_van_travel', 12),
  entry('dartford', 'car_van_travel', 12),
  entry('esso', 'car_van_travel', 12),
  entry('hertz', 'car_van_travel', 12),
  entry('ulez', 'car_van_travel', 12),
  entry('dvla', 'car_van_travel', 12),
  entry('shell', 'car_van_travel', 14),
  entry('uber', 'car_van_travel', 12),
  entry('avis', 'car_van_travel', 12),
  entry('sixt', 'car_van_travel', 12),
  entry('bolt', 'car_van_travel', 10),
  entry('ncp', 'car_van_travel', 12),
  entry('jet', 'car_van_travel', 10),
  entry('bp', 'car_van_travel', 12),
  entry('fuel', 'car_van_travel', 8),
  entry('toll', 'car_van_travel', 8),
  entry('garage', 'car_van_travel', 8),
  entry('mot', 'car_van_travel', 8),
].sort(
  (left, right) =>
    right.priority - left.priority || right.match.length - left.match.length,
)

/** short tokens that must match as whole words to avoid false positives (ee in "fee") */
const WHOLE_WORD_MATCHES = new Set([
  'ee',
  'o2',
  'bt',
  'bp',
  'gas',
  'mot',
  'ncp',
  'jet',
  'ovo',
  'edf',
  'three',
  'shell',
  'uber',
  'bolt',
  'avis',
  'sixt',
  'bulb',
])

function matchesCatalogEntry(haystack: string, match: string) {
  if (WHOLE_WORD_MATCHES.has(match)) {
    return new RegExp(`(?:^|[^a-z0-9])${match.replace('.', '\\.')}(?:[^a-z0-9]|$)`).test(
      haystack,
    )
  }

  return haystack.includes(match)
}

export type SuggestPrivateUseOptions = {
  /** when false, skip car/fuel/parking matches (mileage claim method) */
  includeVehicle?: boolean
}

export function suggestPrivateUse(
  text: string,
  options?: SuggestPrivateUseOptions,
): PrivateUseSuggestion | null {
  const includeVehicle = options?.includeVehicle ?? true
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!normalized) return null

  for (const item of CATALOG) {
    if (!includeVehicle && item.preferredHmrcCategory === 'car_van_travel') continue
    if (!matchesCatalogEntry(normalized, item.match)) continue

    return {
      percent: item.percent,
      chipLabel: `Often ${item.percent}% private`,
      preferredHmrcCategory: item.preferredHmrcCategory,
    }
  }

  return null
}
