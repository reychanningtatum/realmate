// 🔥 SUPABASE AND LOCAL AUTH CONTEXT PARSER
const supabaseUrl = 'https://wmegpgrfrtprhuzmgjma.supabase.co';
const supabaseKey = 'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let user = JSON.parse(localStorage.getItem("user")) || {
    name: "Reychan Bernaldez",
    division: "Alveo Land",
    image: "https://via.placeholder.com/150"
};

let localNotificationsCache = [];

/**
 * 🚀 TIME DISTANCE FORMAT ENGINE (RELATIVE STRINGS)
 */
function formatRelativeTime(dateString) {
    if (!dateString) return "Recent";
    const parsedDate = new Date(dateString);
    if (isNaN(parsedDate.getTime())) return "Recent";

    const now = new Date();
    const diffSeconds = Math.floor((now - parsedDate) / 1000);

    if (diffSeconds < 60) return "Just now";
    
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
}

/**
 * 🚀 DATABASE FETCH ROUTINE: INTEGRATED MULTI-IDENTITY MATCHING WITH QUOTE SANITIZATION
 */
async function fetchNotificationsList() {
    try {
        const userSettings = JSON.parse(localStorage.getItem("userSettings")) || { useAnon: false, anonName: "" };
        
        // CRITICAL FIX: Wrapped name targets in double quotes inside the filter string to prevent spaces from breaking Supabase syntax
        let identityQueryFilter = `recipient_user_name.eq."${user.name}"`;
        if (userSettings.anonName) {
            identityQueryFilter += `,recipient_user_name.eq."${userSettings.anonName}"`;
        }

        const { data, error } = await _supabase
            .from('notifications')
            .select('*')
            .or(identityQueryFilter)
            .order('created_at', { ascending: false });

        if (error) throw error;

        localNotificationsCache = data || [];
        renderNotificationsInterface();
    } catch (err) {
        console.error("Notifications Sync Failure:", err);
        const container = document.getElementById("notificationsContainer");
        if (container) {
            container.innerHTML = `
                <div class="hub-empty-state-card">
                    <i class="fas fa-exclamation-circle" style="color:#ef4444;"></i>
                    <p>Failed to synchronize notifications matrix layer: ${err.message}</p>
                </div>`;
        }
    }
}

/**
 * 🚀 INTERFACE RENDER ENGINE
 */
