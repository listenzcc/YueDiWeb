# 1. 创建 MongoDB 的 repo 文件
cat > /etc/yum.repos.d/mongodb-org-4.4.repo << 'EOF'
[mongodb-org-4.4]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/7/mongodb-org/4.4/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-4.4.asc
EOF

# 2. 安装 MongoDB
yum install -y mongodb-org

# 3. 启动 MongoDB 服务
systemctl start mongod
systemctl enable mongod

# 4. 检查服务状态
systemctl status mongod

# 5. 检查 MongoDB 是否在监听
netstat -tlnp | grep 27017

# 6. 测试连接
mongo --eval "db.version()"