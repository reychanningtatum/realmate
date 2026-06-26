window.supabaseClient = window.supabase.createClient(
    "https://wmegpgrfrtprhuzmgjma.supabase.co",
    "sb_publishable_Rm_fIBDUfu3DEyLj0_bWZw_qEqo8cd4"
);

window.addEventListener('load', () => {
    if (window.location.hash && window.location.hash.includes("type=recovery")) {
      document.getElementById("updatePasswordModal").style.display = "flex";
    }
});

function togglePassword(id, icon){
  let input = document.getElementById(id)
  if(input.type==="password"){
    input.type="text"
    icon.classList.replace("fa-eye","fa-eye-slash")
  } else {
    input.type="password"
    icon.classList.replace("fa-eye-slash","fa-eye")
  }
}

function openRegister(){ document.getElementById("registerModal").style.display="flex" }
function closeRegister(){ document.getElementById("registerModal").style.display="none" }
function openPurpose() { document.getElementById("purposeModal").style.display = "flex"; }
function closePurpose() { document.getElementById("purposeModal").style.display = "none"; }

// 🔥 UPDATED: OPEN TERMS AND REFRESH IFRAME
function openTerms() { 
    document.getElementById("termsModal").style.display = "flex"; 
    const iframe = document.getElementById("termsFrame");
    if(iframe) iframe.src = iframe.src; // Reloads the frame
}

function closeTerms() { 
    document.getElementById("termsModal").style.display = "none"; 
    const checkbox = document.getElementById("termsCheckbox");
    const checkboxArea = document.getElementById("checkboxArea");
    const checkboxLabel = document.getElementById("checkboxLabel");
    if (checkbox) {
        checkbox.disabled = false;
        checkboxArea.classList.remove("locked");
        checkboxLabel.innerHTML = 'I have read and agree to the <b>Full Legal Terms & Conditions</b> and consent to the professional sharing of listing data within the Realmate AI network.';
    }
}

function toggleRegButton() {
    const checkbox = document.getElementById("termsCheckbox");
    const regBtn = document.getElementById("regBtn");
    regBtn.disabled = !checkbox.checked;
}

function showError(input, show){
  let error=input.nextElementSibling
  if(show){
    input.classList.add("error")
    if(error && error.classList.contains('error-text')) error.style.display="block"
  } else {
    input.classList.remove("error")
    if(error && error.classList.contains('error-text')) error.style.display="none"
  }
}

function validateName(i){ showError(i,i.value.trim().length<2) }
function validatePhone(i){ showError(i,!/^[0-9]{10,13}$/.test(i.value.trim())) }
function validateEmail(i){ showError(i,!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value.trim())) }
function validateAlveo(i){ showError(i,i.value.trim()==="") }
function validatePassword(i){ showError(i,!/^(?=.*[A-Z])(?=.*[0-9]).{8,}$/.test(i.value)) }
function validateBirthday(input){
  if(!input.value) { showError(input, true); return; }
  let year=input.value.split("-")[0];
  let currentYear = new Date().getFullYear();
  showError(input, year.length!==4 || year > currentYear - 18 || year < currentYear - 100);
}

function showLoginError(msg) {
  const el = document.getElementById("loginError");
  if (!el) return;
  el.querySelector("span").textContent = msg;
  el.style.display = "flex";
  // shake the form card
  const container = document.querySelector(".container");
  container.style.animation = "none";
  container.offsetHeight;
  container.style.animation = "loginShake 0.35s ease";
}

function clearLoginError() {
  const el = document.getElementById("loginError");
  if (el) el.style.display = "none";
}

