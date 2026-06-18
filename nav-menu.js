// Shared nav avatar menu
function toggleNavMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('navMenu');
    if (menu) menu.classList.toggle('open');
}

document.addEventListener('click', () => {
    const menu = document.getElementById('navMenu');
    if (menu) menu.classList.remove('open');
});

// Load user avatar into nav button
document.addEventListener('DOMContentLoaded', () => {
    const avatar = document.getElementById('navAvatar');
    if (!avatar) return;
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const wrap = avatar.closest('.mob-nav-avatar-wrap');
    if (wrap) {
        wrap.style.cssText += 'display:flex;flex-direction:column;align-items:center;gap:2px;';
    }

    const imgStyle = user.image
        ? `background:url('${user.image}') center/cover no-repeat;`
        : `background:#32cd32;`;
    const initial = user.image ? '' : (user.name || 'U').charAt(0).toUpperCase();

    // Remove existing <span>Me</span> sibling to avoid duplicate
    const existingSpan = avatar.parentElement?.querySelector('span');
    if (existingSpan) existingSpan.remove();

    avatar.outerHTML = `
        <div id="navAvatarPill" onclick="toggleNavMenu(event)" style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
            <div style="position:relative;display:inline-block;">
                <div style="width:28px;height:28px;border-radius:50%;overflow:hidden;${imgStyle}display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;">
                    ${initial}
                </div>
                <div style="position:absolute;bottom:-2px;right:-4px;width:14px;height:14px;border-radius:50%;background:#64748b;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1.5px;">
                    <div style="width:7px;height:1px;background:#fff;border-radius:1px;"></div>
                    <div style="width:7px;height:1px;background:#fff;border-radius:1px;"></div>
                    <div style="width:7px;height:1px;background:#fff;border-radius:1px;"></div>
                </div>
            </div>
            <span style="font-size:10px;color:#64748b;">Me</span>
        </div>`;
});
