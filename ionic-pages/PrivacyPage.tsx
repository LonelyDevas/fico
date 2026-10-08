import { IonContent, IonPage } from '@ionic/react'

const CONTACT = 'joshuadg511@gmail.com'

const sections: { title: string; body: string[] }[] = [
  {
    title: 'What Fico is',
    body: ['Fico is a personal finance app for tracking wallets, transactions, budgets, bills, debts and investments. It is a private app made available to a small group of invited users.'],
  },
  {
    title: 'What we collect',
    body: [
      'Account details: your email address, your name and your sign-in method (email and password, or Google).',
      'Financial entries you type in: wallets and balances, transactions, categories, budgets, bills, debts, goals and investments, including any crypto coins and amounts you enter.',
      'Settings: your currency, theme and which Home cards you show.',
      'If you turn on bill reminders: a push notification address from your browser or device, used only to send you those reminders.',
    ],
  },
  {
    title: 'What we do not collect',
    body: [
      'Fico does not connect to your bank, does not read your SMS, contacts, location, photos or microphone, and does not hold any card numbers or bank passwords.',
      'There are no ads and no analytics or tracking tools, and your data is never sold or shared for marketing.',
    ],
  },
  {
    title: 'How your data is used',
    body: ['Your data is used only to run the app for you: showing your balances and reports, working out budget and bill status, and sending the reminders you asked for.'],
  },
  {
    title: 'Where it is stored and who else sees it',
    body: [
      'Your data is stored with Supabase, our database and sign-in provider, and the website is hosted on Vercel. Both act only as service providers. Data is sent over encrypted connections, and access is restricted so that each user can read only their own records.',
      'If you add crypto holdings, the app asks CoinGecko for the current price of the coin names you chose. Only the coin names and your currency are sent, never your amounts or your identity.',
      'If you sign in with Google, Google shares your name and email with us to create your account.',
    ],
  },
  {
    title: 'Keeping and deleting your data',
    body: [
      `Your data is kept while your account exists. To have your account and all its data deleted, email ${CONTACT} and it will be removed.`,
      'You can also turn off bill reminders at any time in Settings, which removes your notification address.',
    ],
  },
  {
    title: 'Children',
    body: ['Fico is not meant for children under 13, and we do not knowingly collect their data.'],
  },
  {
    title: 'Changes and contact',
    body: [`If this policy changes, the date below will be updated. Questions or requests: ${CONTACT}.`],
  },
]

export default function PrivacyPage() {
  return (
    <IonPage>
      <IonContent fullscreen>
        <main className="mx-auto max-w-2xl px-5 py-10 text-foreground">
          <h1 className="font-heading text-3xl font-bold">Fico Privacy Policy</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated: October 8, 2026</p>
          {sections.map((s) => (
            <section key={s.title} className="mt-7">
              <h2 className="font-heading text-lg font-semibold">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </main>
      </IonContent>
    </IonPage>
  )
}
