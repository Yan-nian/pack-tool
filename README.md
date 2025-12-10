# Excel 数据工具

基于 Docker 的高性能 Web Excel 数据处理工具，提供搜索、匹配等强大功能。

## 功能特性

### ✨ 核心功能

1. **Excel 文件上传与管理**
   - 支持 `.xlsx` 和 `.xls` 格式
   - 多表管理，实时切换
   - 表数据预览与分页显示

2. **强大的搜索功能**
   - 全表搜索：在所有列中搜索关键词
   - 指定列搜索：精确搜索特定列
   - 实时结果统计与高亮显示

3. **智能数据匹配**
   - 跨表数据匹配
   - 根据源表某列匹配目标表多列数据
   - 示例：根据"零件名称"匹配"包装类型"和"包装数量"
   - 支持多列同时匹配

4. **高性能与优质体验**
   - 分页加载，快速响应
   - 简洁现代的界面设计
   - 完善的错误提示与交互反馈
   - 格式化数据展示（表格形式）

## 技术栈

### 后端
- **FastAPI**: 高性能 Python Web 框架
- **Pandas**: 强大的数据处理库
- **OpenPyXL**: Excel 文件读写

### 前端
- **React 18**: 现代化前端框架
- **Ant Design 5**: 企业级 UI 组件库
- **Axios**: HTTP 客户端

### 部署
- **Docker**: 容器化部署
- **Docker Compose**: 多容器编排
- **Nginx**: 前端静态文件服务与反向代理
- **GitHub Actions**: 自动构建和发布 Docker 镜像

## Docker 镜像

项目已配置 GitHub Actions 自动构建，每次推送到 main/master 分支时会自动构建并推送镜像到 GitHub Container Registry。

**单容器集成方案** - 前后端集成在一个 Docker 镜像中，部署更简单！

**可用镜像：**
- 完整应用: `ghcr.io/yan-nian/pack-tool:latest`

**拉取镜像：**
```powershell
docker pull ghcr.io/yan-nian/pack-tool:latest
```

## 快速开始

### 使用 Docker（推荐）

#### 方式一：使用预构建镜像（最快）

1. **确保已安装 Docker 和 Docker Compose**

2. **克隆项目**
   ```bash
   git clone https://github.com/Yan-nian/pack-tool.git
   cd pack-tool
   ```

3. **一键启动**
   ```powershell
   docker-compose up -d
   ```

4. **访问应用**
   
   打开浏览器访问：http://localhost

5. **停止服务**
   ```powershell
   docker-compose down
   ```

#### 方式二：本地构建镜像

1. **克隆项目**
   ```bash
   git clone https://github.com/Yan-nian/pack-tool.git
   cd pack-tool
   ```

2. **构建并启动**
   ```powershell
   docker-compose up -d --build
   ```

3. **访问应用**
   
   打开浏览器访问：http://localhost

4. **停止服务**
   ```powershell
   docker-compose down
   ```

### 本地开发模式

#### 后端启动

```powershell
cd backend
pip install -r requirements.txt
python main.py
```

后端服务运行在：http://localhost:8000

#### 前端启动

```powershell
cd frontend
npm install --legacy-peer-deps
npm start
```

前端应用运行在：http://localhost:3000

## 使用指南

### 1. 上传 Excel 文件

- 点击右上角"上传 Excel"按钮
- 选择 `.xlsx` 或 `.xls` 文件
- 上传成功后，表会自动显示在左侧列表

### 2. 查看表数据

- 在左侧列表中点击表名
- 主区域会显示表的所有数据
- 支持分页浏览

### 3. 搜索数据

**全表搜索：**
- 在搜索框中直接输入关键词
- 点击搜索按钮或按 Enter

**指定列搜索：**
- 先在下拉框中选择要搜索的列
- 再输入关键词进行搜索

### 4. 数据匹配

假设您有两个表：
- **未维护主数据表**：包含"零件名称"等列
- **PFEP表**：包含"零件名称"、"包装类型"、"包装数量"等列

**操作步骤：**

1. 点击"数据匹配"按钮
2. 填写匹配配置：
   - **源表**：选择"未维护主数据表"
   - **源表匹配列**：选择"零件名称"
   - **目标表**：选择"PFEP表"
   - **目标表要获取的列**：选择"包装类型"和"包装数量"
3. 点击"开始匹配"
4. 系统会将两表通过"零件名称"进行匹配，并在源表中添加对应的"包装类型"和"包装数量"列

### 5. 删除表

- 在左侧表列表中，点击表名右侧的删除图标
- 确认删除即可

## API 文档

启动后端后，访问 API 文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 主要 API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/` | 健康检查 |
| POST | `/upload` | 上传 Excel 文件 |
| GET | `/tables` | 获取所有表列表 |
| GET | `/table/{table_name}` | 获取表数据（分页） |
| POST | `/search` | 搜索数据 |
| POST | `/match` | 匹配数据 |
| DELETE | `/table/{table_name}` | 删除表 |

## 项目结构

```
excel-tool/
├── backend/                 # 后端服务
│   ├── main.py             # FastAPI 应用
│   └── requirements.txt    # Python 依赖
├── frontend/               # 前端应用
│   ├── public/             # 静态资源
│   ├── src/
│   │   ├── App.js          # 主应用组件
│   │   ├── App.css         # 样式文件
│   │   └── index.js        # 入口文件
│   ├── package.json        # Node 依赖
│   └── .env                # 环境变量
├── data/                   # 数据目录
├── Dockerfile              # 单容器 Docker 配置
├── docker-compose.yml      # Docker Compose 配置
├── .gitignore             # Git 忽略文件
└── README.md              # 项目文档
```

## 性能优化

- **后端**：
  - 使用 Pandas 进行高效数据处理
  - 分页加载避免一次性加载大量数据
  - 内存中缓存已上传的表数据

- **前端**：
  - 虚拟滚动优化大表渲染
  - 组件按需加载
  - 生产环境静态资源压缩

- **部署**：
  - Nginx 静态资源缓存
  - Docker 容器隔离与资源限制

## 注意事项

1. **数据安全**：上传的 Excel 文件存储在内存中，重启服务后数据会丢失
2. **文件大小**：建议单个文件不超过 50MB
3. **浏览器兼容**：推荐使用 Chrome、Edge、Firefox 等现代浏览器
4. **端口占用**：确保 80 和 8000 端口未被占用

## 常见问题

**Q: 上传文件失败？**
- 检查文件格式是否为 `.xlsx` 或 `.xls`
- 确保文件未损坏
- 检查文件大小是否过大

**Q: 数据匹配没有结果？**
- 确保匹配列的值在两个表中都存在
- 检查数据格式是否一致（如空格、大小写等）

**Q: Docker 启动失败？**
- 检查 Docker 服务是否运行
- 确保端口 80 和 8000 未被占用
- 查看日志：`docker-compose logs`

## 开发计划

- [ ] 支持数据导出（Excel、CSV）
- [ ] 支持更多数据格式（CSV、JSON）
- [ ] 数据持久化存储
- [ ] 用户认证与权限管理
- [ ] 数据可视化图表
- [ ] 批量数据处理

## 许可证

MIT License

## 作者

Excel Tool Development Team

---

如有问题或建议，欢迎提交 Issue！
