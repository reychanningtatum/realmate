// mates.js — Realmate connection system
// Requires a `mates` table in Supabase. Run this SQL once:
//
// create table mates (
//   id uuid default gen_random_uuid() primary key,
//   requester_id   uuid,
//   requester_name text,
//   requester_img  text,
//   recipient_id   uuid,
//   recipient_name text,
//   status         text default 'pending',   -- 'pending' | 'accepted' | 'declined'
//   created_at     timestamptz default now()
// );
// create index on mates(requester_id);
// create index on mates(recipient_id);

const MATES_URL = 'https://wmegpgrfrtprhuzmgjma.supabase.co';
const MATES_KEY = 'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4';
const _matesDb  = (typeof _sb !== 'undefined') ? _sb
                : (typeof _supabase !== 'undefined') ? _supabase
                : supabase.createClient(MATES_URL, MATES_KEY);

// Cache: recipientName → status ('none'|'pending_sent'|'pending_received'|'accepted')
let _matesCache = {};
let _matesLoaded = false;

function _localUser() {
    return JSON.parse(localStorage.getItem('user')) || null;
}

async function loadMatesCache() {
    const me = _localUser();
    if (!me) return;
    try {
        const { data } = await _matesDb.auth.getUser();
        const myId = data?.user?.id;
        if (!myId) return;

        const { data: rows } = await _matesDb
            .from('mates')
            .select('*')
            .or(`requester_id.eq.${myId},recipient_id.eq.${myId}`);

        _matesCache = {};
        (rows || []).forEach(r => {
            const otherName = r.requester_id === myId ? r.recipient_name : r.requester_name;
            if (r.requester_id === myId) {
                _matesCache[otherName] = r.status === 'accepted' ? 'accepted' : 'pending_sent';
            } else {
                _matesCache[otherName] = r.status === 'accepted' ? 'accepted' : 'pending_received';
            }
        });
        _matesLoaded = true;
    } catch (e) { console.warn('mates cache load:', e); }
}

function getMateStatus(userName) {
    return _matesCache[userName] || 'none';
}

async function getMatesCount(userId) {
    try {
        const { count } = await _matesDb
            .from('mates')
            .select('*', { count: 'exact', head: true })
            .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
            .eq('status', 'accepted');
        return count || 0;
    } catch { return 0; }
}

// Returns { accepted: [], pendingReceived: [] }
async function getMatesList() {
    const me = _localUser();
    if (!me) return { accepted: [], pendingReceived: [] };
    try {
        const { data: authData } = await _matesDb.auth.getUser();
        const myId = authData?.user?.id;
        if (!myId) return { accepted: [], pendingReceived: [] };

        const { data: rows } = await _matesDb
            .from('mates')
            .select('*')
            .or(`requester_id.eq.${myId},recipient_id.eq.${myId}`)
            .order('created_at', { ascending: false });

        const accepted = [];
        const pendingReceived = [];
        const pendingSent = [];

        (rows || []).forEach(r => {
            const isMine = r.requester_id === myId;
            if (r.status === 'accepted') {
                accepted.push({
                    name: isMine ? r.recipient_name : r.requester_name,
                    img:  isMine ? (r.recipient_img || null) : (r.requester_img || null),
                    id:   isMine ? r.recipient_id : r.requester_id,
                    rowId: r.id
                });
            } else if (r.status === 'pending' && !isMine) {
                pendingReceived.push({
                    name: r.requester_name,
                    img:  r.requester_img,
                    id:   r.requester_id,
                    rowId: r.id
                });
            } else if (r.status === 'pending' && isMine) {
                pendingSent.push({
                    name: r.recipient_name,
                    rowId: r.id
                });
            }
        });

        // Fill missing images from profiles table
        const missingImg = accepted.filter(m => !m.img && m.id);
        if (missingImg.length > 0) {
            const ids = missingImg.map(m => m.id);
            const { data: profiles } = await _matesDb
                .from('profiles')
                .select('id, avatar_url')
                .in('id', ids);
            if (profiles) {
                const map = {};
                profiles.forEach(p => { map[p.id] = p.avatar_url; });
                accepted.forEach(m => { if (!m.img && map[m.id]) m.img = map[m.id]; });
            }
        }

        return { accepted, pendingReceived, pendingSent };
    } catch (e) { console.warn('getMatesList:', e); return { accepted: [], pendingReceived: [] }; }
}

async function sendMateRequest(recipientName, recipientImg) {
    const me = _localUser();
    if (!me) return { error: 'Not logged in' };

    const existing = getMateStatus(recipientName);
    if (existing !== 'none') return { error: 'Already connected or pending' };

    try {
        const { data: authData } = await _matesDb.auth.getUser();
        const myId = authData?.user?.id;
        if (!myId) return { error: 'Not authenticated' };

        // Find recipient id by name from listings
        const { data: recipientRows } = await _matesDb
            .from('listings')
            .select('user_id')
            .eq('user_name', recipientName)
            .limit(1);
        const recipientId = recipientRows?.[0]?.user_id || null;

        const { error } = await _matesDb.from('mates').insert({
            requester_id:   myId,
            requester_name: me.name,
            requester_img:  me.image || '',
            recipient_id:   recipientId,
            recipient_name: recipientName,
            recipient_img:  recipientImg || '',
            status: 'pending'
        });
        if (error) throw error;

        // Send notification to recipient
        await _matesDb.from('notifications').insert({
            type:                  'mate_request',
            sender_user_name:      me.name,
            sender_profile_picture: me.image || '',
            recipient_user_name:   recipientName,
            message:               'sent you a mate request.',
            is_read:               false,
            created_at:            new Date().toISOString()
        });

        _matesCache[recipientName] = 'pending_sent';
        return { success: true };
    } catch (e) {
        console.error('sendMateRequest:', e);
        return { error: e.message };
    }
}

