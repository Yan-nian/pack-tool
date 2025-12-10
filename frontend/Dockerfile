FROM node:18-alpine as build

WORKDIR /app

# 复制package.json
COPY package.json .

# 安装依赖
RUN npm install --legacy-peer-deps

# 复制源代码
COPY public ./public
COPY src ./src

# 构建应用
RUN npm run build

# 生产环境使用nginx
FROM nginx:alpine

# 复制构建产物
COPY --from=build /app/build /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
