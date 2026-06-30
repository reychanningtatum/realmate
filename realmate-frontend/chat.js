// =========================================
// CHAT MODULE — Realmate (clean rewrite)
// =========================================

const CHAT_URL = 'https://wmegpgrfrtprhuzmgjma.supabase.co';
const CHAT_KEY = 'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4';
const _chatSupa = supabase.createClient(CHAT_URL, CHAT_KEY);

const CHAT_READ_HEADERS = { 'apikey': CHAT_KEY, 'Authorization': `Bearer ${CHAT_KEY}` };
const CHAT_WRITE_HEADERS = { 'apikey': CHAT_KEY, 'Authorization': `Bearer ${CHAT_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOC_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
const FILE_LIMITS = { 'image': 15728640, 'pdf': 20971520, 'doc': 10485760, 'docx': 10485760, 'xls': 10485760, 'xlsx': 10485760 };

let currentUser = null;
let activeConversationId = null;
let activeOtherUser = null;
let conversations = [];
let attachedFile = null;
let typingTimeout = null;
let typingChannel = null;
let messagesChannel = null;
let convChannel = null;

// ===== PRESENCE STATE =====
let presenceChannel = null;
let onlineUsers = {};
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

// ===== REST HELPERS =====
async function chatGet(table, query) {
    try {
        const r = await fetch(`${CHAT_URL}/rest/v1/${table}?${query}`, { headers: CHAT_READ_HEADERS });
        if (!r.ok) return [];
        return await r.json();
    } catch (e) { return []; }
}

async function chatInsert(table, body) {
    try {
        const r = await fetch(`${CHAT_URL}/rest/v1/${table}`, { method: 'POST', headers: CHAT_WRITE_HEADERS, body: JSON.stringify(body) });
        if (!r.ok) return null;
        const t = await r.text();
        if (!t) return null;
        const d = JSON.parse(t);
        return Array.isArray(d) ? d[0] : d;
    } catch (e) { return null; }
}

async function chatUpdate(table, query, body) {
    try {
        await fetch(`${CHAT_URL}/rest/v1/${table}?${query}`, { method: 'PATCH', headers: CHAT_WRITE_HEADERS, body: JSON.stringify(body) });
    } catch (e) {}
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await waitForUser();
    if (!currentUser) return;

    setupPresence();
    setupLastSeenEvents();
    setupMobileKeyboard();
    loadChatActiveStatus();

    await loadConversations();
    setupRealtimeConversations();

    const openWith = new URLSearchParams(window.location.search).get('user');
    if (openWith) {
        await openConversationWithUser(openWith);
    } else {
        const openChatWith = sessionStorage.getItem('openChatWith');
        if (openChatWith) {
            try {
                const { userId, name } = JSON.parse(openChatWith);
                sessionStorage.removeItem('openChatWith');
                if (userId) {
                    await openConversationWithUser(userId);
                } else if (name) {
                    // Fallback: find existing conversation by other user's name
                    const byName = conversations.find(c => c.otherUser && c.otherUser.name === name);
                    if (byName) await openConversation(byName.id);
                    else {
                        // Look up user id by name from listings table
                        const res = await fetch(`${CHAT_URL}/rest/v1/listings?select=user_id&user_name=eq.${encodeURIComponent(name)}&limit=1`, { headers: { apikey: CHAT_KEY, Authorization: `Bearer ${CHAT_KEY}` } });
                        const rows = await res.json();
                        if (Array.isArray(rows) && rows[0]?.user_id) await openConversationWithUser(rows[0].user_id);
                    }
                }
            } catch {}
        } else {
            const lastConv = sessionStorage.getItem('chat_active_conv');
            if (lastConv && conversations.find(c => c.id === lastConv)) {
                await openConversation(lastConv);
            }
        }
    }
});

function waitForUser() {
    return new Promise(resolve => {
        let n = 0;
        const tick = () => {
            const u = JSON.parse(localStorage.getItem('user'));
            if (u && u.id) resolve(u);
            else if (n++ < 25) setTimeout(tick, 200);
            else resolve(null);
        };
        tick();
    });
}

// ===== PRESENCE (zero DB writes for online status) =====
function setupPresence() {
    presenceChannel = _chatSupa.channel('online-users', {
        config: { presence: { key: currentUser.id } }
    });

    presenceChannel.on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        onlineUsers = {};
        Object.keys(state).forEach(userId => { onlineUsers[userId] = true; });
        refreshOnlineUI();
    });

    presenceChannel.on('presence', { event: 'join' }, ({ key }) => {
        onlineUsers[key] = true;
        refreshOnlineUI();
    });

    presenceChannel.on('presence', { event: 'leave' }, ({ key }) => {
        delete onlineUsers[key];
        refreshOnlineUI();
    });

    presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await presenceChannel.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
        }
    });
}

function isUserOnline(userId) {
    return !!onlineUsers[userId];
}

function refreshOnlineUI() {
    renderConvList();
    if (activeOtherUser) updateHeaderStatus();
}

// ===== LAST SEEN (write only on disconnect/idle/background) =====
function writeLastSeen() {
    if (!currentUser) return;
    chatUpdate('profiles', `id=eq.${currentUser.id}`, { last_seen: new Date().toISOString() });
}

function setupLastSeenEvents() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            writeLastSeen();
        } else {
            resetInactivityTimer();
            if (presenceChannel) {
                presenceChannel.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
            }
        }
    });

    window.addEventListener('beforeunload', writeLastSeen);

    window.addEventListener('pagehide', writeLastSeen);

    ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
        document.addEventListener(evt, resetInactivityTimer, { passive: true });
    });

    resetInactivityTimer();
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        writeLastSeen();
        if (presenceChannel) presenceChannel.untrack();
    }, INACTIVITY_TIMEOUT);
}

// ===== LOAD CONVERSATIONS =====
async function loadConversations() {
    let myParts = await chatGet('conversation_participants', `select=conversation_id,deleted_at&user_id=eq.${currentUser.id}`);
    if (myParts && myParts.code) {
        myParts = await chatGet('conversation_participants', `select=conversation_id&user_id=eq.${currentUser.id}`);
    }
    if (!myParts.length) { conversations = []; renderConvList(); return; }

    const deletedMap = {};
    myParts.forEach(p => { if (p.deleted_at) deletedMap[p.conversation_id] = p.deleted_at; });

    const ids = myParts.map(p => p.conversation_id);
    const idStr = ids.map(id => `"${id}"`).join(',');

    const [allParts, profiles_raw, msgs, unread] = await Promise.all([
        chatGet('conversation_participants', `select=conversation_id,user_id&conversation_id=in.(${idStr})`),
        (async () => {
            const otherIds = [];
            const tempParts = await chatGet('conversation_participants', `select=conversation_id,user_id&conversation_id=in.(${idStr})`);
            tempParts.forEach(p => { if (p.user_id !== currentUser.id && !otherIds.includes(p.user_id)) otherIds.push(p.user_id); });
            if (!otherIds.length) return [];
            return chatGet('profiles', `select=id,full_name,avatar_url,job_title,last_seen,show_active_status&id=in.(${otherIds.map(i => `"${i}"`).join(',')})`);
        })(),
        chatGet('messages', `select=*&conversation_id=in.(${idStr})&order=created_at.desc`),
        chatGet('messages', `select=conversation_id&conversation_id=in.(${idStr})&sender_id=neq.${currentUser.id}&is_read=eq.false`)
    ]);

    const profileMap = {};
    profiles_raw.forEach(p => profileMap[p.id] = p);

    const unreadMap = {};
    unread.forEach(m => { unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1; });

    const lastMsgMap = {};
    msgs.forEach(m => { if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m; });

    conversations = ids.map(cid => {
        const other = allParts.find(p => p.conversation_id === cid && p.user_id !== currentUser.id);
        const prof = other ? profileMap[other.user_id] : null;
        if (!prof) return null;

        const lm = lastMsgMap[cid] || null;
        const deletedAt = deletedMap[cid];
        if (deletedAt && (!lm || new Date(lm.created_at) <= new Date(deletedAt))) return null;

        return {
            id: cid,
            otherUser: {
                id: prof.id,
                name: prof.full_name || 'Unknown',
                image: prof.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(prof.full_name || 'U')}&background=random&color=fff`,
                job: prof.job_title || '',
                last_seen: prof.last_seen,
                show_active_status: prof.show_active_status !== false
            },
            lastMessage: lm,
            unreadCount: unreadMap[cid] || 0
        };
    }).filter(Boolean);

    conversations.sort((a, b) => {
        const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
        const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
        return tb - ta;
    });

    renderConvList();
}

