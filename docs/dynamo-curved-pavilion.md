# Dynamo 参数化优美曲线建筑方案

**项目名称：** 涟影馆（Ripple Pavilion）— 滨水文化展馆  
**工具链：** Autodesk Dynamo（建议 2.x+）+ Revit / 或 Dynamo Sandbox + 几何预览  
**交付类型：** 文字方案 + 可直接照着搭建的节点逻辑与参数表  
**设计原则：** 少参数、高控制；连续可扫掠曲面；建造友好的分段网格

---

## 1. 概念叙事

### 1.1 场地与意象

建筑落在城市滨水公园一侧，一侧朝向水面，一侧朝向步道与草坪。设计从水面涟漪与驳岸弧线取材：一条主导曲线沿水岸展开，屋顶与墙体由同一组引导线放样生成，形成「涟影」——水纹在建筑表皮上的凝固瞬间。

不追求夸张自由曲面堆叠，而是用 **一条主脊线 + 两组侧缘曲线 + 可控截面** 生成连续壳，保证美学统一与参数可调。

### 1.2 功能布局（示意）

| 区域 | 位置逻辑 | 空间特征 |
| --- | --- | --- |
| 入口门厅 | 背水一侧、曲线最开阔处 | 挑高、通透 |
| 主展厅 | 体量中段 | 缓弧屋顶、柔光带 |
| 多功能厅 / 讲座 | 体量一端收束处 | 相对封闭、声学友好 |
| 咖啡 / 休憩 | 临水一侧 | 落地玻璃、观景廊 |
| 后勤 / 卫生间 | 背水夹层或端部 | 矩形服务核，不参与曲面放样 |

服务核用正交体插入曲面壳内，Dynamo 只负责 **外壳与结构引导线**；内部隔墙可在 Revit 中后建。

### 1.3 美学方向

- **轮廓：** 水平延展的柔和梭形，两端微微抬起或一侧抬起形成眺望姿态  
- **表皮：** 纵向肋条（结构表达）+ 横向分格（面板模数）  
- **光：** 屋顶沿主脊两侧开窄天窗带；临水面大面积透明，背水面实墙与肋条更密  
- **材料意向：** 浅色预制混凝土 / GRC 面板、浅橡木内衬、哑光金属收边；避免高饱和色与过度镜面  
- **动势：** 步行从陆侧进入，视线沿曲线被引向水面；屋顶外轮廓与驳岸线呼应

---

## 2. 几何策略（少参数高控制）

### 2.1 生成逻辑总览

```text
场地基线 (Site Baseline)
    → 主脊线 RidgeCurve（水平投影 + 竖向起伏）
    → 左右侧缘 EdgeL / EdgeR（相对脊线偏移 + 高度差）
    → 截面轮廓 Profile（沿路径变化的高度/宽度）
    → Loft / Sweep 生成壳面 ShellSurface
    → UV 细分 → 结构肋 / 面板分格
    → 底板 / 地坪裁剪 → 可导出实体或自适应族放置点
```

核心思想：**一切优美曲线来自 3 条引导线 + 1 组截面参数**，而不是手工捏数百个控制点。

### 2.2 数学骨架（便于在 Code Block 中实现）

设沿建筑长向参数 \( t \in [0,1] \)：

**平面主轴线（滨水弧）：**

\[
x(t) = L \cdot t, \quad
y(t) = A_y \cdot \sin(\pi t) + B_y \cdot \sin(2\pi t)
\]

- \( L \)：建筑长度  
- \( A_y \)：向水面的主拱偏量（正值朝水）  
- \( B_y \)：二次谐波，打破对称、制造「一波未平」的细微变化（建议 \( |B_y| \ll |A_y| \)）

**脊线高度：**

\[
z_{\mathrm{ridge}}(t) = H_0 + H_amp \cdot \sin(\pi t)^{p}
\]

- \( H_0 \)：最小净高相关的脊高基准  
- \( H_amp \)：中部抬升幅度  
- \( p \)：抬升锐度（\( p>1 \) 更「鼓」在中段，\( p<1 \) 更平缓）

**半宽（左右缘到脊线水平投影距离）：**

\[
w(t) = W_0 + W_amp \cdot \sin(\pi t)^{q}
\]

