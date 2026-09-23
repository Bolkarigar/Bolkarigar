/**
 * Accounts Orbit Team Todos — owner/manager sends tasks to all staff or selected members.
 */
function setupTeamTodoFeatures({ app, mongoose, authenticateToken, models, rbac }) {
  const { User } = models;
  const { effectiveRole } = rbac;

  async function resolveOwnerId(req) {
    const user = await User.findById(req.user.id);
    if (!user) return String(req.user.id);
    return user.ownerId ? String(user.ownerId) : String(user._id);
  }

  async function ownerMiddleware(req, res, next) {
    try {
      req.ownerId = req.dataUserId || await resolveOwnerId(req);
      next();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  function requireTeamTodoHost(req, res, next) {
    const role = effectiveRole(req);
    if (role === 'owner' || role === 'manager') return next();
    return res.status(403).json({ error: 'Only Owner or Manager can send team todos.' });
  }

  const teamTodoSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    assignToAll: { type: Boolean, default: true },
    assigneeUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    doneByUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }, { timestamps: true });
  teamTodoSchema.index({ ownerId: 1, createdAt: -1 });

  const TeamTodo = mongoose.models.TeamTodo || mongoose.model('TeamTodo', teamTodoSchema);

  function isAssignedToUser(todo, userId) {
    if (todo.assignToAll) return true;
    return (todo.assigneeUserIds || []).some((id) => String(id) === String(userId));
  }

  function serializeTodo(todo, staffMap, viewerId, canHost) {
    const assignees = todo.assignToAll
      ? 'All staff'
      : (todo.assigneeUserIds || []).map((id) => staffMap.get(String(id)) || 'Staff').join(', ') || 'Selected staff';
    const doneNames = (todo.doneByUserIds || []).map((id) => staffMap.get(String(id)) || 'Done').join(', ');
    return {
      id: todo._id,
      text: todo.text,
      createdBy: todo.createdBy,
      assignToAll: todo.assignToAll,
      assigneesLabel: assignees,
      createdAt: todo.createdAt,
      doneByUserIds: todo.assigneeUserIds?.length ? todo.doneByUserIds : todo.doneByUserIds,
      doneCount: (todo.doneByUserIds || []).length,
      doneNames: doneNames || '',
      isDoneForMe: (todo.doneByUserIds || []).some((id) => String(id) === String(viewerId)),
      canHost
    };
  }

  async function staffNameMap(ownerId) {
    const users = await User.find({ ownerId }).select('username _id');
    const owner = await User.findById(ownerId).select('username');
    const map = new Map();
    if (owner) map.set(String(owner._id), owner.username);
    users.forEach((u) => map.set(String(u._id), u.username));
    return map;
  }

  app.get('/api/team-todos/staff', authenticateToken, ownerMiddleware, requireTeamTodoHost, async (req, res) => {
    const staff = await User.find({ ownerId: req.ownerId }).select('username role _id').sort({ username: 1 });
    res.json({
      success: true,
      staff: staff.map((u) => ({ id: u._id, username: u.username, role: u.role || 'staff' }))
    });
  });

  app.get('/api/team-todos', authenticateToken, ownerMiddleware, async (req, res) => {
    const role = effectiveRole(req);
    const canHost = role === 'owner' || role === 'manager';
    const viewerId = req.user.id;
    const todos = await TeamTodo.find({ ownerId: req.ownerId }).sort({ createdAt: -1 }).limit(100);
    const staffMap = await staffNameMap(req.ownerId);

    const visible = canHost
      ? todos
      : todos.filter((t) => isAssignedToUser(t, viewerId));

    res.json({
      success: true,
      canHost,
      todos: visible.map((t) => serializeTodo(t, staffMap, viewerId, canHost))
    });
  });

  app.post('/api/team-todos', authenticateToken, ownerMiddleware, requireTeamTodoHost, async (req, res) => {
    const { text, assignToAll, assigneeUserIds } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: 'Todo message is required.' });

    const toAll = assignToAll !== false && assignToAll !== 'false';
    let assignees = [];
    if (!toAll) {
      if (!Array.isArray(assigneeUserIds) || !assigneeUserIds.length) {
        return res.status(400).json({ error: 'Select staff members or choose All staff.' });
      }
      const valid = await User.find({ _id: { $in: assigneeUserIds }, ownerId: req.ownerId }).select('_id');
      assignees = valid.map((u) => u._id);
      if (!assignees.length) return res.status(400).json({ error: 'Invalid staff selection.' });
    }

    const todo = await TeamTodo.create({
      ownerId: req.ownerId,
      createdBy: req.user.id,
      text: text.trim(),
      assignToAll: toAll,
      assigneeUserIds: assignees
    });

    res.json({ success: true, todo: { id: todo._id, text: todo.text } });
  });

  app.post('/api/team-todos/:id/done', authenticateToken, ownerMiddleware, async (req, res) => {
    const todo = await TeamTodo.findOne({ _id: req.params.id, ownerId: req.ownerId });
    if (!todo) return res.status(404).json({ error: 'Todo not found.' });
    if (!isAssignedToUser(todo, req.user.id)) {
      return res.status(403).json({ error: 'This todo is not assigned to you.' });
    }
    const uid = req.user.id;
    if (!(todo.doneByUserIds || []).some((id) => String(id) === String(uid))) {
      todo.doneByUserIds.push(uid);
      await todo.save();
    }
    res.json({ success: true, message: 'Marked as done.' });
  });

  app.delete('/api/team-todos/:id', authenticateToken, ownerMiddleware, requireTeamTodoHost, async (req, res) => {
    const deleted = await TeamTodo.findOneAndDelete({ _id: req.params.id, ownerId: req.ownerId });
    if (!deleted) return res.status(404).json({ error: 'Todo not found.' });
    res.json({ success: true, message: 'Team todo removed.' });
  });

  console.log('✓ Accounts Orbit Team Todos loaded');
  return { TeamTodo };
}

module.exports = { setupTeamTodoFeatures };
