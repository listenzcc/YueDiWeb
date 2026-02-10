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
async function setActiveUser() {
    try {
	const args = process.argv.slice(2);
	
	if (args.length === 0) {
		console.log('example: node setActiveUser active john@example.com')
		console.log('example: node setActiveUser inactive john@example.com')
		throw new Error('Not allow empty input')
	}

	const moving = args[0];
	const email = args[1];
	
	const user = await User.findOne({email})
	if (!user) {
		throw new Error(`未找到用户：${email}`);
	}
	if (moving==='active'){user.isActive = true;}
	if (moving==='inactive') {user.isActive = false;}

	await user.save();

	console.log('更新用户状态成功:', email, user.isActive);
        
        process.exit(0);
    } catch (error) {
        console.error('更新用户状态失败:', error);
        process.exit(1);
    }
}


const main = async () => {
	await setActiveUser();
}

if (require.main === module) {
	main()
}
