const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const config = require('../config/config');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 用户注册
router.post('/register', [
    body('username').isLength({ min: 3, max: 30 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password } = req.body;

        // 检查用户是否已存在
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return res.status(400).json({
                error: '用户名或邮箱已被使用'
            });
        }

        // 创建用户
        const user = new User({
            username,
            email,
            password
        });

        await user.save();

        // 生成 JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.status(201).json({
            message: '注册成功',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ error: '注册失败' });
    }
});

// 用户登录
router.post('/login', [
    body('email').isEmail(),
    body('password').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // 查找用户
        const user = await User.findOne({ email, isActive: true });
        if (!user) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        // 验证密码
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        // 更新最后登录时间
        await user.updateLastLogin();

        // 生成 JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.json({
            message: '登录成功',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                storageQuota: user.storageQuota,
                usedStorage: user.usedStorage
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password');

        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

// 修改密码
router.post('/change-password', authMiddleware, [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;
        const user = req.user;

        // 验证当前密码
        const isValid = await user.comparePassword(currentPassword);
        if (!isValid) {
            return res.status(400).json({ error: '当前密码错误' });
        }

        // 更新密码
        user.password = newPassword;
        await user.save();

        res.json({ message: '密码修改成功' });
    } catch (error) {
        res.status(500).json({ error: '修改密码失败' });
    }
});

module.exports = router;