左右缘点：

\[
P_{L/R}(t) = P_{\mathrm{axis}}(t) \pm w(t)\cdot n(t) + (0,0,z_{\mathrm{edge}}(t))
\]

其中 \( n(t) \) 为平面轴线的单位法向；\( z_{\mathrm{edge}} \) 低于脊线，形成排水坡与剖面表情。

**截面：** 在每个 \( t \) 上用三点（左缘、脊、右缘）做圆弧或二次样条，再 Loft 成壳。三点圆弧最稳、最易建造；需要更「尖」的屋脊时改用样条并加脊线切矢控制。

---

## 3. 参数表（Number Slider 建议）

在 Dynamo 中全部用 **Number Slider**（或输入节点）暴露；名称建议与下表一致，便于协作。

### 3.1 体量主控（一级参数，优先调这些）

| 参数名 | 默认 | 建议范围 | 单位 | 作用 |
| --- | --- | --- | --- | --- |
| `Length` | 48 | 30–80 | m | 建筑长向跨度 \( L \) |
| `WaterAmp` | 6 | 2–12 | m | 平面向水拱度 \( A_y \) |
| `AsymAmp` | 1.2 | 0–3 | m | 二次谐波 \( B_y \)（不对称） |
| `RidgeBase` | 7.5 | 5–12 | m | 脊线基准高 \( H_0 \) |
| `RidgeAmp` | 3.5 | 0–8 | m | 中部抬升 \( H_amp \) |
| `RidgePower` | 1.4 | 0.8–2.5 | — | 抬升锐度 \( p \) |
| `HalfWidthBase` | 8 | 5–14 | m | 半宽基准 \( W_0 \) |
| `HalfWidthAmp` | 4 | 0–8 | m | 中部加宽 \( W_amp \) |
| `WidthPower` | 1.2 | 0.8–2.0 | — | 宽度变化锐度 \( q \) |
| `EdgeDrop` | 2.8 | 1–5 | m | 侧缘相对脊线落差 |

### 3.2 细分与建造（二级参数）

| 参数名 | 默认 | 建议范围 | 作用 |
| --- | --- | --- | --- |
| `U_Count` | 24 | 12–48 | 长向分段（结构肋数量相关） |
| `V_Count` | 10 | 6–20 | 横截面分段（面板环向） |
| `PanelMaxLen` | 1.5 | 0.9–2.4 | 目标面板长边上限（m），用于提示分格 |
| `GlazingRatioWater` | 0.65 | 0.3–0.85 | 临水面开窗比例（后处理标记） |
| `SolidRatioLand` | 0.7 | 0.4–0.9 | 背水面实墙比例 |
| `FloorElevation` | 0.45 | 0.0–1.2 | 室内地坪相对场地（防汛抬高） |
| `ShellThickness` | 0.25 | 0.15–0.45 | 壳厚示意（偏移曲面） |

### 3.3 布尔 / 开口（三级，可后做）

| 参数名 | 默认 | 作用 |
| --- | --- | --- |
| `EntranceWidth` | 4.5 | 陆侧入口切口宽度 |
| `EntranceT` | 0.22 | 入口中心沿 \( t \) 的位置 |
| `SkylightOffset` | 1.2 | 天窗带距脊线的水平偏移 |
| `SkylightWidth` | 0.9 | 天窗带宽度 |

**调参口诀：** 先锁 `Length` / `WaterAmp` / `HalfWidth*` 定平面与体量 → 再调 `Ridge*` 定天际线 → 最后调 `U/V_Count` 与开口。

---

## 4. Dynamo 节点流程（可照着搭）

下列按 **数据流顺序** 分组。节点名以 Dynamo 常见库为准（Core + Geometry）；若使用 LunchBox / Springs 等包，等价替换即可。

### 4.1 输入组

1. 放置全部 Number Slider（见第 3 节），整理到同一组并命名。  
2. `Code Block` 或 `Range` 生成参数序列：

```
n = U_Count;
t = 0..1..#n;
```

### 4.2 平面轴线与法向

**Code Block 示例（可直接粘贴，把滑块接到同名输入）：**

