function switchMarketTab(tab) {
    const listings  = document.getElementById('listingsTabPane');
    const analytics = document.getElementById('analyticsTabPane');
    const btnL = document.getElementById('tabListings');
    const btnA = document.getElementById('tabAnalytics');

    if (tab === 'analytics') {
        listings.style.display  = 'none';
        analytics.style.display = 'block';
        btnL.classList.remove('active');
        btnA.classList.add('active');
        // Init chart when tab first opens (canvas must be visible for sizing)
        if (!_capChart) initCapTracker();
        else { _capChart.resize(); }
    } else {
        analytics.style.display = 'none';
        listings.style.display  = 'block';
        btnA.classList.remove('active');
        btnL.classList.add('active');
    }
}

const CAP_PROJECTS = [
    {
        id: 'sequoia',
        name: 'Sequoia',
        sub: 'Alveo Land · Two Serendra, BGC, Taguig',
        currentPrice: '₱295K – ₱315K',
        currentLabel: 'per sqm · 2026 (Current)',
        data: [
            { year: 2012, price: 112000, phase: 'Launch Phase' },
            { year: 2013, price: 125000, phase: 'Preselling' },
            { year: 2014, price: 138000, phase: 'Preselling' },
            { year: 2015, price: 152000, phase: 'Mid-Construction' },
            { year: 2016, price: 168000, phase: 'Structural Completion' },
            { year: 2017, price: 185000, phase: 'Pre-Turnover' },
            { year: 2018, price: 210000, phase: 'Turnover Year' },
            { year: 2019, price: 235000, phase: 'Peak RFO Market' },
            { year: 2020, price: 240000, phase: 'Pandemic Stagnation' },
            { year: 2021, price: 230000, phase: 'Pandemic Adjustment' },
            { year: 2022, price: 245000, phase: 'Recovery Phase' },
            { year: 2023, price: 265000, phase: 'Post-Pandemic Climb' },
            { year: 2024, price: 280000, phase: 'Mature Asset Phase' },
            { year: 2025, price: 290000, phase: 'Established RFO' },
            { year: 2026, price: 305000, phase: 'Stabilized Market', isCurrent: true },
        ],
        annotations: [
            { year: 2018, label: 'Turnover', color: '#f59e0b' },
            { year: 2020, label: 'Pandemic', color: '#ef4444' },
            { year: 2022, label: 'Recovery', color: '#32cd32' },
        ],
        takeaways: [
            { icon: 'fa-arrow-trend-up', title: 'Turnover Bump', body: 'Sharpest value jump between 2017–2019 as the project transitioned from paper to physical inventory.' },
            { icon: 'fa-shield-halved', title: 'Pandemic Resilience', body: 'Held ground during 2020–2021 downturn. Serendra\'s limited green space acted as a natural price floor.' },
            { icon: 'fa-building', title: 'Replacement Cost Edge', body: 'New Alveo BGC launches price significantly higher, making Sequoia competitive for immediate cash flow.' },
        ],
        totalGain: null,
    }
];

// compute total gain
CAP_PROJECTS.forEach(p => {
    const first = p.data[0].price;
    const last  = p.data[p.data.length - 1].price;
    p.totalGain = (((last - first) / first) * 100).toFixed(0);
});

let _capChart = null;
let _activeProject = CAP_PROJECTS[0];

function initCapTracker() {
    renderProjectTabs();
    renderCapProject(_activeProject);
}

function renderProjectTabs() {
    const wrap = document.getElementById('capProjectTabs');
    if (!wrap) return;
    wrap.innerHTML = CAP_PROJECTS.map(p => `
        <button onclick="switchCapProject('${p.id}')" id="capTab-${p.id}"
            style="padding:7px 16px; border-radius:20px; font-size:12px; font-weight:700; cursor:pointer;
                   border:1.5px solid ${p.id === _activeProject.id ? '#32cd32' : '#e2e8f0'};
                   background:${p.id === _activeProject.id ? '#32cd32' : '#fff'};
                   color:${p.id === _activeProject.id ? '#fff' : '#64748b'};
                   transition:all 0.2s;">
            ${p.name}
        </button>
    `).join('');
}

function switchCapProject(id) {
    _activeProject = CAP_PROJECTS.find(p => p.id === id) || CAP_PROJECTS[0];
    renderProjectTabs();
    renderCapProject(_activeProject);
}

