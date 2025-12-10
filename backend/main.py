from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from typing import List, Optional, Dict
import pandas as pd
import io
import os
import pickle
from pydantic import BaseModel

app = FastAPI(title="Excel Tool API")

# 数据持久化目录
DATA_DIR = os.environ.get('DATA_DIR', '/app/data')
DATA_FILE = os.path.join(DATA_DIR, 'excel_data.pkl')

# 确保数据目录存在
os.makedirs(DATA_DIR, exist_ok=True)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 存储上传的Excel数据
excel_data = {}

def save_data():
    """保存数据到文件"""
    try:
        with open(DATA_FILE, 'wb') as f:
            pickle.dump(excel_data, f)
    except Exception as e:
        print(f"保存数据失败: {e}")

def load_data():
    """从文件加载数据"""
    global excel_data
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'rb') as f:
                excel_data = pickle.load(f)
            print(f"已加载 {len(excel_data)} 个表")
    except Exception as e:
        print(f"加载数据失败: {e}")
        excel_data = {}

# 启动时加载数据
load_data()

class SearchRequest(BaseModel):
    table_name: str
    search_term: str
    search_column: Optional[str] = None

class MatchRequest(BaseModel):
    source_table: str
    source_column: str
    target_table: str
    target_columns: List[str]
    selections: Optional[dict] = None  # 用户选择的值 {key: selected_index}

class MultiMatchTarget(BaseModel):
    target_table: str
    target_columns: List[str]

class MultiMatchRequest(BaseModel):
    source_table: str
    source_column: str
    targets: List[MultiMatchTarget]  # 多个目标表
    selections: Optional[Dict[str, dict]] = None  # {target_table: {key: selected_index}}

class ExportRequest(BaseModel):
    data: List[dict]
    columns: List[str]
    filename: Optional[str] = "匹配结果"

