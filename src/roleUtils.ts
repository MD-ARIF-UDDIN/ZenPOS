export type AppRole = 'admin' | 'manager' | 'cashier' | 'sales_executive' | string;

export const STAFF_ROLES = [
  { value: 'cashier', label: 'Cashier' },
  { value: 'sales_executive', label: 'Sales Executive' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Administrator' },
] as const;

/**
 * Returns true if the user's role is Cashier or Sales Executive.
 * Both roles have identical restricted permissions:
 * - Only see POS and Sales
 * - In Sales, only see the last 5 sales
 */
export const isRestrictedStaffRole = (role?: string | null): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase().replace(/[-_]/g, ' ').trim();
  return normalized === 'cashier' || normalized === 'sales executive';
};

/**
 * Formats a role value into a clean, human-readable label
 */
export const formatRoleName = (role?: string | null): string => {
  if (!role) return 'Cashier';
  const normalized = role.toLowerCase().replace(/[-_]/g, ' ').trim();
  if (normalized === 'admin' || normalized === 'administrator') return 'Administrator';
  if (normalized === 'manager') return 'Manager';
  if (normalized === 'sales executive') return 'Sales Executive';
  if (normalized === 'cashier') return 'Cashier';
  return role.charAt(0).toUpperCase() + role.slice(1);
};
