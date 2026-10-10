import * as ImagePicker from 'expo-image-picker'

export type ImagePickerResult = ImagePicker.ImagePickerResult

export const pickImageFromLibrary = async (
  allowsEditing = true,
): Promise<ImagePickerResult | null> => {
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

export const takePhotoWithCamera = async (
  allowsEditing = true,
): Promise<ImagePickerResult | null> => {
  return pickImageFromLibrary(allowsEditing)
}
