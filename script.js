/**
 * Expense Tracker Core JavaScript
 * Handles Data, Logic, and UI Updates
 */

// --- Data Layer (LocalStorage Management) ---
const DataManager = {
    STORAGE_KEY: 'expense_tracker_data',
    SETTINGS_KEY: 'expense_tracker_settings',

    saveTransactions(transactions) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(transactions));
    },

    getTransactions() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    addTransaction(transaction) {
        const transactions = this.getTransactions();
        transactions.unshift(transaction); // Newest first
        this.saveTransactions(transactions);
    },

    deleteTransaction(id) {
        const transactions = this.getTransactions().filter(t => t.id !== id);
        this.saveTransactions(transactions);
    },

    saveSettings(settings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    },

    getSettings() {
        const data = localStorage.getItem(this.SETTINGS_KEY);
        return data ? JSON.parse(data) : { budget: 2000, theme: 'light' };
    }
};

// --- Financial Logic ---
const FinancialEngine = {
    calculateTotals(transactions) {
        let income = 0;
        let expense = 0;

        transactions.forEach(t => {
            const amount = parseFloat(t.amount);
            if (t.type === 'income') {
                income += amount;
            } else {
                expense += amount;
            }
        });

        return {
            income,
            expense,
            balance: income - expense
        };
    },

    getCategoryTotals(transactions, type = 'expense') {
        const totals = {};
        transactions.filter(t => t.type === type).forEach(t => {
            totals[t.category] = (totals[t.category] || 0) + parseFloat(t.amount);
        });
        return totals;
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    },

    formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }
};