function renderCapProject(project) {
    document.getElementById('capProjectName').textContent  = project.name + ' — ' + project.sub.split('·')[1]?.trim();
    document.getElementById('capProjectSub').textContent   = project.sub;
    document.getElementById('capCurrentPrice').textContent = project.currentPrice;
    document.getElementById('capCurrentLabel').textContent = project.currentLabel;

    // Stat pills
    const first = project.data[0];
    const last  = project.data[project.data.length - 1];
    document.getElementById('capStatPills').innerHTML = `
        <div style="background:rgba(255,255,255,0.06);border-radius:10px;padding:8px 14px;">
            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Launch Price</div>
            <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px;">₱${(first.price/1000).toFixed(0)}K<span style="font-size:10px;font-weight:500;color:#64748b;margin-left:3px;">/sqm</span></div>
        </div>
        <div style="background:rgba(255,255,255,0.06);border-radius:10px;padding:8px 14px;">
            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Total Appreciation</div>
            <div style="font-size:15px;font-weight:800;color:#32cd32;margin-top:2px;">+${project.totalGain}%</div>
        </div>
        <div style="background:rgba(255,255,255,0.06);border-radius:10px;padding:8px 14px;">
            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Timeline</div>
            <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px;">${first.year} – ${last.year}</div>
        </div>
        <div style="background:rgba(255,255,255,0.06);border-radius:10px;padding:8px 14px;">
            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Data Points</div>
            <div style="font-size:15px;font-weight:800;color:#fff;margin-top:2px;">${project.data.length} yrs</div>
        </div>
    `;

    // Annotations row
    document.getElementById('capAnnotations').innerHTML = project.annotations.map(a => `
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#94a3b8;font-weight:600;">
            <span style="width:10px;height:10px;border-radius:50%;background:${a.color};flex-shrink:0;display:inline-block;"></span>
            ${a.year} · ${a.label}
        </div>
    `).join('');

    // Takeaways
    document.getElementById('capTakeaways').innerHTML = project.takeaways.map(t => `
        <div style="background:#fff;border-radius:16px;padding:18px 20px;border:1px solid #e2e8f0;display:flex;gap:14px;align-items:flex-start;">
            <div style="width:36px;height:36px;border-radius:10px;background:#f0fdf4;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas ${t.icon}" style="color:#32cd32;font-size:15px;"></i>
            </div>
            <div>
                <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:4px;">${t.title}</div>
                <div style="font-size:12px;color:#64748b;line-height:1.5;">${t.body}</div>
            </div>
        </div>
    `).join('');

    buildChart(project);
}

function buildChart(project) {
    const ctx = document.getElementById('capChartCanvas');
    if (!ctx) return;

    if (_capChart) { _capChart.destroy(); _capChart = null; }

    const labels = project.data.map(d => d.year.toString());
    const prices = project.data.map(d => d.price);
    const isMobile = window.innerWidth < 600;

    // Gradient fill
    const chartCtx = ctx.getContext('2d');
    const gradient = chartCtx.createLinearGradient(0, 0, 0, isMobile ? 180 : 240);
    gradient.addColorStop(0,   'rgba(50,205,50,0.25)');
    gradient.addColorStop(0.6, 'rgba(50,205,50,0.06)');
    gradient.addColorStop(1,   'rgba(50,205,50,0)');

    // Annotation point colors
    const annMap = {};
    project.annotations.forEach(a => { annMap[a.year] = a.color; });
    const pointColors = project.data.map(d => annMap[d.year] || (d.isCurrent ? '#32cd32' : 'rgba(50,205,50,0.7)'));
    const pointRadius = project.data.map(d => annMap[d.year] || d.isCurrent ? 6 : 3);

    _capChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: prices,
                borderColor: '#32cd32',
                borderWidth: 2.5,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: pointColors,
                pointBorderColor: '#0f172a',
                pointBorderWidth: 1.5,
                pointRadius: pointRadius,
                pointHoverRadius: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#94a3b8',
                    bodyColor: '#fff',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        title: items => items[0].label,
                        label: item => {
                            const d = project.data[item.dataIndex];
                            return [
                                ' ₱' + Number(item.raw).toLocaleString() + ' / sqm',
                                ' ' + d.phase
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        color: '#475569',
                        font: { size: isMobile ? 9 : 11, weight: '600' },
                        maxRotation: isMobile ? 45 : 0,
                    }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#475569',
                        font: { size: isMobile ? 9 : 11, weight: '600' },
                        callback: v => '₱' + (v / 1000).toFixed(0) + 'K'
                    }
                }
            }
        }
    });
}

