#!/bin/bash

# 监控服务器状态
echo "=== OSS 服务器监控 ==="
echo "时间: $(date)"
echo

# 检查服务状态
echo "1. 服务状态:"
systemctl status oss-server --no-pager -l | grep -A 5 "Active:"
echo

# 检查 MongoDB
echo "2. MongoDB 状态:"
systemctl status mongod --no-pager -l | grep -A 3 "Active:"
echo

# 检查存储空间
echo "3. 存储空间:"
df -h /opt
echo

# 检查日志
echo "4. 最近错误日志:"
tail -20 /opt/oss-server/logs/error.log 2>/dev/null || echo "无错误日志"
echo

# 检查网络连接
echo "5. 网络连接:"
netstat -tlnp | grep :3000 || echo "服务未在监听"
echo

# 检查进程
echo "6. Node.js 进程:"
ps aux | grep node | grep -v grep