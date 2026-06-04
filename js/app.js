/* --- NAVIGATION LOGIC --- */
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.getElementById('main-title').innerText = e.currentTarget.getAttribute('data-title');

        const targetId = e.currentTarget.getAttribute('data-target');
        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        
        if(targetId === 'view-transactions') renderAllTransactions();
        if(targetId === 'view-wealth') populateWealthForm();
        if(targetId === 'view-month-insight') renderMonthInsights();
        
        // Trigger chart re-render to ensure they size correctly on tab switch
        if(targetId === 'view-dashboard') updateCharts();
        if(targetId === 'view-month-insight') renderMonthInsights(); 
    });
});

/* --- STATE MANAGEMENT --- */
const defaultData = {
    assets: { cash: 0, bank: 0, savings: 0, investments: 0, other: 0 },
    transactions: [],
    theme: 'light'
};

const categories = {
    income: ['Salary', 'Freelancing', 'Business', 'Side Income', 'Dividends', 'Other'],
    expense: ['Rent', 'Electricity', 'Gas', 'Water', 'Internet', 'Fuel', 'Transport', 'Grocery', 'Restaurant', 'Entertainment', 'Shopping', 'Health', 'Education', 'Loan Payments', 'Bike Maintenance', 'Social', 'Other'],
    withdraw: ['ATM Withdrawal', 'Bank Branch', 'Cheque']
};

let appData = JSON.parse(localStorage.getItem('pkrFinDash')) || defaultData;
let charts = {};

const formatPKR = (amount) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount);

const getTxBadge = (type) => type === 'income' ? 'badge-income' : (type === 'expense' ? 'badge-expense' : 'badge-withdraw');
const getTxSign = (type) => type === 'income' ? '+' : (type === 'expense' ? '-' : '↔');
const getTxColor = (type) => type === 'income' ? 'var(--primary)' : (type === 'expense' ? 'var(--danger)' : 'var(--warning)');

const getSourceIcon = (source) => {
    if(source === 'bank') return '<i class="fa-solid fa-building-columns"></i> Bank';
    if(source === 'cash') return '<i class="fa-solid fa-money-bill-wave"></i> Cash';
    if(source === 'savings') return '<i class="fa-solid fa-piggy-bank"></i> Savings';
    return '<i class="fa-solid fa-vault"></i> Asset';
};

const saveData = () => {
    localStorage.setItem('pkrFinDash', JSON.stringify(appData));
    updateDashboard();
    renderAllTransactions();
};

/* --- 1. LIFETIME DASHBOARD UPDATES --- */
const updateDashboard = () => {
    const totalWealth = Object.values(appData.assets).reduce((a, b) => a + b, 0);
    let lifetimeIncome = 0; let lifetimeExpense = 0;

    appData.transactions.forEach(t => {
        if (t.type === 'income') lifetimeIncome += t.amount;
        if (t.type === 'expense') lifetimeExpense += t.amount;
    });

    document.getElementById('val-wealth').innerText = formatPKR(totalWealth);
    
    // Replaced the duplicated savings logic with live synced asset metrics
    document.getElementById('val-bank').innerText = formatPKR(appData.assets.bank || 0);
    document.getElementById('val-cash').innerText = formatPKR(appData.assets.cash || 0);
    document.getElementById('val-savings').innerText = formatPKR(appData.assets.savings || 0);
    
    document.getElementById('val-income').innerText = formatPKR(lifetimeIncome);
    document.getElementById('val-expense').innerText = formatPKR(lifetimeExpense);

    renderRecentTransactions();
    updateCharts();
};

