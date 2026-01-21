# 更新系统
yum update -y

# 安装基础软件
yum install -y epel-release
yum install -y nodejs npm git nginx python3 python3-pip wget curl vim

# 安装 PM2 进程管理
npm install -g pm2

# 安装 Docker（可选）
curl -fsSL https://get.docker.com | bash
systemctl start docker
systemctl enable docker