# WeCom Bot WebChat — 设计方案文档

> 版本：v2.0（WebSocket 长连接方案）  
> 最后更新：2026-07-03  
> 项目仓库：https://github.com/wutao667/wecom-bot-webchat

---

## 目录

1. [项目概述](#1-项目概述)
2. [需求分析](#2-需求分析)
3. [技术选型与理由](#3-技术选型与理由)
4. [系统架构](#4-系统架构)
5. [企业微信智能机器人 WebSocket 协议](#5-企业微信智能机器人-websocket-协议)
6. [数据库设计](#6-数据库设计)
7. [API 接口设计](#7-api-接口设计)
8. [WebSocket 实时通信设计](#8-websocket-实时通信设计)
9. [前端页面结构](#9-前端页面结构)
10. [项目目录结构](#10-项目目录结构)
11. [部署方案](#11-部署方案)
12. [开发计划与里程碑](#12-开发计划与里程碑)
13. [风险与应对措施](#13-风险与应对措施)

---

## 1. 项目概述

### 1.1 项目名称

**WeCom Bot WebChat** — 企业微信智能机器人网页版聊天工具

### 1.2 项目目标

构建一个 Web 应用，支持用户绑定企业微信智能机器人（Smart Bot），通过 **WebSocket 长连接** 实现网页端与企业微信用户之间的双向实时消息通信。对标 OpenClaw 中企业微信 bot 的绑定方式（botId + secret）。

### 1.3 核心理念

与传统的"自建应用（Agent）+ URL 回调"方案不同，本项目采用**智能机器人 + WebSocket 长连接**方案：

- 配置极简：只需 **botId + secret** 两个参数（与 OpenClaw 一致）
- 无需暴露公网回调 URL
- 无需处理 AES 加解密、XML 解析、签名验证
- 一条 WebSocket 连接即可完成收发双向通信
- 企业微信官方 SDK 处理连接管理、心跳保活、自动重连

### 1.4 核心价值

| 场景 | 说明 |
|------|------|
| 客服系统 | 在网页端接收和回复企业微信客户消息 |
| 运维告警 | 通过 Bot 向指定用户发送告警通知 |
| 个人助理 | 在浏览器中管理企业微信消息，无需频繁切换设备 |
| 自动化交互 | 为 Bot 接入 AI 能力，实现智能对话 |

---

## 2. 需求分析

### 2.1 功能需求

#### 2.1.1 Bot 管理

| 编号 | 功能 | 优先级 | 说明 |
|------|------|--------|------|
| F-01 | 添加 Bot | P0 | 输入 **botId + secret**（与 OpenClaw 配置一致） |
| F-02 | 验证 Bot 联通性 | P0 | 通过 WebSocket 连接测试确认配置正确 |
| F-03 | 测试发送消息 | P1 | 添加成功后向测试用户发一条确认消息 |
| F-04 | 编辑 Bot | P1 | 修改已绑定的 Bot 配置 |
| F-05 | 删除 Bot | P1 | 解除 Bot 绑定 |
| F-06 | 查看 Bot 列表 | P0 | 所有已绑定 Bot 的概览（在线/离线状态） |

#### 2.1.2 消息收发

| 编号 | 功能 | 优先级 | 说明 |
|------|------|--------|------|
| F-07 | 发送文本/Markdown 消息 | P0 | 向指定企业微信用户发送消息 |
| F-08 | 发送图片消息 | P1 | 支持上传图片并发送 |
| F-09 | 发送文件消息 | P2 | 支持上传文件并发送 |
| F-10 | 接收消息推送 | P0 | 实时接收用户发来的消息（WebSocket 回调） |
| F-11 | 消息记录查询 | P0 | 查看历史消息记录 |
| F-12 | 消息实时推送 | P0 | 通过 socket.io 推送到前端浏览器 |
| F-13 | 回复消息 | P0 | 在网页回复用户消息 |
| F-14 | 流式回复 | P1 | 支持流式（类打字）回复效果 |

#### 2.1.3 用户与认证

| 编号 | 功能 | 优先级 | 说明 |
|------|------|--------|------|
| F-15 | 用户注册 | P0 | 用户名 + 密码注册 |
| F-16 | 用户登录 | P0 | JWT 认证 |
| F-17 | 用户注销 | P1 | 退出登录 |

#### 2.1.4 联系人

| 编号 | 功能 | 优先级 | 说明 |
|------|------|--------|------|
| F-18 | 最近会话 | P1 | 最近有消息来往的用户列表 |

> 注意：智能机器人模式下，只能与**主动给机器人发过消息的用户**通信。无法像自建应用那样通过 API 拉取全量通讯录。联系人列表来自历史消息中出现的用户。

### 2.2 非功能需求

| 编号 | 需求 | 指标 |
|------|------|------|
| N-01 | 并发连接 | 支持 100+ WebSocket 并发 |
| N-02 | 消息延迟 | 端到端延迟 < 2 秒 |
| N-03 | 数据持久化 | SQLite 存储，定期备份 |
| N-04 | 安全性 | 加密传输（TLS），密码哈希存储 |
| N-05 | 可维护性 | 日志记录，错误追踪 |

---

## 3. 技术选型与理由

### 3.1 技术选型一览

| 层级 | 技术 | 版本 | 理由 |
|------|------|------|------|
| **后端框架** | Express | 4.x | Node.js 生态最成熟的 Web 框架 |
| **运行时** | Node.js | v24.15 | 服务器已有，无需额外安装 |
| **前端框架** | React | 19.x | 组件化开发，生态成熟 |
| **UI 组件库** | Ant Design | 5.x | 企业级 UI 规范，聊天场景组件丰富 |
| **构建工具** | Vite | 6.x | 极速 HMR，开箱即用的 React + TS 支持 |
| **数据库** | SQLite (better-sqlite3) | 11.x | 零配置单文件，适合中小规模部署 |
| **网页 WebSocket** | socket.io | 4.x | 自动降级、房间管理、ACK 机制 |
| **企微 SDK** | **@wecom/aibot-node-sdk** | 1.0.7 | **企业微信智能机器人官方 SDK，WebSocket 长连接** |
| **反向代理** | Caddy | 2.11.3 | 自动 TLS、配置简洁、服务器已安装 |
| **进程管理** | systemd | 系统自带 | Ubuntu 原生，自动重启、日志管理 |

### 3.2 SDK 选择说明

本项目不使用传统的 `wechat-enterprise`（自建应用 SDK），而是使用 `@wecom/aibot-node-sdk`（智能机器人 SDK）。

**`@wecom/aibot-node-sdk` 核心能力：**

| 能力 | 说明 |
|------|------|
| WebSocket 长连接 | 连接到 `wss://openws.work.weixin.qq.com`，全双工通信 |
| 自动认证 | 连接建立后自动发送认证帧（botId + secret） |
| 心跳保活 | 默认 30 秒心跳，自动维持连接 |
| 自动重连 | 指数退避重连，最大重连次数可配 |
| 消息收发 | 事件驱动：`message.text`、`message.image` 等 |
| 主动推送 | `sendMessage(chatid, body)` 主动向用户发消息 |
| 流式回复 | `replyStream()` 支持打字机效果 |
| 媒体上传/下载 | 分片上传临时素材，AES 解密文件下载 |

### 3.3 方案对比：自建应用 vs 智能机器人

| 维度 | 自建应用（Agent）+ URL 回调 | ✅ 智能机器人 + WebSocket 长连接 |
|------|---------------------------|--------------------------------|
| SDK | `wechat-enterprise` | `@wecom/aibot-node-sdk` |
| 配置参数 | corpid + agentid + secret + token + encodingAESKey（5 个） | **botId + secret（2 个）** |
| 连接方式 | 需要公网 HTTPS 端口暴露回调 URL | **WebSocket 主动连接企微，不暴露端口** |
| 消息加密 | AES-256-CBC + PKCS7 + XML（复杂） | **SDK 内部处理，开发者零感知** |
| 双向通信 | 回调收消息 + API 发消息（两套机制） | **一条 WebSocket 全搞定** |
| Token 管理 | 需要自行管理 access_token（7200s 过期） | **SDK 自动管理** |
| 通讯录 | 可通过 API 拉取全量通讯录 | **只能与主动发过消息的用户通信** |
| 适用于本项目 | ✔️ 复杂但通用 | ✅ **简单、现代、推荐** |

---

## 4. 系统架构

### 4.1 总体架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                         Internet                                  │
└────────────────────┬──────────────────────────┬──────────────────┘
                     │                          │
                     ▼                          ▼
             ┌───────────────┐         ┌───────────────┐
             │ User Browser  │         │  WeChat Work  │
             │ (React SPA)   │         │  (企业微信)     │
             └───────┬───────┘         └───────┬───────┘
                     │                         │
                     │ HTTPS/WSS               │ WebSocket
                     ▼                         ▼
             ┌──────────────────────────────────────────────────────┐
             │                Caddy Reverse Proxy                    │
             │            (自动 TLS · 路径路由 · WSS 代理)            │
             └──────────────────────┬───────────────────────────────┘
                                    │
                                    ▼
             ┌──────────────────────────────────────────────────────┐
             │               Node.js Express Server                  │
             │                                                       │
             │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐   │
             │  │ REST API │  │socket.io │  │  WSClient         │   │
             │  │  Router  │  │  Server  │  │  (aibot-node-sdk) │   │
             │  └────┬─────┘  └────┬─────┘  └────────┬──────────┘   │
             │       │             │                   │              │
             │       ▼             ▼                   │              │
             │  ┌──────────────────────────────────┐   │              │
             │  │        Service Layer              │   │              │
             │  │  ┌──────────┐ ┌────────────────┐ │   │              │
             │  │  │BotManager │ │  MsgService   │ │   │              │
             │  │  └──────────┘ └───────┬────────┘ │   │              │
             │  └───────────────────────┼──────────┘   │              │
             │                          │              │              │
             │                          ▼              ▼              │
             │  ┌──────────────────────────────────────────────────┐  │
             │  │                SQLite Database                    │  │
             │  │        (bots · messages · users)                 │  │
             │  └──────────────────────────────────────────────────┘  │
             └────────────────────────────────────────────────────────┘

                    ◄──── WebSocket (wss://openws.work.weixin.qq.com) ────► 企业微信
```

### 4.2 消息流

```
▼ 发送消息（网页 → 企微用户）

[浏览器] ── socket.io ──→ [MsgService] ── wsClient.sendMessage(chatid, body) ──→ [企微用户]

▼ 接收消息（企微用户 → 网页）

[企微用户发消息] ── WebSocket ──→ [WSClient]
                                      │
                                      ├─→ 事件 'message.text'
                                      ├─→ 解析消息体
                                      ├─→ 存入 SQLite
                                      └─→ socket.io 推送 → [浏览器]
```

### 4.3 进程模型

```
┌────────────────────────────────────────────────────────┐
│                Node.js 单进程                           │
│                                                         │
│  Main Thread (Event Loop)                               │
│  ┌───────────────────────────────────────────────┐     │
│  │  Express HTTP Server (端口 3001)               │     │
│  │  socket.io Server (挂载在 HTTP Server 上)       │     │
│  │  WSClient × N (每个 Bot 一条 WebSocket 长连接)  │     │
│  │     ├─ 自动认证                                  │     │
│  │     ├─ 30s 心跳保活                              │     │
│  │     ├─ 指数退避自动重连                          │     │
│  │     └─ 消息事件分发                              │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  Worker Threads (better-sqlite3 同步查询)               │
│  └── SQLite 查询 (同步但不阻塞事件循环)                 │
└────────────────────────────────────────────────────────┘
```

---

## 5. 企业微信智能机器人 WebSocket 协议

### 5.1 SDK 使用方式

本项目使用 `@wecom/aibot-node-sdk`（v1.0.7）作为与企业微信通信的核心组件。

```typescript
import { WSClient } from '@wecom/aibot-node-sdk';

// 1. 创建客户端（极简配置）
const wsClient = new WSClient({
  botId: 'aibxxxxxxxxxxxxxxxxx',   // 企微后台获取
  secret: 'your-bot-secret',       // 企微后台获取
});

// 2. 建立 WebSocket 长连接（SDK 自动管理心跳和重连）
wsClient.connect();

// 3. 监听消息
wsClient.on('message.text', (frame) => {
  const { msgid, aibotid, chatid, chattype, from, text, msgtype } = frame.body;
  console.log(`收到消息: from=${from.userid}, content=${text.content}`);
});

// 4. 主动发送消息（主动推送，无需等待回调）
await wsClient.sendMessage('userid_or_chatid', {
  msgtype: 'markdown',
  markdown: { content: '这是一条**主动推送**的消息' },
});

// 5. 回复消息（回复某条收到的消息）
await wsClient.reply(receivedFrame, {
  msgtype: 'stream',
  stream: {
    id: 'stream-001',
    content: '回复内容（支持 Markdown）',
    finish: true,
  },
});
```

### 5.2 WebSocket 帧协议

SDK 底层使用统一的 JSON 帧格式进行 WebSocket 通信：

| 方向 | cmd | 说明 |
|------|-----|------|
| 客户端 → 服务端 | `aibot_subscribe` | 认证订阅（携带 botId + secret） |
| 服务端 → 客户端 | `aibot_msg_callback` | 消息推送回调 |
| 服务端 → 客户端 | `aibot_event_callback` | 事件推送回调 |
| 客户端 → 服务端 | `aibot_respond_msg` | 回复消息 |
| 客户端 → 服务端 | `aibot_send_msg` | 主动发送消息 |
| 客户端 → 服务端 | `ping` | 心跳 |

### 5.3 消息类型

SDK 支持的消息类型：

| 类型 | SDK 事件 | 说明 |
|------|----------|------|
| 文本 | `message.text` | 用户发送的文本消息 |
| 图片 | `message.image` | 用户发送的图片 |
| 图文混排 | `message.mixed` | 文本+图片组合 |
| 语音 | `message.voice` | 语音消息（已转文字） |
| 文件 | `message.file` | 文件消息 |
| 视频 | `message.video` | 视频消息 |

### 5.4 事件类型

| 事件 | SDK 事件 | 说明 |
|------|----------|------|
| 进入会话 | `event.enter_chat` | 用户首次进入机器人单聊 |
| 模板卡片点击 | `event.template_card_event` | 用户点击模板卡片按钮 |
| 用户反馈 | `event.feedback_event` | 用户对回复进行反馈 |

### 5.5 与自建应用回调的关键差异

```
自建应用 (Agent) 回调:
  企微 ──HTTP POST XML(AES加密)──→ 你的回调URL
  你  ──HTTP GET access_token──→ 企微API
  你  ──HTTP POST message──→ 企微API
  需要: 公网暴露 + AES加解密 + Token管理 + XML解析

智能机器人 (AI Bot) WebSocket:
  企微 ◄═══════ WebSocket (全双工) ═══════► 你
  连接建立后自动双向通信
  需要: 无公网暴露 + 零加解密 + 零Token管理 + JSON帧
```

---

## 6. 数据库设计

### 6.1 ER 图

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│   users     │       │     bots        │       │  messages   │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id (PK)     │◄──────│ user_id (FK)    │       │ id (PK)     │
│ username    │       │ id (PK)         │◄──────│ bot_id (FK) │
│ password_ha │       │ name            │       │ direction   │
│ created_at  │       │ bot_id          │       │ msg_type    │
└─────────────┘       │ secret          │       │ content     │
                      │ status          │       │ from_user   │
                      │ created_at      │       │ to_user     │
                      └─────────────────┘       │ msg_id      │
                                                 │ created_at  │
                                                 │ wx_msg_id   │
                                                 └─────────────┘
```

### 6.2 建表 SQL

```sql
-- 启用 WAL 模式提升并发性能
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL CHECK(length(username) >= 3),
    password_hash TEXT    NOT NULL,
    display_name  TEXT    DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Bot 配置表
-- 仅需 botId + secret，与 OpenClaw 配置一致
CREATE TABLE IF NOT EXISTS bots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    bot_id        TEXT    NOT NULL,              -- 企微智能机器人 BotID（以 aib 开头）
    secret        TEXT    NOT NULL,              -- 机器人 Secret
    status        TEXT    DEFAULT 'disconnected' CHECK(status IN ('connected','disconnected','error')),
    last_error    TEXT    DEFAULT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bots_user_id ON bots(user_id);

-- 消息记录表
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id      INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    direction   TEXT    NOT NULL CHECK(direction IN ('outgoing','incoming')),
    msg_type    TEXT    NOT NULL CHECK(msg_type IN ('text','markdown','image','file','voice','video','mixed')),
    content     TEXT    NOT NULL,                -- 消息内容/描述
    from_user   TEXT    NOT NULL,                -- 发送方 userid
    to_user     TEXT    NOT NULL DEFAULT '',     -- 接收方 userid（incoming 时可能为空）
    msg_id      TEXT    DEFAULT NULL,            -- 本地消息 ID
    wx_msg_id   TEXT    DEFAULT NULL,            -- 企业微信消息 ID（用于排重）
    status      TEXT    DEFAULT 'sent' CHECK(status IN ('sending','sent','delivered','failed','read')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_messages_bot_id  ON messages(bot_id);
CREATE INDEX idx_messages_created ON messages(bot_id, created_at DESC);
CREATE UNIQUE INDEX idx_messages_wx_msg_id ON messages(wx_msg_id) WHERE wx_msg_id IS NOT NULL;
```

---

## 7. API 接口设计

### 7.1 认证接口

#### POST /api/auth/register — 注册

```
Request:
  POST /api/auth/register
  Content-Type: application/json
  { "username": "alice", "password": "***" }

Response 201:
  { "success": true, "data": { "id": 1, "username": "alice", "created_at": "..." } }
```

#### POST /api/auth/login — 登录

```
Request:
  POST /api/auth/login
  Content-Type: application/json
  { "username": "alice", "password": "***" }

Response 200:
  { "success": true, "data": { "token": "eyJ...", "user": { "id": 1, "username": "alice" } } }
```

### 7.2 Bot 管理接口

> 所有 Bot 管理接口需在 Header 中携带 `Authorization: Bearer <token>`。

#### GET /api/bots — 获取 Bot 列表

```
Response 200:
  { "success": true, "data": [
    { "id": 1, "name": "客服机器人", "bot_id": "aibxxx...", "status": "connected", "created_at": "..." }
  ]}
```

#### POST /api/bots — 创建 Bot

```
Request:
  { "name": "客服机器人", "bot_id": "aibxxxxxxxxx", "secret": "xxx" }

Response 201:
  { "success": true, "data": { "id": 1, "name": "客服机器人", "status": "disconnected", ... } }

创建成功后，服务端会自动使用 bot_id + secret 建立 WebSocket 长连接。
```

#### PUT /api/bots/:id — 更新 Bot

```
Request:
  { "name": "客服机器人 v2", "secret": "new-secret" }

Response 200:
  { "success": true, "data": { ... } }
```

#### DELETE /api/bots/:id — 删除 Bot

```
Response 200:
  { "success": true }

删除时自动断开 WebSocket 连接并清理消息记录。
```

### 7.3 消息接口

#### POST /api/bots/:id/send — 发送消息

```
Request:
  {
    "to_user": "zhangsan",          // 企业微信 userid
    "msg_type": "markdown",         // text | markdown
    "content": "**你好**，这是一条测试消息"
  }

Response 200:
  { "success": true, "data": { "message_id": 100, "status": "sent" } }
```

后端调用 `wsClient.sendMessage(to_user, { msgtype, body })` 发送。

#### GET /api/bots/:id/messages — 消息记录

```
Query:
  ?contact=zhangsan&page=1&page_size=20

Response 200:
  { "success": true, "data": {
    "total": 50, "page": 1, "page_size": 20,
    "items": [
      { "id": 100, "direction": "incoming", "msg_type": "text",
        "content": "你好", "from_user": "zhangsan",
        "created_at": "2026-07-03T10:00:00Z" }
    ]
  }}
```

#### GET /api/bots/:id/contacts — 最近联系人

```
Response 200:
  { "success": true, "data": [
    { "userid": "zhangsan", "name": "张三", "last_message": "...", "unread_count": 3 }
  ]}
```

联系人来自历史消息中 `from_user` 的去重，按最后消息时间倒序。

### 7.4 统一响应格式

```typescript
// 成功
interface ApiSuccess<T> { success: true; data: T; }
// 失败
interface ApiError { success: false; error: string; code?: string; }
// 分页
interface PaginatedData<T> { total: number; page: number; page_size: number; items: T[]; }
```

HTTP 状态码：200（成功）、201（创建成功）、400（参数错误）、401（未认证）、404（不存在）、500（服务器错误）

---

## 8. WebSocket 实时通信设计

### 8.1 两层 WebSocket 架构

本项目涉及**两层 WebSocket**，职责分离：

```
┌──────────────────────────────────────────────────────────────┐
│                         Node.js Server                        │
│                                                               │
│  第一层：企微长连接                    第二层：网页实时推送    │
│  ┌─────────────────────┐            ┌────────────────────┐    │
│  │ WSClient (aibot)    │            │ socket.io Server   │    │
│  │ ←→ 企微 WebSocket  │            │ ←→ 浏览器 WSS     │    │
│  │ 网关                │            │                     │    │
│  │ wss://openws.work   │            │ 浏览器 connected    │    │
│  │ .weixin.qq.com      │            │                     │    │
│  └──────────┬──────────┘            └──────────┬──────────┘    │
│             │                                   │              │
│             └──────────────┬────────────────────┘              │
│                            ▼                                   │
│                     ┌──────────────┐                           │
│                     │  MsgService  │                           │
│                     │  转发+持久化  │                           │
│                     └──────────────┘                           │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 第一层：企微长连接（WSClient）

```
每个 Bot 建立一条独立 WebSocket 连接到企微网关

Bot 1: WSClient({ botId: "aibxxx1", secret: "***" })
  ├── connect() → wss://openws.work.weixin.qq.com
  ├── on('message.text') → handle text messages
  ├── on('event.enter_chat') → handle enter chat events
  ├── sendMessage(chatid, body) → push messages proactively
  └── disconnect() → close connection

Bot 2: WSClient({ botId: "aibxxx2", secret: "***" })
  └── ... (same structure)
```

### 8.3 第二层：网页实时推送（socket.io）

#### 连接认证

```javascript
// 服务端：socket.io 中间件认证
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});
```

#### 事件定义

| 事件 | 方向 | 说明 |
|------|------|------|
| `join_bot` | 客户端 → 服务端 | 加入 Bot 房间 |
| `leave_bot` | 客户端 → 服务端 | 离开 Bot 房间 |
| `send_message` | 客户端 → 服务端 | 发送消息请求 |
| `new_message` | 服务端 → 客户端 | 新消息推送 |
| `bot_status` | 服务端 → 客户端 | Bot 连接状态变化 |
| `mark_read` | 客户端 → 服务端 | 标记已读 |

### 8.4 端到端消息流程

```
┌───────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 浏览器  │    │socket.io │    │MsgService│    │ WSClient │    │ 企微
├───────┤    ├──────────┤    ├──────────┤    ├──────────┤    ├──────────┤
    │ 发送消息           │            │            │            │
    │─send_message────►  │            │            │            │
    │                   │─send──────► │            │            │
    │                   │            │─wsClient.  │            │
    │                   │            │ sendMsg()─► │─WS Frame──►│
    │                   │            │            │◄──ACK───── │
    │◄─message_status───│◄────── ok ─│            │            │
    │                   │            │            │            │
    │ 接收消息           │            │            │            │
    │                   │            │            │◄─WS Frame──│
    │                   │            │◄─emit──── │            │
    │                   │            │─持久化入库  │            │
    │◄─new_message─────│◄─push───── │            │            │
    │                   │            │            │            │
```

### 8.5 WSClient 连接管理

```javascript
class BotConnectionPool {
  // Bot ID → WSClient 映射
  private clients = new Map();

  async connect(bot) {
    const wsClient = new WSClient({ botId: bot.bot_id, secret: bot.secret });

    wsClient.on('connected', () => {
      console.log(`Bot ${bot.id} 已连接`);
      this.updateStatus(bot.id, 'connected');
      this.pushBotStatus(bot.id, 'connected');
    });

    wsClient.on('authenticated', () => {
      console.log(`Bot ${bot.id} 认证成功`);
    });

    wsClient.on('disconnected', (reason) => {
      console.log(`Bot ${bot.id} 断开: ${reason}`);
      this.updateStatus(bot.id, 'disconnected');
      this.pushBotStatus(bot.id, 'disconnected');
    });

    wsClient.on('error', (error) => {
      console.error(`Bot ${bot.id} 错误:`, error);
    });

    wsClient.on('message.text', (frame) => {
      this.handleMessage(bot.id, frame);
    });

    wsClient.on('event.enter_chat', (frame) => {
      console.log(`用户 ${frame.body.from.userid} 进入会话`);
    });

    wsClient.connect();
    this.clients.set(bot.id, wsClient);
  }

  async disconnect(botId) {
    const client = this.clients.get(botId);
    if (client) {
      client.disconnect();
      this.clients.delete(botId);
    }
  }

  async sendMessage(botId, chatid, body) {
    const client = this.clients.get(botId);
    if (!client) throw new Error('Bot not connected');
    return client.sendMessage(chatid, body);
  }
}
```

---

## 9. 前端页面结构

### 9.1 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录页 | 用户名密码登录 |
| `/register` | 注册页 | 新用户注册 |
| `/` | Bot 选择器 | 显示已绑定的 Bot 列表，选择进入聊天 |
| `/chat/:botId` | 主聊天页面 | 聊天界面 + 最近联系人列表 |
| `/bots/manage` | Bot 管理页面 | 增删改查 Bot 配置（botId + secret） |

### 9.2 组件树

```
App
├── AuthLayout
│   ├── LoginPage
│   └── RegisterPage
│
└── MainLayout (需要认证)
    ├── Sidebar
    │   ├── BotSelector (Bot 列表 + 在线状态指示灯)
    │   ├── BotManageLink (进入管理页)
    │   └── UserInfo (当前用户信息 + 退出)
    │
    ├── ChatPage
    │   ├── ContactList
    │   │   ├── ContactItem (头像 + 名称 + 最后消息 + 未读数)
    │   │   └── SearchBar
    │   │
    │   └── ChatWindow
    │       ├── ChatHeader (联系人信息)
    │       ├── MessageList
    │       │   ├── MessageItem (气泡样式)
    │       │   │   ├── TextMessage
    │       │   │   ├── ImageMessage
    │       │   │   ├── MarkdownMessage
    │       │   │   └── FileMessage
    │       │   └── LoadMore (加载历史消息)
    │       └── MessageInput
    │           ├── TextInput (支持 Markdown 输入 + 发送)
    │           ├── ImageUpload (发送图片)
    │           └── FileUpload (发送文件)
    │
    └── BotManagePage
        ├── BotList
        │   └── BotCard (Bot 概览卡片 + 在线状态)
        └── BotForm (添加/编辑 Bot 的弹窗表单)
            ├── BotIdInput (企微后台获取的 BotID)
            ├── SecretInput (企微后台获取的 Secret)
            └── VerifyButton (测试连接 — 尝试建立 WebSocket 并发送测试消息)
```

### 9.3 聊天界面布局示意图

```
┌─────────────────────────────────────────────────┐
│  导航栏                                           │
│  ┌──────┐  ┌──────────────────────────────┐      │
│  │  Bot │  │  聊天主区域                     │      │
│  │ 切换  │  │   ┌────────────────────────┐  │      │
│  │      │  │   │  📞 张三               │  │      │
│  │  🟢 客 │  │   ├────────────────────────┤  │      │
│  │  服Bot│  │   │                        │  │      │
│  │      │  │   │  上午 10:30              │  │      │
│  │      │  │   │  ┌──────────────┐       │  │      │
│  │      │  │   │  │ 你好，我想咨  │← 收到 │  │      │
│  │  ─── │  │   │  │ 询一下       │       │  │      │
│  │      │  │   │  └──────────────┘       │  │      │
│  │  最近 │  │   │       ┌──────────┐     │  │      │
│  │  联系人│  │   │       │**您好**  │→ 发送 │  │      │
│  │       │  │   │       │请问有什么│      │  │      │
│  │  📝 张│  │   │       │可以帮您  │      │  │      │
│  │  三   │  │   │       └──────────┘     │  │      │
│  │  📝 李│  │   │                        │  │      │
│  │  四   │  │   ├────────────────────────┤  │      │
│  │       │  │   │  [支持 Markdown...] 📎📷➤ │  │      │
│  └──────┘  │   └────────────────────────┘  │      │
│            └──────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

---

## 10. 项目目录结构

```
wecom-bot-webchat/
├── package.json                 # 项目配置与依赖
├── .env.example                 # 环境变量模板
├── .gitignore                   # Git 忽略规则
├── README.md                    # 项目说明文档
│
├── docs/
│   └── design.md                # 本设计方案文档
│
├── server/                      # 后端代码
│   ├── index.js                 # 入口文件
│   ├── config.js                # 配置（从环境变量读取）
│   │
│   ├── routes/                  # HTTP 路由
│   │   ├── auth.js              # 认证路由（登录/注册）
│   │   ├── bots.js              # Bot 管理路由
│   │   ├── messages.js          # 消息路由
│   │   └── contacts.js          # 联系人路由
│   │
│   ├── services/                # 业务逻辑层
│   │   ├── authService.js       # 认证服务
│   │   ├── botService.js        # Bot 管理服务
│   │   ├── msgService.js        # 消息服务（核心）
│   │   └── wecomClient.js       # WSClient 连接池管理（核心）
│   │
│   ├── middleware/              # Express 中间件
│   │   ├── auth.js              # JWT 认证中间件
│   │   ├── errorHandler.js      # 全局错误处理
│   │   └── validate.js          # 请求验证中间件
│   │
│   ├── socket/                  # socket.io 相关
│   │   ├── index.js             # socket.io 初始化 + 事件注册
│   │   └── auth.js              # socket.io 认证中间件
│   │
│   ├── db/                      # 数据库相关
│   │   ├── index.js             # 数据库连接初始化
│   │   ├── migrate.js           # 数据库迁移脚本
│   │   └── schema.sql           # 完整建表 SQL
│   │
│   ├── utils/
│   │   └── logger.js            # 日志工具
│   │
│   └── scheduler/
│       └── reconnection.js      # Bot 重连管理器
│
├── client/                      # 前端代码 (Vite + React)
│   ├── index.html               # HTML 入口
│   ├── vite.config.js           # Vite 配置
│   ├── package.json             # 前端依赖
│   │
│   ├── src/
│   │   ├── main.jsx             # React 入口
│   │   ├── App.jsx              # 根组件 + 路由配置
│   │   │
│   │   ├── api/                 # API 请求封装
│   │   │   ├── client.js        # Axios 实例
│   │   │   ├── auth.js          # 认证 API
│   │   │   ├── bots.js          # Bot API
│   │   │   └── messages.js      # 消息 API
│   │   │
│   │   ├── socket/              # socket.io 客户端
│   │   │   ├── index.js         # 连接管理
│   │   │   └── events.js        # 事件处理
│   │   │
│   │   ├── pages/               # 页面组件
│   │   │   ├── Login.jsx        # 登录页
│   │   │   ├── Register.jsx     # 注册页
│   │   │   ├── Chat.jsx         # 主聊天页
│   │   │   └── BotManage.jsx    # Bot 管理页
│   │   │
│   │   ├── components/          # 可复用组件
│   │   │   ├── ChatWindow.jsx   # 聊天窗口
│   │   │   ├── MessageList.jsx  # 消息列表
│   │   │   ├── MessageInput.jsx # 消息输入框
│   │   │   ├── ContactList.jsx  # 联系人列表
│   │   │   ├── ContactItem.jsx  # 联系人条目
│   │   │   ├── BotSelector.jsx  # Bot 切换器
│   │   │   ├── BotForm.jsx      # Bot 配置表单（botId + secret）
│   │   │   └── ProtectedRoute.jsx # 认证保护路由
│   │   │
│   │   ├── hooks/               # 自定义 Hooks
│   │   │   ├── useSocket.js     # WebSocket 管理
│   │   │   ├── useMessages.js   # 消息状态管理
│   │   │   └── useAuth.js       # 认证状态管理
│   │   │
│   │   └── styles/              # 样式文件
│   │       ├── global.css
│   │       └── chat.css
│   │
│   └── public/
│       └── favicon.ico
│
└── scripts/
    └── deploy.sh                # 部署脚本
```

### 依赖清单

```json
// server/package.json
{
  "dependencies": {
    "express": "^4.21.x",
    "socket.io": "^4.8.x",
    "better-sqlite3": "^11.x",
    "@wecom/aibot-node-sdk": "^1.0.7",    // 企微智能机器人 SDK（核心）
    "jsonwebtoken": "^9.x",
    "bcryptjs": "^2.4.x",
    "cors": "^2.8.x",
    "morgan": "^1.10.x"
  }
}

// client/package.json
{
  "dependencies": {
    "react": "^19.x",
    "react-dom": "^19.x",
    "react-router-dom": "^7.x",
    "antd": "^5.x",
    "@ant-design/icons": "^5.x",
    "axios": "^1.x",
    "socket.io-client": "^4.x",
    "dayjs": "^1.x"
  },
  "devDependencies": {
    "vite": "^6.x",
    "@vitejs/plugin-react": "^4.x"
  }
}
```

---

## 11. 部署方案

### 11.1 部署拓扑

```
                    Internet
                       │
                       ▼
              ┌─────────────────┐
              │   Caddy (443)   │  ← 自动 TLS，域名 chat.zeaho.site
              │   反向代理       │
              └────────┬────────┘
                       │ :3001
                       ▼
              ┌─────────────────┐
              │  Node.js App    │  ← systemd 管理，开机自启
              │  127.0.0.1:3001 │
              ├─────────────────┤
              │  WSClient (每个 │
              │  Bot 一条长连接) │
              │  ─→ wss://     │
              │  openws.work   │
              │  .weixin.qq.com│
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   SQLite DB     │
              │  wecom-chat.db  │
              └─────────────────┘
```

### 11.2 Caddy 配置

```caddy
chat.zeaho.site {
    reverse_proxy 127.0.0.1:3001 {
        header_up Upgrade {http.request.header.Upgrade}
        header_up Connection {http.request.header.Connection}
    }
    log {
        output file /var/log/caddy/wecom-chat.log
        format json
    }
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

### 11.3 systemd 服务单元

```ini
[Unit]
Description=WeCom Bot WebChat
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/wecom-bot-webchat
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=JWT_SECRET=your-jwt-secret-here
Environment=DB_PATH=/var/data/wecom-chat.db
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 11.4 部署脚本

```bash
# scripts/deploy.sh
#!/bin/bash
set -e
APP_DIR="/var/www/wecom-bot-webchat"
DATA_DIR="/var/data"
REPO_URL="https://github.com/wutao667/wecom-bot-webchat.git"

sudo mkdir -p $APP_DIR $DATA_DIR

if [ -d "$APP_DIR/.git" ]; then
    cd $APP_DIR && git pull
else
    git clone $REPO_URL $APP_DIR && cd $APP_DIR
fi

cd $APP_DIR/server
npm install --production

cd $APP_DIR/client
npm install && npm run build

sudo systemctl daemon-reload
sudo systemctl restart wecom-bot-webchat
```

---

## 12. 开发计划与里程碑

### 12.1 阶段划分

```
Phase 1 (MVP)    Phase 2 (增强)     Phase 3 (完善)
─────────────────────────────────────────────────►
│                  │                    │
├── 核心功能 ──────┤── 功能增强 ───────┤── 体验优化 ──→
├── 第 1-2 周      ├── 第 3-4 周       ├── 第 5-6 周
```

### 12.2 详细里程碑

#### Phase 1 — MVP 核心功能（第 1-2 周）

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1.1 项目骨架 | 第 1 周前 3 天 | Express 项目初始化，SQLite 建表，Vite + React 脚手架 |
| M1.2 用户认证 | 第 1 周中 2 天 | 注册 + 登录 API，前端登录页，JWT 中间件 |
| M1.3 Bot 管理 + WebSocket 连接 | 第 1 周后 2 天 | Bot CRUD API + **WSClient 长连接集成**，前端 Bot 管理页 |
| M1.4 消息接收 | 第 2 周前 2 天 | WSClient 事件监听 → 入库 → socket.io 推送到前端 |
| M1.5 消息发送 | 第 2 周中 2 天 | 前端发送 → `wsClient.sendMessage()` → 企微用户收到 |
| M1.6 聊天 UI | 第 2 周后 2 天 | 完整聊天界面（联系人列表 + 消息列表 + 输入框） |

**Phase 1 验收标准：**
- ✅ 用户可注册登录
- ✅ 用户可添加 Bot（botId + secret），自动建立 WebSocket 长连接
- ✅ Bot 连接状态实时显示（在线/离线）
- ✅ 网页可向企微用户发送 Markdown 消息
- ✅ 企微用户发消息 → 网页实时展示
- ✅ 消息记录持久化并可查询

#### Phase 2 — 功能增强（第 3-4 周）

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M2.1 图片消息 | 第 3 周前 2 天 | 上传图片 → 前端预览 → WSClient 上传临时素材 → 发送图片 |
| M2.2 文件消息 | 第 3 周中 2 天 | 类似图片流程 |
| M2.3 流式回复 | 第 3 周后 3 天 | 支持打字机效果回复（replyStream） |
| M2.4 多 Bot 切换 | 第 4 周前 2 天 | 侧边栏 Bot 切换，数据隔离 |
| M2.5 连接监控 | 第 4 周后 3 天 | 连接状态可视化，重连历史，错误通知 |

#### Phase 3 — 体验优化（第 5-6 周）

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M3.1 消息搜索 | 第 5 周前 2 天 | 全局消息搜索 |
| M3.2 消息引用 | 第 5 周中 2 天 | 消息引用回复 |
| M3.3 暗色模式 | 第 5 周后 2 天 | 主题切换 |
| M3.4 虚拟列表 | 第 6 周前 2 天 | 大量消息时的虚拟滚动 |
| M3.5 数据备份 | 第 6 周后 3 天 | SQLite 定时备份，恢复脚本 |

---

## 13. 风险与应对措施

| 编号 | 风险 | 概率 | 影响 | 等级 | 应对措施 |
|------|------|------|------|------|----------|
| R-01 | WebSocket 连接断开 | 中 | 高 | **高** | SDK 内置自动重连（指数退避） + 前端连接状态提示 |
| R-02 | 企微 WebSocket 服务不稳定 | 低 | 高 | **中** | 重连机制 + 错误日志告警 |
| R-03 | 消息重复推送 | 中 | 低 | **中** | 使用 wx_msg_id 去重（数据库 UNIQUE 约束） |
| R-04 | socket.io 断开 | 高 | 中 | **中** | socket.io 自动重连 + 重连后同步未读消息 |
| R-05 | SQLite 并发写入 | 低 | 中 | **低** | WAL 模式 + better-sqlite3 串行化写入 |
| R-06 | Bot Secret 泄露 | 低 | 高 | **中** | 数据库加密存储敏感字段，配置文件 600 权限 |
| R-07 | 域名/证书过期 | 低 | 高 | **中** | Caddy 自动续期 |
| R-08 | 服务器磁盘空间满 | 中 | 中 | **中** | 定期清理旧消息，监控磁盘使用率 |

### 关键应对

**R-01 WebSocket 断开：** SDK 内置指数退避重连（默认最大 10 次），前端实时展示 Bot 在线状态。重连后自动恢复消息收发。

**R-03 消息重复：** 使用企业微信消息 msgid + 数据库 UNIQUE 索引防重。

**R-06 Secret 泄露：** 数据库加密存储 secret 字段，系统环境变量管理 JWT 密钥，配置文件 600 权限。

---

## 附录

### A. 完整建表 SQL

```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL CHECK(length(username) >= 3),
    password_hash TEXT    NOT NULL,
    display_name  TEXT    DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    bot_id        TEXT    NOT NULL,
    secret        TEXT    NOT NULL,
    status        TEXT    DEFAULT 'disconnected' CHECK(status IN ('connected','disconnected','error')),
    last_error    TEXT    DEFAULT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bots_user_id ON bots(user_id);

CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id      INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    direction   TEXT    NOT NULL CHECK(direction IN ('outgoing','incoming')),
    msg_type    TEXT    NOT NULL CHECK(msg_type IN ('text','markdown','image','file','voice','video','mixed')),
    content     TEXT    NOT NULL,
    from_user   TEXT    NOT NULL,
    to_user     TEXT    NOT NULL DEFAULT '',
    msg_id      TEXT    DEFAULT NULL,
    wx_msg_id   TEXT    DEFAULT NULL,
    status      TEXT    DEFAULT 'sent' CHECK(status IN ('sending','sent','delivered','failed','read')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_messages_bot_id  ON messages(bot_id);
CREATE INDEX idx_messages_created ON messages(bot_id, created_at DESC);
CREATE UNIQUE INDEX idx_messages_wx_msg_id ON messages(wx_msg_id) WHERE wx_msg_id IS NOT NULL;
```

### B. 智能机器人配置流程

在企业微信后台配置智能机器人的步骤：

1. 登录企业微信管理后台 → 应用管理 → 智能机器人
2. 点击"创建智能机器人"
3. 连接方式选择 **"使用长连接"**
4. 创建完成后获取 BotID 和 Secret
5. 在本网站添加 Bot 时填入这两个参数即可

### C. `@wecom/aibot-node-sdk` 关键 API

| 方法 | 参数 | 说明 |
|------|------|------|
| `new WSClient(options)` | `{ botId, secret, ... }` | 创建客户端 |
| `wsClient.connect()` | 无 | 建立 WebSocket 连接 |
| `wsClient.disconnect()` | 无 | 断开连接 |
| `wsClient.sendMessage(chatid, body)` | userid + 消息体 | 主动推送消息 |
| `wsClient.reply(frame, body)` | 回调帧 + 消息体 | 回复消息 |
| `wsClient.replyStream(frame, id, content, finish)` | 帧 + 流ID + 内容 + 结束标记 | 流式回复 |
| `wsClient.replyMedia(frame, type, mediaId)` | 帧 + 类型 + 素材ID | 回复媒体 |
| `wsClient.sendMediaMessage(chatid, type, mediaId)` | 会话ID + 类型 + 素材ID | 主动发送媒体 |
| `wsClient.uploadMedia(buffer, options)` | 文件Buffer + 选项 | 上传临时素材 |
| `wsClient.downloadFile(url, aesKey?)` | URL + 密钥 | 下载文件 |

### D. 参考文档

- [@wecom/aibot-node-sdk 企业微信智能机器人 SDK](https://www.npmjs.com/package/@wecom/aibot-node-sdk)
- [企业微信智能机器人开发文档](https://developer.work.weixin.qq.com/document/path/99110)
- [socket.io 官方文档](https://socket.io/docs/v4/)
- [better-sqlite3 文档](https://github.com/WiseLibs/better-sqlite3)

---

> 本文档为 WeCom Bot WebChat 项目的完整设计方案（WebSocket 长连接版）。
> 方案基于 `@wecom/aibot-node-sdk`，与 OpenClaw 企业微信 bot 的绑定方式一致。