async function login(){
  const loginBtn = document.getElementById("loginBtn");
  const loginBtnText = document.getElementById("loginBtnText");
  const identifier = document.getElementById("loginIdentifier").value.trim();
  const password = document.getElementById("password").value;

  clearLoginError();

  if(!identifier || !password) {
    showLoginError("Please enter your email or username and password.");
    return;
  }

  loginBtn.disabled = true;
  loginBtnText.innerHTML = '<span class="spinner"></span> Signing in…';

  try {
    let emailToLogin = identifier;

    if (!identifier.includes("@")) {
      const { data: legacyUser } = await window.supabaseClient
        .from('Users')
        .select('email')
        .eq('username', identifier)
        .maybeSingle();
      if (!legacyUser) {
        showLoginError("No account found with that username.");
        return;
      }
      emailToLogin = legacyUser.email;
    }

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: emailToLogin,
      password,
    });

    if (error) {
      const msg = error.message.toLowerCase().includes("invalid")
        ? "Incorrect email or password. Please try again."
        : error.message;
      showLoginError(msg);
      return;
    }

    // Store basic info and redirect immediately
    const authUser = data.user;
    const meta = authUser.user_metadata || {};
    const fullName = `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || emailToLogin;
    localStorage.setItem("user", JSON.stringify({
      id: authUser.id,
      email: authUser.email,
      name: fullName,
      image: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0f172a&color=32cd32`,
      job: '', division: 'Alveo Land', group: '', team: '', bio: ''
    }));
    localStorage.setItem("isGuest", "false");

    loginBtn.disabled = true;
    loginBtnText.innerHTML = '<span class="spinner"></span> Redirecting…';
    document.getElementById("loginSuccess").style.display = "flex";
    setTimeout(() => location.href = "livemarket.html", 1400);

  } catch(err) {
    showLoginError("Something went wrong. Please try again.");
  } finally {
    if (document.getElementById("loginBtn").disabled) {
      loginBtn.disabled = false;
      loginBtnText.innerHTML = "Sign In";
    }
  }
}

async function forgotPassword() {
  const identifier = document.getElementById("loginIdentifier").value.trim();
  const forgotLink = document.getElementById("forgotLink");
  if (!identifier) {
    alert("Please enter your email or username to request a reset link.");
    return;
  }
  const originalText = forgotLink.innerText;
  forgotLink.innerText = "Sending link...";
  forgotLink.style.pointerEvents = "none";
  forgotLink.style.opacity = "0.5";

  try {
    let emailToReset = identifier;
    if (!identifier.includes("@")) {
        const { data, error } = await window.supabaseClient
            .from('Users')
            .select('email')
            .eq('username', identifier)
            .single();
        if(data) emailToReset = data.email;
        else {
            alert("Username not found.");
            return;
        }
    }
    const { error } = await window.supabaseClient.auth.resetPasswordForEmail(emailToReset, {
      redirectTo: window.location.origin + window.location.pathname, 
    });
    if (error) alert("Error sending reset link: " + error.message);
    else alert("Password reset link sent to " + emailToReset + " 📧. Please check your inbox.");
  } catch (err) {
    alert("Unexpected error: " + err.message);
  } finally {
    forgotLink.innerText = originalText;
    forgotLink.style.pointerEvents = "auto";
    forgotLink.style.opacity = "1";
  }
}

async function handleUpdatePassword() {
  const newPassword = document.getElementById("newPassword").value;
  const updateBtn = document.getElementById("updateBtn");
  const updateBtnText = document.getElementById("updateBtnText");
  if (!/^(?=.*[A-Z])(?=.*[0-9]).{8,}$/.test(newPassword)) {
    alert("Password must be 8+ chars, with 1 uppercase letter and 1 number.");
    return;
  }
  updateBtn.disabled = true;
  updateBtnText.innerHTML = '<span class="spinner"></span> Saving...';
  try {
    const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });
    if (error) alert("Failed to update password: " + error.message);
    else {
      alert("Password updated successfully!");
      window.location.href = window.location.pathname; 
    }
  } catch (err) {
    alert("Error updating password: " + err.message);
  } finally {
    updateBtn.disabled = false;
    updateBtnText.innerHTML = "Save New Password";
  }
}

function guestLogin(){ 
    localStorage.setItem("isGuest", "true");
    localStorage.removeItem("user"); 
    alert("Proceeding as guest spectator...");
    location.href="livemarket.html"; 
}

// Cache result of username check so submit doesn't need to re-query
let _usernameAvailable = null;
let _lastCheckedUsername = '';

