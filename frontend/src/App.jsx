import React, { useState, useEffect } from 'react';
import {
  Layout, Menu, Upload, Button, Table, Input, Select, message,
  Card, Space, Tabs, Modal, Form, Tag, Spin
} from 'antd';
import {
  UploadOutlined, SearchOutlined, LinkOutlined,
  DeleteOutlined, ReloadOutlined, FileExcelOutlined,
  DownloadOutlined, CloseOutlined
} from '@ant-design/icons';
import axios from 'axios';
import './App.css';

const { Header, Content, Sider } = Layout;
const { Search } = Input;
const { Option } = Select;

// 配置axios基础URL (Vite 使用 import.meta.env)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
axios.defaults.baseURL = API_BASE_URL;

function App() {
  const [tables, setTables] = useState([]);
  const [currentTable, setCurrentTable] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [searchResults, setSearchResults] = useState(null);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [matchResults, setMatchResults] = useState(null); // 匹配结果
  const [multiValueModal, setMultiValueModal] = useState(null); // 多值选择弹窗
  const [multiValueSelections, setMultiValueSelections] = useState({}); // 用户选择
  const [pendingMatchParams, setPendingMatchParams] = useState(null); // 待处理的匹配参数
  const [form] = Form.useForm();
  
  // 监听表单字段变化用于联动
  const sourceTableValue = Form.useWatch('sourceTable', form);
  const targetTableValue = Form.useWatch('targetTable', form);
  
  // 获取选中表的列
  const sourceTableColumns = tables.find(t => t.name === sourceTableValue)?.columns || [];
  const targetTableColumns = tables.find(t => t.name === targetTableValue)?.columns || [];

  // 加载表列表
  const loadTables = async () => {
    try {
      const response = await axios.get('/tables');
      setTables(response.data.tables);
    } catch (error) {
      message.error('加载表列表失败: ' + error.message);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  // 上传文件
  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    setLoading(true);
    try {
      const response = await axios.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(response.data.message);
      await loadTables();
      if (!currentTable) {
        setCurrentTable(response.data.table_name);
        loadTableData(response.data.table_name, 1);
      }
    } catch (error) {
      message.error('上传失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
    return false;
  };

  // 加载表数据
  const loadTableData = async (tableName, page = 1, pageSize = 50) => {
    setLoading(true);
    try {
      const response = await axios.get(`/table/${tableName}`, {
        params: { page, page_size: pageSize }
      });
      
      const data = response.data;
      setTableData(data.data);
      setColumns(data.columns.map((col, index) => ({
        title: col,
        dataIndex: col,
        key: col,
        width: 150,
        ellipsis: true,
        fixed: index === 0 ? 'left' : undefined
      })));
      
      setPagination({
        current: data.page,
        pageSize: data.page_size,
        total: data.total
      });
      
      setSearchResults(null);
    } catch (error) {
      message.error('加载数据失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 搜索功能
  const handleSearch = async (value, searchColumn = null) => {
    if (!currentTable) {
      message.warning('请先选择一个表');
      return;
    }
    
    if (!value.trim()) {
      loadTableData(currentTable, 1);
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post('/search', {
        table_name: currentTable,
        search_term: value,
        search_column: searchColumn
      });
      
      setSearchResults(response.data);
      setTableData(response.data.data);
      setPagination({ ...pagination, total: response.data.total });
      message.success(`找到 ${response.data.total} 条匹配结果`);
    } catch (error) {
      message.error('搜索失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 匹配数据
  const handleMatch = async (values, selections = null) => {
    setLoading(true);
    try {
      const params = {
        source_table: values.sourceTable,
        source_column: values.sourceColumn,
        target_table: values.targetTable,
        target_columns: values.targetColumns
      };
      
      if (selections) {
        params.selections = selections;
      }
      
      const response = await axios.post('/match', params);
      
      // 检查是否需要用户选择
      if (response.data.status === 'need_selection') {
        setPendingMatchParams(values);
        setMultiValueModal(response.data.multi_value_keys);
        setMultiValueSelections({});
        setMatchModalVisible(false);
        message.info(response.data.message);
        return;
      }
      
      const matchData = response.data.data;
      const matchCols = response.data.columns.map((col, index) => ({
        title: col,
        dataIndex: col,
        key: col,
        width: 150,
        ellipsis: true,
        fixed: index === 0 ? 'left' : undefined
      }));
      
      // 设置匹配结果
      setMatchResults({
        data: matchData,
        columns: matchCols,
        sourceTable: values.sourceTable,
        targetTable: values.targetTable,
        total: response.data.total
      });
      
      // 清除当前表选择，以显示匹配结果
      setCurrentTable(null);
      
      message.success(`匹配完成，共 ${response.data.total} 条数据`);
      setMatchModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('匹配失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 确认多值选择
  const handleConfirmSelections = () => {
    if (pendingMatchParams) {
      handleMatch(pendingMatchParams, multiValueSelections);
      setMultiValueModal(null);
      setPendingMatchParams(null);
    }
  };

  // 导出匹配结果为CSV
  const handleExportMatch = () => {
    if (!matchResults || !matchResults.data.length) return;
    
    const headers = matchResults.columns.map(col => col.title);
    const rows = matchResults.data.map(row => 
      matchResults.columns.map(col => {
        const val = row[col.dataIndex];
        // 处理包含逗号或引号的值
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? '';
      }).join(',')
    );
    
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `匹配结果_${matchResults.sourceTable}_${matchResults.targetTable}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  // 删除表
  const handleDeleteTable = async (tableName) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除表 "${tableName}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete(`/table/${tableName}`);
          message.success('删除成功');
          await loadTables();
          if (currentTable === tableName) {
            setCurrentTable(null);
            setTableData([]);
            setColumns([]);
          }
        } catch (error) {
          message.error('删除失败: ' + (error.response?.data?.detail || error.message));
        }
      }
    });
  };

  // 表格分页变化
  const handleTableChange = (newPagination) => {
    if (searchResults) {
      // 如果是搜索结果，不需要重新加载
      setPagination(newPagination);
    } else {
      loadTableData(currentTable, newPagination.current, newPagination.pageSize);
    }
  };

  const currentTableInfo = tables.find(t => t.name === currentTable);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <FileExcelOutlined style={{ fontSize: 28, color: '#1890ff', marginRight: 12 }} />
            <h1 style={{ color: 'white', margin: 0, fontSize: 20 }}>Excel 数据工具</h1>
          </div>
          <Upload beforeUpload={handleUpload} showUploadList={false} accept=".xlsx,.xls">
            <Button type="primary" icon={<UploadOutlined />} loading={loading}>
              上传 Excel
            </Button>
          </Upload>
        </div>
      </Header>
      
      <Layout>
        <Sider width={250} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16, fontWeight: 'bold', fontSize: 16 }}>
              已上传的表 ({tables.length})
            </div>
            <Menu
              mode="inline"
              selectedKeys={currentTable ? [currentTable] : []}
              style={{ borderRight: 0 }}
            >
              {tables.map(table => (
                <Menu.Item
                  key={table.name}
                  onClick={() => {
                    setCurrentTable(table.name);
                    loadTableData(table.name, 1);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {table.name}
                    </span>
                    <DeleteOutlined
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTable(table.name);
                      }}
                      style={{ color: '#ff4d4f' }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {table.rows} 行 × {table.columns.length} 列
                  </div>
                </Menu.Item>
              ))}
            </Menu>
          </div>
        </Sider>
        
        <Layout style={{ padding: 24 }}>
          <Content>
            {currentTable ? (
              <Card
                title={
                  <Space>
                    <span>{currentTable}</span>
                    {currentTableInfo && (
                      <Tag color="blue">
                        {currentTableInfo.rows} 行 × {currentTableInfo.columns.length} 列
                      </Tag>
                    )}
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      icon={<LinkOutlined />}
                      onClick={() => setMatchModalVisible(true)}
                      disabled={tables.length < 2}
                    >
                      数据匹配
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => loadTableData(currentTable, 1)}
                    >
                      刷新
                    </Button>
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Select
                      placeholder="选择搜索列（可选）"
                      style={{ width: 200 }}
                      allowClear
                      onChange={(value) => {
                        const searchInput = document.querySelector('.search-input input');
                        if (searchInput && searchInput.value) {
                          handleSearch(searchInput.value, value);
                        }
                      }}
                    >
                      {columns.map(col => (
                        <Option key={col.dataIndex} value={col.dataIndex}>
                          {col.title}
                        </Option>
                      ))}
                    </Select>
                    <Search
                      className="search-input"
                      placeholder="输入搜索内容..."
                      allowClear
                      enterButton={<SearchOutlined />}
                      size="middle"
                      onSearch={(value) => {
                        const selectValue = document.querySelector('.ant-select-selection-item')?.textContent;
                        const selectedColumn = columns.find(col => col.title === selectValue)?.dataIndex;
                        handleSearch(value, selectedColumn || null);
                      }}
                      style={{ flex: 1 }}
                    />
                  </div>
                  
                  {searchResults && (
                    <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 4 }}>
                      <Space>
                        <SearchOutlined style={{ color: '#1890ff' }} />
                        <span>
                          搜索 "{searchResults.search_term}"
                          {searchResults.search_column && ` 于列 "${searchResults.search_column}"`}
                          ，找到 {searchResults.total} 条结果
                        </span>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => loadTableData(currentTable, 1)}
                        >
                          清除搜索
                        </Button>
                      </Space>
                    </div>
                  )}
                  
                  <Table
                    columns={columns}
                    dataSource={tableData}
                    loading={loading}
                    pagination={pagination}
                    onChange={handleTableChange}
                    scroll={{ x: 'max-content', y: 500 }}
                    rowKey={(record, index) => index}
                    size="small"
                    bordered
                  />
                </Space>
              </Card>
            ) : matchResults ? (
              <Card
                title={
                  <Space>
                    <span>匹配结果</span>
                    <Tag color="green">{matchResults.sourceTable} → {matchResults.targetTable}</Tag>
                    <Tag color="blue">{matchResults.total} 条数据</Tag>
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={handleExportMatch}
                    >
                      导出CSV
                    </Button>
                    <Button
                      icon={<CloseOutlined />}
                      onClick={() => setMatchResults(null)}
                    >
                      关闭
                    </Button>
                  </Space>
                }
              >
                <Table
                  columns={matchResults.columns}
                  dataSource={matchResults.data}
                  loading={loading}
                  pagination={{ pageSize: 50, showTotal: (total) => `共 ${total} 条` }}
                  scroll={{ x: 'max-content', y: 500 }}
                  rowKey={(record, index) => index}
                  size="small"
                  bordered
                />
              </Card>
            ) : (
              <Card style={{ textAlign: 'center', padding: '60px 0' }}>
                <FileExcelOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
                <h2 style={{ color: '#999' }}>请上传Excel文件或选择已上传的表</h2>
                <Upload beforeUpload={handleUpload} showUploadList={false} accept=".xlsx,.xls">
                  <Button type="primary" icon={<UploadOutlined />} size="large">
                    上传 Excel 文件
                  </Button>
                </Upload>
              </Card>
            )}
          </Content>
        </Layout>
      </Layout>
      
      <Modal
        title="数据匹配"
        open={matchModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setMatchModalVisible(false);
          form.resetFields();
        }}
        width={600}
        okText="开始匹配"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleMatch}
        >
          <Form.Item
            name="sourceTable"
            label="源表"
            rules={[{ required: true, message: '请选择源表' }]}
          >
            <Select placeholder="选择源表">
              {tables.map(table => (
                <Option key={table.name} value={table.name}>
                  {table.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="sourceColumn"
            label="源表匹配列"
            rules={[{ required: true, message: '请选择源表匹配列' }]}
          >
            <Select placeholder="选择要匹配的列">
              {sourceTableColumns.map(col => (
                <Option key={col} value={col}>
                  {col}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="targetTable"
            label="目标表"
            rules={[{ required: true, message: '请选择目标表' }]}
          >
            <Select placeholder="选择目标表">
              {tables.map(table => (
                <Option key={table.name} value={table.name}>
                  {table.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="targetColumns"
            label="目标表要获取的列"
            rules={[{ required: true, message: '请选择要获取的列' }]}
          >
            <Select mode="multiple" placeholder="选择要获取的列（可多选）">
              {targetTableColumns.map(col => (
                <Option key={col} value={col}>
                  {col}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 多值选择弹窗 */}
      <Modal
        title="选择匹配值"
        open={!!multiValueModal}
        onOk={handleConfirmSelections}
        onCancel={() => {
          setMultiValueModal(null);
          setPendingMatchParams(null);
          setMultiValueSelections({});
        }}
        width={800}
        okText="确认选择并匹配"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Tag color="orange">发现以下匹配项有多个可选值，请为每个选择一个</Tag>
        </div>
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {multiValueModal && Object.entries(multiValueModal).map(([key, options]) => (
            <Card 
              key={key} 
              size="small" 
              style={{ marginBottom: 12 }}
              title={<span>匹配键: <Tag color="blue">{key}</Tag></span>}
            >
              <Select
                style={{ width: '100%' }}
                placeholder="请选择一个值"
                value={multiValueSelections[key]}
                onChange={(val) => setMultiValueSelections(prev => ({...prev, [key]: val}))}
              >
                {options.map((opt, idx) => (
                  <Option key={idx} value={idx}>
                    {Object.entries(opt).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                  </Option>
                ))}
              </Select>
            </Card>
          ))}
        </div>
        {multiValueModal && (
          <div style={{ marginTop: 12, color: '#666' }}>
            提示：未选择的项将使用第一个值
          </div>
        )}
      </Modal>
    </Layout>
  );
}

export default App;
