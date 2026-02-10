let currentUser = null;
let stsCredentials = null;
let ossClient = null;

// 显示/隐藏区域
function showSection(section) {
    document.querySelectorAll('.card').forEach(el => el.classList.add('hidden'));

    function removeHidden(section) {
        document.getElementById(section + 'Section').classList.remove('hidden');
        if (section === 'upload') { dataTypeSelect.value = 'CT' }
        if (section === 'uploadForm') { dataTypeSelect.value = 'Form' }
    }

    if (typeof (section) === 'string') {
        removeHidden(section)
    } else {
        section.map(section => {
            removeHidden(section)
        })
    }
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

// 登录
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

        // 更新界面
        updateUserInterface();
        showSection(['upload', 'departmentInfo']);

        // 获取存储信息
        updateStorageInfo();
    } catch (error) {
        showMessage('authMessage', error.message, 'error');
    }
}

// 注册
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
    const token = localStorage.getItem('token');

    if (token && currentUser) {
        document.getElementById('currentUser').textContent = currentUser.username;
        document.getElementById('profileUsername').textContent = currentUser.username;
        document.getElementById('profileEmail').textContent = `邮箱：${currentUser.email}`;

        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('uploadBtn').classList.remove('hidden');
        document.getElementById('uploadFormBtn').classList.remove('hidden');
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

// 获取 STS Token
async function getSTSToken() {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/oss/sts-token', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '获取上传凭证失败');
        }

        stsCredentials = data;
        return data;
    } catch (error) {
        showMessage('uploadMessage', error.message, 'error');
        throw error;
    }
}

// 初始化 OSS 客户端
async function initOSSClient() {
    if (!stsCredentials) {
        await getSTSToken();
        console.log('获取到 STS 新凭证');
    }
    console.log('沿用已有 STS 凭证');

    ossClient = new OSS({
        region: 'oss-cn-hangzhou',
        accessKeyId: stsCredentials.credentials.accessKeyId,
        accessKeySecret: stsCredentials.credentials.accessKeySecret,
        stsToken: stsCredentials.credentials.stsToken,
        bucket: 'shen-bucket-20260209',
        secure: true,  // OSS SDK 里开启 HTTPS
        refreshSTSToken: async () => {
            const newToken = await getSTSToken();
            return {
                accessKeyId: newToken.accessKeyId,
                accessKeySecret: newToken.accessKeySecret,
                stsToken: newToken.stsToken
            };
        },
        refreshSTSTokenInterval: 300000 // 5分钟刷新一次
    });
}

// 拖放事件处理
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

// 上传文件
async function uploadFiles(files) {
    if (!files.length) return;

    try {
        await initOSSClient();
        console.log('OSS 客户端初始化完成');

        document.getElementById('progressContainer').style.display = 'block';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = '准备上传...';

        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`开始上传文件：${file.name} (${i + 1}/${files.length})`);
            await uploadSingleFile(file, i + 1, files.length);
            console.log(`文件上传完成：${file.name}`);
        }

        showMessage('uploadMessage', '所有文件上传完成！', 'success');

        // 更新存储信息
        updateStorageInfo();
    } catch (error) {
        showMessage('uploadMessage', error.message, 'error');
    } finally {
        document.getElementById('progressContainer').style.display = 'none';
    }
}