// --- Dashboard Controller ---
const DashboardController = {
    init() {
        this.updateSummary();
        this.renderRecentTransactions();

        const dateEl = document.getElementById('dashboard-date');
        if (dateEl) {
            const now = new Date();
            dateEl.textContent = `Summary for ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
        }
    },

    updateSummary() {
        const transactions = DataManager.getTransactions();
        const totals = FinancialEngine.calculateTotals(transactions);

        const balanceEl = document.getElementById('total-balance');
        const incomeEl = document.getElementById('total-income');
        const expenseEl = document.getElementById('total-expense');

        if (balanceEl) balanceEl.textContent = FinancialEngine.formatCurrency(totals.balance);
        if (incomeEl) incomeEl.textContent = FinancialEngine.formatCurrency(totals.income);
        if (expenseEl) expenseEl.textContent = FinancialEngine.formatCurrency(totals.expense);

        // Color coding for balance
        if (balanceEl) {
            balanceEl.style.color = totals.balance >= 0 ? 'var(--success)' : 'var(--danger)';
        }
    },

    renderRecentTransactions() {
        const container = document.getElementById('transactions-container');
        if (!container) return;

        const transactions = DataManager.getTransactions().slice(0, 5); // Show last 5

        if (transactions.length === 0) {
            return; // Keep default placeholder
        }

        container.innerHTML = '';
        transactions.forEach(t => {
            const div = document.createElement('div');
            div.className = 'transaction-item fade-in';
            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div class="icon-box ${t.type === 'income' ? 'icon-income' : 'icon-expense'}" style="width: 42px; height: 42px; font-size: 1.1rem;">
                        <i class="${this.getCategoryIcon(t.category)}"></i>
                    </div>
                    <div>
                        <p style="font-weight: 500; margin-bottom: 0.1rem;">${t.note || t.category}</p>
                        <p style="font-size: 0.75rem; color: var(--text-muted);">${FinancialEngine.formatDate(t.date)} • ${t.category}</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <p class="${t.type === 'income' ? 'amount-income' : 'amount-expense'}">
                        ${t.type === 'income' ? '+' : '-'}${FinancialEngine.formatCurrency(t.amount)}
                    </p>
                    <button onclick="DashboardController.deleteItem('${t.id}')" style="font-size: 0.75rem; color: var(--danger); margin-top: 0.2rem; opacity: 0.6; transition: 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    },

    deleteItem(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            DataManager.deleteTransaction(id);
            this.init();
            UIController.showToast('Transaction deleted');
        }
    },

    getCategoryIcon(category) {
        const icons = {
            'Salary': 'fas fa-money-bill-wave',
            'Business': 'fas fa-briefcase',
            'Investment': 'fas fa-chart-line',
            'Food': 'fas fa-utensils',
            'Travel': 'fas fa-plane',
            'Rent': 'fas fa-house',
            'Utilities': 'fas fa-lightbulb',
            'Shopping': 'fas fa-bag-shopping',
            'Health': 'fas fa-heart-pulse',
            'Entertainment': 'fas fa-film',
            'Other': 'fas fa-tags'
        };
        return icons[category] || 'fas fa-circle-question';
    }
};

// --- Reports Controller ---
const ReportsController = {
    init() {
        this.populateCategoryFilter();
        this.applyFilters();

        const applyBtn = document.getElementById('apply-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyFilters());
        }
    },

    populateCategoryFilter() {
        const select = document.getElementById('filter-category');
        if (!select) return;

        const categories = [...AddTransactionController.categories.expense, ...AddTransactionController.categories.income];
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            select.appendChild(opt);
        });
    },

    applyFilters() {
        const period = document.getElementById('filter-period').value;
        const category = document.getElementById('filter-category').value;

        let transactions = DataManager.getTransactions();

        // Time Filtering
        const now = new Date();
        if (period === 'this-month') {
            transactions = transactions.filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
        } else if (period === 'last-month') {
            const last = new Date();
            last.setMonth(now.getMonth() - 1);
            transactions = transactions.filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear();
            });
        } else if (period === 'this-year') {
            transactions = transactions.filter(t => new Date(t.date).getFullYear() === now.getFullYear());
        }

        // Category Filtering
        if (category !== 'all') {
            transactions = transactions.filter(t => t.category === category);
        }

        this.renderCharts(transactions);
        this.updateSummaryText(transactions);
    },

    renderCharts(transactions) {
        const categoryTotals = FinancialEngine.getCategoryTotals(transactions, 'expense');
        const totals = FinancialEngine.calculateTotals(transactions);

        ChartEngine.drawPieChart('pieChart', categoryTotals);
        ChartEngine.drawBarChart('barChart', totals.income, totals.expense);

        this.renderLegend(categoryTotals);
    },

    renderLegend(categoryTotals) {
        const legend = document.getElementById('pie-legend');
        if (!legend) return;

        legend.innerHTML = '';
        const colors = ChartEngine.colors;
        let i = 0;
        for (const cat in categoryTotals) {
            const color = colors[i % colors.length];
            const div = document.createElement('div');
            div.className = 'legend-item';
            div.innerHTML = `<div class="legend-color" style="background-color: ${color}"></div> ${cat}`;
            legend.appendChild(div);
            i++;
        }
    },

    updateSummaryText(transactions) {
        const el = document.getElementById('report-summary-text');
        if (!el) return;

        const totals = FinancialEngine.calculateTotals(transactions);
        const count = transactions.length;

        if (count === 0) {
            el.innerHTML = '<p>No data available for the selected filters.</p>';
            return;
        }

        el.innerHTML = `
            <p>During this period, you had <strong>${count}</strong> transactions.</p>
            <p>Total Income: <span style="color: var(--success);">${FinancialEngine.formatCurrency(totals.income)}</span></p>
            <p>Total Expenses: <span style="color: var(--danger);">${FinancialEngine.formatCurrency(totals.expense)}</span></p>
            <p>Net Savings: <span style="color: ${totals.balance >= 0 ? 'var(--success)' : 'var(--danger)'};">${FinancialEngine.formatCurrency(totals.balance)}</span></p>
        `;
    }
};

// --- Chart Engine (Pure Canvas) ---
const ChartEngine = {
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#4b5563'],

    drawPieChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const total = Object.values(data).reduce((a, b) => a + b, 0);
        if (total === 0) {
            ctx.fillStyle = '#9ca3af';
            ctx.textAlign = 'center';
            ctx.fillText('No expense data', canvas.width / 2, canvas.height / 2);
            return;
        }

        let startAngle = -Math.PI / 2;
        let i = 0;

        for (const category in data) {
            const sliceAngle = (data[category] / total) * 2 * Math.PI;
            ctx.fillStyle = this.colors[i % this.colors.length];

            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, canvas.height / 2);
            ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2.5, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fill();

            startAngle += sliceAngle;
            i++;
        }
    },

    drawBarChart(canvasId, income, expense) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const max = Math.max(income, expense, 100);
        const padding = 50;
        const barWidth = 60;
        const gap = 40;
        const chartHeight = canvas.height - padding * 2;

        // Draw Axes
        ctx.strokeStyle = '#e5e7eb';
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();

        // Income Bar
        const incomeHeight = (income / max) * chartHeight;
        ctx.fillStyle = '#10b981';
        ctx.fillRect(padding + gap, canvas.height - padding - incomeHeight, barWidth, incomeHeight);

        // Expense Bar
        const expenseHeight = (expense / max) * chartHeight;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(padding + gap * 2 + barWidth, canvas.height - padding - expenseHeight, barWidth, expenseHeight);

        // Labels
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Income', padding + gap + barWidth / 2, canvas.height - padding + 15);
        ctx.fillText('Expense', padding + gap * 2 + barWidth + barWidth / 2, canvas.height - padding + 15);
    }
};

// --- Settings Controller ---
const SettingsController = {
    init() {
        this.loadBudget();
        this.updateProgress();

        const saveBudgetBtn = document.getElementById('save-budget');
        if (saveBudgetBtn) {
            saveBudgetBtn.addEventListener('click', () => this.saveBudget());
        }

        const exportBtn = document.getElementById('export-csv');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToCSV());
        }

        const clearBtn = document.getElementById('clear-data');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAllData());
        }
    },

    loadBudget() {
        const settings = DataManager.getSettings();
        const budgetInput = document.getElementById('budget-amount');
        if (budgetInput) {
            budgetInput.value = settings.budget;
        }
    },

    saveBudget() {
        const amount = document.getElementById('budget-amount').value;
        if (!amount || amount < 0) {
            UIController.showToast('Please enter a valid budget', 'error');
            return;
        }

        const settings = DataManager.getSettings();
        settings.budget = parseFloat(amount);
        DataManager.saveSettings(settings);

        this.updateProgress();
        UIController.showToast('Budget saved successfully!');
    },

    updateProgress() {
        const settings = DataManager.getSettings();
        const transactions = DataManager.getTransactions();

        // Only count expenses for this month for budget
        const now = new Date();
        const thisMonthExpenses = transactions
            .filter(t => t.type === 'expense')
            .filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            })
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const percent = (thisMonthExpenses / settings.budget) * 100;
        const boundedPercent = Math.min(percent, 100);

        const progressBar = document.getElementById('budget-progress-bar');
        const percentText = document.getElementById('budget-percent');
        const statusText = document.getElementById('budget-status-text');

        if (progressBar) {
            progressBar.style.width = `${boundedPercent}%`;
            progressBar.className = 'progress-bar';
            if (percent >= 100) progressBar.classList.add('progress-danger');
            else if (percent >= 80) progressBar.classList.add('progress-warning');
        }

        if (percentText) percentText.textContent = `${Math.round(percent)}%`;
        if (statusText) {
            statusText.textContent = `You've spent ${FinancialEngine.formatCurrency(thisMonthExpenses)} of your ${FinancialEngine.formatCurrency(settings.budget)} budget.`;
        }

        // Trigger notifications if needed
        this.checkBudgetAlerts(percent);
    },

    checkBudgetAlerts(percent) {
        // This could be enhanced to show popups if threshold crossed
        if (percent >= 100) {
            UIController.showToast('Budget Exceeded! Please review your spending.', 'error');
        } else if (percent >= 80) {
            UIController.showToast('Budget Warning: You have reached 80% of your limit.', 'error');
        }
    },

    exportToCSV() {
        const transactions = DataManager.getTransactions();
        if (transactions.length === 0) {
            UIController.showToast('No data to export', 'error');
            return;
        }

        let csv = 'Date,Type,Category,Amount,Note\n';
        transactions.forEach(t => {
            csv += `${t.date},${t.type},${t.category},${t.amount},"${t.note || ''}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `almitrack_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        UIController.showToast('Exporting data...');
    },

    clearAllData() {
        if (confirm('CRITICAL: This will permanently delete all your data. Are you sure?')) {
            localStorage.clear();
            UIController.showToast('All data cleared. Refreshing...');
            setTimeout(() => window.location.href = 'index.html', 1500);
        }
    }
};

// --- Add Transaction Controller ---
const AddTransactionController = {
    categories: {
        expense: ['Food', 'Travel', 'Rent', 'Utilities', 'Shopping', 'Health', 'Entertainment', 'Other'],
        income: ['Salary', 'Business', 'Investment', 'Other']
    },

    init() {
        const form = document.getElementById('transaction-form');
        if (!form) return;

        this.setupTypeToggle();
        this.updateCategories('expense');
        this.setDefaultDate();

        form.addEventListener('submit', (e) => this.handleSubmit(e));
    },

    setupTypeToggle() {
        const btns = document.querySelectorAll('.type-btn');
        const typeInput = document.getElementById('transaction-type');

        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const type = btn.dataset.type;
                typeInput.value = type;
                this.updateCategories(type);
            });
        });
    },

    updateCategories(type) {
        const select = document.getElementById('category');
        if (!select) return;

        select.innerHTML = '';
        this.categories[type].forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
    },

    setDefaultDate() {
        const dateInput = document.getElementById('date');
        if (dateInput) {
            dateInput.valueAsDate = new Date();
        }
    },

    handleSubmit(e) {
        e.preventDefault();

        const type = document.getElementById('transaction-type').value;
        const amount = document.getElementById('amount').value;
        const category = document.getElementById('category').value;
        const date = document.getElementById('date').value;
        const note = document.getElementById('note').value;

        if (!amount || amount <= 0) {
            UIController.showToast('Please enter a valid amount', 'error');
            return;
        }

        const transaction = {
            id: Date.now().toString(),
            type,
            amount,
            category,
            date,
            note
        };

        DataManager.addTransaction(transaction);
        UIController.showToast('Transaction added successfully!');

        // Redirect to dashboard after short delay
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    }
};

// --- UI Utilities ---
const UIController = {
    initTheme() {
        const settings = DataManager.getSettings();
        document.documentElement.setAttribute('data-theme', settings.theme);
        this.updateThemeIcon(settings.theme);
    },

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);

        const settings = DataManager.getSettings();
        settings.theme = newTheme;
        DataManager.saveSettings(settings);
        this.updateThemeIcon(newTheme);
    },

    updateThemeIcon(theme) {
        const icon = document.getElementById('theme-toggle-icon');
        if (icon) {
            icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    },

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} fade-in`;
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: ${type === 'success' ? 'var(--success)' : 'var(--danger)'};
            color: white;
            padding: 1rem 2rem;
            border-radius: 0.5rem;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

// --- Global Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    UIController.initTheme();

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => UIController.toggleTheme());
    }

    // Initialize Sidebar active states
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (currentPath.includes(link.getAttribute('href'))) {
            link.classList.add('active');
        }
    });
});
