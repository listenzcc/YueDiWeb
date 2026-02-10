const mongoose = require('mongoose');
const User = require('./models/User'); // 修改为你的路径

// 连接数据库（修改为你的连接字符串）
mongoose.connect('mongodb://localhost:27017/oss-server', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('数据库已连接');
    listUsers();
}).catch(err => {
    console.error('数据库连接失败:', err);
});

// 列出用户
async function listUsers() {
    try {
        // 从 User 模型查询
        const users = await User.find({})
            .sort({ createdAt: -1 })
            .select('-password'); // 不返回密码
        
        console.log('\n===== 用户列表 =====');
        console.log(`总用户数: ${users.length}`);
        console.log('===================\n');
        
        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.username} (${user.email})`);
            console.log(`   角色: ${user.role}`);
            console.log(`   注册: ${user.createdAt.toLocaleString()}`);
            console.log(`   最后登录: ${user.lastLogin ? user.lastLogin.toLocaleString() : '从未登录'}`);
            console.log(`   状态: ${user.isActive ? '活跃' : '禁用'}`);
            console.log(`   存储: ${(user.usedStorage / 1024 / 1024 / 1024).toFixed(2)} GB / ${(user.storageQuota / 1024 / 1024 / 1024).toFixed(0)} GB`);
            console.log('');
        });
        
        process.exit(0);
    } catch (error) {
        console.error('查询失败:', error);
        process.exit(1);
    }
}
