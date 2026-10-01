'use client';

import { IonApp, IonContent, IonPage, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Redirect, useLocation } from 'react-router-dom';
import Providers from '@/queries/query-provider';
import Navbar from '@/components/navbar';
import { FloatingAgent } from '@/components/floating-agent';
import { useIsAuthenticated, useAuthLoading } from '@/store/auth-store';

import SignInPage from '@/ionic-pages/SignInPage';
import SignUpPage from '@/ionic-pages/SignUpPage';
import OnboardingPage from '@/ionic-pages/OnboardingPage';
import AuthCallbackPage from '@/ionic-pages/AuthCallbackPage';
import DashboardPage from '@/ionic-pages/DashboardPage';
import StatisticsPage from '@/ionic-pages/StatisticsPage';
import ManagePage from '@/ionic-pages/ManagePage';
import BillsPage from '@/ionic-pages/BillsPage';
import BudgetsPage from '@/ionic-pages/BudgetsPage';
import DebtsPage from '@/ionic-pages/DebtsPage';
import InvestmentsPage from '@/ionic-pages/InvestmentsPage';
import CategoriesPage from '@/ionic-pages/CategoriesPage';
import SettingsPage from '@/ionic-pages/SettingsPage';
import ProfilePage from '@/ionic-pages/ProfilePage';
import { TransactionsPage } from '@/ionic-pages/TransactionsPage';
import { WalletsPage } from '@/ionic-pages/WalletsPage';

/** Pages that need a signed-in user wait for the session check, then render or go to sign-in. */
function withAuth<P extends object>(Page: React.ComponentType<P>) {
  return function Guarded(props: P) {
    const isAuthenticated = useIsAuthenticated();
    const isAuthLoading = useAuthLoading();

    if (isAuthLoading) {
      return (
        <IonPage>
          <IonContent>
            <div className="flex h-full min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
            </div>
          </IonContent>
        </IonPage>
      );
    }
    if (!isAuthenticated) return <Redirect to="/signin" />;
    return <Page {...props} />;
  };
}

const GuardedOnboarding = withAuth(OnboardingPage);
const GuardedDashboard = withAuth(DashboardPage);
const GuardedStatistics = withAuth(StatisticsPage);
const GuardedManage = withAuth(ManagePage);
const GuardedBills = withAuth(BillsPage);
const GuardedBudgets = withAuth(BudgetsPage);
const GuardedDebts = withAuth(DebtsPage);
const GuardedInvestments = withAuth(InvestmentsPage);
const GuardedCategories = withAuth(CategoriesPage);
const GuardedSettings = withAuth(SettingsPage);
const GuardedProfile = withAuth(ProfilePage);
const GuardedTransactions = withAuth(TransactionsPage);
const GuardedWallets = withAuth(WalletsPage);

setupIonicReact({
  mode: 'md', // Use Material Design by default, auto-switches on iOS
});

function AppShellInner() {
  const location = useLocation();
  const hideNav = ['/', '/signin', '/signup', '/onboarding', '/auth/callback'].includes(location.pathname);
  const isAuthenticated = useIsAuthenticated();
  const isAuthLoading = useAuthLoading();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {!hideNav && <Navbar />}
      <div
        className={`flex-1 relative${!hideNav ? ' pb-(--bottom-nav-h) lg:pb-0' : ''}`}
      >
        <IonRouterOutlet id="main-content" style={{ height: '100%', position: 'relative', display: 'block' }}>
          <Route exact path="/signin" component={SignInPage} />
          <Route exact path="/signup" component={SignUpPage} />
          <Route exact path="/onboarding" component={GuardedOnboarding} />
          <Route exact path="/auth/callback" component={AuthCallbackPage} />
          <Route exact path="/dashboard" component={GuardedDashboard} />
          <Route exact path="/statistics" component={GuardedStatistics} />
          <Route exact path="/wallets" component={GuardedWallets} />
          <Route exact path="/transactions" component={GuardedTransactions} />
          <Route exact path="/manage" component={GuardedManage} />
          <Route exact path="/bills" component={GuardedBills} />
          <Route exact path="/budgets" component={GuardedBudgets} />
          <Route exact path="/debts" component={GuardedDebts} />
          <Route exact path="/investments" component={GuardedInvestments} />
          <Route exact path="/categories" component={GuardedCategories} />
          <Route exact path="/settings" component={GuardedSettings} />
          <Route exact path="/profile" component={GuardedProfile} />
          <Route exact path="/">
            {!isAuthLoading && <Redirect to={isAuthenticated ? '/dashboard' : '/signin'} />}
          </Route>
        </IonRouterOutlet>
      </div>
      {!hideNav && <FloatingAgent />}
    </div>
  );
}

export default function AppShell() {
  return (
    <Providers>
      <IonApp>
        <IonReactRouter>
          <AppShellInner />
        </IonReactRouter>
      </IonApp>
    </Providers>
  );
}
