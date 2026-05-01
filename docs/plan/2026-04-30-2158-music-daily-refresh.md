# 音乐 App 每日推荐刷新计划

## 用户需求

用户问当前音乐 App 是否每天都一样。确认后发现首页推荐来自首次加载后的缓存榜单：`featuredIds`、`songMap` 被持久化，`fetchFeatured` 在已有 `featuredIds` 时直接返回，导致首页长期不变。用户要求添加相关功能。

## 目标

- 首页推荐每天刷新一次。
- 同一天内保持稳定，不要每次进 App 都重新请求或乱序。
- 跨天后自动后台刷新，并让首页区块内容发生变化。
- 如果当天接口失败，保留旧缓存，不清空首页。

## 关键决策

1. 在音乐数据 store 中新增 `featuredFetchedDate`，格式为本地日期 `YYYY-MM-DD`。
2. `fetchFeatured` 的跳过条件改为：已有内容且 `featuredFetchedDate === today` 时跳过。
3. 当日期变化时重新调用 `fetchFeaturedFromMeting`。
4. 对当天拉到的歌曲做“按日期稳定重排”：同一天顺序固定，不同日期顺序不同，避免接口榜单未变化时首页仍一模一样。
5. 持久化 `featuredFetchedDate`，让刷新逻辑跨 App 重启生效。
6. 保留现有播放队列：如果队列为空或队列正是旧推荐队列，则更新为当天推荐队列；如果用户已经在播放自定义/搜索队列，则不打断。

## 验收标准

- 同一天第二次调用 `fetchFeatured` 不重新请求接口。
- 缓存日期不是今天时会重新请求并更新 `featuredFetchedDate`。
- 同一批歌曲在不同日期产生不同推荐顺序。
- 音乐 UI 测试、音乐数据测试、TypeScript 检查通过。
