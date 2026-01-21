# 1. 登录到 ECS 服务器
ssh root@your-ecs-ip

# 2. 下载项目文件
cd /opt
git clone https://github.com/your-repo/oss-server.git
cd oss-server

# 3. 运行安装脚本
chmod +x setup.sh
./setup.sh

# 4. 配置环境变量
vim .env
# 填入你的阿里云 AccessKey、Bucket 等信息

# 5. 重启服务
systemctl restart oss-server

# 6. 访问服务
curl http://localhost:3000/health