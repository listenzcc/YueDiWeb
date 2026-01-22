const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const config = require('./config/config');

const app = express();

// 安全中间件
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true
}));

// 限流
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100 // 限制每个IP 100次请求
});
app.use('/api/', limiter);

// 解析请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static('public'));

// 数据库连接
mongoose.connect(config.database.mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('MongoDB 连接成功'))
    .catch(err => console.error('MongoDB 连接失败:', err));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/oss', require('./routes/oss'));

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 静态文件路由（放在路由前面）
app.use('/js', express.static(path.join(__dirname, 'public/js'), {
    maxAge: '1y', // 长期缓存
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        }
    }
}));

app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// 默认静态文件路由（放在最后）
app.use(express.static(path.join(__dirname, 'public'), {
    index: false, // 不自动提供 index.html
    extensions: ['html', 'htm']
}));

// 默认路由
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
const PORT = config.server.port;
app.listen(PORT, config.server.host, () => {
    console.log(`服务器运行在 http://${config.server.host}:${PORT}`);
});