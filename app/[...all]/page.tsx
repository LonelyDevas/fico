import AppWrapper from '../../components/AppWrapper'

export const dynamicParams = false

export async function generateStaticParams() {
  return [
    { all: ['signin'] },
    { all: ['signup'] },
    { all: ['dashboard'] },
    { all: ['statistics'] },
    { all: ['wallets'] },
    { all: ['transactions'] },
    { all: ['budgets'] },
    { all: ['manage'] },
    { all: ['bills'] },
    { all: ['debts'] },
    { all: ['investments'] },
    { all: ['categories'] },
    { all: ['settings'] },
    { all: ['profile'] },
    { all: ['onboarding'] },
    { all: ['auth', 'callback'] },
  ]
}

export default function Page() {
  return <AppWrapper />
}
