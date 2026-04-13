# 信语聊天支持发送本地图片

**日期**: 2026-04-12

## 用户需求
信语(XingYu)的图片发送功能目前只支持从 APP 内置相册(`MOCK_GALLERY_IMAGES`)选图。
用户希望也能从本地设备选择图片进行发送。

## 关键决策

1. **入口位置**: 在 ImagePicker 网格的第一个位置放置一个"+"按钮，点击触发 `<input type="file">`
2. **文件处理**: 使用 `FileReader.readAsDataURL()` 将本地图片转为 data URL，与现有 `sendImageMessage` 流程兼容（已支持 data URL，画板功能就是这样做的）
3. **图片压缩**: 使用 Canvas 对大图进行压缩（最大 1200px 宽/高，JPEG 质量 0.8），避免 data URL 过大导致性能问题
4. **文件类型限制**: `accept="image/*"` 限制只能选图片
5. **图标**: 使用 lucide-react 的 `Plus` 图标