async function checkUsernameAvailability() {
  const input = document.getElementById("regUsername");
  const username = input.value.trim();
  if (!username || username === _lastCheckedUsername) return;
  _lastCheckedUsername = username;
  _usernameAvailable = null; // pending

  const status = document.getElementById("usernameStatus");
  if (status) { status.textContent = "Checking…"; status.style.color = "#94a3b8"; }

  const { data } = await window.supabaseClient
    .from('Users')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  _usernameAvailable = !data;
  if (status) {
    if (_usernameAvailable) {
      status.textContent = "✓ Available";
      status.style.color = "#16a34a";
    } else {
      status.textContent = "✗ Already taken";
      status.style.color = "#ef4444";
    }
  }
}

function showRegToast(message, type = 'success') {
  const existing = document.getElementById('regToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'regToast';
  toast.style.cssText = `
    position:fixed; bottom:30px; left:50%; transform:translateX(-50%) translateY(20px);
    background:${type === 'error' ? '#ef4444' : '#0f172a'}; color:#fff;
    padding:14px 28px; border-radius:14px; font-size:14px; font-weight:700;
    box-shadow:0 20px 40px rgba(0,0,0,0.2); z-index:99999;
    border-left:4px solid ${type === 'error' ? '#fca5a5' : '#32cd32'};
    transition:all 0.3s ease; opacity:0;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function registerUser(){
  const regBtn = document.getElementById("regBtn");
  const btnText = document.getElementById("btnText");
  let username = document.getElementById("regUsername").value.trim();
  let firstName = document.getElementById("firstName").value.trim();
  let lastName = document.getElementById("lastName").value.trim();
  let email = document.getElementById("regEmail").value.trim();
  let password = document.getElementById("regPassword").value;
  let phone = document.getElementById("phone").value.trim();
  let birthday = document.getElementById("birthday").value;
  let gender = document.getElementById("gender").value;
  let alveo = document.getElementById("alveo").value.trim();

  if (!username || !firstName || !email || !password || !birthday || !alveo) {
    showRegToast("Please fill in all required fields.", "error");
    return;
  }

  // Close immediately — no waiting
  closeRegister();
  showRegToast("Creating your account…");

  // Everything runs in background — user is already free
  ;(async () => {
    try {
      if (username !== _lastCheckedUsername || _usernameAvailable === null) {
        await checkUsernameAvailability();
      }
      if (_usernameAvailable === false) {
        showRegToast("Username already taken — choose another.", "error");
        return;
      }
      const { data: alveoCheck } = await window.supabaseClient
        .from('profiles')
        .select('id')
        .eq('alveo_id', alveo)
        .limit(1);
      if (alveoCheck?.length > 0) {
        showRegToast("This Alveo ID is already registered. Please use a different one.", "error");
        return;
      }
      const { error } = await window.supabaseClient.auth.signUp({
        email, password,
        options: { data: { username, first_name: firstName, last_name: lastName, phone_number: phone, birthday, gender, alveo_id: alveo } }
      });
      if (error) showRegToast("Registration failed: " + error.message, "error");
      else showRegToast("Account created! Check your email to confirm. ✉️");
    } catch(err) {
      showRegToast("Unexpected error: " + err.message, "error");
    } finally {
      regBtn.disabled = false;
      btnText.innerHTML = "Create Account";
    }
  })();
}

function checkPassword(){
  let val = document.getElementById("regPassword").value
  let bar = document.getElementById("passwordBar")
  let score = 0
  document.getElementById("rule1").classList.remove("valid")
  document.getElementById("rule2").classList.remove("valid")
  document.getElementById("rule3").classList.remove("valid")
  if(val.length >= 8){ document.getElementById("rule1").classList.add("valid"); score++ }
  if(/[A-Z]/.test(val)){ document.getElementById("rule2").classList.add("valid"); score++ }
  if(/[0-9]/.test(val)){ document.getElementById("rule3").classList.add("valid"); score++ }
  bar.style.width = (score / 3) * 100 + "%"
  if(score == 1) bar.style.background = "#ef4444"
  if(score == 2) bar.style.background = "#f97316"
  if(score == 3) bar.style.background = "#16a34a"
}

window.onclick = function(event) {
    let purposeModal = document.getElementById("purposeModal");
    let termsModal = document.getElementById("termsModal");
    let registerModal = document.getElementById("registerModal");
    if (event.target == purposeModal) purposeModal.style.display = "none";
    if (event.target == termsModal) closeTerms();
    if (event.target == registerModal) registerModal.style.display = "none";
}