// Chart initializes on first click of Analytics tab, not on page load

/* ── Mini chart in sticky bar ── */
let _miniChart = null;

function initMiniChart() {
    const ctx = document.getElementById('miniChartCanvas');
    if (!ctx || _miniChart) return;

    const project = CAP_PROJECTS[0];
    const prices  = project.data.map(d => d.price);
    const labels  = project.data.map(d => String(d.year));

    const chartCtx = ctx.getContext('2d');
    const gradient = chartCtx.createLinearGradient(0, 0, 0, 126);
    gradient.addColorStop(0, 'rgba(50,205,50,0.35)');
    gradient.addColorStop(1, 'rgba(50,205,50,0)');

    const annMap = {};
    project.annotations.forEach(a => { annMap[a.year] = a.color; });

    const pointRadii  = project.data.map(d => annMap[d.year] ? 4 : (d.isCurrent ? 4 : 0));
    const pointColors = project.data.map(d => annMap[d.year] || (d.isCurrent ? '#32cd32' : 'transparent'));
    const pointBorder = project.data.map(d => annMap[d.year] ? '#0f172a' : (d.isCurrent ? '#0f172a' : 'transparent'));

    _miniChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: prices,
                borderColor: '#32cd32',
                borderWidth: 2,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: pointRadii,
                pointBackgroundColor: pointColors,
                pointBorderColor: pointBorder,
                pointBorderWidth: 1.5,
                pointHoverRadius: pointRadii.map(r => Math.max(r, 5)),
                pointHoverBackgroundColor: pointColors,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 1.5,
            }]
        },
        options: {
            responsive: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: function(context) {
                        const tooltip = document.getElementById('miniChartTooltip');
                        if (!tooltip) return;
                        if (context.tooltip.opacity === 0) {
                            tooltip.style.display = 'none';
                            return;
                        }
                        const idx = context.tooltip.dataPoints?.[0]?.dataIndex;
                        if (idx === undefined) return;
                        const d = project.data[idx];
                        document.getElementById('miniTooltipYear').textContent  = d.year;
                        document.getElementById('miniTooltipPrice').textContent = '₱' + Number(d.price).toLocaleString() + ' /sqm';
                        document.getElementById('miniTooltipPhase').textContent = d.phase;
                        tooltip.style.display = 'block';
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: '#475569',
                        font: { size: 8, weight: '700' },
                        maxRotation: 0,
                        callback: function(val, idx) {
                            const year = parseInt(this.getLabelForValue(val));
                            return [2012, 2018, 2021, 2026].includes(year) ? year : '';
                        }
                    }
                },
                y: { display: false }
            }
        }
    });
}

function toggleVideoRow(btn) {
    const row = document.getElementById('videoRow');
    const chevron = document.getElementById('videoRowChevron');
    const isOpen = row.classList.toggle('open');
    chevron.classList.toggle('open', isOpen);
    btn.classList.toggle('collapsed', !isOpen);
}

function toggleMiniCharts(btn) {
    const row = document.getElementById('miniChartsRow');
    const chevron = document.getElementById('miniChartsChevron');
    const sep = document.getElementById('tickerSeparator');
    const isOpen = row.classList.toggle('open');
    chevron.classList.toggle('open', isOpen);
    btn.classList.toggle('collapsed', !isOpen);
    sep.style.display = isOpen ? 'block' : 'none';
}

function miniChartOpenAnalytics() {
    switchMarketTab('analytics');
    document.getElementById('ledgerView')?.scrollIntoView({ behavior: 'smooth' });
}

function closeMiniChart() {
    document.getElementById('miniChartSection').style.display = 'none';
    document.getElementById('tickerSeparator').style.display = 'none';
    if (_miniChart) { _miniChart.destroy(); _miniChart = null; }
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('rm_show_graphs') === '0') {
        ['miniChartsRow', 'miniChartsToggleBtn', 'tickerSeparator'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        return;
    }
    setTimeout(() => {
        initMiniChart();
        document.getElementById('tickerSeparator').style.display = 'block';
    }, 300);
});
