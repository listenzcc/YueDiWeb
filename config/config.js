require('dotenv').config();

module.exports = {
    // 服务器配置
    server: {
        port: process.env.PORT || 3000,
        host: '0.0.0.0',
        sessionSecret: process.env.SESSION_SECRET || 'your-secret-key-change-this'
    },

    // 阿里云配置
    // aliyun: {
    //     accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    //     accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    //     region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    //     bucket: process.env.OSS_BUCKET,
    //     roleArn: process.env.ALIYUN_ROLE_ARN,
    //     endpoint: `oss-${process.env.OSS_REGION || 'cn-hangzhou'}.aliyuncs.com`
    // },
    // 阿里云配置
    aliyun: {
        accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
        region: process.env.OSS_REGION || 'oss-cn-hangzhou',
        bucket: process.env.OSS_BUCKET,
        roleArn: process.env.ALIYUN_ROLE_ARN,
        endpoint: process.env.OSS_ENDPOINT || `oss-${process.env.OSS_REGION || 'cn-hangzhou'}.aliyuncs.com`
    },

    // 数据库配置
    database: {
        mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/oss-server'
    },

    // JWT 配置
    jwt: {
        secret: process.env.JWT_SECRET || 'jwt-secret-key-change-this',
        expiresIn: '24h'
    },

    // 上传限制
    upload: {
        maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
        allowedTypes: [
            'image/*',
            'video/*',
            'application/pdf',
            'application/zip',
            'text/plain'
        ],
        tempDir: '/tmp/uploads'
    }
};