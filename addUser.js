const mongoose = require('mongoose');
const readline = require('readline');
const User = require('./models/User'); // 修改为你的路径

// 连接数据库（修改为你的连接字符串）
mongoose.connect('mongodb://localhost:27017/oss-server', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('数据库已连接');
}).catch(err => {
    console.error('数据库连接失败:', err);
});

// 列出用户
async function addUser(userData) {
    try {
        // Check input
        if (!userData.username || !userData.email || !userData.password) {
            throw new Error('用户名、邮箱和密码都是必填项');
        }

	const {username, email, password} = userData;

	// Check if user is good
	const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return res.status(400).json({
                error: '用户名或邮箱已被使用'
            });
        }

	// Add new user
	const user = new User({username, email, password})
	await user.save()

	console.log('添加新用户成功:', username);
        
        process.exit(0);
    } catch (error) {
        console.error('添加新用户失败:', error);
        process.exit(1);
    }
}


const addUserFromArgs = async () => {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('使用方法:');
        console.log('  node addUser.js <用户名> <邮箱> <密码>');
        console.log('\n示例:');
        console.log('  node addUser.js john john@example.com password123');
        process.exit(1);
    }

    const userData = {
        username: args[0],
        email: args[1],
        password: args[2],
    };
    
    await addUser(userData);

}

const main = async () => {
	await addUserFromArgs();
}

if (require.main === module) {
	main()
}
