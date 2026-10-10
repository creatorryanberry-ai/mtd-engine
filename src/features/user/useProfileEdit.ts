import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useDebounceValue } from 'tamagui'

import { apiFetch } from '~/features/api/client/apiFetch'
import { useUser } from '~/features/user/useUser'
import { showToast } from '~/interface/toast/helpers'

function checkUsernameValid(username: string) {
  if (username.length < 3) return false
  if (!username.match(/^[a-z][a-z0-9_]+$/)) return false
  return true
}

export const useProfileEdit = () => {
  const { user, update } = useUser()
  const [isSaving, setIsSaving] = useState(false)
  const [username, setUsername] = useState(user?.username || '')
  const [name, setName] = useState(user?.name || '')
  const [isTouched, setIsTouched] = useState(false)
  const [isUsernameBlocked, setIsUsernameBlocked] = useState(false)

  const lowernameUsername = username.trim().toLowerCase()
  const debouncedUsername = useDebounceValue(lowernameUsername, 500)
  const isUsernameValid = checkUsernameValid(debouncedUsername)
  const isUsernameInvalid = (debouncedUsername && !isUsernameValid) || isUsernameBlocked

  const { data: availability, isFetching: isCheckingAvailability } = useQuery({
    queryKey: ['username-available', debouncedUsername],
    queryFn: () =>
      apiFetch<{ available: boolean }>(
        `/api/users/username-available?username=${encodeURIComponent(debouncedUsername)}`,
      ),
    enabled: isUsernameValid && debouncedUsername !== user?.username,
  })

  const trimmedUsername = username.trim().toLowerCase()
  const isAvailable =
    debouncedUsername === user?.username ||
    (isUsernameValid && availability?.available === true)

  const isUnavailable =
    isUsernameValid &&
    debouncedUsername !== user?.username &&
    availability?.available === false

  const hasUnsavedChanges =
    isTouched && (trimmedUsername !== user?.username || name.trim() !== user?.name)

  const canSave =
    isUsernameValid && !isCheckingAvailability && !isUnavailable && hasUnsavedChanges

  const handleAvatarUpload = async (url: string) => {
    if (!user?.id) return
    try {
      await update({ image: url })
      showToast('Avatar updated', { type: 'success' })
    } catch {
      showToast('Failed to update avatar', { type: 'error' })
    }
  }

  const handleSave = async () => {
    if (isSaving || !canSave) return

    setIsSaving(true)

    try {
      await update({
        username: username.trim(),
        name: name.trim(),
      })

      setIsTouched(false)
      showToast('Profile updated', { type: 'success' })
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('Blocked username')) {
        setIsUsernameBlocked(true)
      } else {
        showToast('Failed to update profile', { type: 'error' })
      }
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleNameChange = (text: string) => {
    if (text.length <= 40) {
      setName(text)
      setIsTouched(true)
    }
  }

  const handleUsernameChange = (text: string) => {
    if (text.length <= 30) {
      setUsername(text)
      setIsTouched(true)
      if (isUsernameBlocked) {
        setIsUsernameBlocked(false)
      }
    }
  }

  return {
    user,
    username,
    name,
    isSaving,
    isCheckingAvailability,
    isAvailable,
    isUnavailable,
    isUsernameInvalid,
    hasUnsavedChanges,
    canSave,
    debouncedUsername,
    handleAvatarUpload,
    handleSave,
    handleNameChange,
    handleUsernameChange,
  }
}