const renderRecentTransactions = () => {
    const tbody = document.getElementById('recent-transactions');
    tbody.innerHTML = '';
    const sorted = [...appData.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    sorted.forEach(t => {
        const sourceBadgeHTML = t.source ? `<br><span class="badge-source">${getSourceIcon(t.source)}</span>` : '';
        tbody.innerHTML += `
            <tr>
                <td>${t.date}</td>
                <td>${t.description}</td>
                <td><span class="badge ${getTxBadge(t.type)}">${t.category}</span> ${sourceBadgeHTML}</td>
                <td style="color: ${getTxColor(t.type)}; font-weight: 600;">${getTxSign(t.type)} ${formatPKR(t.amount)}</td>
            </tr>`;
    });
};

/* --- 2. SPECIFIC MONTH DASHBOARD UPDATES --- */
const renderMonthInsights = () => {
    const picker = document.getElementById('insight-month-picker');
    if (!picker.value) {
        const now = new Date();
        picker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const [year, month] = picker.value.split('-').map(Number);
    const targetMonth = month - 1; 

    let currentIncome = 0, currentExpense = 0;
    const expensesByCategory = {};
    
    const daysInMonth = new Date(year, targetMonth + 1, 0).getDate();
    const dailyInc = new Array(daysInMonth).fill(0);
    const dailyExp = new Array(daysInMonth).fill(0);

    appData.transactions.forEach(t => {
        const d = new Date(t.date);
        if (d.getMonth() === targetMonth && d.getFullYear() === year) {
            const dayIndex = d.getDate() - 1;
            if (t.type === 'income') {
                currentIncome += t.amount;
                dailyInc[dayIndex] += t.amount;
            }
            if (t.type === 'expense') {
                currentExpense += t.amount;
                dailyExp[dayIndex] += t.amount;
                expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
            }
        }
    });

    const currentSavings = currentIncome - currentExpense;

    document.getElementById('month-summary-cards').innerHTML = `
        <div class="card glass">
            <div class="card-header"><span>Income (${picker.value})</span> <div class="card-icon icon-income"><i class="fa-solid fa-arrow-down"></i></div></div>
            <div class="card-value">${formatPKR(currentIncome)}</div>
        </div>
        <div class="card glass">
            <div class="card-header"><span>Expenses (${picker.value})</span> <div class="card-icon icon-expense"><i class="fa-solid fa-arrow-up"></i></div></div>
            <div class="card-value">${formatPKR(currentExpense)}</div>
        </div>
        <div class="card glass">
            <div class="card-header"><span>Net Month Savings</span> <div class="card-icon icon-savings"><i class="fa-solid fa-piggy-bank"></i></div></div>
            <div class="card-value">${formatPKR(currentSavings)}</div>
        </div>
    `;

    drawMonthGraphs(expensesByCategory, dailyInc, dailyExp, daysInMonth);

    const categoriesContainer = document.getElementById('month-top-categories');
    categoriesContainer.innerHTML = '';
    const sortedCategories = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);
    
    if (sortedCategories.length > 0) {
        sortedCategories.slice(0, 5).forEach(([cat, amount], index) => {
            const percent = currentExpense > 0 ? ((amount / currentExpense) * 100).toFixed(1) : 0;
            categoriesContainer.innerHTML += `
                <div class="progress-group">
                    <div class="progress-header">
                        <span><strong>#${index + 1} ${cat}</strong></span>
                        <span>${formatPKR(amount)} (${percent}%)</span>
                    </div>
                    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percent}%; background: var(--secondary)"></div></div>
                </div>
            `;
        });
    } else {
        categoriesContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; padding: 1rem 0;">No operational expense metrics captured for this month layout.</p>';
    }
};

const drawMonthGraphs = (expensesByCategory, dailyInc, dailyExp, daysInMonth) => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#6b7280';
    const isMobile = window.innerWidth < 768; 
    
    const labels = Array.from({length: daysInMonth}, (_, i) => i + 1);

    const barCtx = document.getElementById('monthBarChart').getContext('2d');
    if(charts.monthBar) charts.monthBar.destroy();
    
    // Fixed: Daily Cashflow is now a Line Graph
    charts.monthBar = new Chart(barCtx, { 
        type: 'line', 
        data: { 
            labels: labels, 
            datasets: [ 
                { 
                    label: 'Income', 
                    data: dailyInc, 
                    borderColor: '#10b981', 
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }, 
                { 
                    label: 'Expense', 
                    data: dailyExp, 
                    borderColor: '#ef4444', 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                } 
            ] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { 
                y: { 
                    ticks: { color: textColor }, 
                    grid: { color: isDark ? '#334155' : '#e5e7eb' } 
                }, 
                x: { 
                    ticks: { color: textColor }, 
                    grid: { display: false } 
                } 
            }, 
            plugins: { 
                legend: { labels: { color: textColor } } 
            },
            interaction: {
                mode: 'index',
                intersect: false,
            }
        } 
    });

    const pieCtx = document.getElementById('monthPieChart').getContext('2d');
    if(charts.monthPie) charts.monthPie.destroy();
    charts.monthPie = new Chart(pieCtx, { 
        type: 'doughnut', 
        data: { 
            labels: Object.keys(expensesByCategory), 
            datasets: [{ data: Object.values(expensesByCategory), backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'], borderWidth: 0 }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: isMobile ? 'bottom' : 'right', labels: { color: textColor } } }, cutout: '70%' } 
    });
};

/* --- 3. ALL TRANSACTIONS VIEW --- */
const renderAllTransactions = () => {
    const tbody = document.getElementById('all-transactions-body');
    const search = document.getElementById('search-tx').value.toLowerCase();
    tbody.innerHTML = '';
    
    const sorted = [...appData.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(t => {
        if (t.description.toLowerCase().includes(search) || t.category.toLowerCase().includes(search)) {
            const sourceBadgeHTML = t.source ? `<br><span class="badge-source">${getSourceIcon(t.source)}</span>` : '';
            tbody.innerHTML += `
                <tr>
                    <td>${t.date}</td>
                    <td>${t.description}</td>
                    <td><span class="badge ${getTxBadge(t.type)}">${t.category}</span> ${sourceBadgeHTML}</td>
                    <td style="color: ${getTxColor(t.type)}; font-weight: 600;">${getTxSign(t.type)} ${formatPKR(t.amount)}</td>
                    <td><button class="delete-btn" onclick="deleteTx(${t.id})"><i class="fa-solid fa-trash"></i></button></td>
                </tr>
            `;
        }
    });
};

const deleteTx = (id) => {
    if(confirm('Confirm deletion of this transaction log entry? This will perfectly reverse any associated balance changes.')) {
        const txToDelete = appData.transactions.find(t => t.id === id);
        if (txToDelete) {
            const src = txToDelete.source || 'bank'; 
            
            if (txToDelete.type === 'income') {
                appData.assets[src] -= txToDelete.amount;
            } else if (txToDelete.type === 'expense') {
                appData.assets[src] += txToDelete.amount;
            } else if (txToDelete.type === 'withdraw') {
                appData.assets[src] += txToDelete.amount;
                appData.assets.cash -= txToDelete.amount;
            }
        }
        appData.transactions = appData.transactions.filter(t => t.id !== id);
        saveData();
    }
};

/* --- 4. WEALTH PORTFOLIO VIEW --- */
const populateWealthForm = () => {
    document.getElementById('w-cash').value = appData.assets.cash;
    document.getElementById('w-bank').value = appData.assets.bank;
    document.getElementById('w-savings').value = appData.assets.savings;
    document.getElementById('w-investments').value = appData.assets.investments;
    document.getElementById('w-other').value = appData.assets.other;
};

const saveWealth = () => {
    appData.assets.cash = parseFloat(document.getElementById('w-cash').value) || 0;
    appData.assets.bank = parseFloat(document.getElementById('w-bank').value) || 0;
    appData.assets.savings = parseFloat(document.getElementById('w-savings').value) || 0;
    appData.assets.investments = parseFloat(document.getElementById('w-investments').value) || 0;
    appData.assets.other = parseFloat(document.getElementById('w-other').value) || 0;
    saveData();
    alert("Wealth Asset Matrix Adjusted Manually!");
};

/* --- GLOBAL CHARTS ENGINE --- */
const updateCharts = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#6b7280';
    const isMobile = window.innerWidth < 768; 

    const expensesByCategory = {};
    appData.transactions.forEach(t => { if(t.type === 'expense') expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount; });

    const pieCtx = document.getElementById('pieChart').getContext('2d');
    if(charts.pie) charts.pie.destroy();
    charts.pie = new Chart(pieCtx, { 
        type: 'doughnut', 
        data: { 
            labels: Object.keys(expensesByCategory), 
            datasets: [{ data: Object.values(expensesByCategory), backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'], borderWidth: 0 }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: isMobile ? 'bottom' : 'right', labels: { color: textColor } } }, cutout: '70%' } 
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const labels = []; const incData = []; const expData = [];

    for(let i=5; i>=0; i--) {
        let m = currentMonth - i; let y = new Date().getFullYear();
        if(m < 0) { m += 12; y -= 1; }
        labels.push(months[m]);
        let inc = 0, exp = 0;
        appData.transactions.forEach(t => {
            const d = new Date(t.date);
            if(d.getMonth() === m && d.getFullYear() === y) { 
                // FIXED LOGIC HERE: Only track actual income and actual expenses
                if(t.type === 'income') inc += t.amount; 
                else if(t.type === 'expense') exp += t.amount; 
            }
        });
        incData.push(inc); expData.push(exp);
    }

    const barCtx = document.getElementById('mainChart').getContext('2d');
    if(charts.bar) charts.bar.destroy();
    charts.bar = new Chart(barCtx, { 
        type: 'bar', 
        data: { 
            labels: labels, 
            datasets: [ { label: 'Revenue Intake', data: incData, backgroundColor: '#10b981', borderRadius: 6 }, { label: 'Expense Loss Out', data: expData, backgroundColor: '#ef4444', borderRadius: 6 } ] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: textColor }, grid: { color: isDark ? '#334155' : '#e5e7eb' } }, x: { ticks: { color: textColor }, grid: { display: false } } }, plugins: { legend: { labels: { color: textColor } } } } 
    });
};

/* --- MODAL CONTROL --- */
const openModal = (id) => {
    document.getElementById(id).classList.add('active');
    if(id === 'transactionModal') { 
        document.getElementById('trans-date').value = new Date().toISOString().split('T')[0]; 
        updateCategories(); 
    }
};
const closeModal = (id) => document.getElementById(id).classList.remove('active');

const updateCategories = () => {
    const type = document.getElementById('trans-type').value;
    document.getElementById('trans-category').innerHTML = categories[type].map(c => `<option value="${c}">${c}</option>`).join('');
    
    const sourceContainer = document.getElementById('asset-source-container');
    const sourceLabel = document.getElementById('source-label');
    const sourceSelect = document.getElementById('trans-source');
    
    sourceContainer.classList.add('active');
    
    if (type === 'withdraw') {
        sourceLabel.innerText = 'Withdraw From:';
        sourceSelect.innerHTML = `
            <option value="bank">Bank Account</option>
            <option value="savings">Savings Account</option>
        `;
    } else {
        sourceLabel.innerText = type === 'income' ? 'Deposit Into:' : 'Pay From:';
        sourceSelect.innerHTML = `
            <option value="bank">Bank Account</option>
            <option value="cash">Cash in Hand</option>
            <option value="savings">Savings Account</option>
        `;
    }
};

/* --- TRANSACTION SUBMISSION --- */
document.getElementById('form-transaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('trans-type').value;
    const source = document.getElementById('trans-source').value;
    const amount = Number(document.getElementById('trans-amount').value) || 0;

    if (type === 'income') {
        appData.assets[source] = (Number(appData.assets[source]) || 0) + amount;
    } else if (type === 'expense') {
        appData.assets[source] = (Number(appData.assets[source]) || 0) - amount;
    } else if (type === 'withdraw') {
        appData.assets[source] = (Number(appData.assets[source]) || 0) - amount;
        appData.assets.cash = (Number(appData.assets.cash) || 0) + amount;
    }

    appData.transactions.push({ 
        id: Date.now(), 
        type: type, 
        source: source, 
        date: document.getElementById('trans-date').value, 
        category: document.getElementById('trans-category').value, 
        description: document.getElementById('trans-desc').value, 
        amount: amount 
    });

    saveData();
    closeModal('transactionModal');
    e.target.reset();
});

const exportData = () => {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `souravs-wallet-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported.assets || !imported.transactions) {
                alert("Invalid backup file. Please use a file exported from this app.");
                return;
            }
            if (confirm(`Import ${imported.transactions.length} transactions and asset balances? This will replace your current data.`)) {
                appData = imported;
                saveData();
                alert("Data imported successfully!");
            }
        } catch (err) {
            alert("Failed to read file. Make sure it is a valid JSON backup.");
        }
    };
    reader.readAsText(file);
    event.target.value = "";
};

const toggleTheme = () => {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    appData.theme = newTheme;
    localStorage.setItem('pkrFinDash', JSON.stringify(appData));
    updateCharts();
};

// Event listener to fix chart resizing on window resize
window.addEventListener('resize', () => {
    if(document.getElementById('view-dashboard').classList.contains('active')) updateCharts();
    if(document.getElementById('view-month-insight').classList.contains('active')) renderMonthInsights();
});

document.documentElement.setAttribute('data-theme', appData.theme || 'light');
updateCategories(); 
updateDashboard();
