# Stage 1: 构建前端 (使用 Vite)
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制 package.json 和配置
COPY frontend/package.json ./
COPY frontend/vite.config.js ./

# 安装依赖
RUN npm install

# 复制源码
COPY frontend/index.html ./
COPY frontend/public ./public
COPY frontend/src ./src

# 设置环境变量并构建
ENV VITE_API_URL=/api

RUN npm run build


# Stage 2: Python 后端
FROM python:3.11-slim AS backend-builder

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Stage 3: 最终镜像
FROM python:3.11-slim AS production

# 安装 nginx 和必要工具
RUN apt-get update && \
    apt-get install -y nginx procps && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 从构建阶段复制 Python 依赖
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# 复制后端代码
COPY backend/main.py .

# 从构建阶段复制前端构建产物
COPY --from=frontend-builder /app/frontend/build /usr/share/nginx/html

# 配置 nginx
RUN echo 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    \n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    \n\
    # API 代理到后端\n\
    location /api/ {\n\
        proxy_pass http://127.0.0.1:8000/;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
        proxy_set_header Host $host;\n\
        proxy_cache_bypass $http_upgrade;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
    }\n\
    \n\
    # React 路由\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    \n\
    # 静态资源缓存\n\
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}' > /etc/nginx/sites-available/default

# 创建数据目录
RUN mkdir -p /app/data

# 创建启动脚本
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# 启动后端服务（后台运行）\n\
echo "Starting backend service..."\n\
uvicorn main:app --host 127.0.0.1 --port 8000 &\n\
\n\
# 等待后端启动\n\
sleep 3\n\
\n\
# 启动 nginx（前台运行）\n\
echo "Starting nginx..."\n\
nginx -g "daemon off;"' > /app/start.sh && \
    chmod +x /app/start.sh

EXPOSE 80

# 使用启动脚本
CMD ["/app/start.sh"]
