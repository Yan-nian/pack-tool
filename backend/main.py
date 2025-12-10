from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
import pandas as pd
import io
import os
from pydantic import BaseModel

app = FastAPI(title="Excel Tool API")

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

class SearchRequest(BaseModel):
    table_name: str
    search_term: str
    search_column: Optional[str] = None

class MatchRequest(BaseModel):
    source_table: str
    source_column: str
    target_table: str
    target_columns: List[str]

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
        target_subset = target_df[[merge_column] + request.target_columns].drop_duplicates()
        
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

@app.delete("/table/{table_name}")
async def delete_table(table_name: str):
    """删除表"""
    if table_name not in excel_data:
        raise HTTPException(status_code=404, detail="表不存在")
    
    del excel_data[table_name]
    return {"message": f"表 '{table_name}' 已删除"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