// ===== RENDER CONVERSATION LIST =====
function renderConvList(filter) {
    const list = document.getElementById('chatConvList');
    const lf = (filter || '').toLowerCase();
    const items = lf ? conversations.filter(c => c.otherUser.name.toLowerCase().includes(lf)) : conversations;

    if (!items.length) {
        list.innerHTML = lf
            ? `<div class="chat-conv-empty"><i class="fas fa-search" style="font-size:28px;color:var(--chat-border);margin-bottom:8px;display:block;"></i>No results</div>`
            : `<div class="chat-conv-empty"><i class="fas fa-comments" style="font-size:32px;color:var(--chat-border);margin-bottom:8px;display:block;"></i>No conversations yet</div>`;
        return;
    }

    list.innerHTML = items.map(c => {
        const active = c.id === activeConversationId ? ' active' : '';
        const online = (c.otherUser.show_active_status && isUserOnline(c.otherUser.id)) ? '<div class="online-dot"></div>' : '';
        const lm = c.lastMessage;
        let preview = '';
        if (lm) {
            if (lm.is_unsent) {
                preview = lm.sender_id === currentUser.id ? 'You unsent a message' : 'Message unsent';
            } else {
                preview = lm.sender_id === currentUser.id ? 'You: ' : '';
                preview += lm.message_type === 'TEXT' ? (lm.message_text || '') : `📎 ${lm.file_name || lm.message_type}`;
            }
        }
        const time = lm ? fmtConvTime(lm.created_at) : '';
        const badge = c.unreadCount > 0 ? `<span class="chat-unread-badge">${c.unreadCount > 99 ? '99+' : c.unreadCount}</span>` : '';

        return `<div class="chat-conv-swipe-wrap" data-conv-id="${c.id}">
            <div class="chat-conv-item${active}" onclick="openConversation('${c.id}')">
                <div class="chat-conv-avatar"><img src="${c.otherUser.image}" alt="">${online}</div>
                <div class="chat-conv-info">
                    <div class="chat-conv-name">${esc(c.otherUser.name)}</div>
                    <div class="chat-conv-last">${esc(preview.length > 40 ? preview.slice(0, 40) + '…' : preview)}</div>
                </div>
                <div class="chat-conv-meta"><span class="chat-conv-time">${time}</span>${badge}</div>
            </div>
            <div class="chat-conv-swipe-action" onclick="promptDeleteChat('${c.id}')"><i class="fas fa-trash-can"></i><span>Delete</span></div>
        </div>`;
    }).join('');
}

