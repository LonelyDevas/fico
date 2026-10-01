'use client'

import { useRef, useState } from 'react'
import { useHistory } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Camera, IdCard, KeyRound, LogOut, Mail, Shield, Trash2, Upload, User as UserIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth-store'
import { UserAvatar } from '@/components/ui/user-avatar'
import { useLogout, useUpdateAvatar, useUpdateName, useUpdatePassword, useUpdateUsername } from '@/queries/auth/auth'

export function ProfilePageContent() {
  const history = useHistory()
  const user = useAuthStore((state) => state.user)
  const setAuth = useAuthStore((state) => state.setAuth)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const [username, setUsername] = useState(user?.username ?? '')
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const { mutate: updateUsername, isPending: isSavingUsername } = useUpdateUsername()
  const { mutate: updatePassword, isPending: isSavingPassword } = useUpdatePassword()
  const { mutate: logout } = useLogout()
  const { mutate: updateName, isPending: isSavingName } = useUpdateName()
  const { mutate: updateAvatar, isPending: isSavingAvatar } = useUpdateAvatar()
  const fileInput = useRef<HTMLInputElement>(null)

  const changeAvatar = (args: { file?: File; url?: string }, message: string) => {
    if (!user) return
    updateAvatar(
      { userId: user._id, ...args },
      {
        onSuccess: (avatarUrl) => {
          setAuth({ ...user, avatarUrl })
          toast.success(message)
        },
      }
    )
  }

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) changeAvatar({ file }, 'Profile picture updated')
  }

  const canUseGoogle = !!user?.googleAvatarUrl && user.avatarUrl !== user.googleAvatarUrl

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  const nameChanged = firstName.trim() !== (user?.firstName ?? '') || lastName.trim() !== (user?.lastName ?? '')

  const handleSaveName = () => {
    if (!user || !nameChanged) return
    const first = firstName.trim()
    const last = lastName.trim()
    updateName(
      { userId: user._id, firstName: first, lastName: last },
      {
        onSuccess: () => {
          setAuth({ ...user, firstName: first, lastName: last })
          toast.success('Name updated')
        },
      }
    )
  }

  const usernameChanged = username.trim() !== '' && username.trim() !== user?.username

  const handleSaveUsername = () => {
    if (!user || !usernameChanged) return
    const trimmed = username.trim()
    updateUsername(
      { userId: user._id, username: trimmed },
      {
        onSuccess: () => {
          setAuth({ ...user, username: trimmed })
          toast.success('Username updated')
        },
      }
    )
  }

  const handleChangePassword = () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    updatePassword(newPassword, {
      onSuccess: () => {
        toast.success('Password updated')
        setNewPassword('')
        setConfirmPassword('')
      },
    })
  }

  const handleSignOut = () => {
    logout(undefined, {
      onSettled: () => {
        clearAuth()
        history.push('/signin')
      },
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-background to-secondary/40 p-6 shadow-ios">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <UserAvatar user={user} className="size-20 text-3xl" />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={isSavingAvatar}
              aria-label="Change profile picture"
              className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-ios disabled:opacity-60"
            >
              <Camera className="size-4" />
            </button>
            <input ref={fileInput} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{fullName || user?.username || 'Account'}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {fullName && user?.username ? `@${user.username} · ` : ''}
              {user?.email}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary" className="capitalize">{user?.status ?? 'active'}</Badge>
              <Badge variant="outline" className="capitalize">{user?.provider ?? 'local'}</Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1.5 rounded-full" disabled={isSavingAvatar} onClick={() => fileInput.current?.click()}>
            <Upload className="size-4" />
            {isSavingAvatar ? 'Saving...' : 'Upload photo'}
          </Button>
          {canUseGoogle && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full"
              disabled={isSavingAvatar}
              onClick={() => changeAvatar({ url: user?.googleAvatarUrl }, 'Using your Google photo')}
            >
              Use Google photo
            </Button>
          )}
          {!!user?.avatarUrl && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5 rounded-full text-destructive hover:text-destructive"
              disabled={isSavingAvatar}
              onClick={() => changeAvatar({}, 'Profile picture removed')}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          )}
        </div>
      </section>

      <Card className="border-border/70 bg-card/90 shadow-ios backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <IdCard className="size-4" />
            Name
          </CardTitle>
          <CardDescription>Your first and last name, shown on your profile and in greetings.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="First name" aria-label="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
            <Input placeholder="Last name" aria-label="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
          </div>
          <Button className="mt-3" onClick={handleSaveName} disabled={!nameChanged || isSavingName}>
            {isSavingName ? 'Saving...' : 'Save name'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-ios backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserIcon className="size-4" />
            Username
          </CardTitle>
          <CardDescription>This is how you sign in and how your name appears in Fico.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input value={username} onChange={(event) => setUsername(event.target.value)} className="sm:max-w-xs" />
            <Button onClick={handleSaveUsername} disabled={!usernameChanged || isSavingUsername}>
              {isSavingUsername ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-ios backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="size-4" />
            Email
          </CardTitle>
          <CardDescription>Contact support to change the email tied to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-border/70 bg-secondary/30 px-4 py-3 text-sm text-foreground">
            {user?.email || 'No email on file'}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-ios backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="size-4" />
            Password
          </CardTitle>
          <CardDescription>Choose a new password with at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            className="mt-3"
            onClick={handleChangePassword}
            disabled={isSavingPassword || !newPassword || !confirmPassword}
          >
            {isSavingPassword ? 'Updating...' : 'Update password'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-ios backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="size-4" />
            Session
          </CardTitle>
          <CardDescription>Sign out of Fico on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
