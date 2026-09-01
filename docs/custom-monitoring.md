# 自定义监控规划

## 当前版本边界

当前 Dashboard 通过 Node 同源 WebSocket gateway 采集 Screeps 官方通用 WebSocket `cpu` 频道中的 CPU 使用值，并在浏览器内存中保留最近 15 分钟的折线数据。Token 由服务端 Docker Secret 注入，不会传给浏览器。

本版本不接入 CPU Bucket：

- 不订阅未经实际验证的 `bucket` 或 `cpubucket` 频道。
- 不读取某个 Bot 的 Memory 结构。
- 不执行 Console 命令作为后台采集手段。
- 不把缺失的 Bucket 数据显示为 `0`。

## 后期目标

后续增加“自定义监控”能力，让数据源和指标定义独立于 Dashboard 内置字段。目标是支持：

- 用户选择数据源类型。
- 用户配置指标名称、单位、取值路径和图表颜色。
- 统一接入时间序列采样、保留策略和图表展示。
- 明确展示数据源不可用、权限不足和数据延迟状态。

## 可能的数据源适配器

### Screeps WebSocket

适合 CPU、Memory 等官方实时频道已经明确提供的指标。适配器必须基于实际抓到的事件结构定义字段，禁止根据名称猜测字段。

### Bot 主动上报

由 Bot 按约定向独立采集入口上报数据。Dashboard 不解析特定 Bot 的 Memory，也不绑定 `hivemind` 等项目结构。

建议协议包含：

```json
{
  "timestamp": 0,
  "metrics": {
    "cpuBucket": 0
  }
}
```

认证、来源服务器和账号范围需要在服务端校验。

### 私服服务端适配器

对于自托管 Screeps 私服，可以增加服务端适配器读取私服明确提供的运行指标。该能力必须由 `SCREEPS_ALLOWED_ORIGINS` 和显式配置控制，不能扩大为任意目标代理。

## 建议架构

```text
数据源适配器
  -> 标准化 MetricSample
  -> 浏览器采样缓冲区
  -> 通用折线图
```

标准化类型可以设计为：

```ts
interface MetricSample {
  metricId: string;
  timestamp: number;
  value: number;
  source: string;
  unit?: string;
}
```

之后再增加：

- 指标注册表。
- 数据源健康状态。
- 每指标采样周期。
- 最大样本数和时间窗口。
- 多曲线叠加与单位转换。
- 导出 CSV / JSON。

## 实施顺序

1. 先抽象通用 `MetricSample` 和数据源适配器接口。
2. 用当前官方 CPU WebSocket 作为第一个适配器。
3. 增加用户可配置的自定义上报 HTTP / WebSocket 协议。
4. 增加指标配置 UI 和数据源状态面板。
5. 最后再接入 CPU Bucket 等需要 Bot 或私服配合的数据。