function searchConversations(v) {
    document.getElementById('chatConvSearchClear').style.display = v ? 'block' : 'none';
    renderConvList(v);
}
function clearConvSearch() {
    document.getElementById('chatConvSearch').value = '';
    document.getElementById('chatConvSearchClear').style.display = 'none';
    renderConvList();
}

// ===== OPEN CONVERSATION =====
async function openConversation(convId) {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;

    unsubMessages();

    activeConversationId = convId;
    activeOtherUser = conv.otherUser;
    sessionStorage.setItem('chat_active_conv', convId);

    document.getElementById('chatEmptyState').style.display = 'none';
    document.getElementById('chatActiveConv').style.display = 'flex';
    document.getElementById('chatHeaderAvatar').src = activeOtherUser.image;
    document.getElementById('chatHeaderName').textContent = activeOtherUser.name;
    updateHeaderStatus();

    if (window.innerWidth <= 768) {
        document.getElementById('chatSidebar').classList.add('hidden');
        document.getElementById('chatMain').classList.add('active');
    }

    renderConvList();

    const container = document.getElementById('chatMessages');
    container.innerHTML = '';

    const msgs = await chatGet('messages', `select=*&conversation_id=eq.${convId}&order=created_at.asc`);

    if (activeConversationId !== convId) return;

    if (!msgs.length) {
        container.insertAdjacentHTML('beforeend', '<div style="text-align:center;padding:40px;color:var(--chat-sub);font-size:13px;">No messages yet. Say hello! 👋</div>');
    } else {
        let lastDate = '';
        msgs.forEach(m => {
            const d = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            if (d !== lastDate) { lastDate = d; addDateSep(container, d); }
            addMsgBubble(container, m);
        });
        container.scrollTop = container.scrollHeight;
    }

    markRead(convId);
    subscribeMessages(convId);
    subscribeTyping(convId);
}

async function openConversationWithUser(userId) {
    const existing = conversations.find(c => c.otherUser && c.otherUser.id === userId);
    if (existing) { await openConversation(existing.id); return; }
    await startConversation(userId);
}

function backToConvList() {
    unsubMessages();
    activeConversationId = null;
    activeOtherUser = null;
    sessionStorage.removeItem('chat_active_conv');
    document.getElementById('chatSidebar').classList.remove('hidden');
    document.getElementById('chatMain').classList.remove('active');
    document.getElementById('chatActiveConv').style.display = 'none';
    document.getElementById('chatEmptyState').style.display = 'flex';
    document.getElementById('chatMessages').innerHTML = '';
    renderConvList();
}

function updateHeaderStatus() {
    const el = document.getElementById('chatHeaderStatus');
    if (!activeOtherUser) return;

    if (!activeOtherUser.show_active_status) {
        el.textContent = '';
        return;
    }

    if (isUserOnline(activeOtherUser.id)) {
        el.innerHTML = '<span class="status-online">● Online</span>';
    } else if (activeOtherUser.last_seen) {
        el.textContent = `Last seen ${fmtLastSeen(activeOtherUser.last_seen)}`;
    } else {
        el.textContent = 'Offline';
    }
}

// ===== DOM HELPERS =====
function addDateSep(container, text) {
    const div = document.createElement('div');
    div.className = 'chat-date-sep';
    div.innerHTML = `<span>${text}</span>`;
    container.appendChild(div);
}

function renderListingRefCard(container, ref) {
    const { extractLocations } = window;
    const locs = typeof extractLocations === 'function' ? extractLocations(ref.content || '') : [];
    const locText = locs.length ? locs.join(', ') : '';
    const priceMatch = (ref.content || '').match(/(\d+\.?\d*)\s*[Mm](?:illion)?/);
    const price = priceMatch ? `₱${parseFloat(priceMatch[1])}M` : '';

    const catColors = {
        'FOR SALE': '#16a34a', 'FOR RENT': '#2563eb', 'FOR LEASE': '#7c3aed',
        'WILLING TO BUY': '#b45309', 'WILLING TO RENT': '#0e7490', 'WILLING TO LEASE': '#be185d'
    };
    const catColor = catColors[ref.category] || '#64748b';

    const card = document.createElement('div');
    card.className = 'chat-listing-ref';
    card.innerHTML = `
        <div class="clr-label"><i class="fas fa-handshake"></i> Offer Reference</div>
        <div class="clr-body">
            ${ref.img ? `<img class="clr-img" src="${ref.img}" onerror="this.style.display='none'">` : ''}
            <div class="clr-info">
                ${ref.category ? `<span class="clr-cat" style="color:${catColor};border-color:${catColor}20;background:${catColor}10">${ref.category}</span>` : ''}
                ${locText ? `<div class="clr-loc"><i class="fas fa-map-marker-alt"></i>${locText}</div>` : ''}
                ${price    ? `<div class="clr-price">${price}</div>` : ''}
            </div>
        </div>
        <a class="clr-view-btn" href="listing-detail.html?id=${ref.id}" onclick="event.stopPropagation()">
            View Listing <i class="fas fa-arrow-right"></i>
        </a>
    `;
    container.appendChild(card);
}

