import { supabase } from '@/utils/supabase-client'
import { useSettingsStore } from '@/store/settings-store'

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase'

/**
 * Remember that onboarding is finished, on this device and on the account.
 * The device flag alone is lost on a new browser or when site data is cleared,
 * which used to send finished users back to onboarding at every login.
 */
export async function markOnboardingDone(): Promise<void> {
  useSettingsStore.getState().setOnboardingCompleted(true)
  if (!isSupabase()) return
  try {
    await supabase.auth.updateUser({ data: { onboarding_completed: true } })
  } catch {
    /* the device flag is already set; the account flag is retried at the next login */
  }
}

/** Has the signed-in account already been through onboarding? */
export async function isOnboardingDone(): Promise<boolean> {
  if (useSettingsStore.getState().onboardingCompleted) {
    // Save it on the account too, so other browsers and devices agree.
    void markOnboardingDone()
    return true
  }
  if (!isSupabase()) return false

  try {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user?.user_metadata?.onboarding_completed === true) {
      useSettingsStore.getState().setOnboardingCompleted(true)
      return true
    }

    // Accounts made before the flag existed: anyone who already has a wallet is set up.
    const { count } = await supabase.from('wallets').select('id', { count: 'exact', head: true })
    if ((count ?? 0) > 0) {
      await markOnboardingDone()
      return true
    }
  } catch {
    /* if we cannot tell, fall through and treat the account as new */
  }
  return false
}
