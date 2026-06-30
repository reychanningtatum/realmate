// 🔔 GLOBAL NOTIFICATION BADGE — loads on every page
(async function () {
    const SUPABASE_URL = 'https://wmegpgrfrtprhuzmgjma.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4';

    const user = JSON.parse(localStorage.getItem("user")) || { name: "" };
    const userSettings = JSON.parse(localStorage.getItem("userSettings")) || { anonName: "" };
    if (!user.name) return;

    async function fetchUnreadCount() {
        try {
            let filter = `recipient_user_name.eq."${user.name}"`;
            if (userSettings.anonName) {
                filter += `,recipient_user_name.eq."${userSettings.anonName}"`;
            }

            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/notifications?select=id&is_read=eq.false&or=(${encodeURIComponent(filter)})`,
                {
                    headers: {
                        apikey: SUPABASE_KEY,
                        Authorization: `Bearer ${SUPABASE_KEY}`
                    }
                }
            );
            const data = await res.json();
            return Array.isArray(data) ? data.length : 0;
        } catch {
            return 0;
        }
    }

    function applyBadge(count) {
        // Remove existing badges first
        document.querySelectorAll('.global-notif-badge').forEach(el => el.remove());

        if (count <= 0) return;

        const label = count > 99 ? '99+' : String(count);

        // Desktop sidebar bell
        const sidebarBell = document.querySelector('.nav-item [class*="fa-bell"]');
        if (sidebarBell) {
            const wrapper = sidebarBell.parentElement;
            wrapper.style.position = 'relative';
            const badge = document.createElement('span');
            badge.className = 'global-notif-badge';
            badge.textContent = label;
            badge.style.cssText = `
                position: absolute;
                top: 6px; right: 10px;
                background: #ef4444;
                color: #fff;
                font-size: 10px;
                font-weight: 800;
                min-width: 18px;
                height: 18px;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
                pointer-events: none;
                line-height: 1;
                box-shadow: 0 2px 6px rgba(239,68,68,0.4);
                z-index: 10;
            `;
            wrapper.appendChild(badge);
        }

        // Mobile bottom nav bell
        const mobileBell = document.querySelector('.mob-nav-item [class*="fa-bell"]');
        if (mobileBell) {
            const wrapper = mobileBell.parentElement;
            wrapper.style.position = 'relative';
            const badge = document.createElement('span');
            badge.className = 'global-notif-badge';
            badge.textContent = label;
            badge.style.cssText = `
                position: absolute;
                top: 2px; right: 50%;
                transform: translateX(calc(50% + 8px));
                background: #ef4444;
                color: #fff;
                font-size: 9px;
                font-weight: 800;
                min-width: 16px;
                height: 16px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 3px;
                pointer-events: none;
                line-height: 1;
                box-shadow: 0 2px 6px rgba(239,68,68,0.4);
                z-index: 10;
            `;
            wrapper.appendChild(badge);
        }
    }

    async function refresh() {
        const count = await fetchUnreadCount();
        applyBadge(count);
    }

    // Run on load then every 60 seconds as fallback
    await refresh();
    setInterval(refresh, 60000);

    // Realtime subscription for instant notifications
    try {
        const _notifSupa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        _notifSupa
            .channel('notif-badge')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => {
                    const row = payload.new;
                    if (row.recipient_user_name === user.name ||
                        (userSettings.anonName && row.recipient_user_name === userSettings.anonName)) {
                        refresh();
                    }
                }
            )
            .subscribe();
    } catch (e) {
        console.warn('Realtime notif subscription failed:', e);
    }
})();