function addMsgBubble(container, m) {
    const isOwn = m.sender_id === currentUser.id;
    const side = isOwn ? 'own' : 'other';

    const dt = new Date(m.created_at);
    const now = new Date();
    const isToday = dt.toDateString() === now.toDateString();
    const isYesterday = new Date(now - 86400000).toDateString() === dt.toDateString();
    const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    let fullTimestamp;
    if (isToday) fullTimestamp = `Today at ${timeStr}`;
    else if (isYesterday) fullTimestamp = `Yesterday at ${timeStr}`;
    else fullTimestamp = `${dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • ${timeStr}`;

    // Unsent message
    if (m.is_unsent) {
        const label = isOwn ? 'You unsent a message' : 'This message was unsent';
        const html = `<div class="chat-msg-row ${side}" data-msg-id="${m.id}" onclick="toggleMsgTimestamp(this)"><div class="chat-msg-tap-ts">${fullTimestamp}</div><div><div class="chat-msg-unsent"><i class="fas fa-ban" style="margin-right:4px;font-size:11px;"></i>${label}</div></div></div>`;
        container.insertAdjacentHTML('beforeend', html);
        return;
    }

    let receipt = '';
    if (isOwn) {
        // Get HH:MM of this message
        const msgMinute = new Date(m.created_at).toISOString().slice(0, 16);
        // Hide receipts on previous own messages sharing the same minute
        container.querySelectorAll('.chat-msg-row.own').forEach(row => {
            const prev = row.querySelector('.chat-msg-receipt');
            if (prev && row.dataset.msgMinute === msgMinute) prev.style.display = 'none';
        });
        receipt = m.is_read
            ? '<span class="chat-msg-receipt"><span class="seen">✓✓</span></span>'
            : '<span class="chat-msg-receipt"><span class="delivered">✓✓</span></span>';
    }

    let bubble = '';
    const type = (m.message_type || 'TEXT').toUpperCase();
    if (type === 'LISTING_REF' || (type === 'TEXT' && (m.message_text || '').startsWith('__LISTING_REF__'))) {
        try {
            const rawText = (m.message_text || '').replace('__LISTING_REF__', '');
            const ref = JSON.parse(rawText || '{}');
            const priceMatch = (ref.content || '').match(/(\d+\.?\d*)\s*[Mm](?:illion)?/);
            const price = priceMatch ? `₱${parseFloat(priceMatch[1])}M` : '';
            const catColors = { 'FOR SALE': '#16a34a', 'FOR RENT': '#2563eb', 'PRE-SELLING': '#d97706', 'RESALE': '#7c3aed' };
            const catColor = catColors[ref.category] || '#64748b';
            const imgHtml = ref.img ? `<img class="clr-img" src="${ref.img}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;">` : '';
            const catHtml = ref.category ? `<span class="clr-cat" style="background:${catColor}15;color:${catColor};font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;">${ref.category}</span>` : '';
            const priceHtml = price ? `<div class="clr-price" style="font-size:13px;font-weight:800;color:#0f172a;margin-top:4px;">${price}</div>` : '';
            bubble = `<div class="chat-listing-ref" style="cursor:default;"><div class="clr-label"><i class="fas fa-handshake"></i> Offer Reference</div><div class="clr-body" style="display:flex;gap:10px;align-items:flex-start;">${imgHtml}<div class="clr-info">${catHtml}${priceHtml}</div></div><a class="clr-view-btn" href="listing-detail.html?id=${ref.id}" onclick="event.stopPropagation();" style="display:block;margin-top:10px;text-align:center;padding:8px;background:#0f172a;color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">View Listing</a></div>`;
        } catch { bubble = `<div class="chat-msg-bubble">📋 Offer Reference</div>`; }
        const html = `<div class="chat-msg-row ${side}" data-msg-id="${m.id}">${bubble}</div>`;
        container.insertAdjacentHTML('beforeend', html);
        return;
    } else if (type === 'TEXT') {
        bubble = `<div class="chat-msg-bubble">${esc(m.message_text || '')}</div>`;
    } else if (type === 'IMAGE') {
        bubble = `<div class="chat-msg-bubble chat-msg-image-bubble"><img class="chat-msg-image" src="${m.file_url}" alt="Image" onclick="event.stopPropagation();openLightbox('${m.file_url}')" loading="lazy"></div>`;
    } else if (type === 'PDF') {
        bubble = fileBubble(m, '📄', true);
    } else if (type === 'DOC' || type === 'DOCX') {
        bubble = fileBubble(m, '📝', false);
    } else if (type === 'XLS' || type === 'XLSX') {
        bubble = fileBubble(m, '📊', false);
    }

    const ctxAttr = `oncontextmenu="event.preventDefault();showCtxMenu(event,this)" data-msg-text="${esc(m.message_text || '')}" data-msg-type="${type}" data-msg-sender="${m.sender_id}"`;

    const msgMinuteAttr = isOwn ? `data-msg-minute="${new Date(m.created_at).toISOString().slice(0,16)}"` : '';
    const html = `<div class="chat-msg-row ${side}" data-msg-id="${m.id}" ${msgMinuteAttr} onclick="toggleMsgTimestamp(this)" ${ctxAttr}><div class="chat-msg-tap-ts">${fullTimestamp}</div><div>${bubble}<div class="chat-msg-meta" style="justify-content:${isOwn ? 'flex-end' : 'flex-start'}">${receipt}</div></div></div>`;

    container.insertAdjacentHTML('beforeend', html);
}

