const express = require('express');
const STS = require('@alicloud/sts20150401');
const config = require('../config/config');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// 创建 STS 客户端
const createSTSClient = () => {
    return new STS.default({
        accessKeyId: config.aliyun.accessKeyId,
        accessKeySecret: config.aliyun.accessKeySecret,
        endpoint: 'sts.aliyuncs.com',
        apiVersion: '2015-04-01'
    });
};

// 获取 STS 临时凭证
router.get('/sts-token', authMiddleware, async (req, res) => {
    try {
        const user = req.user;

        console.log(`为用户 ${user._id} (${user.username}) 请求 STS Token`);

        // 检查用户存储空间
        if (user.usedStorage >= user.storageQuota) {
            return res.status(403).json({
                success: false,
                error: '存储空间不足，请清理文件或联系管理员'
            });
        }

        // 检查阿里云配置
        if (!config.aliyun.accessKeyId || config.aliyun.accessKeyId.includes('your-')) {
            console.warn('阿里云配置未设置，返回测试数据');
            return res.json({
                success: true,
                credentials: getTestCredentials(),
                config: {
                    bucket: config.aliyun.bucket || 'test-bucket',
                    region: config.aliyun.region || 'oss-cn-hangzhou',
                    endpoint: config.aliyun.endpoint || 'oss-cn-hangzhou.aliyuncs.com'
                },
                userPath: `users/${user._id}/`,
                isTest: true
            });
        }

        // 检查 RAM 角色配置
        if (!config.aliyun.roleArn || config.aliyun.roleArn.includes('your-account-id')) {
            return res.status(400).json({
                success: false,
                error: '未配置 RAM 角色 (ALIYUN_ROLE_ARN)',
                help: '请在 .env 文件中设置 ALIYUN_ROLE_ARN=acs:ram::你的账号ID:role/你的角色名'
            });
        }

        // 创建 STS 客户端
        const stsClient = createSTSClient();

        // 定义详细的策略
        const policy = {
            "Version": "1",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "oss:PutObject",
                        "oss:GetObject",
                        "oss:DeleteObject",
                        "oss:ListObjects",
                        "oss:ListParts",
                        "oss:AbortMultipartUpload"
                    ],
                    "Resource": [
                        `acs:oss:*:*:${config.aliyun.bucket}/users/${user._id}/*`
                    ],
                    "Condition": {
                        "NumericLessThanEquals": {
                            "oss:ContentLength": config.upload.maxFileSize || 10 * 1024 * 1024 * 1024
                        },
                        "StringLike": {
                            "oss:Prefix": `users/${user._id}/*`
                        }
                    }
                },
                {
                    "Effect": "Allow",
                    "Action": [
                        "oss:GetBucketLocation",
                        "oss:ListObjects"
                    ],
                    "Resource": [
                        `acs:oss:*:*:${config.aliyun.bucket}`
                    ]
                }
            ]
        };

        // STS 请求参数
        const params = {
            roleArn: config.aliyun.roleArn,
            roleSessionName: `oss-user-${user._id}-${Date.now()}`,
            durationSeconds: 3600, // 1小时有效期
            policy: JSON.stringify(policy)
        };
        const request = new STS.AssumeRoleRequest(params);

        console.log('发送 STS 请求，参数:', JSON.stringify(params, null, 2));

        // 调用 STS API
        // const result = await stsClient.assumeRole(params);
        const result = await stsClient.assumeRoleWithOptions(request);

        console.log('STS Token 获取成功');

        // 返回给前端
        res.json({
            success: true,
            credentials: {
                accessKeyId: result.Credentials.AccessKeyId,
                accessKeySecret: result.Credentials.AccessKeySecret,
                stsToken: result.Credentials.SecurityToken,
                expiration: result.Credentials.Expiration
            },
            config: {
                bucket: config.aliyun.bucket,
                region: config.aliyun.region,
                endpoint: config.aliyun.endpoint
            },
            userPath: `users/${user._id}/`,
            policy: policy,
            requestId: result.RequestId
        });

    } catch (error) {
        console.error('获取STS Token失败:', error);

        // 详细的错误处理
        let errorMessage = '获取上传凭证失败';
        let statusCode = 500;
        let details = {};

        if (error.code) {
            details.code = error.code;

            switch (error.code) {
                case 'InvalidAccessKeyId.NotFound':
                    errorMessage = '阿里云 AccessKey ID 不存在或无效';
                    statusCode = 400;
                    break;
                case 'SignatureDoesNotMatch':
                    errorMessage = '阿里云 AccessKey Secret 不匹配';
                    statusCode = 400;
                    break;
                case 'NoSuchRole':
                    errorMessage = 'RAM 角色不存在，请检查 ALIYUN_ROLE_ARN 配置';
                    statusCode = 400;
                    break;
                case 'AccessDenied':
                    errorMessage = 'AccessKey 没有权限调用 STS 服务';
                    statusCode = 403;
                    break;
                case 'InvalidParameter.RoleSessionName':
                    errorMessage = 'RoleSessionName 格式错误，不能包含特殊字符';
                    statusCode = 400;
                    break;
                case 'InvalidParameter.DurationSeconds':
                    errorMessage = '有效期设置错误，应在 900-3600 秒之间';
                    statusCode = 400;
                    break;
                case 'InvalidParameter.Policy':
                    errorMessage = '策略格式错误，必须是有效的 JSON';
                    statusCode = 400;
                    break;
                default:
                    errorMessage = `阿里云 STS 服务错误: ${error.code}`;
            }
        }

        // 返回错误信息
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                code: error.code,
                requestId: error.requestId
            } : undefined,
            // 同时返回测试凭证，让前端可以继续测试
            testCredentials: getTestCredentials(),
            isTest: true
        });
    }
});