function renderNotificationsInterface() {
    const container = document.getElementById("notificationsContainer");
    const unreadDisplay = document.getElementById("unreadCountDisplay");
    const sidebarBadge = document.getElementById("navNotifBadge");

    if (!container) return;

    const unreadAlerts = localNotificationsCache.filter(n => !n.is_read);
    const unreadCount = unreadAlerts.length;

    if (unreadDisplay) unreadDisplay.innerText = unreadCount;
    if (sidebarBadge) {
        if (unreadCount > 0) {
            sidebarBadge.innerText = unreadCount;
            sidebarBadge.style.display = "inline-block";
        } else {
            sidebarBadge.style.display = "none";
        }
    }

    if (localNotificationsCache.length === 0) {
        container.innerHTML = `
            <div class="hub-empty-state-card">
                <i class="fas fa-bell-slash"></i>
                <p>Your timeline is clean. No notification payloads logged.</p>
            </div>`;
        return;
    }

    container.innerHTML = "";

    localNotificationsCache.forEach(notif => {
        const row = document.createElement("div");
        row.className = `notification-hub-card ${!notif.is_read ? 'hub-card-unread' : ''}`;
        row.onclick = () => handleNotificationRowClick(notif.id);

        let typeIcon = "fa-bell";
        let contextClass = "badge-reply";

        if (notif.type === 'mate_request') {
            typeIcon = "fa-user-plus";
            contextClass = "badge-mate";
        } else if (notif.type === 'mate_accepted') {
            typeIcon = "fa-handshake";
            contextClass = "badge-mate";
        } else if (notif.type.includes("like")) {
            typeIcon = "fa-heart";
            contextClass = "badge-like";
        } else if (notif.type.includes("mention")) {
            typeIcon = "fa-at";
            contextClass = "badge-mention";
        } else if (notif.type.includes("reply") || notif.type.includes("comment")) {
            typeIcon = "fa-comment-alt";
            contextClass = "badge-reply";
        }

        const alreadyHandled = notif.is_read || (typeof getMateStatus === 'function' && getMateStatus(notif.sender_user_name) === 'accepted');
        const mateActions = (notif.type === 'mate_request' && !alreadyHandled) ? `
            <div class="mate-request-actions">
                <button class="mate-accept-btn" onclick="handleNotifAcceptMate(this, '${notif.sender_user_name.replace(/'/g, "\\'")}', '${notif.id}')">
                    <i class="fas fa-check"></i> Accept
                </button>
                <button class="mate-decline-btn" onclick="handleNotifDeclineMate(this, '${notif.sender_user_name.replace(/'/g, "\\'")}', '${notif.id}')">
                    <i class="fas fa-times"></i> Decline
                </button>
            </div>` : (notif.type === 'mate_request' && alreadyHandled ? `<p class="mate-confirmed-msg"><i class="fas fa-handshake"></i> You are now Realmates!</p>` : '');

        row.innerHTML = `
            <div class="hub-avatar-block">
                <img src="${notif.sender_profile_picture || 'https://via.placeholder.com/150'}" class="hub-avatar-img" alt="Sender Avatar">
                <div class="hub-type-badge-icon ${contextClass}">
                    <i class="fas ${typeIcon}"></i>
                </div>
            </div>
            <div class="hub-message-content-box">
                <p class="hub-message-text">
                    <strong>${notif.sender_user_name}</strong> ${notif.message || 'interacted with your content.'}
                </p>
                <span class="hub-timestamp-label">
                    <i class="far fa-clock"></i> ${formatRelativeTime(notif.created_at || notif.timestamp)}
                </span>
                ${mateActions}
            </div>
            ${!notif.is_read ? '<div class="hub-unread-marker-dot"></div>' : ''}
        `;
        container.appendChild(row);
    });
}

/**
 * 🚀 ACTION TRIPPERS: BULK READ ASSIGNMENT MATRIX
 */
async function markAllNotificationsAsRead() {
    if (localNotificationsCache.length === 0) return;
    
    try {
        const userSettings = JSON.parse(localStorage.getItem("userSettings")) || { useAnon: false, anonName: "" };
        let identityQueryFilter = `recipient_user_name.eq."${user.name}"`;
        if (userSettings.anonName) {
            identityQueryFilter += `,recipient_user_name.eq."${userSettings.anonName}"`;
        }

        // Optimistically clean user layout memory structures 
        localNotificationsCache.forEach(n => n.is_read = true);
        renderNotificationsInterface();

        const { error } = await _supabase
            .from('notifications')
            .update({ is_read: true })
            .or(identityQueryFilter)
            .eq('is_read', false);

        if (error) throw error;
        await fetchNotificationsList();
    } catch (err) {
        console.error("Bulk update operations failure:", err);
    }
}

/**
 * 🚀 ACTION TRIPPERS: SINGLE ELEMENT READ TRACKING
 */
async function markSingleNotificationAsRead(id) {
    const { error } = await _supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

    if (error) {
        console.error("[Notif] Mark-read FAILED (check Supabase RLS UPDATE policy):", error.message, error);
        return false;
    }
    return true;
}

/**
 * 🚀 NAVIGATION DEEP LINK PROCESSING FACTORY
 */