function fileBubble(m, icon, preview) {
    const sz = fmtSize(m.file_size || 0);
    const url = m.file_url || '';
    const name = m.file_name || 'File';
    const prevBtn = preview ? `<button onclick="window.open('${url}','_blank')">Preview</button>` : '';
    return `<div class="chat-msg-bubble"><div class="chat-msg-file"><span class="chat-msg-file-icon">${icon}</span><div class="chat-msg-file-info"><div class="chat-msg-file-name">${esc(name)}</div><div class="chat-msg-file-size">${sz}</div><div class="chat-msg-file-actions">${prevBtn}<button onclick="downloadFile('${url}','${esc(name)}')">Download</button></div></div></div></div>`;
}

// ===== SEND MESSAGE =====
async function sendMessage() {
    const input = document.getElementById('chatComposerInput');
    const text = input.value.trim();
    const convId = activeConversationId;
    if (!convId || (!text && !attachedFile)) return;

    const btn = document.getElementById('chatSendBtn');
    btn.disabled = true;
    input.value = '';
    autoResizeComposer(input);

    try {
        if (attachedFile) {
            await doSendFile(attachedFile, convId);
            removeAttachedFile();
        }
        if (text) {
            await doSendText(text, convId);
        }
        chatUpdate('conversations', `id=eq.${convId}`, { updated_at: new Date().toISOString() });
    } catch (e) {
        console.error('Send error:', e);
    }

    btn.disabled = false;
    updateSendButton();
    input.focus();
}

async function doSendText(text, convId) {
    const msg = await chatInsert('messages', {
        conversation_id: convId,
        sender_id: currentUser.id,
        message_type: 'TEXT',
        message_text: text,
        is_read: false
    });
    if (msg && activeConversationId === convId) {
        const container = document.getElementById('chatMessages');
        if (container.querySelector('div[style*="text-align"]')) container.innerHTML = '';
        const d = new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const lastSep = container.querySelectorAll('.chat-date-sep');
        const lastD = lastSep.length ? lastSep[lastSep.length - 1].textContent.trim() : '';
        if (d !== lastD) addDateSep(container, d);
        addMsgBubble(container, msg);
        container.scrollTop = container.scrollHeight;
    }
    const conv = conversations.find(c => c.id === convId);
    if (conv && msg) { conv.lastMessage = msg; sortAndRenderConvs(); }
}

async function doSendFile(file, convId) {
    const ext = file.name.split('.').pop().toLowerCase();
    let messageType = ext.toUpperCase();
    let fileToUpload = file;

    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        messageType = 'IMAGE';
        fileToUpload = await compressImage(file, { maxPx: 1200, quality: 0.82 });
    }

    const fname = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const fpath = `chat/${convId}/${fname}`;

    const upRes = await fetch(`${CHAT_URL}/storage/v1/object/chat-files/${fpath}`, {
        method: 'POST',
        headers: { 'apikey': CHAT_KEY, 'Authorization': `Bearer ${CHAT_KEY}`, 'Content-Type': file.type || 'application/octet-stream' },
        body: fileToUpload
    });
    if (!upRes.ok) throw new Error('Upload failed');

    const fileUrl = `${CHAT_URL}/storage/v1/object/public/chat-files/${fpath}`;
    const msg = await chatInsert('messages', {
        conversation_id: convId,
        sender_id: currentUser.id,
        message_type: messageType,
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
        is_read: false
    });

    if (msg && activeConversationId === convId) {
        const container = document.getElementById('chatMessages');
        if (container.querySelector('div[style*="text-align"]')) container.innerHTML = '';
        if (!container.querySelector(`[data-msg-id="${msg.id}"]`)) {
            addMsgBubble(container, msg);
            container.scrollTop = container.scrollHeight;
        }
    }
    const conv = conversations.find(c => c.id === convId);
    if (conv && msg) { conv.lastMessage = msg; sortAndRenderConvs(); }
}

function sortAndRenderConvs() {
    conversations.sort((a, b) => {
        const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
        const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
        return tb - ta;
    });
    renderConvList();
}

// ===== FILE HANDLING =====
function handleFileAttach(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    const ext = file.name.split('.').pop().toLowerCase();
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isDoc = ALLOWED_DOC_EXTENSIONS.includes(ext);
    if (!isImage && !isDoc) { alert('Unsupported file type.'); return; }
    const max = isImage ? FILE_LIMITS['image'] : (FILE_LIMITS[ext] || 10485760);
    if (file.size > max) { alert(`File too large. Maximum: ${fmtSize(max)}`); return; }
    attachedFile = file;
    document.getElementById('chatFilePreviewName').textContent = `${file.name} (${fmtSize(file.size)})`;
    document.getElementById('chatFilePreview').classList.add('active');
    updateSendButton();
}

function removeAttachedFile() {
    attachedFile = null;
    document.getElementById('chatFilePreview').classList.remove('active');
    updateSendButton();
}

function downloadFile(url, name) {
    const a = document.createElement('a');
    a.href = url; a.download = name; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
}

// ===== COMPOSER =====
function handleComposerKeydown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoResizeComposer(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; updateSendButton(); }
function updateSendButton() {
    const inp = document.getElementById('chatComposerInput');
    document.getElementById('chatSendBtn').disabled = !inp.value.trim() && !attachedFile;
}

// ===== TYPING =====
function handleTyping() {
    if (!activeConversationId || !typingChannel) return;
    typingChannel.send({ type: 'broadcast', event: 'typing', payload: { user_id: currentUser.id, name: currentUser.name } });
}

