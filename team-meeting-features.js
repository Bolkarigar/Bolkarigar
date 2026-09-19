/**
 * BolKarigar Team Meetings — owner/manager schedules voice or video calls with staff.
 * Join via in-app link (secure room slug + join code).
 */
const crypto = require('crypto');

function randomSlug(len = 12) {
  return crypto.randomBytes(Math.ceil(len * 0.75)).toString('base64url').slice(0, len);
}

function setupTeamMeetingFeatures({ app, mongoose, authenticateToken, models, rbac, requireBusinessPlan }) {
  const { User, BusinessProfile } = models;
  const { effectiveRole } = rbac;
  const biz = requireBusinessPlan || ((req, res, next) => next());

  function requireMeetingAccess(req, res, next) {
    if (req.subscription?.fullAccess) return next();
    if (req.isStaffAccount && req.subscription?.isActive) return next();
    return res.status(403).json({
      error: 'Team meetings require an active Business plan on the shop account.',
      code: 'PLAN_UPGRADE_REQUIRED'
    });
  }

  function requireMeetingHost(req, res, next) {
    const role = effectiveRole(req);
    if (role === 'owner' || role === 'manager') return next();
    return res.status(403).json({ error: 'Only Owner or Manager can schedule meetings.' });
  }

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

  const meetingSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    agenda: { type: String, default: '' },
    callType: { type: String, enum: ['audio', 'video'], default: 'video' },
    inviteMode: { type: String, enum: ['all', 'selected'], default: 'all' },
    inviteeUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    roomSlug: { type: String, required: true, index: true },
    joinCode: { type: String, required: true },
    status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' },
    scheduledAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null }
  }, { timestamps: true });
  meetingSchema.index({ ownerId: 1, status: 1, scheduledAt: -1 });

  const TeamMeeting = mongoose.models.TeamMeeting || mongoose.model('TeamMeeting', meetingSchema);

  function userCanJoinMeeting(meeting, userId, role) {
    if (role === 'owner' || role === 'manager') return true;
    if (meeting.inviteMode === 'all') return true;
    const uid = String(userId);
    return (meeting.inviteeUserIds || []).some((id) => String(id) === uid);
  }

  function jitsiRoomName(meeting) {
    return `Bolkarigar_${String(meeting.ownerId).slice(-8)}_${meeting.roomSlug}`;
  }

  function buildJoinPath(meeting) {
    return `bolkarigar.html?meetJoin=${meeting._id}&code=${meeting.joinCode}`;
  }

  app.get('/api/meetings/staff', authenticateToken, biz, ownerMiddleware, requireMeetingAccess, async (req, res) => {
    const staff = await User.find({ ownerId: req.ownerId }).select('username role _id').sort({ username: 1 });
    res.json({
      success: true,
      staff: staff.map((u) => ({
        id: u._id,
        username: u.username,
        role: u.role || 'staff'
      }))
    });
  });

  app.get('/api/meetings', authenticateToken, biz, ownerMiddleware, requireMeetingAccess, async (req, res) => {
    const role = effectiveRole(req);
    const userId = req.user.id;
    const meetings = await TeamMeeting.find({ ownerId: req.ownerId, status: { $ne: 'ended' } })
      .sort({ scheduledAt: -1 })
      .limit(50);

    const visible = meetings.filter((m) => userCanJoinMeeting(m, userId, role));
    res.json({
      success: true,
      canHost: role === 'owner' || role === 'manager',
      meetings: visible.map((m) => ({
        id: m._id,
        title: m.title,
        agenda: m.agenda,
        callType: m.callType,
        inviteMode: m.inviteMode,
        inviteeUserIds: m.inviteeUserIds,
        status: m.status,
        scheduledAt: m.scheduledAt,
        createdAt: m.createdAt,
        createdBy: m.createdBy,
        joinPath: buildJoinPath(m),
        joinCode: m.joinCode
      }))
    });
  });

  app.post('/api/meetings', authenticateToken, biz, ownerMiddleware, requireMeetingAccess, requireMeetingHost, async (req, res) => {
    const { title, agenda, callType, inviteMode, inviteeUserIds } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Meeting title is required.' });

    const mode = inviteMode === 'selected' ? 'selected' : 'all';
    let invitees = [];
    if (mode === 'selected') {
      if (!Array.isArray(inviteeUserIds) || !inviteeUserIds.length) {
        return res.status(400).json({ error: 'Select at least one team member, or choose All Staff.' });
      }
      const valid = await User.find({ _id: { $in: inviteeUserIds }, ownerId: req.ownerId }).select('_id');
      invitees = valid.map((u) => u._id);
      if (!invitees.length) return res.status(400).json({ error: 'Invalid team members selected.' });
    }

    const meeting = await TeamMeeting.create({
      ownerId: req.ownerId,
      createdBy: req.user.id,
      title: title.trim(),
      agenda: agenda || '',
      callType: callType === 'audio' ? 'audio' : 'video',
      inviteMode: mode,
      inviteeUserIds: invitees,
      roomSlug: randomSlug(14),
      joinCode: randomSlug(8)
    });

    res.json({
      success: true,
      meeting: {
        id: meeting._id,
        title: meeting.title,
        callType: meeting.callType,
        joinPath: buildJoinPath(meeting),
        joinCode: meeting.joinCode
      }
    });
  });

  app.post('/api/meetings/:id/join', authenticateToken, biz, ownerMiddleware, requireMeetingAccess, async (req, res) => {
    const { code } = req.body || {};
    const meeting = await TeamMeeting.findOne({ _id: req.params.id, ownerId: req.ownerId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found.' });
    if (meeting.status === 'ended') return res.status(400).json({ error: 'This meeting has ended.' });
    if (code !== meeting.joinCode) return res.status(403).json({ error: 'Invalid meeting link or code.' });

    const role = effectiveRole(req);
    if (!userCanJoinMeeting(meeting, req.user.id, role)) {
      return res.status(403).json({ error: 'You are not invited to this meeting.' });
    }

    const user = await User.findById(req.user.id).select('username role');
    const displayName = user?.username || 'Team Member';
    const isModerator = role === 'owner' || role === 'manager';

    if (meeting.status === 'scheduled') {
      meeting.status = 'live';
      meeting.startedAt = new Date();
      await meeting.save();
    }

    let companyName = 'BolKarigar Team';
    const profile = await BusinessProfile.findOne({ userId: req.ownerId });
    if (profile?.companyName) companyName = profile.companyName;

    res.json({
      success: true,
      meeting: {
        id: meeting._id,
        title: meeting.title,
        callType: meeting.callType,
        status: meeting.status
      },
      jitsi: {
        domain: 'meet.jit.si',
        roomName: jitsiRoomName(meeting),
        displayName,
        isModerator,
        startWithVideoMuted: meeting.callType === 'audio',
        subject: `${companyName} — ${meeting.title}`
      }
    });
  });

  app.post('/api/meetings/:id/end', authenticateToken, biz, ownerMiddleware, requireMeetingAccess, requireMeetingHost, async (req, res) => {
    const meeting = await TeamMeeting.findOne({ _id: req.params.id, ownerId: req.ownerId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found.' });
    meeting.status = 'ended';
    meeting.endedAt = new Date();
    await meeting.save();
    res.json({ success: true, message: 'Meeting ended.' });
  });

  console.log('✓ BolKarigar Team Meetings loaded');
  return { TeamMeeting };
}

module.exports = { setupTeamMeetingFeatures };