// 辅助函数：获取测试凭证（开发环境使用）
function getTestCredentials() {
    const now = new Date();
    const expiration = new Date(now.getTime() + 3600000).toISOString();

    return {
        accessKeyId: 'STS_TEST_ACCESS_KEY_ID',
        accessKeySecret: 'STS_TEST_ACCESS_KEY_SECRET',
        stsToken: 'STS_TEST_SECURITY_TOKEN_1234567890abcdef',
        expiration: expiration
    };
}

// 文件列表（使用主账号 AccessKey 获取）
router.get('/files', authMiddleware, async (req, res) => {
    try {
        const user = req.user;

        // 使用 OSS SDK 获取文件列表
        const OSS = require('ali-oss');
        const ossClient = new OSS({
            region: config.aliyun.region,
            accessKeyId: config.aliyun.accessKeyId,
            accessKeySecret: config.aliyun.accessKeySecret,
            bucket: config.aliyun.bucket
        });

        const result = await ossClient.list({
            prefix: `users/${user._id}/`,
            'max-keys': 100
        });

        // 计算总大小
        const totalSize = result.objects ?
            result.objects.reduce((sum, obj) => sum + (obj.size || 0), 0) : 0;

        // 更新用户存储使用量
        if (totalSize !== user.usedStorage) {
            await User.findByIdAndUpdate(user._id, { usedStorage: totalSize });
        }

        // 格式化文件信息
        const files = (result.objects || []).map(obj => ({
            name: obj.name,
            url: `https://${config.aliyun.bucket}.${config.aliyun.endpoint}/${obj.name}`,
            size: obj.size,
            lastModified: obj.lastModified,
            type: getFileType(obj.name)
        }));

        res.json({
            success: true,
            files: files,
            totalSize: totalSize,
            storageQuota: user.storageQuota,
            isTruncated: result.isTruncated,
            nextMarker: result.nextMarker
        });

    } catch (error) {
        console.error('获取文件列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取文件列表失败',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            files: [] // 返回空数组，不影响前端展示
        });
    }
});

// 获取文件类型
function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
        'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'bmp': 'image', 'webp': 'image',
        'mp4': 'video', 'avi': 'video', 'mov': 'video', 'wmv': 'video', 'flv': 'video',
        'mp3': 'audio', 'wav': 'audio', 'aac': 'audio',
        'pdf': 'document',
        'zip': 'archive', 'rar': 'archive', '7z': 'archive',
        'txt': 'text', 'md': 'text',
        'doc': 'word', 'docx': 'word',
        'xls': 'excel', 'xlsx': 'excel',
        'ppt': 'powerpoint', 'pptx': 'powerpoint'
    };
    return types[ext] || 'other';
}