function subscribeTyping(convId) {
    typingChannel = _chatSupa.channel(`typing:${convId}`);
    typingChannel.on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === currentUser.id || activeConversationId !== convId) return;
        const el = document.getElementById('chatTypingIndicator');
        el.innerHTML = `${esc(payload.name)} is typing<span class="typing-dots"><span></span><span></span><span></span></span>`;
        el.classList.add('active');
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => el.classList.remove('active'), 3000);
    }).subscribe();
}

// ===== READ RECEIPTS =====
async function markRead(convId) {
    await chatUpdate('messages', `conversation_id=eq.${convId}&sender_id=neq.${currentUser.id}&is_read=eq.false`, { is_read: true });
    const conv = conversations.find(c => c.id === convId);
    if (conv) { conv.unreadCount = 0; renderConvList(); }
}

// ===== REALTIME =====
function subscribeMessages(convId) {
    messagesChannel = _chatSupa.channel(`msgs:${convId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
            (payload) => {
                if (activeConversationId !== convId) return;
                const m = payload.new;
                if (document.querySelector(`[data-msg-id="${m.id}"]`)) return;
                const container = document.getElementById('chatMessages');
                if (container.querySelector('div[style*="text-align"]')) container.innerHTML = '';
                addMsgBubble(container, m);
                container.scrollTop = container.scrollHeight;
                if (m.sender_id !== currentUser.id) markRead(convId);
                const conv = conversations.find(c => c.id === convId);
                if (conv) { conv.lastMessage = m; sortAndRenderConvs(); }
            })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
            (payload) => {
                const m = payload.new;
                if (m.is_unsent) {
                    const row = document.querySelector(`[data-msg-id="${m.id}"]`);
                    if (row) {
                        const isOwn = m.sender_id === currentUser.id;
                        const label = isOwn ? 'You unsent a message' : 'This message was unsent';
                        const inner = row.querySelector('div:nth-child(2)');
                        if (inner) inner.innerHTML = `<div class="chat-msg-unsent"><i class="fas fa-ban" style="margin-right:4px;font-size:11px;"></i>${label}</div>`;
                        row.removeAttribute('oncontextmenu');
                    }
                    const conv = conversations.find(c => c.id === convId);
                    if (conv) { conv.lastMessage = m; sortAndRenderConvs(); }
                    return;
                }
                if (m.sender_id === currentUser.id && m.is_read) {
                    const el = document.querySelector(`[data-msg-id="${m.id}"] .chat-msg-receipt`);
                    if (el) el.innerHTML = '<span class="seen">✓✓</span>';
                }
            })
        .subscribe();
}

function unsubMessages() {
    if (messagesChannel) { _chatSupa.removeChannel(messagesChannel); messagesChannel = null; }
    if (typingChannel) { _chatSupa.removeChannel(typingChannel); typingChannel = null; }
}

function setupRealtimeConversations() {
    convChannel = _chatSupa.channel('conv-list')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${currentUser.id}` },
            () => loadConversations())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
                const m = payload.new;
                if (m.sender_id === currentUser.id) return;
                if (m.conversation_id === activeConversationId) return;
                const conv = conversations.find(c => c.id === m.conversation_id);
                if (conv) {
                    conv.unreadCount = (conv.unreadCount || 0) + 1;
                    conv.lastMessage = m;
                    sortAndRenderConvs();
                }
            })
        .subscribe();
}

// ===== NEW CHAT =====
function openNewChatModal() {
    document.getElementById('chatNewModal').classList.add('active');
    document.getElementById('chatNewModalSearch').value = '';
    document.getElementById('chatNewModalSearch').focus();
    loadAllUsers();
}

function closeNewChatModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('chatNewModal').classList.remove('active');
}

async function loadAllUsers(filter) {
    const list = document.getElementById('chatNewModalList');
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--chat-sub);"><i class="fas fa-spinner fa-spin"></i></div>';
    let q = `select=id,full_name,avatar_url,job_title&id=neq.${currentUser.id}&limit=50`;
    if (filter) q += `&full_name=ilike.*${encodeURIComponent(filter)}*`;
    const users = await chatGet('profiles', q);
    if (!users.length) { list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--chat-sub);font-size:13px;">No users found</div>'; return; }
    list.innerHTML = users.map(u => `
        <div class="chat-new-modal-user" onclick="startConversation('${u.id}')">
            <img src="${u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name || 'U')}&background=random&color=fff`}" alt="">
            <div class="chat-new-modal-user-info"><h4>${esc(u.full_name || 'Unknown')}</h4><p>${esc(u.job_title || '')}</p></div>
        </div>`).join('');
}

function searchNewChatUsers(v) {
    clearTimeout(searchNewChatUsers._t);
    searchNewChatUsers._t = setTimeout(() => loadAllUsers(v), 300);
}

async function startConversation(userId) {
    const existing = conversations.find(c => c.otherUser && c.otherUser.id === userId);
    if (existing) { closeNewChatModal(); await openConversation(existing.id); return; }

    const conv = await chatInsert('conversations', { created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    if (!conv) { alert('Failed to create conversation.'); return; }

    await chatInsert('conversation_participants', { conversation_id: conv.id, user_id: currentUser.id });
    await chatInsert('conversation_participants', { conversation_id: conv.id, user_id: userId });

    closeNewChatModal();
    await loadConversations();
    await openConversation(conv.id);
}

// ===== MESSAGE SEARCH =====
function toggleMsgSearch() {
    const bar = document.getElementById('chatMsgSearchBar');
    bar.classList.toggle('active');
    if (bar.classList.contains('active')) {
        document.getElementById('chatMsgSearchInput').value = '';
        document.getElementById('chatMsgSearchInput').focus();
    } else if (activeConversationId) {
        openConversation(activeConversationId);
    }
}

async function searchMessages(val) {
    if (!val || val.length < 2 || !activeConversationId) return;
    clearTimeout(searchMessages._t);
    searchMessages._t = setTimeout(async () => {
        const msgs = await chatGet('messages', `select=*&conversation_id=eq.${activeConversationId}&message_text=ilike.*${encodeURIComponent(val)}*&order=created_at.asc`);
        const container = document.getElementById('chatMessages');
        if (!msgs.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--chat-sub);font-size:13px;">No messages found</div>'; return; }
        container.innerHTML = '';
        msgs.forEach(m => addMsgBubble(container, m));
        container.querySelectorAll('.chat-msg-bubble').forEach(b => {
            if (b.querySelector('.chat-msg-file')) return;
            b.innerHTML = b.innerHTML.replace(new RegExp(`(${val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<span class="chat-search-highlight">$1</span>');
        });
    }, 300);
}

