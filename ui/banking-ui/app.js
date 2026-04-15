const AUTH_URL = 'http://localhost:5000';
const BANKING_URL = 'http://localhost:5001/api';
const REDIRECT_URI = 'http://localhost:5002'; // Local server for testing frontend

let accessToken = localStorage.getItem('accessToken');
let userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
    // Exchange code for token
    await exchangeCodeForToken(code);
    window.history.replaceState({}, document.title, "/");
  }

  if (accessToken) {
    showApp();
    setupNavigation();
    loadDashboard();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-container').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
  
  document.getElementById('login-btn').addEventListener('click', () => {
    window.location.href = `${AUTH_URL}/login?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  });
}

function showApp() {
  document.getElementById('login-container').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  document.getElementById('user-role-badge').textContent = userInfo.role || 'USER';

  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userInfo');
    window.location.reload();
  });
}

async function exchangeCodeForToken(code) {
  try {
    const res = await fetch(`${AUTH_URL}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (res.ok) {
      accessToken = data.accessToken;
      localStorage.setItem('accessToken', accessToken);
      
      // Decode JWT to get Role
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      userInfo = { role: payload.role, userId: payload.userId };
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      
      showToast('Logged in successfully!', 'success');
    } else {
      showToast(data.error || 'Failed to authenticate', 'error');
    }
  } catch(e) {
    showToast('Network error during authentication', 'error');
  }
}

// API Calls Wrapper
async function apiCall(endpoint, options = {}) {
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
  
  const res = await fetch(`${BANKING_URL}${endpoint}`, options);
  const data = await res.json();
  
  if (res.status === 401 || res.status === 403) {
    showToast(data.error || 'Unauthorized access', 'error');
    if (res.status === 401) {
       // Typically we would try to refresh here, but for simplicity, we log out
       localStorage.removeItem('accessToken');
       setTimeout(() => window.location.reload(), 2000);
    }
    throw new Error(data.error);
  }
  
  if (!res.ok) {
    showToast(data.error || 'API Error', 'error');
    throw new Error(data.error);
  }
  
  return data;
}

// Navigation
function setupNavigation() {
  const btns = document.querySelectorAll('.nav-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      btns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const view = e.target.dataset.view;
      switchView(view);
    });
  });

  document.getElementById('transfer-form').addEventListener('submit', handleTransfer);
}

function switchView(viewName) {
  document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`view-${viewName}`).classList.remove('hidden');
  
  const titles = {
    'dashboard': 'Dashboard',
    'transactions': 'Transactions',
    'transfer': 'Transfer Money'
  };
  document.getElementById('page-title').textContent = titles[viewName];

  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'transactions') loadTransactions();
}

async function loadDashboard() {
  try {
    const data = await apiCall('/account');
    document.getElementById('dash-balance').textContent = `$${data.account.balance.toFixed(2)}`;
    document.getElementById('dash-account').textContent = data.account.accountNumber;
  } catch(e) {}
}

async function loadTransactions() {
  try {
    const data = await apiCall('/transactions');
    const tbody = document.querySelector('#transactions-table tbody');
    tbody.innerHTML = '';
    
    data.transactions.forEach(tx => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${tx.id}</td>
        <td>${new Date(tx.date).toLocaleString()}</td>
        <td class="type-${tx.type.toLowerCase()}">${tx.type}</td>
        <td class="type-${tx.type.toLowerCase()}">${tx.type === 'DEBIT' || tx.type === 'TRANSFER' ? '-' : '+'}$${tx.amount.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch(e) {}
}

async function handleTransfer(e) {
  e.preventDefault();
  const dest = document.getElementById('transfer-dest').value;
  const amount = parseFloat(document.getElementById('transfer-amount').value);
  
  try {
    const data = await apiCall('/transfer', {
      method: 'POST',
      body: JSON.stringify({ destination: dest, expectedAmount: amount })
    });
    
    showToast(`Successfully transferred $${amount} to ${dest}`, 'success');
    document.getElementById('transfer-form').reset();
    
    // Refresh balance if on dashboard
    loadDashboard();
  } catch(e) {}
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
