#!/bin/bash

echo "正在设置 OSS 文件上传服务器..."

# 创建项目目录
mkdir -p /opt/oss-server
cd /opt/oss-server

# 检查并安装 Node.js
if ! command -v node &> /dev/null; then
    echo "安装 Node.js..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    yum install -y nodejs
fi

# 检查是否已安装 pm2
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 检查是否有 package.json，如果没有则创建
if [ ! -f package.json ]; then
    echo "错误：package.json 不存在！"
    echo "请确保在 /opt/oss-server 目录中存在 package.json 文件"
    exit 1
fi

# 安装项目依赖
echo "安装项目依赖..."
npm install --production

# 创建必要的目录
mkdir -p logs uploads

# 检查环境配置文件
if [ ! -f .env ]; then
    echo "警告：.env 文件不存在"
    echo "请创建 .env 文件并配置阿里云凭证"
    echo "可以参考以下配置："
    echo "PORT=3000"
    echo "ALIYUN_ACCESS_KEY_ID=your-access-key-id"
    echo "ALIYUN_ACCESS_KEY_SECRET=your-access-key-secret"
    echo "OSS_BUCKET=your-bucket-name"
    echo "OSS_REGION=oss-cn-hangzhou"
    echo "ALIYUN_ROLE_ARN=acs:ram::your-account-id:role/your-role-name"
    echo "JWT_SECRET=your-jwt-secret"
fi

# 设置防火墙（CentOS 使用 firewalld）
if command -v firewall-cmd &> /dev/null; then
    echo "配置防火墙..."
    firewall-cmd --permanent --add-port=3000/tcp
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --permanent --add-port=22/tcp
    firewall-cmd --reload
else
    echo "警告：firewalld 未安装，跳过防火墙配置"
fi

# 创建 systemd 服务
echo "创建 systemd 服务..."
cat > /etc/systemd/system/oss-server.service << EOF
[Unit]
Description=OSS File Upload Server
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/oss-server
Environment=NODE_ENV=production
ExecStart=$(which node) /opt/oss-server/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=oss-server

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
systemctl daemon-reload
systemctl enable oss-server
systemctl start oss-server

echo "检查服务状态..."
sleep 3
systemctl status oss-server --no-pager -l

# 检查是否安装了 nginx，如果已安装则配置反向代理
if command -v nginx &> /dev/null; then
    echo "检测到已安装 Nginx，配置反向代理..."
    
    # 创建 nginx 配置
    cat > /etc/nginx/conf.d/oss-server.conf << 'NGINXCONF'
server {
    listen 80;
    server_name _;
    
    client_max_body_size 10G;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 上传超时设置
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
NGINXCONF
    
    # 测试并重启 nginx
    if nginx -t; then
        systemctl restart nginx
        echo "Nginx 配置完成并重启成功"
    else
        echo "Nginx 配置测试失败，请检查配置"
    fi
else
    echo "Nginx 未安装，跳过反向代理配置"
    echo "如需安装 Nginx，请运行：yum install -y nginx"
fi

echo "========================================"
echo "安装完成！"
echo ""
echo "下一步操作："
echo "1. 编辑配置文件：vi /opt/oss-server/.env"
echo "   配置阿里云 AccessKey、Bucket 等信息"
echo ""
echo "2. 重启服务：systemctl restart oss-server"
echo ""
echo "3. 查看服务状态：systemctl status oss-server"
echo ""
echo "4. 查看日志：journalctl -u oss-server -f"
echo ""
echo "5. 访问地址："
echo "   http://$(curl -s ifconfig.me):3000"
if command -v nginx &> /dev/null; then
    echo "   或 http://$(curl -s ifconfig.me)"
fi
echo ""
echo "6. 健康检查："
echo "   curl http://localhost:3000/health"
echo "========================================"