async function handleNotificationRowClick(id) {
    const notif = localNotificationsCache.find(n => n.id === id);
    if (!notif) return;

    if (!notif.is_read) {
        notif.is_read = true;
        await markSingleNotificationAsRead(id);
        renderNotificationsInterface();
    }

    let anchorFragmentTarget = "";
    if (notif.target_reply_id) {
        anchorFragmentTarget = `reply-element-${notif.target_reply_id}`;
    } else if (notif.target_comment_id) {
        anchorFragmentTarget = `comment-element-${notif.target_comment_id}`;
    } else if (notif.target_post_id) {
        anchorFragmentTarget = `post-${notif.target_post_id}`;
    }

    // Store both the anchor element ID and the post ID so forum page can open the comment section
    if (anchorFragmentTarget) {
        localStorage.setItem("route_target_anchor_id", anchorFragmentTarget);
    }
    if (notif.target_post_id) {
        localStorage.setItem("route_target_post_id", String(notif.target_post_id));
    }

    // Mate/follow notifications → go to sender's profile
    if (notif.type === 'mate_request' || notif.type === 'mate_accepted' || notif.type === 'follow') {
        try {
            const { data: profiles } = await _supabase
                .from('profiles')
                .select('id')
                .eq('full_name', notif.sender_user_name)
                .limit(1);
            const senderId = profiles?.[0]?.id;
            if (senderId) {
                location.href = `dashboard.html?user_id=${senderId}`;
            } else {
                // fallback: try listings table
                const { data: listings } = await _supabase
                    .from('listings')
                    .select('user_id')
                    .eq('user_name', notif.sender_user_name)
                    .limit(1);
                const lid = listings?.[0]?.user_id;
                location.href = lid ? `dashboard.html?user_id=${lid}` : `dashboard.html`;
            }
        } catch { location.href = `dashboard.html`; }
        return;
    }

    if (notif.target_post_id) {
        try {
            const { data: postRows } = await _supabase
                .from('forum_posts')
                .select('source')
                .eq('id', notif.target_post_id)
                .limit(1);
            const source = postRows?.[0]?.source;
            if (source === 'home') {
                // Override anchor ID for home page comment format
                if (notif.target_comment_id) {
                    localStorage.setItem("route_target_anchor_id", `hf-comment-${notif.target_comment_id}`);
                }
                location.href = 'home.html';
            } else {
                location.href = 'forum.html';
            }
        } catch {
            location.href = 'forum.html';
        }
    } else {
        location.href = 'forum.html';
    }
}

/**
 * 🚀 LIVE STREAM SUBSCRIPTION ARCHITECTURE LISTENER
 */
function setupRealtimeNotificationListener() {
    const userSettings = JSON.parse(localStorage.getItem("userSettings")) || { useAnon: false, anonName: "" };
    
    _supabase
        .channel('public:notifications')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications'
        }, payload => {
            if (payload.new) {
                const targetMatch = payload.new.recipient_user_name === user.name || 
                                    (userSettings.anonName && payload.new.recipient_user_name === userSettings.anonName);
                
                if (targetMatch) {
                    localNotificationsCache.unshift(payload.new);
                    renderNotificationsInterface();
                }
            }
        })
        .subscribe();
}

async function handleNotifAcceptMate(btn, senderName, notifId) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    await acceptMateRequest(senderName);
    await markSingleNotificationAsRead(notifId);
    // Mark in local cache so re-renders don't show buttons again
    const cached = localNotificationsCache.find(n => n.id === notifId);
    if (cached) cached.is_read = true;
    const actions = btn.closest('.mate-request-actions');
    if (actions) actions.outerHTML = `<p class="mate-confirmed-msg"><i class="fas fa-handshake"></i> You are now Realmates!</p>`;
}

async function handleNotifDeclineMate(btn, senderName, notifId) {
    btn.disabled = true;
    await declineMateRequest(senderName);
    await markSingleNotificationAsRead(notifId);
    const cached = localNotificationsCache.find(n => n.id === notifId);
    if (cached) cached.is_read = true;
    const actions = btn.closest('.mate-request-actions');
    if (actions) actions.outerHTML = `<p class="mate-declined-msg">Request declined.</p>`;
}

/**
 * 🚀 LIFECYCLE INITIALIZER CONSTRUCTOR
 */
window.onload = () => {
    fetchNotificationsList();
    setupRealtimeNotificationListener();
};