@app.get("/")
async def root():
    return {"message": "Excel Tool API is running"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传Excel文件"""
    try:
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="只支持Excel文件(.xlsx, .xls)")
        
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # 存储数据
        table_name = file.filename.replace('.xlsx', '').replace('.xls', '')
        excel_data[table_name] = df
        
        # 保存到文件
        save_data()
        
        return {
            "message": "文件上传成功",
            "table_name": table_name,
            "rows": len(df),
            "columns": list(df.columns)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件处理失败: {str(e)}")

@app.get("/tables")
async def get_tables():
    """获取所有已上传的表"""
    tables = []
    for name, df in excel_data.items():
        tables.append({
            "name": name,
            "rows": len(df),
            "columns": list(df.columns)
        })
    return {"tables": tables}

@app.get("/table/{table_name}")
async def get_table(table_name: str, page: int = 1, page_size: int = 50):
    """获取表数据（分页）"""
    if table_name not in excel_data:
        raise HTTPException(status_code=404, detail="表不存在")
    
    df = excel_data[table_name]
    total = len(df)
    start = (page - 1) * page_size
    end = start + page_size
    
    # 转换为JSON格式，处理NaN值
    data = df.iloc[start:end].fillna("").to_dict(orient='records')
    
    return {
        "table_name": table_name,
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": data,
        "columns": list(df.columns)
    }

@app.post("/search")
async def search(request: SearchRequest):
    """搜索功能"""
    if request.table_name not in excel_data:
        raise HTTPException(status_code=404, detail="表不存在")
    
    df = excel_data[request.table_name]
    
    try:
        if request.search_column:
            # 在指定列中搜索
            if request.search_column not in df.columns:
                raise HTTPException(status_code=400, detail=f"列 '{request.search_column}' 不存在")
            mask = df[request.search_column].astype(str).str.contains(request.search_term, case=False, na=False)
        else:
            # 在所有列中搜索
            mask = df.astype(str).apply(lambda x: x.str.contains(request.search_term, case=False, na=False)).any(axis=1)
        
        result_df = df[mask]
        data = result_df.fillna("").to_dict(orient='records')
        
        return {
            "table_name": request.table_name,
            "search_term": request.search_term,
            "search_column": request.search_column,
            "total": len(data),
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")

@app.post("/match")
async def match_data(request: MatchRequest):
    """根据一列匹配其他表的数据"""
    if request.source_table not in excel_data:
        raise HTTPException(status_code=404, detail=f"源表 '{request.source_table}' 不存在")
    
    if request.target_table not in excel_data:
        raise HTTPException(status_code=404, detail=f"目标表 '{request.target_table}' 不存在")
    
    source_df = excel_data[request.source_table]
    target_df = excel_data[request.target_table]
    
    if request.source_column not in source_df.columns:
        raise HTTPException(status_code=400, detail=f"源表中列 '{request.source_column}' 不存在")
    
    # 检查目标列是否存在
    missing_columns = [col for col in request.target_columns if col not in target_df.columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"目标表中列 {missing_columns} 不存在")
    
    try:
        # 使用merge进行匹配
        # 假设目标表的第一列是匹配键
        merge_column = target_df.columns[0]
        
        # 准备匹配所需的列
        target_subset = target_df[[merge_column] + request.target_columns].copy()
        
        # 将匹配列转换为字符串类型以避免类型不匹配问题
        source_df = source_df.copy()
        source_df[request.source_column] = source_df[request.source_column].astype(str).str.strip()
        target_subset[merge_column] = target_subset[merge_column].astype(str).str.strip()
        
        # 检测多值匹配情况
        target_grouped = target_subset.groupby(merge_column)
        multi_value_keys = {}
        
        for key, group in target_grouped:
            if len(group) > 1:
                # 该key有多个匹配值
                options = group[request.target_columns].fillna("").to_dict(orient='records')
                # 去重
                unique_options = []
                seen = set()
                for opt in options:
                    opt_tuple = tuple(sorted(opt.items()))
                    if opt_tuple not in seen:
                        seen.add(opt_tuple)
                        unique_options.append(opt)
                if len(unique_options) > 1:
                    multi_value_keys[key] = unique_options
        
        # 如果有多值情况且用户未做选择，返回让用户选择
        if multi_value_keys and not request.selections:
            return {
                "status": "need_selection",
                "multi_value_keys": multi_value_keys,
                "message": f"发现 {len(multi_value_keys)} 个匹配项有多个值，请选择"
            }
        
        # 应用用户选择或使用第一个值
        if request.selections:
            # 根据用户选择构建唯一映射
            for key, idx in request.selections.items():
                if key in multi_value_keys:
                    selected = multi_value_keys[key][int(idx)]
                    # 移除其他值，只保留选择的
                    mask = target_subset[merge_column] == key
                    for col in request.target_columns:
                        target_subset.loc[mask, col] = selected.get(col, "")
        
        # 去重后执行匹配
        target_subset = target_subset.drop_duplicates(subset=[merge_column], keep='first')
        
        # 执行左连接
        result_df = source_df.merge(
            target_subset,
            left_on=request.source_column,
            right_on=merge_column,
            how='left',
            suffixes=('', '_matched')
        )
        
        data = result_df.fillna("").to_dict(orient='records')
        
        return {
            "status": "success",
            "source_table": request.source_table,
            "source_column": request.source_column,
            "target_table": request.target_table,
            "target_columns": request.target_columns,
            "total": len(data),
            "data": data,
            "columns": list(result_df.columns)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"匹配失败: {str(e)}")

@app.post("/multi-match")
async def multi_match_data(request: MultiMatchRequest):
    """匹配多个目标表"""
    if request.source_table not in excel_data:
        raise HTTPException(status_code=404, detail=f"源表 '{request.source_table}' 不存在")
    
    source_df = excel_data[request.source_table].copy()
    source_df[request.source_column] = source_df[request.source_column].astype(str).str.strip()
    
    all_multi_value_keys = {}
    
    try:
        for target in request.targets:
            if target.target_table not in excel_data:
                raise HTTPException(status_code=404, detail=f"目标表 '{target.target_table}' 不存在")
            
            target_df = excel_data[target.target_table]
            merge_column = target_df.columns[0]
            
            # 准备目标列
            target_subset = target_df[[merge_column] + target.target_columns].copy()
            target_subset[merge_column] = target_subset[merge_column].astype(str).str.strip()
            
            # 检测多值情况
            target_grouped = target_subset.groupby(merge_column)
            for key, group in target_grouped:
                if len(group) > 1:
                    options = group[target.target_columns].fillna("").to_dict(orient='records')
                    unique_options = []
                    seen = set()
                    for opt in options:
                        opt_tuple = tuple(sorted(opt.items()))
                        if opt_tuple not in seen:
                            seen.add(opt_tuple)
                            unique_options.append(opt)
                    if len(unique_options) > 1:
                        if target.target_table not in all_multi_value_keys:
                            all_multi_value_keys[target.target_table] = {}
                        all_multi_value_keys[target.target_table][key] = unique_options
            
            # 如果有多值且无选择，返回让用户选择
            if all_multi_value_keys and not request.selections:
                return {
                    "status": "need_selection",
                    "multi_value_keys": all_multi_value_keys,
                    "message": f"发现多个匹配项有多个值，请选择"
                }
            
            # 应用用户选择
            if request.selections and target.target_table in request.selections:
                for key, idx in request.selections[target.target_table].items():
                    if target.target_table in all_multi_value_keys and key in all_multi_value_keys[target.target_table]:
                        selected = all_multi_value_keys[target.target_table][key][int(idx)]
                        mask = target_subset[merge_column] == key
                        for col in target.target_columns:
                            target_subset.loc[mask, col] = selected.get(col, "")
            
            # 去重
            target_subset = target_subset.drop_duplicates(subset=[merge_column], keep='first')
            
            # 重命名列避免冲突
            rename_map = {col: f"{col}({target.target_table})" for col in target.target_columns}
            target_subset = target_subset.rename(columns=rename_map)
            
            # 执行左连接
            source_df = source_df.merge(
                target_subset,
                left_on=request.source_column,
                right_on=merge_column,
                how='left',
                suffixes=('', '_dup')
            )
            
            # 删除重复的合并列
            if merge_column in source_df.columns and merge_column != request.source_column:
                source_df = source_df.drop(columns=[merge_column])
        
        data = source_df.fillna("").to_dict(orient='records')
        
        return {
            "status": "success",
            "source_table": request.source_table,
            "source_column": request.source_column,
            "targets": [{"target_table": t.target_table, "target_columns": t.target_columns} for t in request.targets],
            "total": len(data),
            "data": data,
            "columns": list(source_df.columns)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"匹配失败: {str(e)}")

@app.post("/export-excel")
async def export_excel(request: ExportRequest):
    """导出为Excel文件"""
    try:
        df = pd.DataFrame(request.data)
        
        # 按照指定列顺序
        if request.columns:
            df = df[[col for col in request.columns if col in df.columns]]
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='匹配结果')
        
        output.seek(0)
        
        filename = f"{request.filename}.xlsx"
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")

@app.delete("/table/{table_name}")
async def delete_table(table_name: str):
    """删除表"""
    if table_name not in excel_data:
        raise HTTPException(status_code=404, detail="表不存在")
    
    del excel_data[table_name]
    
    # 保存到文件
    save_data()
    
    return {"message": f"表 '{table_name}' 已删除"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
