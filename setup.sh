#!/bin/bash

echo "正在设置 OSS 文件上传服务器..."

# 创建项目目录
mkdir -p /opt/oss-server
cd /opt/oss-server

# 安装 MongoDB
# echo "安装 MongoDB..."
# wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
# echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
# apt-get update
# apt-get install -y mongodb-org
# systemctl start mongod
# systemctl enable mongod

# 安装 Node.js
# curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
# apt-get install -y nodejs

# 安装项目依赖
npm install

# 创建必要的目录
mkdir -p logs uploads

# 复制环境配置文件
if [ ! -f .env ]; then
    cp .env.example .env
    echo "请编辑 .env 文件配置阿里云凭证"
fi

# 设置防火墙
ufw allow 3000
ufw allow 22
ufw --force enable

# 创建 systemd 服务
cat > /etc/systemd/system/oss-server.service << EOF
[Unit]
Description=OSS File Upload Server
After=network.target mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/oss-server
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/node /opt/oss-server/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
systemctl daemon-reload
systemctl enable oss-server
systemctl start oss-server

# 设置 Nginx 反向代理（可选）
# apt-get install -y nginx
cat > /etc/nginx/sites-available/oss-server << EOF
server {
    listen 80;
    server_name your-domain.com;
    
    client_max_body_size 10G;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # 上传超时设置
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

ln -s /etc/nginx/sites-available/oss-server /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

echo "安装完成！"
echo "1. 请编辑 /opt/oss-server/.env 配置文件"
echo "2. 重启服务: systemctl restart oss-server"
echo "3. 访问地址: http://你的服务器IP"