// 生成预签名URL（用于文件分享）
router.post('/presigned-url', authMiddleware, async (req, res) => {
    try {
        const { objectKey, expires = 3600 } = req.body;
        const user = req.user;

        // 验证文件权限
        if (!objectKey.startsWith(`users/${user._id}/`)) {
            return res.status(403).json({
                success: false,
                error: '无权访问此文件'
            });
        }

        // 使用 OSS SDK 生成预签名 URL
        const OSS = require('ali-oss');
        const ossClient = new OSS({
            region: config.aliyun.region,
            accessKeyId: config.aliyun.accessKeyId,
            accessKeySecret: config.aliyun.accessKeySecret,
            bucket: config.aliyun.bucket
        });

        const url = ossClient.signatureUrl(objectKey, {
            expires: parseInt(expires),
            method: 'GET'
        });

        res.json({
            success: true,
            url: url,
            expiresIn: expires,
            objectKey: objectKey
        });

    } catch (error) {
        console.error('生成预签名URL失败:', error);
        res.status(500).json({
            success: false,
            error: '生成分享链接失败'
        });
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
            return res.status(403).json({
                success: false,
                error: '无权删除此文件'
            });
        }

        // 使用 OSS SDK 删除文件
        const OSS = require('ali-oss');
        const ossClient = new OSS({
            region: config.aliyun.region,
            accessKeyId: config.aliyun.accessKeyId,
            accessKeySecret: config.aliyun.accessKeySecret,
            bucket: config.aliyun.bucket
        });

        await ossClient.delete(decodedKey);

        // 更新用户存储使用量（异步）
        User.findById(user._id).then(async (userDoc) => {
            const ossClient2 = new OSS({
                region: config.aliyun.region,
                accessKeyId: config.aliyun.accessKeyId,
                accessKeySecret: config.aliyun.accessKeySecret,
                bucket: config.aliyun.bucket
            });

            const result = await ossClient2.list({
                prefix: `users/${user._id}/`,
                'max-keys': 1
            });

            const totalSize = result.objects ?
                result.objects.reduce((sum, obj) => sum + (obj.size || 0), 0) : 0;

            userDoc.usedStorage = totalSize;
            await userDoc.save();
        }).catch(err => {
            console.error('更新用户存储失败:', err);
        });

        res.json({
            success: true,
            message: '文件删除成功'
        });

    } catch (error) {
        console.error('删除文件失败:', error);
        res.status(500).json({
            success: false,
            error: '删除文件失败'
        });
    }
});

// 批量删除文件
router.post('/batch-delete', authMiddleware, async (req, res) => {
    try {
        const { objectKeys } = req.body;
        const user = req.user;

        if (!Array.isArray(objectKeys) || objectKeys.length === 0) {
            return res.status(400).json({
                success: false,
                error: '请提供要删除的文件列表'
            });
        }

        // 验证所有文件权限
        const unauthorizedFiles = objectKeys.filter(key =>
            !decodeURIComponent(key).startsWith(`users/${user._id}/`)
        );

        if (unauthorizedFiles.length > 0) {
            return res.status(403).json({
                success: false,
                error: '包含无权删除的文件',
                files: unauthorizedFiles
            });
        }

        // 使用 OSS SDK 批量删除
        const OSS = require('ali-oss');
        const ossClient = new OSS({
            region: config.aliyun.region,
            accessKeyId: config.aliyun.accessKeyId,
            accessKeySecret: config.aliyun.accessKeySecret,
            bucket: config.aliyun.bucket
        });

        const result = await ossClient.deleteMulti(
            objectKeys.map(key => decodeURIComponent(key)),
            { quiet: true }
        );

        res.json({
            success: true,
            message: `成功删除 ${result.deleted ? result.deleted.length : 0} 个文件`,
            result: result
        });

    } catch (error) {
        console.error('批量删除文件失败:', error);
        res.status(500).json({
            success: false,
            error: '批量删除文件失败'
        });
    }
});

module.exports = router;