const express = require('express');
const STS = require('@alicloud/sts-sdk');
// const OSS = require('ali-oss');
// const config = require('../config/config');
// const { authMiddleware } = require('../middleware/auth');
// const User = require('../models/User');

// const router = express.Router();

const OSS = require('ali-oss');
const config = require('../config/config');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// 初始化 STS 客户端
// ! It is incorrect to initialize STS like this with ali-oss package
// const sts = new STS({
//     accessKeyId: config.aliyun.accessKeyId,
//     accessKeySecret: config.aliyun.accessKeySecret
// });

// 生成用户特定的上传路径
function getUserUploadPath(userId, filename) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `users/${userId}/${year}/${month}/${day}/${Date.now()}_${filename}`;
}

// 获取 STS 临时凭证
router.get('/sts-token', authMiddleware, async (req, res) => {
    try {
        const user = req.user;

        // 检查用户存储空间
        if (user.usedStorage >= user.storageQuota) {
            return res.status(403).json({
                error: '存储空间不足，请清理文件或联系管理员'
            });
        }

        // 使用 ali-oss 包内置的 STS 功能
        const stsClient = new OSS({
            region: config.aliyun.region,
            accessKeyId: config.aliyun.accessKeyId,
            accessKeySecret: config.aliyun.accessKeySecret,
            bucket: config.aliyun.bucket
        });

        // 定义上传策略
        const policy = {
            "Version": "1",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "oss:PutObject",
                        "oss:GetObject",
                        "oss:DeleteObject",
                        "oss:ListObjects"
                    ],
                    "Resource": [
                        `acs:oss:*:*:${config.aliyun.bucket}/users/${user._id}/*`,
                        `acs:oss:*:*:${config.aliyun.bucket}/users/${user._id}`
                    ]
                }
            ]
        };

        // 获取临时凭证
        const credentials = await stsClient.assumeRole(
            config.aliyun.roleArn,
            policy,
            3600, // 1小时有效期
            `user-${user._id}-${Date.now()}`
        );

        res.json({
            accessKeyId: credentials.credentials.AccessKeyId,
            accessKeySecret: credentials.credentials.AccessKeySecret,
            stsToken: credentials.credentials.SecurityToken,
            expiration: credentials.credentials.Expiration,
            bucket: config.aliyun.bucket,
            region: config.aliyun.region,
            endpoint: config.aliyun.endpoint,
            userPath: `users/${user._id}/`
        });

    } catch (error) {
        console.error('获取STS Token失败:', error);
        res.status(500).json({
            error: '获取上传凭证失败',
            details: error.message
        });
    }
});

// 获取 STS 临时凭证
// router.get('/sts-token', authMiddleware, async (req, res) => {
//     try {
//         const user = req.user;

//         // 检查用户存储空间
//         if (user.usedStorage >= user.storageQuota) {
//             return res.status(403).json({
//                 error: '存储空间不足，请清理文件或联系管理员'
//             });
//         }

//         // 生成上传策略
//         const policy = {
//             "Version": "1",
//             "Statement": [
//                 {
//                     "Effect": "Allow",
//                     "Action": [
//                         "oss:PutObject",
//                         "oss:GetObject",
//                         "oss:ListObjects"
//                     ],
//                     "Resource": [
//                         `acs:oss:*:*:${config.aliyun.bucket}/users/${user._id}/*`,
//                         `acs:oss:*:*:${config.aliyun.bucket}/users/${user._id}`
//                     ],
//                     "Condition": {
//                         "NumericLessThanEquals": {
//                             "oss:ContentLength": config.upload.maxFileSize
//                         }
//                     }
//                 }
//             ]
//         };

//         // 获取 STS Token
//         const result = await sts.assumeRole(
//             config.aliyun.roleArn,
//             policy,
//             3600, // 1小时有效期
//             `user-${user._id}`
//         );

//         const credentials = result.Credentials;

//         res.json({
//             accessKeyId: credentials.AccessKeyId,
//             accessKeySecret: credentials.AccessKeySecret,
//             stsToken: credentials.SecurityToken,
//             expiration: credentials.Expiration,
//             bucket: config.aliyun.bucket,
//             region: config.aliyun.region,
//             endpoint: config.aliyun.endpoint,
//             userPath: `users/${user._id}/`
//         });
//     } catch (error) {
//         console.error('获取STS Token失败:', error);
//         res.status(500).json({ error: '获取上传凭证失败' });
//     }
// });

// 获取上传列表
router.get('/files', authMiddleware, async (req, res) => {
    try {
        const { prefix = '', marker = '' } = req.query;
        const user = req.user;

        const ossClient = new OSS({
            region: config.aliyun.region,
            accessKeyId: config.aliyun.accessKeyId,
            accessKeySecret: config.aliyun.accessKeySecret,
            bucket: config.aliyun.bucket
        });

        const result = await ossClient.list({
            prefix: `users/${user._id}/${prefix}`,
            marker,
            'max-keys': 100
        });

        // 计算用户已使用空间
        const objects = result.objects || [];
        const totalSize = objects.reduce((sum, obj) => sum + (obj.size || 0), 0);

        // 更新用户使用空间（可以定期批量更新）
        user.usedStorage = totalSize;
        await user.save();

        res.json({
            files: objects.map(obj => ({
                name: obj.name,
                url: `https://${config.aliyun.bucket}.${config.aliyun.endpoint}/${obj.name}`,
                size: obj.size,
                lastModified: obj.lastModified
            })),
            nextMarker: result.nextMarker,
            isTruncated: result.isTruncated
        });
    } catch (error) {
        console.error('获取文件列表失败:', error);
        res.status(500).json({ error: '获取文件列表失败' });
    }
});

// 生成预签名URL（用于分享）
router.post('/presigned-url', authMiddleware, async (req, res) => {
    try {
        const { objectKey, expires = 3600 } = req.body;
        const user = req.user;

        // 验证文件权限
        if (!objectKey.startsWith(`users/${user._id}/`)) {
            return res.status(403).json({ error: '无权访问此文件' });
        }

        const ossClient = new OSS({
            region: config.aliyun.region,
            accessKeyId: config.aliyun.accessKeyId,
            accessKeySecret: config.aliyun.accessKeySecret,
            bucket: config.aliyun.bucket
        });

        const url = ossClient.signatureUrl(objectKey, {
            expires,
            method: 'GET'
        });

        res.json({ url });
    } catch (error) {
        console.error('生成预签名URL失败:', error);
        res.status(500).json({ error: '生成分享链接失败' });
    }
});

// 删除文件
router.delete('/file/:objectKey', authMiddleware, async (req, res) => {
    try {
        const { objectKey } = req.params;
        const user = req.user;

        // URL 解码
        const decodedKey = decodeURIComponent(objectKey);

        // 验证文件权限
        if (!decodedKey.startsWith(`users/${user._id}/`)) {
            return res.status(403).json({ error: '无权删除此文件' });
        }

        const ossClient = new OSS({
            region: config.aliyun.region,
            accessKeyId: config.aliyun.accessKeyId,
            accessKeySecret: config.aliyun.accessKeySecret,
            bucket: config.aliyun.bucket
        });

        await ossClient.delete(decodedKey);

        // 更新用户使用空间（需要重新计算）
        res.json({ message: '文件删除成功' });
    } catch (error) {
        console.error('删除文件失败:', error);
        res.status(500).json({ error: '删除文件失败' });
    }
});

module.exports = router;