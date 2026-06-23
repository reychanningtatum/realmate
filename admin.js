const _sbAdmin = window.supabase.createClient(
    'https://wmegpgrfrtprhuzmgjma.supabase.co',
    'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4'
);

const DEFAULT_PASSWORD = 'ADMIN@realmate';
let _currentPassword = DEFAULT_PASSWORD;

// ── Auth ──────────────────────────────────────────────
function toggleGatePassword() {
    const input = document.getElementById('gateInput');
    const eye   = document.getElementById('gateEye');
    if (input.type === 'password') {
        input.type = 'text';
        eye.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        eye.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

async function attemptLogin() {
    const input = document.getElementById('gateInput').value;
    const { data } = await _sbAdmin.from('site_settings').select('value').eq('key', 'admin_password').single();
    _currentPassword = data?.value || DEFAULT_PASSWORD;

    if (input === _currentPassword) {
        sessionStorage.setItem('rm_admin', '1');
        showDash();
    } else {
        const err = document.getElementById('gateError');
        err.style.display = 'flex';
        setTimeout(() => err.style.display = 'none', 3000);
    }
}

function showDash() {
    document.getElementById('gateScreen').style.display = 'none';
    document.getElementById('adminDash').style.display = 'flex';
    loadYoutubeUrl();
    loadMarketReportUrl();
    loadProducers();
    loadCourtesyFields();
}

function logout() {
    sessionStorage.removeItem('rm_admin');
    document.getElementById('gateInput').value = '';
    document.getElementById('adminDash').style.display = 'none';
    document.getElementById('gateScreen').style.display = 'flex';
}

// ── Auto-restore session on refresh ──────────────────
window.addEventListener('DOMContentLoaded', async () => {
    if (sessionStorage.getItem('rm_admin') === '1') {
        const { data } = await _sbAdmin.from('site_settings').select('value').eq('key', 'admin_password').single();
        _currentPassword = data?.value || DEFAULT_PASSWORD;
        showDash();
    }
});

// ── Tab switching ─────────────────────────────────────
function switchTab(name, el) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
    document.getElementById('tab-' + name)?.classList.add('active');
    if (el) el.classList.add('active');
}

// ── YouTube URL ───────────────────────────────────────
// ── Market Report PDF ──────────────────────────────────
async function loadMarketReportUrl() {
    const { data } = await _sbAdmin.from('site_settings').select('value').eq('key', 'market_report_pdf').single();
    if (data?.value) showPdfCurrent(data.value);
}

function onPdfSelected(input) {
    const file = input.files[0];
    if (file) document.getElementById('pdfFileName').textContent = file.name;
}

async function uploadMarketReport() {
    const file = document.getElementById('pdfFileInput').files[0];
    if (!file) return showStatus('pdfStatus', 'Please select a PDF file first.', 'error');

    const progressWrap = document.getElementById('pdfProgressWrap');
    const progressBar  = document.getElementById('pdfProgressBar');
    progressWrap.style.display = 'block';
    progressBar.style.width = '20%';

    // Always overwrite the same key so there's only one report stored
    const fileName = 'market-report.pdf';

    // Remove old file first (ignore error if it doesn't exist)
    await _sbAdmin.storage.from('market-reports').remove([fileName]);

    progressBar.style.width = '40%';

    const { data: upData, error: upErr } = await _sbAdmin.storage
        .from('market-reports')
        .upload(fileName, file, { upsert: true, contentType: 'application/pdf' });

    progressBar.style.width = '70%';

    if (upErr) {
        progressWrap.style.display = 'none';
        const msg = upErr.message || upErr.error || JSON.stringify(upErr);
        alert('Upload failed: ' + msg);
        return showStatus('pdfStatus', 'Upload failed: ' + msg, 'error');
    }

    const { data: urlData } = _sbAdmin.storage.from('market-reports').getPublicUrl(fileName);
    const url = urlData.publicUrl; // clean URL — no cache-buster, PDF.js needs it for CORS

    progressBar.style.width = '90%';

    const { error: dbErr } = await _sbAdmin.from('site_settings')
        .upsert({ key: 'market_report_pdf', value: url }, { onConflict: 'key' });

    progressBar.style.width = '100%';
    setTimeout(() => { progressWrap.style.display = 'none'; progressBar.style.width = '0%'; }, 600);

    if (dbErr) return showStatus('pdfStatus', 'File uploaded but failed to save URL: ' + dbErr.message, 'error');

    showStatus('pdfStatus', 'Market report uploaded successfully.', 'success');
    showPdfCurrent(url);
}

async function clearMarketReport() {
    if (!confirm('Remove the current market report PDF?')) return;
    await _sbAdmin.from('site_settings').delete().eq('key', 'market_report_pdf');
    document.getElementById('pdfCurrentWrap').style.display = 'none';
    document.getElementById('pdfFileName').textContent = 'No file selected';
    document.getElementById('pdfFileInput').value = '';
    showStatus('pdfStatus', 'Market report removed.', 'success');
}

function showPdfCurrent(url) {
    const wrap = document.getElementById('pdfCurrentWrap');
    const parts = url.split('/');
    document.getElementById('pdfCurrentName').textContent = decodeURIComponent(parts[parts.length - 1]);
    document.getElementById('pdfCurrentLink').href = url;
    wrap.style.display = 'block';
}

async function loadYoutubeUrl() {
    const { data } = await _sbAdmin.from('site_settings').select('value').eq('key', 'youtube_url').single();
    if (data?.value) {
        document.getElementById('ytUrlInput').value = data.value;
        showYtPreview(data.value);
    }
}

async function saveYoutubeUrl() {
    const url = document.getElementById('ytUrlInput').value.trim();
    if (!url) return showStatus('ytStatus', 'Please enter a YouTube URL.', 'error');

    const embedUrl = toEmbedUrl(url);
    if (!embedUrl) return showStatus('ytStatus', 'Invalid YouTube URL. Paste a standard youtube.com or youtu.be link.', 'error');

    const { error } = await _sbAdmin.from('site_settings').upsert({ key: 'youtube_url', value: url }, { onConflict: 'key' });
    if (error) return showStatus('ytStatus', 'Failed to save: ' + error.message, 'error');

    showStatus('ytStatus', 'YouTube URL saved successfully.', 'success');
    showYtPreview(url);
}

function showYtPreview(url) {
    const embedUrl = toEmbedUrl(url);
    if (!embedUrl) return;
    document.getElementById('ytPreviewIframe').src = embedUrl;
    document.getElementById('ytPreviewWrap').style.display = 'block';
}

function toEmbedUrl(url) {
    try {
        const u = new URL(url);
        let videoId = null;

        if (u.hostname.includes('youtu.be')) {
            videoId = u.pathname.slice(1);
        } else if (u.hostname.includes('youtube.com')) {
            if (u.pathname === '/watch') videoId = u.searchParams.get('v');
            else if (u.pathname.startsWith('/live/')) videoId = u.pathname.split('/live/')[1].split('?')[0];
            else if (u.pathname.startsWith('/embed/')) return url;
        }

        if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;
        return null;
    } catch { return null; }
}

// ── Top Producers ─────────────────────────────────────
async function loadProducers() {
    const list = document.getElementById('producersList');
    const { data, error } = await _sbAdmin.from('top_producers').select('*').order('created_at', { ascending: true });
    if (error || !data?.length) {
        list.innerHTML = '<div class="empty-row">No producers yet. Add one above.</div>';
        return;
    }
    list.innerHTML = data.map(p => `
        <div class="producer-row">
            <div class="pr-info">
                <div class="pr-name">${p.name}</div>
                <div class="pr-meta">${p.position || ''}${p.team ? ' · ' + p.team : ''} · ₱${Number(p.value / 1000000).toFixed(0)}M · ${p.month || ''}</div>
            </div>
            <div class="pr-actions">
                <button class="btn-edit" onclick="editProducer(${p.id})"><i class="fas fa-pen"></i></button>
                <button class="btn-delete" onclick="deleteProducer(${p.id}, '${p.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`).join('');
    window._producersCache = data;
}

function editProducer(id) {
    const p = window._producersCache.find(x => x.id === id);
    if (!p) return;
    document.getElementById('editingId').value = id;
    document.getElementById('pName').value     = p.name || '';
    document.getElementById('pPosition').value = p.position || '';
    document.getElementById('pTeam').value     = p.team || '';
    document.getElementById('pValue').value    = p.value || '';
    document.getElementById('pMonth').value    = p.month || '';
    document.getElementById('pPeriod').value   = p.period || '';
    document.getElementById('pSaveBtn').innerHTML = '<i class="fas fa-save"></i> Update Producer';
    document.getElementById('pCancelBtn').style.display = 'inline-flex';
    document.getElementById('pName').focus();
    document.getElementById('tab-producers').scrollTop = 0;
}

function cancelEdit() {
    document.getElementById('editingId').value = '';
    ['pName','pPosition','pTeam','pValue','pMonth','pPeriod'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('pSaveBtn').innerHTML = '<i class="fas fa-save"></i> Save Producer';
    document.getElementById('pCancelBtn').style.display = 'none';
}

async function saveProducer() {
    const name  = document.getElementById('pName').value.trim();
    const value = parseFloat(document.getElementById('pValue').value);
    if (!name)       return showStatus('pStatus', 'Name is required.', 'error');
    if (isNaN(value)) return showStatus('pStatus', 'Sales value must be a number.', 'error');

    const payload = {
        name,
        position: document.getElementById('pPosition').value.trim() || null,
        team:     document.getElementById('pTeam').value.trim()     || null,
        value,
        month:    document.getElementById('pMonth').value.trim()    || null,
        period:   document.getElementById('pPeriod').value.trim()   || null,
    };

    const editingId = document.getElementById('editingId').value;
    let error;

    if (editingId) {
        ({ error } = await _sbAdmin.from('top_producers').update(payload).eq('id', editingId));
    } else {
        ({ error } = await _sbAdmin.from('top_producers').insert([payload]));
    }

    if (error) return showStatus('pStatus', 'Failed: ' + error.message, 'error');
    showStatus('pStatus', editingId ? 'Producer updated.' : 'Producer added.', 'success');
    cancelEdit();
    loadProducers();
}

async function deleteProducer(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await _sbAdmin.from('top_producers').delete().eq('id', id);
    if (error) return alert('Delete failed: ' + error.message);
    loadProducers();
}

// ── Change Password ───────────────────────────────────
async function changePassword() {
    const current  = document.getElementById('secCurrent').value;
    const newPass  = document.getElementById('secNew').value;
    const confirm  = document.getElementById('secConfirm').value;

    if (current !== _currentPassword) return showStatus('secStatus', 'Current password is incorrect.', 'error');
    if (!newPass)                      return showStatus('secStatus', 'New password cannot be empty.', 'error');
    if (newPass !== confirm)           return showStatus('secStatus', 'Passwords do not match.', 'error');

    const { error } = await _sbAdmin.from('site_settings').upsert({ key: 'admin_password', value: newPass }, { onConflict: 'key' });
    if (error) return showStatus('secStatus', 'Failed to update: ' + error.message, 'error');

    _currentPassword = newPass;
    ['secCurrent','secNew','secConfirm'].forEach(id => document.getElementById(id).value = '');
    showStatus('secStatus', 'Password updated successfully.', 'success');
}

// ── Courtesy Attribution ──────────────────────────────
async function loadCourtesyFields() {
    try {
        const { data: vc } = await _sbAdmin.from('site_settings').select('value').eq('key', 'video_courtesy').single();
        if (vc?.value) document.getElementById('videoCourtesyInput').value = vc.value;
    } catch {}
    try {
        const { data: pc } = await _sbAdmin.from('site_settings').select('value').eq('key', 'pdf_courtesy').single();
        if (pc?.value) document.getElementById('pdfCourtesyInput').value = pc.value;
    } catch {}
}

async function saveCourtesy(key, inputId, statusId) {
    const val = document.getElementById(inputId).value.trim();
    if (!val) return showStatus(statusId, 'Please enter a name.', 'error');
    const { error } = await _sbAdmin.from('site_settings').upsert({ key, value: val }, { onConflict: 'key' });
    if (error) return showStatus(statusId, 'Failed: ' + error.message, 'error');
    showStatus(statusId, 'Saved!', 'success');
}

// ── Utility ───────────────────────────────────────────
function showStatus(elId, msg, type) {
    const el = document.getElementById(elId);
    el.textContent = msg;
    el.className = 'status-msg ' + type;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
}
