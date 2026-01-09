# 🚀 Next.js 项目生产环境部署完整指南

> **适用场景**：阿里云 ECS 服务器 + Nginx + PM2 + GitHub Actions 自动部署  
> **前置条件**：已购买域名、已购买服务器、域名已备案  
> **预计时间**：首次部署 2-3 小时

---

## 📋 目录

- [第一阶段：服务器环境准备](#第一阶段服务器环境准备)
- [第二阶段：项目代码部署](#第二阶段项目代码部署)
- [第三阶段：Nginx 反向代理配置](#第三阶段nginx-反向代理配置)
- [第四阶段：域名解析和 SSL](#第四阶段域名解析和-ssl)
- [第五阶段：GitHub Actions 自动部署](#第五阶段github-actions-自动部署)
- [常见问题排查](#常见问题排查)

---

## 第一阶段：服务器环境准备

### 1.1 SSH 连接服务器

```bash
# 使用你的服务器 IP 和用户名
ssh root@你的服务器IP
```

**首次连接会提示**：
```
Are you sure you want to continue connecting (yes/no)?
```
输入 `yes` 并回车。

---

### 1.2 安装 Node.js（使用 nvm）

#### 为什么使用 nvm？
- 可以轻松切换 Node.js 版本
- 不需要 sudo 权限安装全局包
- 管理多个项目的不同 Node 版本

#### 步骤：

**如果 git 不存在，先安装：**
```bash
# CentOS/RHEL
yum install -y git

# Ubuntu/Debian
apt-get update && apt-get install -y git
```

**安装 nvm（使用国内镜像）：**
```bash
# 1. 克隆 nvm 仓库
git clone https://gitee.com/mirrors/nvm.git ~/.nvm

# 2. 切换到稳定版本
cd ~/.nvm
git checkout v0.39.7

# 3. 激活 nvm
source ~/.nvm/nvm.sh

# 4. 添加到 bashrc（开机自动加载）
cat >> ~/.bashrc << 'EOF'

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
EOF

# 5. 重新加载配置
source ~/.bashrc

# 6. 验证安装
nvm --version
```

**安装 Node.js 18（使用国内镜像加速）：**
```bash
# 设置 Node.js 下载镜像
export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node

# 安装 Node.js 18
nvm install 18

# 设置为默认版本
nvm alias default 18

# 验证安装
node --version  # 应显示 v18.x.x
npm --version   # 应显示 9.x.x 或 10.x.x
```

**配置 npm 国内镜像（可选但强烈推荐）：**
```bash
npm config set registry https://registry.npmmirror.com
```

---

### 1.3 安装 PM2（进程管理器）

#### 什么是 PM2？
- 保持 Node.js 应用持续运行
- 自动重启崩溃的应用
- 负载均衡
- 日志管理
- 开机自启

#### 步骤：

```bash
# 1. 全局安装 PM2
npm install -g pm2

# 2. 验证安装
pm2 --version

# 3. 配置 PM2 开机自启
pm2 startup

# 会输出一条命令，复制并执行那条命令（类似下面这样）：
# sudo env PATH=$PATH:/root/.nvm/versions/node/v18.20.8/bin ...

# 4. 保存 PM2 进程列表
pm2 save
```

---

### 1.4 确认 Nginx 已安装

```bash
# 检查 Nginx 是否已安装
nginx -v

# 如果未安装，执行：
# CentOS/RHEL
yum install -y nginx

# Ubuntu/Debian
apt-get update && apt-get install -y nginx

# 启动 Nginx
systemctl start nginx
systemctl enable nginx  # 设置开机自启

# 检查状态
systemctl status nginx
```

---

## 第二阶段：项目代码部署

### 2.1 配置 SSH 密钥（用于 Git 和自动部署）

```bash
# 1. 生成 SSH 密钥（一路回车，不设置密码）
ssh-keygen -t ed25519 -C "你的邮箱@example.com"

# 2. 查看公钥
cat ~/.ssh/id_ed25519.pub

# 3. 复制公钥内容，添加到 GitHub
# 访问：https://github.com/settings/keys
# 点击 "New SSH key"
# Title: Aliyun Server
# Key: 粘贴刚才复制的公钥
# 点击 "Add SSH key"

# 4. 测试连接
ssh -T git@github.com
# 第一次会提示，输入 yes
# 看到 "Hi username! You've successfully authenticated" 说明成功
```

⚠️ **重要**：记得同时将公钥添加到服务器的 authorized_keys：

```bash
# 将公钥添加到 authorized_keys（用于 GitHub Actions SSH 连接）
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys

# 设置正确的权限（非常重要！）
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
chmod 600 ~/.ssh/authorized_keys
```

---

### 2.2 克隆项目代码

```bash
# 1. 创建项目目录
mkdir -p /var/www/ai-site
cd /var/www/ai-site

# 2. 克隆代码（使用 SSH 方式）
# 注意：最后的点表示克隆到当前目录
git clone git@github.com:你的用户名/你的仓库名.git .

# 3. 查看文件
ls -la

# 4. 确认分支
git branch
# 应该显示 * main 或 * master
```

---

### 2.3 首次部署

```bash
# 1. 安装依赖
npm install

# 2. 构建生产版本
npm run build

# 如果构建失败，可能是内存不足
# 查看内存：free -h
# 如果内存小于 1GB，可以添加 swap：
# dd if=/dev/zero of=/swapfile bs=1M count=2048
# mkswap /swapfile
# swapon /swapfile

# 3. 使用 PM2 启动应用
pm2 start npm --name "ai-site" -- start

# 4. 查看状态
pm2 status
# 应该显示 status: online

# 5. 查看日志（确认无错误）
pm2 logs ai-site --lines 20

# 6. 保存 PM2 进程列表（开机自启）
pm2 save
```

---

## 第三阶段：Nginx 反向代理配置

### 3.1 为什么需要 Nginx？

1. **反向代理**：将 80/443 端口请求转发到 Node.js 的 3000 端口
2. **HTTPS 支持**：处理 SSL 证书
3. **静态资源缓存**：提升性能
4. **负载均衡**：未来扩展支持

---

### 3.2 配置步骤

#### 情况 A：服务器上已有 Nginx 配置（有域名和 SSL）

**检查现有配置：**
```bash
# 查看已有的配置文件
ls -la /etc/nginx/conf.d/
cat /etc/nginx/conf.d/*.conf
```

**编辑现有配置文件：**
```bash
# 假设你的配置文件是 /etc/nginx/conf.d/default.conf
vim /etc/nginx/conf.d/default.conf

# 或使用 nano
nano /etc/nginx/conf.d/default.conf
```

**修改 HTTPS server 块，添加反向代理：**
```nginx
# HTTP → HTTPS 重定向（保持不变）
server {
    listen       80;
    server_name  yourdomain.com www.yourdomain.com;
    return       301 https://$host$request_uri;
}

# HTTPS 服务器配置
server {
    listen       443 ssl http2;
    server_name  yourdomain.com www.yourdomain.com;

    # SSL 证书路径（根据实际情况修改）
    ssl_certificate     /etc/nginx/ssl/yourdomain.com.pem;
    ssl_certificate_key /etc/nginx/ssl/yourdomain.com.key;

    # SSL 安全配置
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 访问日志
    access_log /var/log/nginx/ai-site-access.log;
    error_log /var/log/nginx/ai-site-error.log;

    # 反向代理到 Next.js 应用（核心配置）
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Next.js 静态资源优化
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 图片和其他静态资源
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000";
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

#### 情况 B：全新配置（无 SSL）

```bash
# 创建配置文件
vim /etc/nginx/conf.d/ai-site.conf
```

**配置内容：**
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    access_log /var/log/nginx/ai-site-access.log;
    error_log /var/log/nginx/ai-site-error.log;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### 3.3 测试并重启 Nginx

```bash
# 1. 测试配置语法
nginx -t

# 应该看到：
# nginx: configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# 2. 如果测试通过，重启 Nginx
systemctl restart nginx

# 3. 检查状态
systemctl status nginx

# 4. 查看错误日志（如果有问题）
tail -f /var/log/nginx/error.log
```

---

### 3.4 配置防火墙和安全组

**阿里云安全组配置：**
1. 登录阿里云控制台
2. 进入 ECS 实例
3. 点击"安全组" → "配置规则"
4. 添加入方向规则：
   - 端口 80/80，授权对象：0.0.0.0/0
   - 端口 443/443，授权对象：0.0.0.0/0
   - 端口 22/22，授权对象：0.0.0.0/0（SSH）

**服务器防火墙配置（如果有）：**
```bash
# CentOS/RHEL (firewalld)
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

# Ubuntu/Debian (ufw)
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload
```

---

## 第四阶段：域名解析和 SSL

### 4.1 域名解析配置

**在阿里云域名控制台：**

1. 进入"云解析 DNS"
2. 找到你的域名，点击"解析设置"
3. 添加两条 A 记录：

| 记录类型 | 主机记录 | 记录值         | TTL    |
|---------|---------|---------------|--------|
| A       | @       | 服务器公网IP   | 10分钟 |
| A       | www     | 服务器公网IP   | 10分钟 |

4. 等待 DNS 生效（通常 5-10 分钟）

**验证 DNS 是否生效：**
```bash
# 本地电脑执行
nslookup yourdomain.com
nslookup www.yourdomain.com

# 或使用 ping
ping yourdomain.com
```

---

### 4.2 配置 SSL 证书（Let's Encrypt 免费证书）

#### 如果已有证书

直接在 Nginx 配置中指定证书路径（参考 3.2 节）。

#### 如果没有证书（使用 Let's Encrypt）

```bash
# 1. 安装 Certbot
# CentOS/RHEL
yum install -y certbot python3-certbot-nginx

# Ubuntu/Debian
apt-get update
apt-get install -y certbot python3-certbot-nginx

# 2. 申请证书（自动配置 Nginx）
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 按提示操作：
# - 输入邮箱
# - 同意服务条款（输入 Y）
# - 选择是否重定向 HTTP 到 HTTPS（选择 2）

# 3. 测试自动续期
certbot renew --dry-run

# 4. 设置自动续期定时任务
crontab -e
# 添加以下行（每月1号凌晨3点自动续期）
0 3 1 * * certbot renew --quiet
```

---

## 第五阶段：GitHub Actions 自动部署

### 5.1 创建 GitHub Actions 工作流文件

在**本地项目**中创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Aliyun Server

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    name: 🚀 部署到生产环境
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 检出代码
        uses: actions/checkout@v3

      - name: 🚀 SSH 连接服务器并部署
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          port: 22
          command_timeout: 10m
          
          script: |
            echo "========================================="
            echo "🚀 开始部署 AI-site 项目"
            echo "========================================="
            
            cd /var/www/ai-site || { echo "❌ 错误：项目目录不存在"; exit 1; }
            
            echo "📥 拉取最新代码..."
            git pull origin main || { echo "❌ 错误：Git 拉取失败"; exit 1; }
            
            echo "📦 安装依赖包..."
            npm install || { echo "❌ 错误：依赖安装失败"; exit 1; }
            
            echo "🔨 构建生产版本..."
            npm run build || { echo "❌ 错误：构建失败"; exit 1; }
            
            echo "🔄 重启应用..."
            pm2 reload ai-site --update-env || pm2 restart ai-site || { echo "❌ 错误：PM2 重启失败"; exit 1; }
            
            echo "📊 当前应用状态："
            pm2 status ai-site
            
            echo "========================================="
            echo "✅ 部署完成！"
            echo "========================================="
```

**⚠️ 注意**：
- `npm install` 不要加 `--production` 参数（会导致构建失败）
- 项目路径根据实际情况修改

---

### 5.2 配置 GitHub Secrets

**获取服务器信息：**

```bash
# 在服务器上执行，获取私钥
cat ~/.ssh/id_ed25519

# 复制完整输出（包括 BEGIN 和 END 行）
```

**在 GitHub 配置 Secrets：**

1. 访问：`https://github.com/你的用户名/仓库名/settings/secrets/actions`
2. 点击 "New repository secret"
3. 添加以下 3 个 Secrets：

| Name | Value | 说明 |
|------|-------|------|
| SERVER_HOST | 123.45.67.89 | 服务器公网 IP |
| SERVER_USER | root | SSH 登录用户名 |
| SERVER_SSH_KEY | -----BEGIN OPENSSH PRIVATE KEY-----<br/>...<br/>-----END OPENSSH PRIVATE KEY----- | SSH 私钥（完整内容） |

**⚠️ 配置 SERVER_SSH_KEY 的注意事项：**
- 必须包含 `-----BEGIN OPENSSH PRIVATE KEY-----`
- 必须包含 `-----END OPENSSH PRIVATE KEY-----`
- 中间所有内容都要复制，不要遗漏
- 不要有多余的空格或换行

---

### 5.3 测试自动部署

**方法 1：手动触发（推荐用于首次测试）**
1. 访问：`https://github.com/你的用户名/仓库名/actions`
2. 点击左侧 "Deploy to Aliyun Server"
3. 点击右侧 "Run workflow"
4. 选择 main 分支，点击 "Run workflow"

**方法 2：提交代码触发**
```bash
# 本地项目
git add .
git commit -m "test: 测试自动部署"
git push origin main
```

**查看部署进度：**
1. GitHub Actions 页面会显示运行状态
2. 点击进入查看详细日志
3. 整个过程约 2-3 分钟

**预期结果：**
```
✅ 📂 进入项目目录
✅ 📥 拉取最新代码
✅ 📦 安装依赖包
✅ 🔨 构建生产版本
✅ 🔄 重启应用
✅ 部署完成！
```

---

## 常见问题排查

### 问题 1：SSH 连接失败

**错误信息：**
```
ssh: handshake failed: ssh: unable to authenticate
```

**原因：**
- SSH 私钥配置错误
- authorized_keys 未配置

**解决方案：**
```bash
# 在服务器上执行
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
chmod 600 ~/.ssh/authorized_keys

# 重新获取私钥
cat ~/.ssh/id_ed25519

# 更新 GitHub Secret: SERVER_SSH_KEY
```

---

### 问题 2：构建失败 - 找不到模块

**错误信息：**
```
Module not found: Can't resolve '@/lib/mock-data'
```

**原因：**
- npm install 使用了 `--production` 参数
- devDependencies 未安装

**解决方案：**
```yaml
# 修改 deploy.yml
npm install  # 不要加 --production
```

---

### 问题 3：PM2 应用未运行（502 错误）

**错误信息：**
浏览器显示 502 Bad Gateway

**排查步骤：**
```bash
# 1. 检查 PM2 状态
pm2 status

# 2. 如果应用 stopped，重启
pm2 restart ai-site

# 3. 查看日志
pm2 logs ai-site --lines 50

# 4. 如果应用不在列表中，重新启动
cd /var/www/ai-site
pm2 start npm --name "ai-site" -- start
pm2 save
```

---

### 问题 4：内存不足导致构建失败

**错误信息：**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**解决方案：**
```bash
# 添加 swap 空间（2GB）
dd if=/dev/zero of=/swapfile bs=1M count=2048
mkswap /swapfile
chmod 600 /swapfile
swapon /swapfile

# 永久生效
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 验证
free -h
```

---

### 问题 5：Nginx 配置错误

**错误信息：**
```
nginx: [emerg] unknown directive "proxy_pass"
```

**排查步骤：**
```bash
# 1. 测试配置
nginx -t

# 2. 查看错误日志
tail -f /var/log/nginx/error.log

# 3. 检查配置文件语法
# 确保没有拼写错误、缺少分号等

# 4. 重启 Nginx
systemctl restart nginx
```

---

### 问题 6：域名无法访问

**排查步骤：**
```bash
# 1. 检查 DNS 解析
nslookup yourdomain.com

# 2. 检查 Nginx 是否运行
systemctl status nginx

# 3. 检查端口是否监听
netstat -tlnp | grep :80
netstat -tlnp | grep :443

# 4. 检查防火墙
# CentOS/RHEL
firewall-cmd --list-all

# Ubuntu/Debian
ufw status

# 5. 检查阿里云安全组
# 登录阿里云控制台查看
```

---

## 📊 部署后的运维命令

### PM2 常用命令

```bash
# 查看所有应用
pm2 list

# 查看日志
pm2 logs ai-site
pm2 logs ai-site --lines 100

# 重启应用
pm2 restart ai-site      # 重启（有短暂停机）
pm2 reload ai-site       # 重载（0 停机）

# 停止/启动
pm2 stop ai-site
pm2 start ai-site

# 查看详细信息
pm2 show ai-site

# 监控
pm2 monit

# 清空日志
pm2 flush ai-site
```

---

### Nginx 常用命令

```bash
# 测试配置
nginx -t

# 重启
systemctl restart nginx

# 重载（不停机）
systemctl reload nginx

# 查看状态
systemctl status nginx

# 查看日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/ai-site-access.log
```

---

### Git 常用命令

```bash
cd /var/www/ai-site

# 查看状态
git status

# 拉取最新代码
git pull

# 查看提交历史
git log --oneline -10

# 回滚到指定版本
git reset --hard 提交hash

# 强制同步远程
git fetch origin
git reset --hard origin/main
```

---

## 🔒 安全加固建议

### 1. 修改 SSH 默认端口

```bash
# 编辑 SSH 配置
vim /etc/ssh/sshd_config

# 修改端口（取消注释并修改）
Port 2222

# 重启 SSH 服务
systemctl restart sshd

# 记得在安全组和防火墙开放新端口
```

### 2. 禁用 root 直接登录

```bash
# 创建新用户
useradd deploy
passwd deploy

# 添加 sudo 权限
usermod -aG wheel deploy  # CentOS/RHEL
usermod -aG sudo deploy   # Ubuntu/Debian

# 禁用 root 登录
vim /etc/ssh/sshd_config
# 设置：PermitRootLogin no

systemctl restart sshd
```

### 3. 配置防火墙

```bash
# 只开放必要端口
# 80 (HTTP)、443 (HTTPS)、22 或自定义 SSH 端口
```

### 4. 定期更新系统

```bash
# CentOS/RHEL
yum update -y

# Ubuntu/Debian
apt-get update && apt-get upgrade -y
```

---

## 📝 日常开发流程

### 开发流程

```bash
# 1. 本地开发（在 dev 分支）
git checkout dev
# ... 编写代码 ...
git add .
git commit -m "feat: 添加新功能"
git push origin dev

# 2. 测试通过后，合并到 main 分支
git checkout main
git pull origin main
git merge dev
git push origin main  # 自动触发部署

# 3. 观察部署状态
# 访问 GitHub Actions 页面查看

# 4. 验证线上环境
# 访问 https://yourdomain.com 测试
```

---

## 🎉 部署完成检查清单

- [ ] Node.js 和 npm 已安装并可用
- [ ] PM2 已安装并配置开机自启
- [ ] Nginx 已配置反向代理
- [ ] 域名 DNS 解析生效
- [ ] SSL 证书配置正常（小锁图标显示）
- [ ] 网站可以正常访问
- [ ] GitHub Actions 自动部署测试成功
- [ ] PM2 应用状态为 online
- [ ] 日志无错误信息

---

## 📚 参考资料

- [Next.js 官方文档](https://nextjs.org/docs)
- [PM2 官方文档](https://pm2.keymetrics.io/docs/)
- [Nginx 官方文档](https://nginx.org/en/docs/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Let's Encrypt 文档](https://letsencrypt.org/docs/)

---

## ✉️ 反馈与支持

如有问题或建议，请提交 Issue：
- GitHub Issues: https://github.com/你的用户名/仓库名/issues

---

**最后更新**: 2025-01-09  
**文档版本**: 1.0  
**作者**: AI-site 团队
