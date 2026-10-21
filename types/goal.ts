export type GoalStatus = 'active' | 'archived';

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  /** YYYY-MM-DD, or null for a goal without a deadline. */
  deadline: string | null;
  /** Wallets whose balance counts toward the goal. Empty means every savings wallet. */
  linkedWalletIds: string[];
  status: GoalStatus;
  createdAt?: string;
};

export type CreateGoalData = {
  name: string;
  targetAmount: number;
  deadline?: string | null;
  linkedWalletIds?: string[];
};

export type UpdateGoalData = {
  id: string;
  name?: string;
  targetAmount?: number;
  deadline?: string | null;
  linkedWalletIds?: string[];
  status?: GoalStatus;
};
