// public/js/app.js

// 全局变量
let currentUser = null;
let stsCredentials = null;
let ossClient = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    bindEvents();
});

// 初始化应用
function initializeApp() {
    const token = localStorage.getItem('token');

    if (token) {
        // 自动登录检查
        fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                if (response.ok) return response.json();
                throw new Error('登录已过期');
            })
            .then(data => {
                currentUser = data.user;
                updateUserInterface();
                showSection('upload');
                updateStorageInfo();
            })
            .catch(() => {
                localStorage.removeItem('token');
            });
    }
}

// 绑定所有事件
function bindEvents() {
    // 导航按钮
    const authBtn = document.getElementById('authBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const filesBtn = document.getElementById('filesBtn');
    const profileBtn = document.getElementById('profileBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (authBtn) authBtn.addEventListener('click', () => showSection('auth'));
    if (uploadBtn) uploadBtn.addEventListener('click', () => showSection('upload'));
    if (filesBtn) filesBtn.addEventListener('click', () => showSection('files'));
    if (profileBtn) profileBtn.addEventListener('click', () => showSection('profile'));
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // 表单按钮
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');

    if (loginBtn) loginBtn.addEventListener('click', login);
    if (registerBtn) registerBtn.addEventListener('click', register);
    if (showRegisterBtn) showRegisterBtn.addEventListener('click', showRegister);
    if (showLoginBtn) showLoginBtn.addEventListener('click', showLogin);

    // 文件上传
    const fileInput = document.getElementById('fileInput');
    const dropArea = document.getElementById('dropArea');
    const chooseFileBtn = document.getElementById('chooseFileBtn');

    if (fileInput) fileInput.addEventListener('change', handleFileSelect);
    if (dropArea) {
        dropArea.addEventListener('dragover', handleDragOver);
        dropArea.addEventListener('dragleave', handleDragLeave);
        dropArea.addEventListener('drop', handleDrop);
    }
    if (chooseFileBtn && fileInput) {
        chooseFileBtn.addEventListener('click', () => fileInput.click());
    }

    // 文件管理
    const searchBtn = document.getElementById('searchBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    if (searchBtn) searchBtn.addEventListener('click', searchFiles);
    if (refreshBtn) refreshBtn.addEventListener('click', refreshFiles);

    // 个人中心
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', changePassword);
}

// 显示/隐藏区域
function showSection(section) {
    document.querySelectorAll('.card').forEach(el => el.classList.add('hidden'));
    document.getElementById(section + 'Section').classList.remove('hidden');
}

// 显示注册表单
function showRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('authMessage').classList.add('hidden');
}

// 显示登录表单
function showLogin() {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('authMessage').classList.add('hidden');
}

// 显示消息
function showMessage(elementId, message, type = 'success') {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `message ${type}`;
    element.classList.remove('hidden');

    if (type === 'success') {
        setTimeout(() => element.classList.add('hidden'), 3000);
    }
}

// 登录函数
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showMessage('authMessage', '请输入邮箱和密码', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '登录失败');
        }

        currentUser = data.user;
        localStorage.setItem('token', data.token);

        showMessage('authMessage', '登录成功！', 'success');
        updateUserInterface();
        showSection('upload');
        updateStorageInfo();
    } catch (error) {
        showMessage('authMessage', error.message, 'error');
    }
}

// 注册函数
async function register() {
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    if (!username || !email || !password) {
        showMessage('authMessage', '请填写所有字段', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showMessage('authMessage', '两次密码输入不一致', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '注册失败');
        }

        showMessage('authMessage', '注册成功！请登录', 'success');
        showLogin();
    } catch (error) {
        showMessage('authMessage', error.message, 'error');
    }
}

// 更新用户界面
function updateUserInterface() {
    if (currentUser) {
        document.getElementById('currentUser').textContent = currentUser.username;
        document.getElementById('profileUsername').textContent = currentUser.username;
        document.getElementById('profileEmail').textContent = `邮箱：${currentUser.email}`;

        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('uploadBtn').classList.remove('hidden');
        document.getElementById('filesBtn').classList.remove('hidden');
        document.getElementById('profileBtn').classList.remove('hidden');
        document.getElementById('logoutBtn').classList.remove('hidden');
    }
}

// 更新存储信息
async function updateStorageInfo() {
    if (!currentUser) return;

    const usedGB = (currentUser.usedStorage / 1024 / 1024 / 1024).toFixed(2);
    const totalGB = (currentUser.storageQuota / 1024 / 1024 / 1024).toFixed(0);
    const percentage = (currentUser.usedStorage / currentUser.storageQuota * 100).toFixed(1);

    document.getElementById('storageStatus').textContent =
        `存储空间：${usedGB}GB / ${totalGB}GB`;
    document.getElementById('storageBar').style.width = `${percentage}%`;
}

// 登出
function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    stsCredentials = null;
    ossClient = null;

    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('uploadBtn').classList.add('hidden');
    document.getElementById('filesBtn').classList.add('hidden');
    document.getElementById('profileBtn').classList.add('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');

    showSection('auth');
}

// 文件上传相关函数
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    document.getElementById('dropArea').classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('dropArea').classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('dropArea').classList.remove('dragover');

    const files = e.dataTransfer.files;
    uploadFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    uploadFiles(files);
}

// 文件上传相关函数（继续添加...）
async function initOSSClient() {
    // 初始化OSS客户端代码
}

async function uploadFiles(files) {
    // 文件上传代码
}

async function getFileList() {
    // 获取文件列表代码
}

// 添加其他需要的函数...

// 导出全局函数（如果需要）
window.showSection = showSection;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.login = login;
window.register = register;
window.logout = logout;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.handleFileSelect = handleFileSelect;