import * as Device from 'expo-device'
import * as ImagePicker from 'expo-image-picker'
import { Alert, Platform } from 'react-native'

// Type that matches expo-image-picker's return type
export type ImagePickerResult = ImagePicker.ImagePickerResult

export const pickImageFromLibrary = async (
  allowsEditing = true,
): Promise<ImagePickerResult | null> => {
  if (Platform.OS === 'web') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing,
      ...(allowsEditing ? { aspect: [1, 1] as [number, number] } : {}),
      quality: 0.8,
    })

    if (!result.canceled) {
      return result
    }
    return null
  }

  const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

  if (!permissionResult.granted) {
    console.info('Permission to access media library was denied')
    Alert.alert(
      'Photo Access Required',
      'This feature requires photo access. You can enable it in your device settings.',
      [
        {
          text: 'OK',
          style: 'cancel',
        },
      ],
    )
    return null
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing,
    ...(allowsEditing ? { aspect: [1, 1] as [number, number] } : {}),
    quality: 0.8,
    // Let iOS always convert image to compatible format e.g. HEIC to JPEG
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  })

  if (!result.canceled) {
    return result
  }

  return null
}

export const takePhotoWithCamera = async (
  allowsEditing = true,
): Promise<ImagePickerResult | null> => {
  // web and simulators have no reliable camera — use the library instead
  if (Platform.OS === 'web' || !Device.isDevice) {
    return pickImageFromLibrary(allowsEditing)
  }

  try {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync()

    if (!permissionResult.granted) {
      console.info('Permission to access camera was denied')
      Alert.alert(
        'Camera Access Required',
        'This feature requires camera access. You can enable it in your device settings.',
        [
          {
            text: 'OK',
            style: 'cancel',
          },
        ],
      )
      return null
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      allowsEditing,
      ...(allowsEditing ? { aspect: [1, 1] as [number, number] } : {}),
      quality: 0.8,
    })

    if (!result.canceled) {
      return result
    }

    return null
  } catch (error) {
    console.info('[imagePicker] camera failed, falling back to library', error)
    return pickImageFromLibrary(allowsEditing)
  }
}
