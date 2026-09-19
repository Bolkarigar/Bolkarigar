/**
 * BolKarigar Team Gallery — owner shares product photos with all or selected staff.
 */
function setupTeamGalleryFeatures({ app, mongoose, authenticateToken, models, rbac }) {
  const { User, Photo } = models;
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

  function requireGalleryHost(req, res, next) {
    const role = effectiveRole(req);
    if (role === 'owner' || role === 'manager') return next();
    return res.status(403).json({ error: 'Only Owner or Manager can share gallery photos.' });
  }

  const galleryShareSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    photoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Photo', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: '' },
    assignToAll: { type: Boolean, default: true },
    assigneeUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }, { timestamps: true });
  galleryShareSchema.index({ ownerId: 1, createdAt: -1 });

  const GalleryShare = mongoose.models.GalleryShare || mongoose.model('GalleryShare', galleryShareSchema);

  function isAssignedToUser(share, userId) {
    if (share.assignToAll) return true;
    return (share.assigneeUserIds || []).some((id) => String(id) === String(userId));
  }

  app.get('/api/team-gallery/staff', authenticateToken, ownerMiddleware, requireGalleryHost, async (req, res) => {
    const staff = await User.find({ ownerId: req.ownerId }).select('username role _id').sort({ username: 1 });
    res.json({
      success: true,
      staff: staff.map((u) => ({ id: u._id, username: u.username, role: u.role || 'staff' }))
    });
  });

  app.get('/api/team-gallery', authenticateToken, ownerMiddleware, async (req, res) => {
    const role = effectiveRole(req);
    const canHost = role === 'owner' || role === 'manager';
    const viewerId = req.user.id;
    const shares = await GalleryShare.find({ ownerId: req.ownerId }).sort({ createdAt: -1 }).limit(100);

    const visible = canHost ? shares : shares.filter((s) => isAssignedToUser(s, viewerId));
    const photoIds = visible.map((s) => s.photoId);
    const photos = await Photo.find({ _id: { $in: photoIds }, userId: req.ownerId });
    const photoMap = new Map(photos.map((p) => [String(p._id), p]));

    const staff = await User.find({ ownerId: req.ownerId }).select('username _id');
    const staffMap = new Map(staff.map((u) => [String(u._id), u.username]));

    res.json({
      success: true,
      canHost,
      shares: visible.map((s) => {
        const photo = photoMap.get(String(s.photoId));
        const assignees = s.assignToAll
          ? 'All staff'
          : (s.assigneeUserIds || []).map((id) => staffMap.get(String(id)) || 'Staff').join(', ');
        return {
          id: s._id,
          note: s.note,
          createdBy: s.createdBy,
          assignToAll: s.assignToAll,
          assigneesLabel: assignees,
          createdAt: s.createdAt,
          photo: photo
            ? { _id: photo._id, fileId: photo.fileId, caption: photo.caption, createdAt: photo.createdAt }
            : null
        };
      }).filter((s) => s.photo)
    });
  });

  app.post('/api/team-gallery/share', authenticateToken, ownerMiddleware, requireGalleryHost, async (req, res) => {
    const { photoId, note, assignToAll, assigneeUserIds } = req.body || {};
    if (!photoId) return res.status(400).json({ error: 'Select a photo to share.' });

    const photo = await Photo.findOne({ _id: photoId, userId: req.ownerId });
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });

    const toAll = assignToAll !== false && assignToAll !== 'false';
    let assignees = [];
    if (!toAll) {
      if (!Array.isArray(assigneeUserIds) || !assigneeUserIds.length) {
        return res.status(400).json({ error: 'Select staff or choose All staff.' });
      }
      const valid = await User.find({ _id: { $in: assigneeUserIds }, ownerId: req.ownerId }).select('_id');
      assignees = valid.map((u) => u._id);
      if (!assignees.length) return res.status(400).json({ error: 'Invalid staff selection.' });
    }

    const share = await GalleryShare.create({
      ownerId: req.ownerId,
      photoId: photo._id,
      createdBy: req.user.id,
      note: note || '',
      assignToAll: toAll,
      assigneeUserIds: assignees
    });

    res.json({ success: true, share: { id: share._id, photoId: photo._id } });
  });

  app.delete('/api/team-gallery/:id', authenticateToken, ownerMiddleware, requireGalleryHost, async (req, res) => {
    const deleted = await GalleryShare.findOneAndDelete({ _id: req.params.id, ownerId: req.ownerId });
    if (!deleted) return res.status(404).json({ error: 'Share not found.' });
    res.json({ success: true, message: 'Share removed.' });
  });

  async function staffCanViewPhoto(dataUserId, viewerUserId, photoId) {
    const roleUser = await User.findById(viewerUserId);
    if (!roleUser?.ownerId) return true;
    const shares = await GalleryShare.find({ ownerId: dataUserId, photoId });
    if (!shares.length) return false;
    return shares.some((s) => isAssignedToUser(s, viewerUserId));
  }

  console.log('✓ BolKarigar Team Gallery loaded');
  return { GalleryShare, staffCanViewPhoto };
}

module.exports = { setupTeamGalleryFeatures };