async function acceptMateRequest(requesterName) {
    const me = _localUser();
    if (!me) return;
    try {
        const { data: authData } = await _matesDb.auth.getUser();
        const myId = authData?.user?.id;

        await _matesDb.from('mates')
            .update({ status: 'accepted' })
            .eq('requester_name', requesterName)
            .eq('recipient_name', me.name);

        // Notify requester they were accepted
        await _matesDb.from('notifications').insert({
            type:                  'mate_accepted',
            sender_user_name:      me.name,
            sender_profile_picture: me.image || '',
            recipient_user_name:   requesterName,
            message:               'accepted your mate request. You are now Realmates!',
            is_read:               false,
            created_at:            new Date().toISOString()
        });

        _matesCache[requesterName] = 'accepted';
        return { success: true };
    } catch (e) {
        console.error('acceptMateRequest:', e);
        return { error: e.message };
    }
}

async function declineMateRequest(requesterName) {
    const me = _localUser();
    if (!me) return;
    try {
        await _matesDb.from('mates')
            .delete()
            .eq('requester_name', requesterName)
            .eq('recipient_name', me.name);

        delete _matesCache[requesterName];
        return { success: true };
    } catch (e) {
        console.error('declineMateRequest:', e);
        return { error: e.message };
    }
}

// Render the correct button label/state for a given user
function mateButtonHtml(userName, btnClass = 'btn-mate') {
    const me = _localUser();
    if (!me || me.name === userName) return ''; // don't show for self

    const status = getMateStatus(userName);
    if (status === 'accepted') {
        return `<button class="${btnClass} mate-status-mates" disabled>
                    <i class="fas fa-handshake"></i> Realmates
                </button>`;
    }
    if (status === 'pending_sent') {
        return `<button class="${btnClass} mate-status-pending" disabled>
                    <i class="fas fa-clock"></i> Pending
                </button>`;
    }
    if (status === 'pending_received') {
        const safe = userName.replace(/'/g, "\\'");
        return `<div style="display:flex;flex-direction:column;gap:6px;">
                    <span style="font-size:12px;font-weight:700;color:#f59e0b;display:flex;align-items:center;gap:5px;">
                        <i class="fas fa-user-clock"></i> Sent you a mate request
                    </span>
                    <div style="display:flex;gap:6px;">
                        <button class="${btnClass} mate-status-received" onclick="handleAcceptMate(this,'${safe}')">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="${btnClass}" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;" onclick="handleDeclineMate(this,'${safe}')">
                            <i class="fas fa-times"></i> Decline
                        </button>
                    </div>
                </div>`;
    }
    return `<button class="${btnClass}" onclick="handleAddMate(this, '${userName.replace(/'/g, "\\'")}')">
                <i class="fas fa-user-plus"></i> Add as Mate
            </button>`;
}

async function handleAddMate(btn, userName) {
    const originalClass = btn.className;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const userImg = btn.closest('.listing-card, .match-card, .profile-info-block')
        ?.querySelector('img')?.src || '';
    const result = await sendMateRequest(userName, userImg);
    if (result.success) {
        btn.className = originalClass.replace('btn-mate-profile', 'btn-mate-profile mate-status-pending')
                                     .replace(/(?<!\S)btn-mate(?!\S)(?!-profile)/, 'btn-mate mate-status-pending');
        btn.innerHTML = '<i class="fas fa-clock"></i> Request Sent';
        btn.disabled = true;
        btn.onclick = null;
    } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Add as Mate';
        console.error('Mate request failed:', result.error);
        alert('Could not send mate request: ' + (result.error || 'Unknown error'));
    }
}

async function handleAcceptMate(btn, userName) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const result = await acceptMateRequest(userName);
    if (result.success) {
        const container = btn.closest('div[style]') || btn.parentElement;
        container.outerHTML = `<button class="btn-mate-profile mate-status-mates" disabled>
                                    <i class="fas fa-handshake"></i> You are now Realmates!
                               </button>`;
    } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Accept';
    }
}

async function handleDeclineMate(btn, userName) {
    btn.disabled = true;
    const result = await declineMateRequest(userName);
    if (result.success) {
        const container = btn.closest('div[style]') || btn.parentElement;
        container.outerHTML = `<button class="btn-mate" onclick="handleAddMate(this,'${userName.replace(/'/g, "\\'")}')">
                                    <i class="fas fa-user-plus"></i> Add as Mate
                               </button>`;
    } else {
        btn.disabled = false;
    }
}

// Init: load cache on page load
document.addEventListener('DOMContentLoaded', () => loadMatesCache());