// 上传单个文件
async function uploadSingleFile(file, current, total) {
    return new Promise(async (resolve, reject) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
                    <div class="file-info">
                        <strong>${file.name}</strong>
                        <div style="color: #6c757d; font-size: 14px;">
                            大小：${formatFileSize(file.size)}
                        </div>
                    </div>
                    <div class="file-actions">
                        <button onclick="downloadFile('${file.name}')">下载</button>
                        <button onclick="deleteFile('${file.name}')" style="background: #e53e3e;">删除</button>
                    </div>
                `;

        document.getElementById('fileList').appendChild(fileItem);

        // ! Setup the file path and name
        // const objectKey = `${stsCredentials.userPath}${Date.now()}_${file.name}`;
        function generateObjectKey() {
            const depa = departmentInput.value || departmentInput.placeholder || '单位',
                unit = unitInput.value || unitInput.placeholder || '科室',
                subj = subjectInput.value || subjectInput.placeholder || '患者',
                type = dataTypeSelect.value || '类型',
                date = new Date().toISOString().replaceAll(':', '');

            const middle = [depa, unit, subj, type, date].join('_')
            const objectKey = `${stsCredentials.userPath}${middle}_${file.name}`;
            return objectKey
        }
        const objectKey = generateObjectKey()

        try {
            const result = await ossClient.multipartUpload(objectKey, file, {
                parallel: 4,
                partSize: 5 * 1024 * 1024, // 5MB
                progress: (percentage) => {
                    const progress = (percentage * 100).toFixed(1);
                    document.getElementById('progressText').textContent =
                        `上传中 (${current}/${total}): ${progress}%`;
                    document.getElementById('progressFill').style.width = `${progress}%`;
                },
                checkpoint: true
            });

            resolve(result);
        } catch (error) {
            fileItem.classList.add('error');
            reject(error);
        }
    });
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 获取文件列表
async function getFileList() {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/oss/files', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '获取文件列表失败');
        }

        displayFiles(data.files);
    } catch (error) {
        showMessage('filesMessage', error.message, 'error');
    }
}

// 显示文件列表
function displayFiles(files) {
    const container = document.getElementById('filesContainer');

    if (!files || files.length === 0) {
        container.innerHTML = '<p>暂无文件</p>';
        return;
    }

    let html = '<div class="file-list">';

    files.forEach(file => {
        const fileName = file.name.split('/').pop();
        const fileSize = formatFileSize(file.size);
        const date = new Date(file.lastModified).toLocaleString();

        html += `
                    <div class="file-item">
                        <div class="file-info">
                            <strong>${fileName}</strong>
                            <div style="color: #6c757d; font-size: 14px;">
                                ${fileSize} • ${date}
                            </div>
                        </div>
                        <div class="file-actions">
                            <button onclick="window.open('${file.url}')">下载</button>
                            <button onclick="shareFile('${file.name}')" style="background: #38a169;">分享</button>
                            <button onclick="deleteServerFile('${file.name}')" style="background: #e53e3e;">删除</button>
                        </div>
                    </div>
                `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// 搜索文件
function searchFiles() {
    const keyword = document.getElementById('searchInput').value;
    // 这里可以实现文件搜索功能
    showMessage('filesMessage', '搜索功能开发中...', 'info');
}

// 刷新文件列表
function refreshFiles() {
    getFileList();
}

// 分享文件
async function shareFile(objectKey) {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/oss/presigned-url', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ objectKey })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '生成分享链接失败');
        }

        navigator.clipboard.writeText(data.url);
        alert('分享链接已复制到剪贴板！\n链接24小时内有效。');
    } catch (error) {
        alert('生成分享链接失败：' + error.message);
    }
}

// 删除服务器文件
async function deleteServerFile(objectKey) {
    if (!confirm('确定要删除这个文件吗？')) return;

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/api/oss/file/${encodeURIComponent(objectKey)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '删除失败');
        }

        showMessage('filesMessage', '文件删除成功', 'success');
        refreshFiles();
        updateStorageInfo();
    } catch (error) {
        showMessage('filesMessage', error.message, 'error');
    }
}

// 修改密码
async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        showMessage('profileMessage', '请填写所有字段', 'error');
        return;
    }

    if (newPassword !== confirmNewPassword) {
        showMessage('profileMessage', '两次新密码输入不一致', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showMessage('profileMessage', '新密码至少需要6位', 'error');
        return;
    }

    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '修改密码失败');
        }

        showMessage('profileMessage', '密码修改成功！', 'success');

        // 清空输入框
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
    } catch (error) {
        showMessage('profileMessage', error.message, 'error');
    }
}

// 退出登录
function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    stsCredentials = null;
    ossClient = null;

    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('uploadBtn').classList.add('hidden');
    document.getElementById('uploadFormBtn').classList.add('hidden');
    document.getElementById('filesBtn').classList.add('hidden');
    document.getElementById('profileBtn').classList.add('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');

    showSection(['auth']);
}

// 页面加载时检查登录状态
window.onload = async function () {
    const token = localStorage.getItem('token');

    if (token) {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                updateUserInterface();
                showSection(['upload', 'departmentInfo'])
                updateStorageInfo();
            } else {
                localStorage.removeItem('token');
            }
        } catch (error) {
            localStorage.removeItem('token');
        }
    }
};
