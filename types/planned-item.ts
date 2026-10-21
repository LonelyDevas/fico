export type PlannedItemType = 'income' | 'expense';
export type PlannedItemStatus = 'expected' | 'confirmed';

export type PlannedItem = {
  id: string;
  name: string;
  type: PlannedItemType;
  amountLow: number;
  amountHigh: number;
  /** YYYY-MM-DD */
  date: string;
  status: PlannedItemStatus;
  categoryId?: string | null;
  category?: { name: string; icon?: string; color?: string } | null;
  notes?: string | null;
};

export type SavePlannedItemData = {
  name: string;
  type: PlannedItemType;
  amountLow: number;
  amountHigh: number;
  date: string;
  status: PlannedItemStatus;
  categoryId?: string | null;
  notes?: string | null;
};

export type UpdatePlannedItemData = SavePlannedItemData & { id: string };
