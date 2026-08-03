import { ReactNode } from 'react';

export interface NavItem {
  label: string;
  path: string;
  /** Permission-code prefix(es) that gate visibility — e.g. a user with any `claim.*` permission sees "Progress Claims". A role needs only one of the prefixes to match (e.g. Settings & RBAC is reachable via `settings.*` OR `user_management.*`). Absent means always visible (Dashboard). */
  permissionPrefix?: string | string[];
  icon: ReactNode;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-[17px] w-[17px] shrink-0">
      {children}
    </svg>
  );
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        path: '/',
        icon: (
          <Icon>
            <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
            <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
            <rect x="13" y="10.5" width="7.5" height="10" rx="1.5" />
            <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.5" />
          </Icon>
        ),
      },
      {
        label: 'CRM',
        path: '/crm',
        permissionPrefix: 'crm.',
        icon: (
          <Icon>
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19c0-3.3 2.6-6 6-6s6 2.7 6 6" />
            <circle cx="17.5" cy="7.5" r="2.3" />
            <path d="M15.3 12.2c2.7.2 4.7 2.4 4.7 5.3" />
          </Icon>
        ),
      },
    ],
  },
  {
    label: 'Delivery',
    items: [
      {
        label: 'Quotations',
        path: '/quotations',
        permissionPrefix: 'quotation.',
        icon: (
          <Icon>
            <path d="M6 3.5h9L19.5 8v12.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
            <path d="M15 3.5V8h4.5" />
            <path d="M8 12.5h8M8 15.5h8M8 18.5h5" />
          </Icon>
        ),
      },
      {
        label: 'Projects',
        path: '/projects',
        permissionPrefix: 'project.',
        icon: (
          <Icon>
            <path d="M3.5 8.5 12 4l8.5 4.5-8.5 4.5-8.5-4.5Z" />
            <path d="M3.5 8.5V16L12 20.5 20.5 16V8.5" />
            <path d="M12 13v7.5" />
          </Icon>
        ),
      },
      {
        label: 'Procurement & PO',
        path: '/procurement',
        permissionPrefix: 'procurement.',
        icon: (
          <Icon>
            <path d="M3.5 5.5h2.2l1 11.4a1.6 1.6 0 0 0 1.6 1.5h9.4a1.6 1.6 0 0 0 1.6-1.4l1-8.6H6.4" />
            <circle cx="9.5" cy="20" r="1.1" />
            <circle cx="17" cy="20" r="1.1" />
          </Icon>
        ),
      },
      {
        label: 'Inventory',
        path: '/inventory',
        permissionPrefix: 'inventory.',
        icon: (
          <Icon>
            <path d="M4 7.5 12 3.5l8 4v9L12 20.5l-8-4Z" />
            <path d="M4 7.5 12 11.5l8-4" />
            <path d="M12 11.5v9" />
          </Icon>
        ),
      },
    ],
  },
  {
    label: 'Commercials',
    items: [
      {
        label: 'Progress Claims',
        path: '/claims',
        permissionPrefix: 'claim.',
        icon: (
          <Icon>
            <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-2.5-1.5-2.5 1.5-2.5-1.5-2.5 1.5-2.5-1.5-1.5.9V4.5a1 1 0 0 1 1-1Z" />
            <path d="M9 8h6M9 11.5h6M9 15h4" />
          </Icon>
        ),
      },
      {
        label: 'Variation Orders',
        path: '/variation-orders',
        permissionPrefix: 'variation_order.',
        icon: (
          <Icon>
            <circle cx="6.5" cy="6" r="2.3" />
            <circle cx="6.5" cy="18" r="2.3" />
            <circle cx="17.5" cy="12" r="2.3" />
            <path d="M6.5 8.3V15.7" />
            <path d="M8.6 6.9c3.6.5 6.4 2.6 6.9 5.1" />
          </Icon>
        ),
      },
      {
        label: 'Project Costing',
        path: '/costing',
        permissionPrefix: 'costing.',
        icon: (
          <Icon>
            <path d="M4 20V10.5M10 20V4.5M16 20v-7M20 20v-4" />
            <path d="M3 20h18" />
          </Icon>
        ),
      },
      {
        label: 'Invoices & Payments',
        path: '/invoices',
        permissionPrefix: 'accounting.',
        icon: (
          <Icon>
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M8 9h8M8 13h8M8 17h5" />
          </Icon>
        ),
      },
    ],
  },
  {
    label: 'Workforce',
    items: [
      {
        label: 'Timesheets',
        path: '/timesheets',
        permissionPrefix: 'timesheet.',
        icon: (
          <Icon>
            <circle cx="12" cy="12.5" r="8" />
            <path d="M12 8v4.5l3 2" />
            <path d="M9 2.5h6" />
          </Icon>
        ),
      },
      {
        label: 'Payroll',
        path: '/payroll',
        permissionPrefix: 'payroll.',
        icon: (
          <Icon>
            <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
            <path d="M3.5 10h17" />
            <path d="M7 14h4" />
          </Icon>
        ),
      },
    ],
  },
  {
    label: 'Insight & Admin',
    items: [
      {
        label: 'Documents',
        path: '/documents',
        permissionPrefix: 'document.',
        icon: (
          <Icon>
            <path d="M6.5 3.5h7L18 8v12a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1Z" />
            <path d="M13 3.5V8h4.5" />
          </Icon>
        ),
      },
      {
        label: 'Reports',
        path: '/reports',
        permissionPrefix: 'reporting.',
        icon: (
          <Icon>
            <path d="M4 4.5v15h16" />
            <path d="M7.5 16 11 11l3 2.5 4.5-6" />
          </Icon>
        ),
      },
      {
        label: 'Settings & RBAC',
        path: '/settings',
        permissionPrefix: ['settings.', 'user_management.'],
        icon: (
          <Icon>
            <circle cx="12" cy="12" r="2.6" />
            <path d="M19.4 13.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V19.5a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H4.5a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10.5a1.6 1.6 0 0 0 1-1.5V4.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10.5a1.6 1.6 0 0 0 1.5 1H19.5a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
          </Icon>
        ),
      },
    ],
  },
];
