/**
 * Team gallery UI — share photos with all or selected staff (same pattern as team todos).
 */
(function () {
  const API = () => (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || ''));
  const token = () => localStorage.getItem('bk_token') || localStorage.getItem('token') || '';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
  }

  async function parseApiResponse(r) {
    const text = await r.text();
    try {
      const data = JSON.parse(text);
      if (!r.ok && data.success === undefined) data.success = false;
      if (!r.ok && !data.error) data.error = `Server error (${r.status})`;
      return data;
    } catch {
      return { success: false, error: `Invalid response (${r.status})` };
    }
  }

  async function apiGet(path) {
    const r = await fetch(`${API()}${path}`, { headers: headers() });
    return parseApiResponse(r);
  }

  async function apiPost(path, body) {
    const r = await fetch(`${API()}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body || {}) });
    return parseApiResponse(r);
  }

  async function apiDelete(path) {
    const r = await fetch(`${API()}${path}`, { method: 'DELETE', headers: headers() });
    return parseApiResponse(r);
  }

  function getAssignMode() {
    const sel = document.querySelector('input[name="teamGalleryAssignMode"]:checked');
    return sel?.value === 'selected' ? 'selected' : 'all';
  }

  function selectedStaffIds() {
    return [...document.querySelectorAll('#teamGalleryStaffList input[type="checkbox"]:checked')].map((cb) => cb.value);
  }

  function toggleStaffPick() {
    const block = document.getElementById('teamGalleryStaffPick');
    if (!block) return;
    block.classList.toggle('hidden', getAssignMode() !== 'selected');
  }

  function paintStaff(staff) {
    const box = document.getElementById('teamGalleryStaffList');
    if (!box) return;
    if (!staff?.length) {
      box.innerHTML = '<p class="helper-text">No staff yet — create invite from Staff panel.</p>';
      return;
    }
    box.innerHTML = staff.map((u) =>
      `<label class="meet-staff-chip"><input type="checkbox" value="${u.id}" /> ${esc(u.username)} <span class="helper-text">(${esc(u.role)})</span></label>`
    ).join('');
  }

  function paintPhotoSelect(photos) {
    const sel = document.getElementById('teamGalleryPhotoSelect');
    if (!sel) return;
    if (!photos?.length) {
      sel.innerHTML = '<option value="">Upload a photo first</option>';
      return;
    }
    sel.innerHTML = '<option value="">— Select photo —</option>' + photos.map((p, i) => {
      const label = p.caption || `Photo ${photos.length - i}`;
      return `<option value="${p._id}">${esc(label)}</option>`;
    }).join('');
  }

  function paintShareList(shares, canHost) {
    const list = document.getElementById('teamGalleryShareList');
    const stat = document.getElementById('teamGalleryShareStatus');
    if (!list) return;
    if (stat) {
      stat.textContent = shares?.length
        ? `${shares.length} shared photo(s) — staff see these in Gallery.`
        : 'No photos shared with team yet.';
    }
    if (!shares?.length) {
      list.innerHTML = '<li class="helper-text">Share a product photo with all staff or selected members.</li>';
      return;
    }
    list.innerHTML = shares.map((s) => {
      const del = canHost
        ? `<button type="button" class="del-btn team-gallery-del" data-id="${s.id}">Remove share</button>`
        : '';
      return `<li class="team-todo-item">
        <div class="team-todo-main">
          <strong>${esc(s.note || s.photo.caption || 'Product photo')}</strong>
          <span class="helper-text">To: ${esc(s.assigneesLabel)} · ${new Date(s.createdAt).toLocaleString('en-IN')}</span>
        </div>
        ${del}
      </li>`;
    }).join('');
    list.querySelectorAll('.team-gallery-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this share? Staff will no longer see this photo.')) return;
        const res = await apiDelete(`/api/team-gallery/${btn.dataset.id}`);
        toast(res.message || res.error || 'Removed', res.success ? 'success' : 'error');
        loadTeamGallery();
      });
    });
  }

  function renderStaffGallery(shares) {
    const photos = (shares || []).map((s) => s.photo).filter(Boolean);
    const uploadRow = document.getElementById('galleryUploadRow');
    const hostBlock = document.getElementById('teamGalleryHostBlock');
    const ownerLibrary = document.getElementById('galleryOwnerLibrary');
    if (uploadRow) uploadRow.classList.add('hidden');
    if (hostBlock) hostBlock.classList.add('hidden');
    if (ownerLibrary) ownerLibrary.classList.add('hidden');
    if (typeof window.bkRenderGalleryThumbs === 'function') {
      window.bkRenderGalleryThumbs(photos);
    }
  }

  async function loadTeamGallery() {
    const hostBlock = document.getElementById('teamGalleryHostBlock');
    const shareData = await apiGet('/api/team-gallery');
    if (!shareData.success) {
      toast(shareData.error || 'Could not load shared gallery', 'error');
      return;
    }
    if (hostBlock) hostBlock.classList.toggle('hidden', !shareData.canHost);
    paintShareList(shareData.shares, shareData.canHost);

    if (shareData.canHost) {
      const uploadRow = document.getElementById('galleryUploadRow');
      const ownerLibrary = document.getElementById('galleryOwnerLibrary');
      if (uploadRow) uploadRow.classList.remove('hidden');
      if (ownerLibrary) ownerLibrary.classList.remove('hidden');
      const gal = await apiGet('/api/gallery');
      if (gal.success) paintPhotoSelect(gal.photos);
      const staffData = await apiGet('/api/team-gallery/staff');
      if (staffData.success) paintStaff(staffData.staff);
      toggleStaffPick();
      if (typeof window.loadGalleryPhotos === 'function') window.loadGalleryPhotos();
    } else {
      renderStaffGallery(shareData.shares);
    }
  }

  async function sendTeamGalleryShare() {
    const photoId = document.getElementById('teamGalleryPhotoSelect')?.value;
    const note = document.getElementById('teamGalleryNote')?.value.trim();
    if (!photoId) return toast('Select a photo to share', 'error');
    const assignToAll = getAssignMode() === 'all';
    const assigneeUserIds = assignToAll ? [] : selectedStaffIds();
    if (!assignToAll && !assigneeUserIds.length) {
      return toast('Select staff or choose All staff', 'error');
    }
    const btn = document.getElementById('teamGallerySendBtn');
    const prev = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    const res = await apiPost('/api/team-gallery/share', { photoId, note, assignToAll, assigneeUserIds });
    if (btn) { btn.disabled = false; btn.textContent = prev; }
    if (!res.success) return toast(res.error || 'Failed', 'error');
    document.getElementById('teamGalleryNote').value = '';
    toast(assignToAll ? '✅ Photo sent to all staff' : '✅ Photo sent to selected staff', 'success');
    loadTeamGallery();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('teamGallerySendBtn')?.addEventListener('click', sendTeamGalleryShare);
    document.querySelectorAll('input[name="teamGalleryAssignMode"]').forEach((r) => {
      r.addEventListener('change', toggleStaffPick);
    });
    document.querySelectorAll('.tab-btn[data-tab="galleryPanel"]').forEach((btn) => {
      btn.addEventListener('click', () => loadTeamGallery());
    });
  });

  window.BolKarigarTeamGallery = { loadTeamGallery };
})();
