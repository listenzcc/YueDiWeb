const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: '未提供认证令牌' });
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        const user = await User.findOne({
            _id: decoded.userId,
            isActive: true
        });

        if (!user) {
            return res.status(401).json({ error: '用户不存在或已被禁用' });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ error: '认证失败' });
    }
};

const adminMiddleware = async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
};

module.exports = { authMiddleware, adminMiddleware };