```
x = Length * t;
y = WaterAmp * Math.Sin(Math.PI * t)
    + AsymAmp * Math.Sin(2 * Math.PI * t);
pts = Point.ByCoordinates(x, y, 0);
axis = NurbsCurve.ByPoints(pts);
```

- 用 `Curve.CoordinateSystemAtParameter` 或相邻点差分得到切向，再叉乘世界 Z 得到水平法向 `n`。  
- 更稳妥：对每个 \( t \) 用解析导数近似：

```
// 切向近似
dx = Length;
dy = WaterAmp * Math.PI * Math.Cos(Math.PI * t)
   + AsymAmp * 2 * Math.PI * Math.Cos(2 * Math.PI * t);
// 水平单位法向（向水侧取 + 或 -，按场地约定）
len = Math.Sqrt(dx * dx + dy * dy);
nx = -dy / len;
ny = dx / len;
```

### 4.3 脊线与左右缘

```
zR = RidgeBase + RidgeAmp * Math.Pow(Math.Sin(Math.PI * t), RidgePower);
zE = zR - EdgeDrop;
w  = HalfWidthBase + HalfWidthAmp * Math.Pow(Math.Sin(Math.PI * t), WidthPower);

ridgePts = Point.ByCoordinates(x, y, zR);
leftPts  = Point.ByCoordinates(x + nx * w, y + ny * w, zE);
rightPts = Point.ByCoordinates(x - nx * w, y - ny * w, zE);

ridge = NurbsCurve.ByPoints(ridgePts);
edgeL = NurbsCurve.ByPoints(leftPts);
edgeR = NurbsCurve.ByPoints(rightPts);
```

### 4.4 截面曲线与放样

对每个 \( t_i \)：

1. 取三点 `leftPts[i]`, `ridgePts[i]`, `rightPts[i]`。  
2. `Arc.ByThreePoints` **或** `NurbsCurve.ByPoints`（三点）生成截面曲线 `profiles[i]`。  
3. `Surface.ByLoft(profiles)` 得到壳面 `shell`。

**注意：**

- 所有剖面朝向需一致（可用 `Curve.NormalAtParameter` / 坐标系对齐），避免 Loft 扭转。  
- 若出现自交：减小 `WaterAmp` 或增大 `HalfWidthBase`。  
- 若中部过尖：增大 `RidgePower` 的同时检查 `EdgeDrop`，或改三点圆弧为带权重的样条。

### 4.5 UV 网格、结构肋、面板

1. `Surface.PointAtParameter(shell, u, v)` 双层 `Range` 生成点阵。  
2. 沿 U（长向）连接点 → 结构肋曲线；沿 V → 环向分格线。  
3. `Surface.Thicken(shell, ShellThickness)` 或法向偏移得到实体示意。  
4. 可选：`AdaptiveComponent.ByPoints`（Revit）把肋截面族放到每条肋的控制点上。

**面板友好性检查（Code Block 思路）：**

- 计算相邻 UV 点弦长，统计超过 `PanelMaxLen` 的比例；若过高，增大 `U_Count`/`V_Count` 或减小曲率参数（`WaterAmp` / `RidgeAmp`）。

### 4.6 地坪、入口与天窗（布尔示意）

1. 用地轴投影曲线 `axis` 做 `Curve.Offset` 得到地坪轮廓，`Surface.ByPatch` + 拉伸到 `FloorElevation`。  
2. 入口：在 `EntranceT` 处取陆侧（背水法向）放一个方体切割体，`Solid.Difference`。  
3. 天窗：在脊线两侧偏移 `SkylightOffset`，沿 U 扫出薄实体再从壳上减去，或仅生成洞口环线供幕墙系统使用。

初学阶段可 **先完成 4.1–4.5**，开口用 Revit 墙洞后开，Dynamo 专注优美壳面。

### 4.7 输出与文档化

| 输出 | 节点建议 | 用途 |
| --- | --- | --- |
| 壳面 / 实体 | `Watch` + `Export` / 直接进 Revit | 体量推敲 |
| 三条引导线 | 成组显示不同颜色 | 设计沟通 |
| UV 网格 | 线条着色 | 结构与幕墙分工 |
| 参数快照 | `String` 拼接当前滑块值 | 方案比选记录 |
| SAT / DWG | Dynamo 导出或 Revit 导出 | 给结构 / 加工方 |

