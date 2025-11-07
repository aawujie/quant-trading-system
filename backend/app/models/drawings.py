"""绘图数据模型"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class DrawingType(str, Enum):
    """绘图类型"""
    TREND_LINE = "trend_line"
    RECTANGLE = "rectangle"
    HORIZONTAL_LINE = "horizontal_line"
    VERTICAL_LINE = "vertical_line"
    FIBONACCI = "fibonacci"


class DrawingPoint(BaseModel):
    """绘图点数据"""
    time: int = Field(..., description="时间戳（秒）")
    price: float = Field(..., description="价格")


class DrawingStyle(BaseModel):
    """绘图样式"""
    color: str = Field("#2962FF", description="颜色")
    lineWidth: int = Field(2, description="线宽")
    lineStyle: str = Field("solid", description="线型：solid/dashed")
    fillOpacity: float = Field(0.1, description="填充透明度（矩形用）")


class DrawingData(BaseModel):
    """
    绘图数据模型
    
    存储用户在图表上绘制的图形
    """
    
    drawing_id: str = Field(..., description="绘图唯一ID")
    symbol: str = Field(..., description="交易对")
    timeframe: str = Field(..., description="时间周期")
    drawing_type: DrawingType = Field(..., description="绘图类型")
    
    # 绘图数据：存储关键点
    points: List[DrawingPoint] = Field(..., description="绘图关键点")
    
    # 样式
    style: DrawingStyle = Field(default_factory=DrawingStyle)
    
    # 元数据
    label: str = Field("", description="标签/备注")
    created_at: int = Field(..., description="创建时间戳")
    
    class Config:
        json_schema_extra = {
            "example": {
                "drawing_id": "drawing_123",
                "symbol": "BTCUSDT",
                "timeframe": "1h",
                "drawing_type": "trend_line",
                "points": [
                    {"time": 1705320000, "price": 42000.0},
                    {"time": 1705330000, "price": 43000.0}
                ],
                "style": {
                    "color": "#2962FF",
                    "lineWidth": 2,
                    "lineStyle": "solid",
                    "fillOpacity": 0.1
                },
                "label": "支撑线",
                "created_at": 1705320000
            }
        }
    
    def __repr__(self) -> str:
        return (
            f"<DrawingData {self.drawing_type.value} {self.symbol} "
            f"@ {self.drawing_id}>"
        )

