/**
 * BolKarigar Payroll — Employee attendance & monthly salary (Business ₹299)
 * Shop/office staff: fixed monthly salary, half-day, paid/unpaid leave, advances.
 */
const ATTENDANCE_STATUSES = ['present', 'absent', 'half_day', 'paid_leave', 'unpaid_leave'];
const STATUS_LABELS = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  paid_leave: 'Paid Leave',
  unpaid_leave: 'Unpaid Leave (Chutti)'
};
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dateKeyFromParts(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayKey() {
  const n = new Date();
  return dateKeyFromParts(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function parseDateKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function calcMonthlySalary(employee, attendanceByDate, advances, year, month) {
  const dim = daysInMonth(year, month);
  const join = employee.joinDate ? new Date(employee.joinDate) : null;
  let workingDays = 0;
  let presentDays = 0;
  let halfDays = 0;
  let paidLeaves = 0;
  let unpaidLeaves = 0;
  let absentDays = 0;
  const dailyRows = [];

  for (let d = 1; d <= dim; d++) {
    const dt = new Date(year, month - 1, d);
    if (join && dt < new Date(join.getFullYear(), join.getMonth(), join.getDate())) continue;

    const key = dateKeyFromParts(year, month, d);
    const dow = dt.getDay();
    const isWeeklyOff = dow === (employee.weeklyOff ?? 0);

    if (isWeeklyOff) {
      dailyRows.push({ date: key, weekday: WEEKDAY_NAMES[dow], status: 'weekly_off', earned: 0 });
      continue;
    }

    workingDays++;
    const rec = attendanceByDate[key];
    let status = rec?.status || 'absent';
    let earned = 0;

    if (!rec) {
      absentDays++;
      earned = 0;
    } else {
      switch (status) {
        case 'present':
          presentDays++;
          earned = 1;
          break;
        case 'half_day':
          halfDays++;
          earned = 0.5;
          break;
        case 'paid_leave':
          paidLeaves++;
          earned = 1;
          break;
        case 'unpaid_leave':
          unpaidLeaves++;
          earned = 0;
          break;
        default:
          absentDays++;
          status = 'absent';
          earned = 0;
      }
    }
    dailyRows.push({ date: key, weekday: WEEKDAY_NAMES[dow], status, earned, note: rec?.note || '' });
  }

  const earnedDays = presentDays + halfDays * 0.5 + paidLeaves;
  const perDayRate = workingDays > 0 ? employee.monthlySalary / workingDays : 0;
  const grossSalary = Math.round(earnedDays * perDayRate * 100) / 100;
  const totalAdvances = (advances || []).reduce((s, a) => s + (a.amount || 0), 0);
  const netPayable = Math.max(0, Math.round((grossSalary - totalAdvances) * 100) / 100);

  return {
    year,
    month,
    workingDays,
    presentDays,
    halfDays,
    paidLeaves,
    unpaidLeaves,
    absentDays,
    earnedDays,
    perDayRate: Math.round(perDayRate * 100) / 100,
    monthlySalary: employee.monthlySalary,
    grossSalary,
    totalAdvances,
    netPayable,
    dailyRows
  };
}

function setupPayrollFeatures({ app, mongoose, authenticateToken, models, rbac, requireBusinessPlan }) {
  const { User, BusinessProfile } = models;
  const { requireOwner } = rbac;
  const biz = requireBusinessPlan || ((req, res, next) => next());

  /** Staff Meri Hajri — Pro ya Business, jab owner plan active ho */
  function requireStaffHajriOrBusiness(req, res, next) {
    if (req.subscription?.fullAccess) return next();
    if (req.isStaffAccount && req.subscription?.isActive) return next();
    return res.status(403).json({
      error: 'Hajri ke liye owner ka plan active hona chahiye.',
      code: 'PLAN_UPGRADE_REQUIRED'
    });
  }

  const hajri = requireStaffHajriOrBusiness;

  const employeeSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    designation: { type: String, default: 'Staff' },
    monthlySalary: { type: Number, required: true, min: 0 },
    weeklyOff: { type: Number, default: 0, min: 0, max: 6 },
    joinDate: { type: Date, default: Date.now },
    linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true }
  }, { timestamps: true });

  const attendanceSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollEmployee', required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    note: { type: String, default: '' },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }, { timestamps: true });
  attendanceSchema.index({ employeeId: 1, dateKey: 1 }, { unique: true });

  const advanceSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollEmployee', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    month: { type: Number, min: 1, max: 12 },
    year: { type: Number },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now }
  }, { timestamps: true });

  const PayrollEmployee = mongoose.models.PayrollEmployee || mongoose.model('PayrollEmployee', employeeSchema);
  const PayrollAttendance = mongoose.models.PayrollAttendance || mongoose.model('PayrollAttendance', attendanceSchema);
  const PayrollAdvance = mongoose.models.PayrollAdvance || mongoose.model('PayrollAdvance', advanceSchema);

  async function resolveOwnerId(req) {
    const user = await User.findById(req.user.id);
    if (!user) return String(req.user.id);
    return user.ownerId ? String(user.ownerId) : String(req.user.id);
  }

  async function ownerMiddleware(req, res, next) {
    try {
      req.ownerId = req.dataUserId || await resolveOwnerId(req);
      next();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  async function getPayrollSettings(ownerId) {
    const profile = await BusinessProfile.findOne({ userId: ownerId });
    return { payrollViewerRole: profile?.payrollViewerRole || 'manager' };
  }

  async function getLinkedEmployee(userId, ownerId) {
    return PayrollEmployee.findOne({ ownerId, linkedUserId: userId, isActive: true });
  }

  const HAJRI_STAFF_ROLES = ['cashier', 'manager', 'staff'];

  /** Auto employee profile for invite-code staff (cashier/manager/staff) — hajri ke liye */
  async function ensureStaffEmployeeRecord(user) {
    if (!user?.ownerId) return null;
    const role = user.role || 'staff';
    if (!HAJRI_STAFF_ROLES.includes(role)) return null;
    const ownerId = String(user.ownerId);
    let emp = await PayrollEmployee.findOne({ ownerId, linkedUserId: user._id, isActive: true });
    if (emp) return emp;
    const roleLabel = { cashier: 'Cashier', manager: 'Manager', staff: 'Staff' }[role] || 'Staff';
    emp = await PayrollEmployee.create({
      ownerId,
      name: user.username || roleLabel,
      designation: roleLabel,
      monthlySalary: 0,
      weeklyOff: 0,
      linkedUserId: user._id,
      joinDate: user.createdAt || new Date()
    });
    return emp;
  }

  async function buildPayrollContext(user) {
    if (!user) return { canManage: false, canViewSalary: false, canMarkHajri: false, isLinkedEmployee: false, employeeId: null, viewerRole: 'manager' };
    const ownerId = user.ownerId ? String(user.ownerId) : String(user._id);
    const settings = await getPayrollSettings(ownerId);

    if (!user.ownerId) {
      return {
        canManage: true,
        canViewSalary: true,
        canMarkHajri: false,
        isLinkedEmployee: false,
        employeeId: null,
        viewerRole: settings.payrollViewerRole
      };
    }

    const role = user.role || 'staff';
    const linked = await getLinkedEmployee(user._id, ownerId);
    const isViewer = role === settings.payrollViewerRole;
    const canManage = isViewer && (role === 'manager' || role === 'cashier');
    const canViewSalary = canManage;
    const canMarkHajri = HAJRI_STAFF_ROLES.includes(role) && !!linked;

    return {
      canManage,
      canViewSalary,
      canMarkHajri,
      isLinkedEmployee: !!linked,
      employeeId: linked ? String(linked._id) : null,
      viewerRole: settings.payrollViewerRole
    };
  }

  function requirePayrollManage(req, res, next) {
    if (!req.payrollContext?.canManage && !req.payrollContext?.canViewSalary) {
      if (req.isStaffAccount && req.payrollContext?.isLinkedEmployee) {
        return res.status(403).json({ error: 'Sirf owner ya salary handler yeh kaam kar sakta hai.' });
      }
      return res.status(403).json({ error: 'Payroll access nahi hai. Owner se Business plan aur salary handler role set karwayein.' });
    }
    next();
  }

  function requireLinkedEmployee(req, res, next) {
    if (!req.linkedEmployee) {
      return res.status(403).json({ error: 'Aapka employee profile link nahi hai. Owner se link karwayein.' });
    }
    next();
  }

  async function payrollContextMiddleware(req, res, next) {
    try {
      const user = await User.findById(req.user.id);
      if (user?.ownerId) {
        await ensureStaffEmployeeRecord(user);
        req.linkedEmployee = await getLinkedEmployee(user._id, String(user.ownerId));
      }
      req.payrollContext = await buildPayrollContext(user);
      next();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  // ===================== SETTINGS =====================
  app.get('/api/payroll/settings', authenticateToken, biz, ownerMiddleware, payrollContextMiddleware, async (req, res) => {
    const settings = await getPayrollSettings(req.ownerId);
    res.json({ success: true, ...settings, payrollContext: req.payrollContext });
  });

  app.put('/api/payroll/settings', authenticateToken, biz, ownerMiddleware, requireOwner, async (req, res) => {
    const role = req.body?.payrollViewerRole;
    if (!['manager', 'cashier'].includes(role)) {
      return res.status(400).json({ error: 'payrollViewerRole manager ya cashier hona chahiye.' });
    }
    await BusinessProfile.findOneAndUpdate(
      { userId: req.ownerId },
      { payrollViewerRole: role },
      { upsert: true }
    );
    res.json({ success: true, payrollViewerRole: role, message: `Salary ab ${role === 'manager' ? 'Manager' : 'Cashier'} ko dikhegi.` });
  });

  // ===================== EMPLOYEES =====================
  app.get('/api/payroll/employees', authenticateToken, biz, ownerMiddleware, payrollContextMiddleware, requirePayrollManage, async (req, res) => {
    const employees = await PayrollEmployee.find({ ownerId: req.ownerId, isActive: true }).sort({ name: 1 });
    res.json({ success: true, employees });
  });

  app.get('/api/payroll/staff-users', authenticateToken, biz, ownerMiddleware, payrollContextMiddleware, requirePayrollManage, async (req, res) => {
    const ownerOid = req.ownerId;
    const staffUsers = await User.find({ ownerId: ownerOid }).select('username role _id').sort({ username: 1 });
    const linked = await PayrollEmployee.find({ ownerId: ownerOid, linkedUserId: { $ne: null }, isActive: true }).select('linkedUserId name');
    const linkedMap = new Map(linked.map((e) => [String(e.linkedUserId), e.name]));
    res.json({
      success: true,
      users: staffUsers.map((u) => ({
        id: u._id,
        username: u.username,
        role: u.role || 'staff',
        alreadyLinked: linkedMap.has(String(u._id)),
        linkedEmployeeName: linkedMap.get(String(u._id)) || null
      }))
    });
  });

  app.post('/api/payroll/employees', authenticateToken, biz, ownerMiddleware, payrollContextMiddleware, requirePayrollManage, async (req, res) => {
    const { name, phone, designation, monthlySalary, weeklyOff, joinDate, linkedUserId } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Employee naam zaroori hai.' });
    const salary = Number(monthlySalary);
    if (!Number.isFinite(salary) || salary < 0) return res.status(400).json({ error: 'Valid monthly salary daalein.' });

    if (linkedUserId) {
      const staffUser = await User.findOne({ _id: linkedUserId, ownerId: req.ownerId });
      if (!staffUser) return res.status(400).json({ error: 'Linked staff user valid nahi.' });
      const existing = await PayrollEmployee.findOne({ ownerId: req.ownerId, linkedUserId, isActive: true });
      if (existing) return res.status(400).json({ error: 'Yeh staff user pehle se kisi employee se linked hai.' });
    }

    const emp = await PayrollEmployee.create({
      ownerId: req.ownerId,
      name: name.trim(),
      phone: phone || '',
      designation: designation || 'Staff',
      monthlySalary: salary,
      weeklyOff: Number.isFinite(Number(weeklyOff)) ? Number(weeklyOff) : 0,
      joinDate: joinDate ? new Date(joinDate) : new Date(),
      linkedUserId: linkedUserId || null
    });
    res.json({ success: true, employee: emp });
  });

  app.put('/api/payroll/employees/:id', authenticateToken, biz, ownerMiddleware, payrollContextMiddleware, requirePayrollManage, async (req, res) => {
    const emp = await PayrollEmployee.findOne({ _id: req.params.id, ownerId: req.ownerId, isActive: true });
    if (!emp) return res.status(404).json({ error: 'Employee nahi mila.' });

    const { name, phone, designation, monthlySalary, weeklyOff, joinDate, linkedUserId } = req.body || {};
    if (name) emp.name = name.trim();
    if (phone !== undefined) emp.phone = phone;
    if (designation) emp.designation = designation;
    if (monthlySalary !== undefined) emp.monthlySalary = Number(monthlySalary);
    if (weeklyOff !== undefined) emp.weeklyOff = Number(weeklyOff);
    if (joinDate) emp.joinDate = new Date(joinDate);

    if (linkedUserId !== undefined) {
      if (linkedUserId) {
        const staffUser = await User.findOne({ _id: linkedUserId, ownerId: req.ownerId });
        if (!staffUser) return res.status(400).json({ error: 'Linked staff user valid nahi.' });
        const clash = await PayrollEmployee.findOne({
          ownerId: req.ownerId,
          linkedUserId,
          isActive: true,
          _id: { $ne: emp._id }
        });
        if (clash) return res.status(400).json({ error: 'Yeh staff user pehle se linked hai.' });
      }
      emp.linkedUserId = linkedUserId || null;
    }
    await emp.save();
    res.json({ success: true, employee: emp });
  });

  app.delete('/api/payroll/employees/:id', authenticateToken, biz, ownerMiddleware, payrollContextMiddleware, requirePayrollManage, async (req, res) => {
    const emp = await PayrollEmployee.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.ownerId },
      { isActive: false, linkedUserId: null },
      { new: true }
    );
    if (!emp) return res.status(404).json({ error: 'Employee nahi mila.' });
    res.json({ success: true, message: 'Employee deactivate ho gaya.' });
  });

  // ===================== ATTENDANCE =====================
  app.get('/api/payroll/attendance', authenticateToken, hajri, ownerMiddleware, payrollContextMiddleware, async (req, res) => {
    const dateKey = req.query.date || todayKey();
    const canManage = req.payrollContext?.canManage || req.payrollContext?.canViewSalary;
    const canSelf = req.payrollContext?.canMarkHajri;

    if (!canManage && !canSelf) {
      return res.status(403).json({ error: 'Attendance access nahi hai.' });
    }

    if (canManage) {
      const employees = await PayrollEmployee.find({ ownerId: req.ownerId, isActive: true }).sort({ name: 1 });
      const records = await PayrollAttendance.find({ ownerId: req.ownerId, dateKey });
      const map = Object.fromEntries(records.map((r) => [String(r.employeeId), r]));
      res.json({
        success: true,
        date: dateKey,
        rows: employees.map((e) => ({
          employee: e,
          attendance: map[String(e._id)] || null
        }))
      });
      return;
    }

    const rec = await PayrollAttendance.findOne({
      ownerId: req.ownerId,
      employeeId: req.linkedEmployee._id,
      dateKey
    });
    res.json({
      success: true,
      date: dateKey,
      employee: req.linkedEmployee,
      attendance: rec
    });
  });

  app.post('/api/payroll/attendance', authenticateToken, biz, ownerMiddleware, payrollContextMiddleware, requirePayrollManage, async (req, res) => {
    const { date, records } = req.body || {};
    const dateKey = date || todayKey();
    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ error: 'Attendance records bhejein.' });
    }

    const saved = [];
    for (const row of records) {
      if (!row.employeeId || !ATTENDANCE_STATUSES.includes(row.status)) continue;
      const emp = await PayrollEmployee.findOne({ _id: row.employeeId, ownerId: req.ownerId, isActive: true });
      if (!emp) continue;
      const rec = await PayrollAttendance.findOneAndUpdate(
        { employeeId: row.employeeId, dateKey },
        {
          ownerId: req.ownerId,
          employeeId: row.employeeId,
          dateKey,
          status: row.status,
          note: row.note || '',
          markedBy: req.user.id
        },
        { upsert: true, new: true }
      );
      saved.push(rec);
    }
    res.json({ success: true, saved: saved.length, date: dateKey });
  });

  app.post('/api/payroll/attendance/self', authenticateToken, hajri, ownerMiddleware, payrollContextMiddleware, requireLinkedEmployee, async (req, res) => {
    const { status, note } = req.body || {};
    const dateKey = todayKey();
    if (!ATTENDANCE_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Valid status chahiye: present, absent, half_day, paid_leave, unpaid_leave' });
    }

    const existing = await PayrollAttendance.findOne({
      employeeId: req.linkedEmployee._id,
      dateKey
    });
    if (existing && String(existing.markedBy) !== String(req.user.id) && req.userRole !== 'manager' && req.userRole !== 'cashier') {
      // allow re-mark by self same day
    }

    const rec = await PayrollAttendance.findOneAndUpdate(
      { employeeId: req.linkedEmployee._id, dateKey },
      {
        ownerId: req.ownerId,
        employeeId: req.linkedEmployee._id,
        dateKey,
        status,
        note: note || '',
        markedBy: req.user.id
      },
      { upsert: true, new: true }
    );
    res.json({ success: true, attendance: rec, message: 'Aaj ki hajri save ho gayi.' });
  });

  // ===================== ADVANCES =====================
  app.get('/api/payroll/advances', authenticateToken, biz, ownerMiddleware, payrollContextMiddleware, requirePayrollManage, async (req, res) => {
    const { employeeId, month, year } = req.query;
    const filter = { ownerId: req.ownerId };
    if (employeeId) filter.employeeId = employeeId;
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);
    const advances = await PayrollAdvance.find(filter).sort({ date: -1 });
    res.json({ success: true, advances });
  });

  app.post('/api/payroll/advances', authenticateToken, biz, ownerMiddleware, payrollContextMiddleware, requirePayrollManage, async (req, res) => {
    const { employeeId, amount, month, year, note } = req.body || {};
    const emp = await PayrollEmployee.findOne({ _id: employeeId, ownerId: req.ownerId, isActive: true });
    if (!emp) return res.status(404).json({ error: 'Employee nahi mila.' });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Valid advance amount daalein.' });

    const adv = await PayrollAdvance.create({
      ownerId: req.ownerId,
      employeeId,
      amount: amt,
      month: month ? Number(month) : new Date().getMonth() + 1,
      year: year ? Number(year) : new Date().getFullYear(),
      note: note || ''
    });
    res.json({ success: true, advance: adv });
  });

  // ===================== SALARY =====================
  async function salaryForEmployee(employee, year, month) {
    const startKey = dateKeyFromParts(year, month, 1);
    const endKey = dateKeyFromParts(year, month, daysInMonth(year, month));
    const records = await PayrollAttendance.find({
      ownerId: employee.ownerId,
      employeeId: employee._id,
      dateKey: { $gte: startKey, $lte: endKey }
    });
    const byDate = Object.fromEntries(records.map((r) => [r.dateKey, r]));
    const advances = await PayrollAdvance.find({
      ownerId: employee.ownerId,
      employeeId: employee._id,
      month: Number(month),
      year: Number(year)
    });
    const calc = calcMonthlySalary(employee, byDate, advances, year, month);
    const lopDays = Math.max(0, Math.round((calc.workingDays - calc.earnedDays) * 100) / 100);
    const lopDeduction = Math.round(lopDays * calc.perDayRate * 100) / 100;
    return {
      employee: {
        id: employee._id,
        empCode: String(employee._id).slice(-6).toUpperCase(),
        name: employee.name,
        phone: employee.phone,
        designation: employee.designation,
        monthlySalary: employee.monthlySalary,
        weeklyOff: employee.weeklyOff,
        weeklyOffLabel: WEEKDAY_NAMES[employee.weeklyOff ?? 0],
        joinDate: employee.joinDate || null
      },
      ...calc,
      lopDays,
      lopDeduction,
      advances
    };
  }

  async function payrollCompanyProfile(ownerId) {
    const profile = await BusinessProfile.findOne({ userId: ownerId });
    return {
      name: profile?.companyName || 'Business',
      address: profile?.fullAddress || '',
      phone: profile?.phone || '',
      gstin: profile?.gstin || ''
    };
  }

  app.get('/api/payroll/salary-summary', authenticateToken, biz, ownerMiddleware, payrollContextMiddleware, requirePayrollManage, async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const employees = await PayrollEmployee.find({ ownerId: req.ownerId, isActive: true }).sort({ name: 1 });
    const summaries = [];
    let totalNet = 0;
    for (const emp of employees) {
      const s = await salaryForEmployee(emp, year, month);
      summaries.push(s);
      totalNet += s.netPayable;
    }
    res.json({ success: true, year, month, summaries, totalNetPayable: Math.round(totalNet * 100) / 100 });
  });

  app.get('/api/payroll/salary/:employeeId', authenticateToken, hajri, ownerMiddleware, payrollContextMiddleware, async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const canManage = req.payrollContext?.canManage || req.payrollContext?.canViewSalary;
    const isOwn = req.linkedEmployee && String(req.linkedEmployee._id) === String(req.params.employeeId);

    if (!canManage && !isOwn) {
      return res.status(403).json({ error: 'Sirf salary handler ya apni salary dekh sakte hain.' });
    }

    const emp = await PayrollEmployee.findOne({ _id: req.params.employeeId, ownerId: req.ownerId, isActive: true });
    if (!emp) return res.status(404).json({ error: 'Employee nahi mila.' });

    const slip = await salaryForEmployee(emp, year, month);
    const company = await payrollCompanyProfile(req.ownerId);
    res.json({ success: true, slip, company, month, year });
  });

  app.get('/api/payroll/me', authenticateToken, hajri, ownerMiddleware, payrollContextMiddleware, async (req, res) => {
    res.json({
      success: true,
      payrollContext: req.payrollContext,
      employee: req.linkedEmployee || null
    });
  });

  console.log('✓ BolKarigar Payroll loaded (Employee Hajri & Salary — Business plan)');
  return { buildPayrollContext, ensureStaffEmployeeRecord, PayrollEmployee, PayrollAttendance, PayrollAdvance, calcMonthlySalary, STATUS_LABELS, WEEKDAY_NAMES };
}

module.exports = { setupPayrollFeatures, ATTENDANCE_STATUSES, STATUS_LABELS, calcMonthlySalary };
