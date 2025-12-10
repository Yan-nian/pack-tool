import React, { useState, useEffect } from 'react';
import {
  Layout, Menu, Upload, Button, Table, Input, Select, message,
  Card, Space, Tabs, Modal, Form, Tag, Spin, Divider
} from 'antd';
import {
  UploadOutlined, SearchOutlined, LinkOutlined,
  DeleteOutlined, ReloadOutlined, FileExcelOutlined,
  DownloadOutlined, CloseOutlined, PlusOutlined, MinusCircleOutlined
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
  const [matchResults, setMatchResults] = useState(null); // 当前显示的匹配结果
  const [matchHistory, setMatchHistory] = useState([]); // 匹配结果历史列表
  const [currentMatchIndex, setCurrentMatchIndex] = useState(null); // 当前选中的匹配结果索引
  const [form] = Form.useForm();
  
  // 监听表单字段变化用于联动
  const sourceTableValue = Form.useWatch('sourceTable', form);
  const targetsValue = Form.useWatch('targets', form); // 监听整个targets数组
  
  // 获取选中表的列
  const sourceTableColumns = tables.find(t => t.name === sourceTableValue)?.columns || [];
  
  // 获取指定目标表的列
  const getTargetTableColumns = (index) => {
    const targetTable = targetsValue?.[index]?.targetTable;
    return tables.find(t => t.name === targetTable)?.columns || [];
  };

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

  // 匹配数据（支持多表）
  const handleMatch = async (values) => {
    console.log('handleMatch called with values:', values);
    
    // 验证必要字段
    if (!values.sourceTable || !values.sourceColumn) {
      message.error('请选择源表和匹配列');
      return;
    }
    
    if (!values.targets || !values.targets.length) {
      message.error('请至少添加一个目标表');
      return;
    }
    
    // 验证每个目标表
    for (let i = 0; i < values.targets.length; i++) {
      const t = values.targets[i];
      if (!t.targetTable || !t.targetMatchColumn || !t.targetColumns || !t.targetColumns.length) {
        message.error(`请完整填写目标表 ${i + 1} 的配置（包括匹配列）`);
        return;
      }
    }
    
    setLoading(true);
    try {
      // 构建多表匹配参数
      const targets = values.targets.map(t => ({
        target_table: t.targetTable,
        target_match_column: t.targetMatchColumn,  // 目标表的匹配列
        target_columns: t.targetColumns,
        conditions: t.conditions?.filter(c => c?.source_col && c?.target_col) || []
      }));
      
      const params = {
        source_table: values.sourceTable,
        source_column: values.sourceColumn,
        targets: targets
      };
      
      console.log('Sending multi-match request with params:', params);
      
      const response = await axios.post('/multi-match', params);
      console.log('Multi-match response:', response.data);
      console.log('Response columns:', response.data.columns);
      console.log('Response data sample:', response.data.data?.[0]);
      
      if (!response.data.data || !response.data.columns) {
        message.error('服务器返回数据格式错误');
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
      
      // 生成名称
      const targetNames = targets.map(t => t.target_table).join(', ');
      
      // 创建新的匹配结果
      const newMatchResult = {
        id: Date.now(),
        name: `${values.sourceTable} → ${targetNames}`,
        data: matchData,
        columns: matchCols,
        sourceTable: values.sourceTable,
        targetTables: targets.map(t => t.target_table),
        total: response.data.total,
        time: new Date().toLocaleTimeString()
      };
      
      // 添加到历史列表
      setMatchHistory(prev => [...prev, newMatchResult]);
      setCurrentMatchIndex(matchHistory.length);
      
      // 设置当前显示的匹配结果
      setMatchResults(newMatchResult);
      
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

  // 导出匹配结果为Excel
  const handleExportMatch = async () => {
    if (!matchResults || !matchResults.data.length) return;
    
    try {
      const response = await axios.post('/export-excel', {
        data: matchResults.data,
        columns: matchResults.columns.map(col => col.dataIndex),
        filename: `匹配结果_${matchResults.name || matchResults.sourceTable}`
      }, {
        responseType: 'blob'
      });
      
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `匹配结果_${matchResults.name || matchResults.sourceTable}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败: ' + error.message);
    }
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
        <Sider width={280} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
          <div style={{ padding: 16 }}>
            {/* 已上传的表 */}
            <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: 14, color: '#1890ff' }}>
              📁 已上传的表 ({tables.length})
            </div>
            <Menu
              mode="inline"
              selectedKeys={currentTable ? [`table_${currentTable}`] : (currentMatchIndex !== null ? [`match_${currentMatchIndex}`] : [])}
              style={{ borderRight: 0 }}
            >
              {tables.map(table => (
                <Menu.Item
                  key={`table_${table.name}`}
                  onClick={() => {
                    setCurrentTable(table.name);
                    setCurrentMatchIndex(null);
                    setMatchResults(null);
                    loadTableData(table.name, 1);
                  }}
                  style={{ height: 'auto', lineHeight: 1.5, padding: '8px 16px', marginBottom: 4 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={table.name}>
                      {table.name}
                    </span>
                    <DeleteOutlined
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTable(table.name);
                      }}
                      style={{ color: '#ff4d4f', flexShrink: 0 }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    {table.rows} 行 × {table.columns.length} 列
                  </div>
                </Menu.Item>
              ))}
            </Menu>
            
            {/* 匹配结果 */}
            {matchHistory.length > 0 && (
              <>
                <div style={{ marginTop: 20, marginBottom: 8, fontWeight: 'bold', fontSize: 14, color: '#52c41a' }}>
                  🔗 匹配结果 ({matchHistory.length})
                </div>
                <Menu
                  mode="inline"
                  selectedKeys={currentMatchIndex !== null ? [`match_${currentMatchIndex}`] : []}
                  style={{ borderRight: 0 }}
                >
                  {matchHistory.map((match, index) => (
                    <Menu.Item
                      key={`match_${index}`}
                      onClick={() => {
                        setCurrentTable(null);
                        setCurrentMatchIndex(index);
                        setMatchResults(match);
                      }}
                      style={{ height: 'auto', lineHeight: 1.5, padding: '8px 16px', marginBottom: 4 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={match.name}>
                          {match.name}
                        </span>
                        <DeleteOutlined
                          onClick={(e) => {
                            e.stopPropagation();
                            setMatchHistory(prev => prev.filter((_, i) => i !== index));
                            if (currentMatchIndex === index) {
                              setMatchResults(null);
                              setCurrentMatchIndex(null);
                            }
                          }}
                          style={{ color: '#ff4d4f', flexShrink: 0 }}
                        />
                      </div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        {match.total} 条 · {match.time}
                      </div>
                    </Menu.Item>
                  ))}
                </Menu>
              </>
            )}
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
                      onClick={() => {
                        form.setFieldsValue({ targets: [{}] });
                        setMatchModalVisible(true);
                      }}
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
                    <Tag color="green">{matchResults.name}</Tag>
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
                      导出Excel
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
                <Space size="large">
                  <Upload beforeUpload={handleUpload} showUploadList={false} accept=".xlsx,.xls">
                    <Button type="primary" icon={<UploadOutlined />} size="large">
                      上传 Excel 文件
                    </Button>
                  </Upload>
                  {tables.length >= 2 && (
                    <Button 
                      icon={<LinkOutlined />} 
                      size="large"
                      onClick={() => {
                        form.setFieldsValue({ targets: [{}] });
                        setMatchModalVisible(true);
                      }}
                    >
                      数据匹配
                    </Button>
                  )}
                </Space>
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
        width={700}
        okText="开始匹配"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleMatch}
          initialValues={{ targets: [{}] }}
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
            label="源表匹配列（用于匹配目标表第一列）"
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
          
          <Divider>目标表配置（可添加多个）</Divider>
          
          <Form.List name="targets">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }, index) => {
                  const targetCols = getTargetTableColumns(name);
                  
                  return (
                    <Card 
                      key={key} 
                      size="small" 
                      style={{ marginBottom: 12 }}
                      title={`目标表 ${index + 1}`}
                      extra={fields.length > 1 && (
                        <MinusCircleOutlined 
                          onClick={() => remove(name)} 
                          style={{ color: '#ff4d4f' }}
                        />
                      )}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, 'targetTable']}
                        label="目标表"
                        rules={[{ required: true, message: '请选择目标表' }]}
                      >
                        <Select 
                          placeholder="选择目标表"
                          onChange={() => {
                            // 清空已选列和条件
                            form.setFieldValue(['targets', name, 'targetMatchColumn'], undefined);
                            form.setFieldValue(['targets', name, 'targetColumns'], []);
                            form.setFieldValue(['targets', name, 'conditions'], []);
                          }}
                        >
                          {tables.map(table => (
                            <Option key={table.name} value={table.name}>
                              {table.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      
                      <Form.Item
                        {...restField}
                        name={[name, 'targetMatchColumn']}
                        label="目标表匹配列（与源表匹配列对应）"
                        rules={[{ required: true, message: '请选择目标表中用于匹配的列' }]}
                      >
                        <Select placeholder="选择目标表中用于匹配的列">
                          {targetCols.map(col => (
                            <Option key={col} value={col}>
                              {col}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      
                      <Form.Item
                        {...restField}
                        name={[name, 'targetColumns']}
                        label="要获取的列"
                        rules={[{ required: true, message: '请选择要获取的列' }]}
                      >
                        <Select mode="multiple" placeholder="选择要获取的列（可多选）">
                          {targetCols.map(col => (
                            <Option key={col} value={col}>
                              {col}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      
                      {/* 限制条件 */}
                      <Form.List name={[name, 'conditions']}>
                        {(condFields, { add: addCond, remove: removeCond }) => (
                          <>
                            {condFields.length > 0 && (
                              <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
                                限制条件（源表列 = 目标表列）
                              </div>
                            )}
                            {condFields.map(({ key: condKey, name: condName, ...condRestField }) => (
                              <Space key={condKey} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                <Form.Item
                                  {...condRestField}
                                  name={[condName, 'source_col']}
                                  style={{ marginBottom: 0 }}
                                >
                                  <Select placeholder="源表列" style={{ width: 150 }}>
                                    {sourceTableColumns.map(col => (
                                      <Option key={col} value={col}>{col}</Option>
                                    ))}
                                  </Select>
                                </Form.Item>
                                <span>=</span>
                                <Form.Item
                                  {...condRestField}
                                  name={[condName, 'target_col']}
                                  style={{ marginBottom: 0 }}
                                >
                                  <Select placeholder="目标表列" style={{ width: 150 }}>
                                    {targetCols.map(col => (
                                      <Option key={col} value={col}>{col}</Option>
                                    ))}
                                  </Select>
                                </Form.Item>
                                <MinusCircleOutlined onClick={() => removeCond(condName)} style={{ color: '#ff4d4f' }} />
                              </Space>
                            ))}
                            <Button 
                              type="link" 
                              size="small" 
                              onClick={() => addCond()} 
                              icon={<PlusOutlined />}
                              style={{ padding: 0 }}
                            >
                              添加限制条件
                            </Button>
                          </>
                        )}
                      </Form.List>
                    </Card>
                  );
                })}
                <Form.Item>
                  <Button 
                    type="dashed" 
                    onClick={() => add()} 
                    block 
                    icon={<PlusOutlined />}
                  >
                    添加目标表
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Layout>
  );
}

export default App;
