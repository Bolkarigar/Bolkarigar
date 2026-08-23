/**
 * BolKarigar RBAC — role-based permissions (owner / manager / cashier / staff)
 */

const PERMISSIONS = {
  STAFF_MANAGE: 'staff.manage',
  PROFILE_EDIT: 'profile.edit',
  DATA_CLEAR: 'data.clear',
  SALES_DELETE: 'sales.delete',
  LEDGER_DELETE: 'ledger.delete',
  ITEM_DELETE: 'inventory.delete',
  INVOICE_CREATE: 'invoice.create',
  UDHAR_PAY: 'udhar.pay',
  UDHAR_VIEW: 'udhar.view',
  REPORTS_VIEW: 'reports.view',
  GSTR_EXPORT: 'gstr.export',
  KHATA_WRITE: 'khata.write',
  KHATA_READ: 'khata.read',
  TALLY_SYNC: 'tally.sync',
  TALLY_TOKEN: 'tally.token',
  CONTRACTOR: 'contractor.manage',
  COMPANIES: 'companies.manage',
  INVENTORY_WRITE: 'inventory.write',
  PROJECTS_WRITE: 'projects.write',
  EXPENSES_WRITE: 'expenses.write',
  BANK_RECON: 'bank.recon',
  PAYROLL_VIEW: 'payroll.view',
  PAYROLL_MANAGE: 'payroll.manage',
  ATTENDANCE_SELF: 'attendance.self'
};

const ROLE_PERMISSIONS = {
  owner: null,
  manager: [
    PERMISSIONS.INVOICE_CREATE, PERMISSIONS.SALES_DELETE, PERMISSIONS.UDHAR_VIEW, PERMISSIONS.UDHAR_PAY,
    PERMISSIONS.REPORTS_VIEW, PERMISSIONS.GSTR_EXPORT, PERMISSIONS.KHATA_READ, PERMISSIONS.KHATA_WRITE,
    PERMISSIONS.TALLY_SYNC, PERMISSIONS.CONTRACTOR, PERMISSIONS.INVENTORY_WRITE, PERMISSIONS.ITEM_DELETE,
    PERMISSIONS.LEDGER_DELETE, PERMISSIONS.PROJECTS_WRITE, PERMISSIONS.EXPENSES_WRITE, PERMISSIONS.BANK_RECON
  ],
  cashier: [
    PERMISSIONS.INVOICE_CREATE, PERMISSIONS.UDHAR_VIEW, PERMISSIONS.UDHAR_PAY, PERMISSIONS.KHATA_READ,
    PERMISSIONS.PROJECTS_WRITE
  ],
  staff: [
    PERMISSIONS.ATTENDANCE_SELF
  ]
};

const ROLE_LABELS = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  staff: 'Staff'
};

const TAB_ACCESS = {
  overviewPanel: ['owner'],
  invoicePanel: ['owner', 'manager', 'cashier'],
  voicePanel: ['owner', 'manager', 'cashier'],
  projectPanel: ['owner', 'manager', 'cashier'],
  inventoryPanel: ['owner', 'manager', 'cashier'],
  totalSalesPanel: ['owner', 'manager', 'cashier'],
  contractorPanel: ['owner', 'manager'],
  ledgerPanel: ['owner', 'manager', 'cashier'],
  khataLedgersPanel: ['owner', 'manager', 'cashier'],
  khataItemsPanel: ['owner', 'manager', 'cashier'],
  khataVoucherPanel: ['owner', 'manager', 'cashier'],
  khataDaybookPanel: ['owner', 'manager', 'cashier'],
  reportsProPanel: ['owner', 'manager'],
  bankReconPanel: ['owner'],
  galleryPanel: ['owner', 'manager', 'cashier', 'staff'],
  todoPanel: ['owner', 'manager', 'cashier', 'staff'],
  qrPanel: ['owner', 'manager', 'cashier', 'staff'],
  calcPanel: ['owner', 'manager', 'cashier', 'staff'],
  converterPanel: ['owner', 'manager', 'cashier', 'staff'],
  notesPanel: ['owner', 'manager', 'cashier', 'staff'],
  mediaPanel: ['owner', 'manager', 'cashier', 'staff'],
  staffPanel: ['owner'],
  payrollPanel: ['owner', 'manager', 'cashier', 'staff'],
  companiesPanel: ['owner'],
  helpPanel: ['owner', 'manager', 'cashier', 'staff']
};

function effectiveRole(req) {
  if (req.isStaffAccount) return req.userRole || 'staff';
  return 'owner';
}

function getPermissionsForRole(role) {
  if (role === 'owner' || !role) return ['*'];
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.staff;
}

function can(role, permission) {
  if (!role || role === 'owner') return true;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(permission);
}

function canAccessTab(role, tabId) {
  const r = role || 'owner';
  const allowed = TAB_ACCESS[tabId];
  if (!allowed) return true;
  return allowed.includes(r);
}

function requirePermission(...permissions) {
  return (req, res, next) => {
    const role = effectiveRole(req);
    if (role === 'owner') return next();
    for (const p of permissions) {
      if (can(role, p)) return next();
    }
    return res.status(403).json({
      error: 'Aapke role me yeh kaam allowed nahi hai.',
      required: permissions,
      role
    });
  };
}

function requireOwner(req, res, next) {
  if (req.isStaffAccount) {
    return res.status(403).json({ error: 'Sirf business owner yeh kaam kar sakta hai.' });
  }
  next();
}

function requireDashboardUpdate(req, res, next) {
  const role = effectiveRole(req);
  if (role === 'owner') return next();
  const { type } = req.body || {};
  const map = {
    todos: true,
    invoices: can(role, PERMISSIONS.INVOICE_CREATE),
    projects: can(role, PERMISSIONS.PROJECTS_WRITE),
    expenses: can(role, PERMISSIONS.EXPENSES_WRITE)
  };
  if (map[type]) return next();
  return res.status(403).json({ error: `Aapke role (${role}) me ${type} update allowed nahi hai.` });
}

module.exports = {
  PERMISSIONS,
  ROLE_LABELS,
  TAB_ACCESS,
  effectiveRole,
  getPermissionsForRole,
  can,
  canAccessTab,
  requirePermission,
  requireOwner,
  requireDashboardUpdate
};