// ===== LIGHTBOX =====
function openLightbox(url) { document.getElementById('chatLightboxImg').src = url; document.getElementById('chatLightbox').classList.add('active'); }
function closeLightbox() { document.getElementById('chatLightbox').classList.remove('active'); }

// ===== UTILS =====
function fmtLastSeen(ls) {
    if (!ls) return 'a while ago';
    const s = Math.floor((Date.now() - new Date(ls).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min${Math.floor(s / 60) > 1 ? 's' : ''} ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} hr${Math.floor(s / 3600) > 1 ? 's' : ''} ago`;
    if (s < 172800) return 'yesterday';
    return new Date(ls).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtConvTime(ts) {
    const d = new Date(ts), now = new Date(), diff = now - d;
    if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString('en-US', { weekday: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtSize(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ===== CONTEXT MENU (long press / right click) =====
let ctxTargetRow = null;
let longPressTimer = null;

function showCtxMenu(e, row) {
    e.preventDefault();
    e.stopPropagation();
    ctxTargetRow = row;

    const menu = document.getElementById('chatCtxMenu');
    const msgType = row.getAttribute('data-msg-type');
    const senderId = row.getAttribute('data-msg-sender');

    document.getElementById('ctxCopy').style.display = (msgType === 'TEXT') ? 'flex' : 'none';
    document.getElementById('ctxUnsend').style.display = (senderId === currentUser.id) ? 'flex' : 'none';

    let x = e.clientX || e.touches?.[0]?.clientX || 0;
    let y = e.clientY || e.touches?.[0]?.clientY || 0;

    menu.classList.add('open');
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    if (x + mw > window.innerWidth) x = window.innerWidth - mw - 8;
    if (y + mh > window.innerHeight) y = window.innerHeight - mh - 8;
    if (x < 4) x = 4;
    if (y < 4) y = 4;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

function hideCtxMenu() {
    document.getElementById('chatCtxMenu').classList.remove('open');
    ctxTargetRow = null;
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.chat-ctx-menu')) hideCtxMenu();
});

// Long press for mobile
document.addEventListener('touchstart', (e) => {
    const row = e.target.closest('.chat-msg-row[oncontextmenu]');
    if (!row) return;
    longPressTimer = setTimeout(() => {
        const touch = e.touches[0];
        showCtxMenu({ preventDefault() {}, stopPropagation() {}, clientX: touch.clientX, clientY: touch.clientY }, row);
    }, 500);
}, { passive: true });

document.addEventListener('touchend', () => { clearTimeout(longPressTimer); });
document.addEventListener('touchmove', () => { clearTimeout(longPressTimer); });

// ===== COPY TEXT =====
function ctxCopyText() {
    if (!ctxTargetRow) return;
    const text = ctxTargetRow.getAttribute('data-msg-text') || '';
    navigator.clipboard.writeText(text).catch(() => {});
    hideCtxMenu();
}

// ===== UNSEND MESSAGE =====
let unsendMsgId = null;

function ctxUnsendMsg() {
    if (!ctxTargetRow) return;
    unsendMsgId = ctxTargetRow.getAttribute('data-msg-id');
    hideCtxMenu();
    document.getElementById('unsendModal').classList.add('open');
}

function closeUnsendModal() {
    document.getElementById('unsendModal').classList.remove('open');
    unsendMsgId = null;
}

async function confirmUnsend() {
    if (!unsendMsgId) return;
    const msgId = unsendMsgId;
    closeUnsendModal();

    await chatUpdate('messages', `id=eq.${msgId}&sender_id=eq.${currentUser.id}`, {
        is_unsent: true,
        message_text: null,
        file_url: null,
        file_name: null,
        file_size: null
    });

    const row = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (row) {
        const inner = row.querySelector('div:nth-child(2)');
        if (inner) inner.innerHTML = '<div class="chat-msg-unsent"><i class="fas fa-ban" style="margin-right:4px;font-size:11px;"></i>You unsent a message</div>';
        row.removeAttribute('oncontextmenu');
    }

    if (activeConversationId) {
        const conv = conversations.find(c => c.id === activeConversationId);
        if (conv && conv.lastMessage && conv.lastMessage.id === msgId) {
            conv.lastMessage.is_unsent = true;
            conv.lastMessage.message_text = null;
            sortAndRenderConvs();
        }
    }
}

// ===== DELETE CHAT (for me only) =====
let deleteChatId = null;

function promptDeleteChat(convId) {
    deleteChatId = convId;
    document.getElementById('deleteChatModal').classList.add('open');
}

function closeDeleteChatModal() {
    document.getElementById('deleteChatModal').classList.remove('open');
    deleteChatId = null;
}

async function confirmDeleteChat() {
    if (!deleteChatId) return;
    const convId = deleteChatId;
    closeDeleteChatModal();

    await chatUpdate('conversation_participants',
        `conversation_id=eq.${convId}&user_id=eq.${currentUser.id}`,
        { deleted_at: new Date().toISOString() }
    );

    conversations = conversations.filter(c => c.id !== convId);

    if (activeConversationId === convId) {
        backToConvList();
    }

    renderConvList();
}

// ===== MESSAGE TIMESTAMPS (tap to reveal) =====
function toggleMsgTimestamp(row) {
    const ts = row.querySelector('.chat-msg-tap-ts');
    if (!ts) return;
    const wasOpen = ts.classList.contains('visible');

    document.querySelectorAll('.chat-msg-tap-ts.visible').forEach(el => el.classList.remove('visible'));

    if (!wasOpen) ts.classList.add('visible');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.chat-msg-row')) {
        document.querySelectorAll('.chat-msg-tap-ts.visible').forEach(el => el.classList.remove('visible'));
    }
});

// ===== CHAT SETTINGS (Active Status) =====
function toggleChatSettings() {
    const panel = document.getElementById('chatSettingsPanel');
    panel.classList.toggle('open');
}

async function loadChatActiveStatus() {
    const toggle = document.getElementById('chatActiveToggle');
    if (!toggle || !currentUser) return;
    try {
        const data = await chatGet('profiles', `select=show_active_status&id=eq.${currentUser.id}`);
        toggle.checked = (data && data[0] && data[0].show_active_status !== false);
    } catch (e) {
        toggle.checked = true;
    }
}

async function saveChatActiveStatus(enabled) {
    if (!currentUser) return;
    chatUpdate('profiles', `id=eq.${currentUser.id}`, { show_active_status: enabled });

    if (!enabled && presenceChannel) {
        presenceChannel.untrack();
    } else if (enabled && presenceChannel) {
        presenceChannel.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
    }
}

// ===== SWIPE-TO-DELETE CONVERSATIONS =====
(function() {
    let startX = 0, currentWrap = null, swiping = false;
    const THRESHOLD = 60;

    document.addEventListener('touchstart', (e) => {
        const wrap = e.target.closest('.chat-conv-swipe-wrap');
        if (!wrap) return;

        // Close any other open swipe
        document.querySelectorAll('.chat-conv-swipe-wrap.swiped').forEach(w => {
            if (w !== wrap) w.classList.remove('swiped');
        });

        startX = e.touches[0].clientX;
        currentWrap = wrap;
        swiping = false;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!currentWrap) return;
        const dx = e.touches[0].clientX - startX;
        if (dx < -15) swiping = true;
        if (swiping) {
            const item = currentWrap.querySelector('.chat-conv-item');
            const move = Math.max(Math.min(dx, 0), -80);
            item.style.transition = 'none';
            item.style.transform = `translateX(${move}px)`;
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!currentWrap) return;
        const item = currentWrap.querySelector('.chat-conv-item');
        item.style.transition = '';
        const current = parseFloat(item.style.transform.replace(/[^-\d.]/g, '') || 0);
        if (current < -THRESHOLD) {
            currentWrap.classList.add('swiped');
        } else {
            currentWrap.classList.remove('swiped');
        }
        item.style.transform = '';
        currentWrap = null;
        swiping = false;
    });

    // Close swipe when tapping elsewhere
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-conv-swipe-wrap')) {
            document.querySelectorAll('.chat-conv-swipe-wrap.swiped').forEach(w => w.classList.remove('swiped'));
        }
    });
})();

// ===== MOBILE KEYBOARD HANDLING (iOS Safari) =====
function setupMobileKeyboard() {
    if (window.innerWidth > 768) return;

    const container = document.querySelector('.chat-container');
    const composer = document.getElementById('chatComposerInput');
    if (!container || !composer) return;

    const vv = window.visualViewport;
    if (!vv) return;

    let keyboardOpen = false;

    function onViewportResize() {
        const keyboardNow = vv.height < window.innerHeight * 0.75;

        if (keyboardNow && !keyboardOpen) {
            keyboardOpen = true;
            container.classList.add('keyboard-open');
            container.style.height = vv.height + 'px';
            scrollMessagesToBottom();
        } else if (keyboardNow && keyboardOpen) {
            container.style.height = vv.height + 'px';
        } else if (!keyboardNow && keyboardOpen) {
            keyboardOpen = false;
            container.classList.remove('keyboard-open');
            container.style.height = '';
        }
    }

    vv.addEventListener('resize', onViewportResize);

    composer.addEventListener('focus', () => {
        setTimeout(() => {
            onViewportResize();
            scrollMessagesToBottom();
        }, 300);
    });

    composer.addEventListener('blur', () => {
        setTimeout(() => {
            keyboardOpen = false;
            container.classList.remove('keyboard-open');
            container.style.height = '';
        }, 100);
    });
}

function scrollMessagesToBottom() {
    const msgs = document.getElementById('chatMessages');
    if (msgs) {
        requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
    }
}