---

## 5. 推荐工作流（从零到一）

| 步骤 | 动作 | 完成标准 |
| --- | --- | --- |
| 1 | 只建平面轴 + 脊/缘点，不 Loft | 平面梭形与滨水关系正确 |
| 2 | Loft 出单层面 | 无翻面、无自交，侧视天际线舒服 |
| 3 | 接入全部一级滑块，存 3 组「瘦长 / 标准 / 鼓胀」预设 | 参数有效且互不打架 |
| 4 | UV 分格 + 厚度 | 面板尺度接近 `PanelMaxLen` |
| 5 | 地坪抬高 + 入口切割 | 流线与防汛成立 |
| 6 | （可选）Revit 自适应族铺肋、幕墙系统 | 进入扩初深度 |

**预设参考值**

- **瘦长临水：** `Length=60`, `WaterAmp=4`, `HalfWidthBase=6`, `RidgeAmp=2.5`  
- **标准涟影（默认）：** 见第 3.1 表  
- **鼓胀展厅：** `Length=42`, `WaterAmp=8`, `HalfWidthAmp=6`, `RidgeAmp=5`, `RidgePower=1.8`

---

## 6. 结构与建造提示（保持曲线可落地）

1. **主结构：** 沿 U 向木/钢肋或胶合木拱，肋距约 `Length/(U_Count-1)`；控制在 1.5–3.0 m 较易施工。  
2. **次结构：** V 向檩条或环梁，承接面板。  
3. **面板：** 优先单向曲率近似（直纹条带）；若 Loft 后高斯曲率变化大，用较小面板或冷弯金属。  
4. **排水：** `EdgeDrop` 保证脊到缘的落差；天沟可沿左右缘内侧。  
5. **服务核：** 在 Dynamo 外壳内用正交盒占位，避免强行扭曲管道空间。  
6. **防汛：** `FloorElevation` 按场地五十年一遇水位加安全余量校核（本方案仅几何抬高）。

---

## 7. 评价标准（什么叫「优美」）

在本方案中，「优美」可操作化为：

1. **连续：** 单次 Loft、无明显折点（除非刻意的入口切开）。  
2. **克制：** 只用 1 个主拱 + 1 个弱谐波，不做随机噪声曲面。  
3. **比例：** 长宽比约 2.5:1–4:1；中部高度约为半宽的 0.7–1.1 倍。  
4. **光影：** 脊侧天窗带 + 临水透明，白天室内有柔和梯度。  
5. **可建：** UV 网格尺度落在常用板材模数内。

---

## 8. 文件与扩展

| 项 | 建议 |
| --- | --- |
| Dynamo 文件名 | `RipplePavilion_Shell_v01.dyn` |
| 版本记录 | 每次改默认参数升 v01 / v02，并在图内写参数快照 |
| 扩展 A | 用 `Surface.DerivativesAtParameter` 做曲率热力图，指导分格加密 |
| 扩展 B | 把 `WaterAmp` 与真实驳岸 DWG 曲线做 `Curve.Approximate` 拟合，轴改「场地驱动」 |
| 扩展 C | 日照：将壳面法向与太阳向量点积，染色临水分格的遮阳深度 |

---

## 9. 节点组清单（搭图时的组名）

按此分组，图面清晰、便于交接：

1. `00_Inputs` — 全部滑块  
2. `01_Axis` — \( t \)、平面轴、法向  
3. `02_Guides` — 脊线 / 左缘 / 右缘  
4. `03_LoftShell` — 截面与放样  
5. `04_GridStructure` — UV、肋、厚度  
6. `05_OpeningsFloor` — 地坪、入口、天窗  
7. `06_Output` — 导出、参数字符串、预览样式

---

## 10. 小结

**涟影馆** 用 Dynamo 将滨水文化展馆收敛为「三引导线 + 可变截面 Loft」的参数化壳：一级滑块塑造平面涟漪与天际线，二级滑块对接结构分格与面板模数，三级开口服务功能。先调少而准的曲线参数，再谈表皮与布尔，即可在可控前提下得到连续、克制而可建造的优美曲线建筑。
