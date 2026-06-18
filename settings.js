// 🔥 SUPABASE SETUP
const supabaseUrl = 'https://wmegpgrfrtprhuzmgjma.supabase.co';
const supabaseKey = 'sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// 🔥 GLOBAL DATA
let user = JSON.parse(localStorage.getItem("user")) || {
    name: "Reychan Bernaldez",
    division: "Alveo Land",
    image: "https://via.placeholder.com/150"
};

let userSettings = JSON.parse(localStorage.getItem("userSettings")) || { useAnon: false, anonName: "" };

/**
 * 🚀 DYNAMIC IN-APP NOTIFICATION TOAST WRAPPER ENGINE
 */
function showSettingsNotificationToast(message, type = "success") {
    const container = document.getElementById("settingsToastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `settings-toast ${type === "success" ? "toast-success" : "toast-error"}`;
    
    const icon = type === "success" ? "fa-check-circle" : "fa-exclamation-circle";
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    // Dynamic Entrance Lifecycle Trigger Animation
    setTimeout(() => {
        toast.classList.add("toast-visible");
    }, 10);

    // Exit Lifecycle Drop Delay Removal Routine
    setTimeout(() => {
        toast.classList.remove("toast-visible");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

/**
 * 🚀 ACTIVE FLOW COMPONENT EDITING STATES
 */
function enableAnonymousEditingMode() {
    const field = document.getElementById("globalAnonNickname");
    const tray = document.getElementById("anonActionControlTray");
    const trigger = document.getElementById("anonEditTriggerBtn");

    if (!field || !tray || !trigger) return;

    // Transition elements into uninhibited data capture state
    field.disabled = false;
    field.style.background = "white";
    field.style.borderColor = "var(--primary-soft)";
    field.style.color = "var(--text-main)";
    field.style.cursor = "text";

    tray.style.display = "flex";
    trigger.style.display = "none";
    
    field.focus();
}

function disableAnonymousEditingMode(shouldRestoreData = false) {
    const field = document.getElementById("globalAnonNickname");
    const tray = document.getElementById("anonActionControlTray");
    const trigger = document.getElementById("anonEditTriggerBtn");
    const statusText = document.getElementById("nicknameCheckStatus");

    if (!field || !tray || !trigger) return;

    // Lock elements down inside systemic read-only layout metrics
    field.disabled = true;
    field.style.background = "#edf2f7";
    field.style.borderColor = "transparent";
    field.style.color = "var(--text-sub)";
    field.style.cursor = "not-allowed";

    tray.style.display = "none";
    trigger.style.display = "flex";

    if (shouldRestoreData) {
        field.value = userSettings.anonName || "";
        if (statusText) {
            statusText.innerText = "Max length configuration limit: 25";
            statusText.style.color = "var(--text-sub)";
        }
        updateLiveIdentityCardPreview();
    }
}

/**
 * 🚀 GLOBAL HUB TAB ROUTER ARCHITECTURE
 */
function switchSettingsCategoryTab(targetPaneId, navElement) {
    const panes = document.querySelectorAll('.settings-pane');
    const navItems = document.querySelectorAll('.settings-nav-item');

    panes.forEach(pane => pane.classList.remove('active'));
    navItems.forEach(item => item.classList.remove('active'));

    const targetPane = document.getElementById(targetPaneId);
    if (targetPane) {
        targetPane.classList.add('active');
    }
    if (navElement) {
        navElement.classList.add('active');
    }
}

/**
 * 🚀 LIVE PREVIEW HANDLING
 */
function updateLiveIdentityCardPreview() {
    const nicknameField = document.getElementById("globalAnonNickname");
    const previewName = document.getElementById("anonPreviewName");
    const previewAvatar = document.getElementById("anonPreviewAvatar");
    const charCount = document.getElementById("nicknameCharCount");
    const statusText = document.getElementById("nicknameCheckStatus");

    if (!nicknameField) return;

    let val = nicknameField.value.trim();
    charCount.innerText = `${nicknameField.value.length}/25`;

    if (val.length > 0) {
        previewName.innerText = val;
        previewAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(val)}&background=0f172a&color=fff`;
        statusText.innerText = "Checking availability status...";
        statusText.style.color = "var(--text-sub)";
    } else {
        previewName.innerText = "Not Set";
        previewAvatar.src = "https://ui-avatars.com/api/?name=Anon&background=0f172a&color=fff";
        statusText.innerText = "Registry character limit: 25";
        statusText.style.color = "var(--text-sub)";
    }
}

/**
 * 🚀 MONIKER REGISTRY INTERACTION POLICY ENGINE
 */
async function saveGlobalAnonPreferences() {
    const nicknameField = document.getElementById("globalAnonNickname");
    const statusText = document.getElementById("nicknameCheckStatus");
    const anonNickname = nicknameField.value.trim();

    if (!anonNickname) {
        showSettingsNotificationToast("Please specify an alphanumeric privacy profile nickname.", "error");
        return;
    }

    if (anonNickname.length < 3) {
        showSettingsNotificationToast("Moniker profile identifier must consist of at least 3 characters.", "error");
        return;
    }

    try {
        const { data: identity, error } = await _supabase
            .from('anonymous_identities')
            .select('*')
            .eq('nickname', anonNickname)
            .maybeSingle();

        if (error) throw error;

        if (identity && identity.real_name !== user.name) {
            statusText.innerText = "Nickname completely unavailable.";
            statusText.style.color = "#ef4444";
            showSettingsNotificationToast("This privacy moniker is claimed by another workspace profile.", "error");
            return;
        }

        if (!identity) {
            const { error: insertError } = await _supabase
                .from('anonymous_identities')
                .insert({
                    nickname: anonNickname,
                    real_name: user.name
                });
            if (insertError) throw insertError;
        }

        userSettings.anonName = anonNickname;
        localStorage.setItem("userSettings", JSON.stringify(userSettings));
        
        statusText.innerText = "Identity secured successfully.";
        statusText.style.color = "var(--primary)";
        
        // Push polished visual toast event indicator feedback layers
        showSettingsNotificationToast("Incognito identity secured across the platform infrastructure grid.");
        disableAnonymousEditingMode(false);

    } catch (err) {
        console.error("Management Registry Save Crash: ", err);
        showSettingsNotificationToast("Failed to write proxy configurations: " + err.message, "error");
    }
}

/**
 * 🚀 HARD RESET CORE IDENTITY RESET FACTORY METRICS
 */
function resetAnonymousMonikerIdentity() {
    if (confirm("Are you sure you want to clear your saved anonymous settings configuration? This resets your profile handle values.")) {
        userSettings.anonName = "";
        userSettings.useAnon = false;
        localStorage.setItem("userSettings", JSON.stringify(userSettings));
        
        const nicknameField = document.getElementById("globalAnonNickname");
        if (nicknameField) nicknameField.value = "";
        
        showSettingsNotificationToast("Moniker parameters cleared cleanly.");
        disableAnonymousEditingMode(true);
    }
}

function logout() {
    localStorage.clear();
    location.href = "index.html";
}

/**
 * 🚀 LIFECYCLE ROUTINE HOOKS BOOTSTRAP EXECUTIONS
 */
window.onload = () => {
    if (userSettings.anonName) {
        const nicknameField = document.getElementById("globalAnonNickname");
        if (nicknameField) nicknameField.value = userSettings.anonName;
    }
    updateLiveIdentityCardPreview();
    initMarketPrefToggles();
    initThemeButtons();
};

function initThemeButtons() {
    const current = getTheme();
    highlightThemeBtn(current);
}

function applyTheme(theme) {
    setTheme(theme);
    highlightThemeBtn(theme);
    showSettingsNotificationToast('Theme updated.', 'success');
}

function highlightThemeBtn(theme) {
    const lightBtn = document.getElementById('themeLightBtn');
    const darkBtn  = document.getElementById('themeDarkBtn');
    if (!lightBtn || !darkBtn) return;
    const activeStyle = 'border-color:#32cd32; box-shadow:0 0 0 3px rgba(50,205,50,0.15);';
    const inactiveStyle = '';
    lightBtn.style.cssText = lightBtn.style.cssText.replace(/border-color:[^;]+;|box-shadow:[^;]+;/g, '');
    darkBtn.style.cssText  = darkBtn.style.cssText.replace(/border-color:[^;]+;|box-shadow:[^;]+;/g, '');
    if (theme === 'light') lightBtn.style.borderColor = '#32cd32', lightBtn.style.boxShadow = '0 0 0 3px rgba(50,205,50,0.15)';
    else                   darkBtn.style.borderColor  = '#32cd32', darkBtn.style.boxShadow  = '0 0 0 3px rgba(50,205,50,0.15)';
}

function initMarketPrefToggles() {
    const videoToggle     = document.getElementById('toggleVideoSetting');
    const tickerToggle    = document.getElementById('toggleTickerSetting');
    const autoMuteToggle  = document.getElementById('toggleAutoMuteSetting');
    const showGraphsToggle = document.getElementById('toggleShowGraphsSetting');
    const pdfToggle        = document.getElementById('togglePdfSetting');
    if (videoToggle)      videoToggle.checked      = localStorage.getItem('rm_hide_video')     !== '1';
    if (tickerToggle)     tickerToggle.checked     = localStorage.getItem('rm_hide_ticker')    !== '1';
    if (autoMuteToggle)   autoMuteToggle.checked   = localStorage.getItem('rm_automute_video') === '1';
    if (showGraphsToggle) showGraphsToggle.checked = localStorage.getItem('rm_show_graphs')    !== '0';
    if (pdfToggle)        pdfToggle.checked        = localStorage.getItem('rm_hide_pdf')       !== '1';
}

function saveMarketPref(key, hide) {
    if (hide) {
        localStorage.setItem(key, '1');
    } else {
        localStorage.removeItem(key);
    }
    showSettingsNotificationToast('Preference saved.', 'success');
}