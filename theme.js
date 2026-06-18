// Applies saved theme immediately — include this as the first script in <head>
(function () {
    const saved = localStorage.getItem('rm_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
})();

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rm_theme', theme);
}

function getTheme() {
    return localStorage.getItem('rm_theme') || 'light';
}
