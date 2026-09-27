'use client'

import { useState } from 'react'
import { useHistory } from 'react-router-dom'
import toast from 'react-hot-toast'
import { KeyRound, LogOut, Mail, Shield, User as UserIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth-store'
import { useLogout, useUpdatePassword, useUpdateUsername } from '@/queries/auth/auth'

const getInitial = (value?: string) => (value ? value.trim().charAt(0).toUpperCase() : 'U')

export function ProfilePageContent() {
  const history = useHistory()
  const user = useAuthStore((state) => state.user)
  const setAuth = useAuthStore((state) => state.setAuth)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const [username, setUsername] = useState(user?.username ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const { mutate: updateUsername, isPending: isSavingUsername } = useUpdateUsername()
  const { mutate: updatePassword, isPending: isSavingPassword } = useUpdatePassword()
  const { mutate: logout } = useLogout()

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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
            {getInitial(user?.username || user?.email)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{user?.username || 'Account'}</h1>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary" className="capitalize">{user?.status ?? 'active'}</Badge>
              <Badge variant="outline" className="capitalize">{user?.provider ?? 'local'}</Badge>
            </div>
          </div>
        </div>
      </section>

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
