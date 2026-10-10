// re-export everything from react-native-svg (aliased to @tamagui/react-native-svg on web)
export * from 'react-native-svg'

// web svg filter primitives — keep separate from star export to avoid SSR conflicts
export { FeGaussianBlur, Filter } from './svg-filters'
