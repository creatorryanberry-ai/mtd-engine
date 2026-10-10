import { Circle, Svg } from 'react-native-svg'

import { useResolvedIconColor } from '~/interface/icons/resolveIconColor'

import { MTD_TOKENS } from '../mtdTokens'

type CircularProgressProps = {
  progress: number
  size?: number
}

export function CircularProgress({ progress, size = 40 }: CircularProgressProps) {
  const strokeWidth = 3.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference
  const trackStroke = useResolvedIconColor(MTD_TOKENS.cardBorder)
  const progressStroke = useResolvedIconColor(MTD_TOKENS.orange)

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackStroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={progressStroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  )
}
