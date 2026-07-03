# WeCom Bot WebChat — 设计方案文档

> 版本：v1.0  
> 最后更新：2026-07-03  
> 项目仓库：https://github.com/wutao667/wecom-bot-webchat

---

## 目录

1. [项目概述](#1-项目概述)
2. [需求分析](#2-需求分析)
3. [技术选型与理由](#3-技术选型与理由)
4. [系统架构](#4-系统架构)
5. [数据库设计](#5-数据库设计)
6. [API 接口设计](#6-api-接口设计)
7. [企业微信回调处理流程](#7-企业微信回调处理流程)
8. [WebSocket 实时通信设计](#8-websocket-实时通信设计)
9. [前端页面结构](#9-前端页面结构)
10. [项目目录结构](#10-项目目录结构)
11. [部署方案](#11-部署方案)
12. [开发计划与里程碑](#12-开发计划与里程碑)
13. [风险与应对措施](#13-风险与应对措施)

---

## 1. 项目概述

### 1.1 项目名称

**WeCom Bot WebChat** — 企业微信机器人网页版聊天工具

### 1.2 项目目标

构建一个 Web 应用，支持用户绑定企业微信自建应用（Agent），实现在浏览器中与企业微信用户进行双向实时消息通信。最终达到类似"网页版企业微信"的体验。

### 1.3 核心价值

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
| F-01 | 添加 Bot | P0 | 输入 corpid, agentid, secret, token, encodingAESKey |
| F-02 | 验证 Bot 联通性 | P0 | 通过回调 URL 验证确认配置正确 |
| F-03 | 编辑 Bot | P1 | 修改已绑定的 Bot 配置 |
| F-04 | 删除 Bot | P1 | 解除 Bot 绑定 |
| F-05 | 查看 Bot 列表 | P0 | 所有已绑定 Bot 的概览 |
| F-06 | Bot 状态监控 | P2 | 显示在线/离线/异常状态 |

#### 2.1.2 消息收发

| 编号 | 功能 | 优先级 | 说明 |
|------|------|--------|------|
| F-07 | 发送文本消息 | P0 | 向指定企业微信用户发送文本 |
| F-08 | 发送图片消息 | P1 | 支持上传图片并发送 |
| F-09 | 发送文件消息 | P2 | 支持上传文件并发送 |
| F-10 | 接收消息推送 | P0 | 实时接收用户发来的消息 |
| F-11 | 消息记录查询 | P0 | 查看历史消息记录 |
| F-12 | 消息实时推送 | P0 | WebSocket 推送到前端 |

#### 2.1.3 用户与认证

| 编号 | 功能 | 优先级 | 说明 |
|------|------|--------|------|
| F-13 | 用户注册 | P0 | 用户名 + 密码注册 |
| F-14 | 用户登录 | P0 | JWT 认证 |
| F-15 | 用户注销 | P1 | 退出登录 |

#### 2.1.4 联系人

| 编号 | 功能 | 优先级 | 说明 |
|------|------|--------|------|
| F-16 | 联系人列表 | P1 | 加载企业微信通讯录中可联系的用户 |
| F-17 | 最近会话 | P1 | 最近有消息来往的用户列表 |

### 2.2 非功能需求

| 编号 | 需求 | 指标 |
|------|------|------|
| N-01 | 并发连接 | 支持 100+ WebSocket 并发 |
| N-02 | 消息延迟 | 端到端延迟 < 2 秒 |
| N-03 | 数据持久化 | SQLite 存储，定期备份 |
| N-04 | 安全性 | 加密传输（TLS），密码哈希存储，AES 解密隔离 |
| N-05 | 可维护性 | 日志记录，错误追踪 |

---

## 3. 技术选型与理由

### 3.1 技术选型一览

| 层级 | 技术 | 版本 | 理由 |
|------|------|------|------|
| **后端框架** | Express | 4.x | Node.js 生态最成熟的 Web 框架，社区丰富，学习曲线平缓 |
| **运行时** | Node.js | v24.15 | 服务器已有环境，无需额外安装；事件驱动适合 I/O 密集场景 |
| **前端框架** | React | 19.x | 组件化开发，生态成熟 |
| **UI 组件库** | Ant Design | 5.x | 企业级 UI 规范，内置 Chat 场景所需组件 |
| **构建工具** | Vite | 6.x | 极速 HMR，开箱即用的 React + TS 支持 |
| **数据库** | SQLite (better-sqlite3) | 11.x | 零配置、单文件，适合中小规模部署；同步 API 性能优异 |
| **WebSocket** | socket.io | 4.x | 自动降级、房间管理、ACK 机制，比原生 WebSocket 更易用 |
| **企微 SDK** | wechat-enterprise | 最新 | 封装了加解密、签名验证、API 调用等复杂逻辑 |
| **反向代理** | Caddy | 2.11.3 | 自动 TLS、配置简洁、服务器已安装 |
| **进程管理** | systemd | 系统自带 | Ubuntu 原生，自动重启、日志管理 |

### 3.2 选型分析

#### 为什么选 Node.js 而非 Go？
- 服务器已有 Node.js v24.15，无 Go 环境
- 本项目为 I/O 密集型（网络请求、文件读写），Node.js 事件循环天然适合
- 企微相关 npm 包生态成熟（`wechat-enterprise` 等）
- 前后端统一语言，降低团队认知负担

#### 为什么选 SQLite 而非 PostgreSQL/MySQL？
- 单用户/小团队场景，不需要独立数据库服务
- 零运维，备份即是复制文件
- better-sqlite3 同步 API 比异步 SQLite 驱动快 2-5x
- 未来需要扩展时，可平滑迁移到 PostgreSQL

#### 为什么选 socket.io 而非原生 WebSocket？
- 自动支持长轮询降级（兼容老旧网络环境）
- 内置房间（Room）机制，天然支持 Bot 隔离
- 支持 ACK 回调，消息可靠性有保障
- 自动重连机制，网络波动后自动恢复

---

## 4. 系统架构

### 4.1 总体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                 │
└──────────────────┬──────────────────────────────┬───────────────┘
                   │                              │
                   ▼                              ▼
           ┌───────────────┐             ┌───────────────┐
           │  User Browser │             │   WeChat Work │
           │  (React SPA)  │             │   (企业微信)   │
           └───────┬───────┘             └───────┬───────┘
                   │                             │
                   │ HTTPS / WSS                │ HTTPS
                   ▼                             ▼
           ┌──────────────────────────────────────────────────────┐
           │               Caddy Reverse Proxy                    │
           │           (自动 TLS · 路径路由 · WSS 代理)            │
           └──────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
           ┌──────────────────────────────────────────────────────┐
           │              Node.js Express Server                  │
           │                                                      │
           │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
           │  │ REST API │  │WebSocket │  │ Callback Handler  │  │
           │  │  Router  │  │  Server  │  │   (AES Decrypt)   │  │
           │  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
           │       │             │                  │             │
           │       ▼             ▼                  ▼             │
           │  ┌──────────────────────────────────────────────┐    │
           │  │            Service Layer                      │    │
           │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │    │
           │  │  │BotManage │ │MsgService│ │WeComAPIProxy │ │    │
           │  │  └──────────┘ └──────────┘ └──────────────┘ │    │
           │  └──────────────────────────────────────────────┘    │
           │                          │                           │
           │                          ▼                           │
           │  ┌──────────────────────────────────────────────┐    │
           │  │              SQLite Database                   │    │
           │  │  (bots · messages · users · contacts)         │    │
           │  └──────────────────────────────────────────────┘    │
           └──────────────────────────────────────────────────────┘
                                  │
                                  ▼
           ┌──────────────────────────────────────────────┐
           │          企业微信 API (第三方 API)              │
           │  https://qyapi.weixin.qq.com/cgi-bin/         │
           └──────────────────────────────────────────────┘
```

### 4.2 消息流

```
▼ 发送消息（网页 → 企微用户）

[浏览器] ──(WSS)──→ [socket.io] ──→ [MsgService] ──(HTTP POST)──→ [企微 API]
                                                                    │
                                                                    ▼
                                                               [企微用户收到消息]

▼ 接收消息（企微用户 → 网页）

[企微用户发消息] ──(HTTP POST)──→ [Caddy] ──→ [Callback Handler]
                                                    │
                                                    ├─→ AES 解密 XML
                                                    ├─→ 解析消息体
                                                    ├─→ 存入 SQLite
                                                    └─→ socket.io 推送 → [浏览器]
```

### 4.3 进程模型

```
┌──────────────────────────────────────────────────────┐
│                Node.js 单进程                         │
│                                                       │
│  Main Thread (Event Loop)                             │
│  ┌─────────────────────────────────────────────┐     │
│  │  Express HTTP Server (端口 3001)             │     │
│  │  socket.io Server (挂载在 HTTP Server 上)     │     │
│  │  WeCom Callback Receiver                     │     │
│  │  Access Token 定时刷新 (setInterval)          │     │
│  └─────────────────────────────────────────────┘     │
│                                                       │
│  Worker Threads (better-sqlite3 同步查询)             │
│  └── SQLite 查询 (同步但不阻塞事件循环)               │
└──────────────────────────────────────────────────────┘
```

---

## 5. 数据库设计

### 5.1 ER 图

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│   users     │       │     bots        │       │  messages   │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id (PK)     │◄──────│ user_id (FK)    │       │ id (PK)     │
│ username    │       │ id (PK)         │◄──────│ bot_id (FK) │
│ password_ha │       │ name            │       │ direction   │
│ created_at  │       │ corpid          │       │ msg_type    │
└─────────────┘       │ agentid         │       │ content     │
                      │ secret          │       │ from_user   │
                      │ token           │       │ to_user     │
                      │ encoding_aeskey │       │ msg_id      │
                      │ status          │       │ created_at  │
                      │ created_at      │       └─────────────┘
                      │ updated_at      │
                      └─────────────────┘
                      │
                      ▼
              ┌─────────────────┐
              │  access_tokens  │
              ├─────────────────┤
              │ id (PK)         │
              │ bot_id (FK)     │
              │ access_token    │
              │ expires_at      │
              │ created_at      │
              └─────────────────┘
```

### 5.2 表结构

#### 5.2.1 `users` — 用户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, AUTOINCREMENT | 用户唯一标识 |
| `username` | TEXT | UNIQUE, NOT NULL | 用户名（3-32 字符） |
| `password_hash` | TEXT | NOT NULL | bcrypt 哈希后的密码 |
| `display_name` | TEXT | DEFAULT '' | 显示名称 |
| `created_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 ISO 8601 |
| `updated_at` | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 最后更新时间 |

```sql
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL CHECK(length(username) >= 3),
    password_hash TEXT    NOT NULL,
    display_name  TEXT    DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

#### 5.2.2 `bots` — 企业微信 Bot 配置表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, AUTOINCREMENT | Bot 唯一标识 |
| `user_id` | INTEGER | FK → users.id, NOT NULL | 所属用户 |
| `name` | TEXT | NOT NULL | Bot 别名（方便识别） |
| `corpid` | TEXT | NOT NULL | 企业 ID |
| `agentid` | INTEGER | NOT NULL | 应用 Agent ID |
| `secret` | TEXT | NOT NULL | 应用 Secret |
| `token` | TEXT | NOT NULL | 回调配置中的 Token |
| `encoding_aeskey` | TEXT | NOT NULL | 回调配置中的 EncodingAESKey |
| `callback_url` | TEXT | DEFAULT NULL | 回调 URL |
| `status` | TEXT | DEFAULT 'inactive' | 状态：active / inactive / error |
| `last_error` | TEXT | DEFAULT NULL | 最近错误信息 |
| `created_at` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | 更新时间 |

```sql
CREATE TABLE IF NOT EXISTS bots (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             TEXT    NOT NULL,
    corpid           TEXT    NOT NULL,
    agentid          INTEGER NOT NULL,
    secret           TEXT    NOT NULL,
    token            TEXT    NOT NULL,
    encoding_aeskey  TEXT    NOT NULL CHECK(length(encoding_aeskey) = 43),
    callback_url     TEXT    DEFAULT NULL,
    status           TEXT    DEFAULT 'inactive' CHECK(status IN ('active','inactive','error')),
    last_error       TEXT    DEFAULT NULL,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_bots_user_id ON bots(user_id);
```

#### 5.2.3 `messages` — 消息记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, AUTOINCREMENT | 消息唯一标识 |
| `bot_id` | INTEGER | FK → bots.id, NOT NULL | 所属 Bot |
| `direction` | TEXT | NOT NULL | 方向：`outgoing`（发送） / `incoming`（接收） |
| `msg_type` | TEXT | NOT NULL | 消息类型：`text` / `image` / `file` / `voice` / `video` |
| `content` | TEXT | NOT NULL | 消息内容（文本正文 或 媒体文件 URL） |
| `from_user` | TEXT | NOT NULL | 发送者（`system` 表示系统发送，否则为企微 userid） |
| `to_user` | TEXT | NOT NULL | 接收者（企微 userid，多个用 `\|` 分隔） |
| `msg_id` | TEXT | DEFAULT NULL | 企业微信消息 ID（用于去重） |
| `status` | TEXT | DEFAULT 'sent' | 状态：sending / sent / delivered / failed |
| `created_at` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

```sql
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id      INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    direction   TEXT    NOT NULL CHECK(direction IN ('outgoing','incoming')),
    msg_type    TEXT    NOT NULL CHECK(msg_type IN ('text','image','file','voice','video')),
    content     TEXT    NOT NULL,
    from_user   TEXT    NOT NULL,
    to_user     TEXT    NOT NULL,
    msg_id      TEXT    DEFAULT NULL,
    status      TEXT    DEFAULT 'sent' CHECK(status IN ('sending','sent','delivered','failed')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_messages_bot_id   ON messages(bot_id);
CREATE INDEX idx_messages_created  ON messages(bot_id, created_at DESC);
CREATE UNIQUE INDEX idx_messages_msg_id ON messages(msg_id) WHERE msg_id IS NOT NULL;
```

#### 5.2.4 `access_tokens` — Access Token 缓存表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, AUTOINCREMENT | |
| `bot_id` | INTEGER | FK → bots.id, UNIQUE, NOT NULL | 每个 Bot 一条记录 |
| `access_token` | TEXT | NOT NULL | 缓存的 access_token |
| `expires_at` | TEXT | NOT NULL | 过期时间（ISO 8601） |
| `created_at` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

```sql
CREATE TABLE IF NOT EXISTS access_tokens (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id        INTEGER UNIQUE NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    access_token  TEXT    NOT NULL,
    expires_at    TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

#### 5.2.5 `contacts` — 联系人缓存表（可选）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, AUTOINCREMENT | |
| `bot_id` | INTEGER | FK → bots.id, NOT NULL | 所属 Bot |
| `userid` | TEXT | NOT NULL | 企微成员 UserID |
| `name` | TEXT | NOT NULL | 成员姓名 |
| `avatar` | TEXT | DEFAULT NULL | 头像 URL |
| `department` | TEXT | DEFAULT NULL | 部门（JSON 数组） |
| `created_at` | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

```sql
CREATE TABLE IF NOT EXISTS contacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id      INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    userid      TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    avatar      TEXT    DEFAULT NULL,
    department  TEXT    DEFAULT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(bot_id, userid)
);
```

---

## 6. API 接口设计

### 6.1 认证接口

#### POST /api/auth/register — 注册

```
Request:
  POST /api/auth/register
  Content-Type: application/json

  {
    "username": "alice",
    "password": "SecureP@ss123",
    "display_name": "Alice"
  }

Response 201:
  {
    "success": true,
    "data": {
      "id": 1,
      "username": "alice",
      "display_name": "Alice",
      "created_at": "2026-07-03T10:00:00Z"
    }
  }

Response 400:
  {
    "success": false,
    "error": "Username already exists"
  }
```

#### POST /api/auth/login — 登录

```
Request:
  POST /api/auth/login
  Content-Type: application/json

  {
    "username": "alice",
    "password": "SecureP@ss123"
  }

Response 200:
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "user": {
        "id": 1,
        "username": "alice",
        "display_name": "Alice"
      }
    }
  }

Response 401:
  {
    "success": false,
    "error": "Invalid username or password"
  }
```

### 6.2 Bot 管理接口

> 所有 Bot 管理接口需在 Header 中携带 `Authorization: Bearer <token>`。

#### GET /api/bots — 获取 Bot 列表

```
Request:
  GET /api/bots

Response 200:
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "客服机器人",
        "corpid": "ww123456789",
        "agentid": 1000001,
        "status": "active",
        "callback_url": "https://chat.zeaho.site/api/callback/1",
        "created_at": "2026-07-03T10:00:00Z"
      }
    ]
  }
```

#### POST /api/bots — 创建 Bot

```
Request:
  POST /api/bots
  Content-Type: application/json

  {
    "name": "客服机器人",
    "corpid": "ww123456789",
    "agentid": 1000001,
    "secret": "your-secret-here",
    "token": "your-token-here",
    "encoding_aeskey": "your-43-char-aes-key-here"
  }

Response 201:
  {
    "success": true,
    "data": {
      "id": 1,
      "name": "客服机器人",
      "corpid": "ww123456789",
      "agentid": 1000001,
      "callback_url": "https://chat.zeaho.site/api/callback/1",
      "status": "inactive",
      "created_at": "2026-07-03T10:00:00Z"
    }
  }
```

#### PUT /api/bots/:id — 更新 Bot

```
Request:
  PUT /api/bots/1
  Content-Type: application/json

  {
    "name": "客服机器人 v2",
    "secret": "new-secret"
  }

Response 200:
  {
    "success": true,
    "data": {
      "id": 1,
      "name": "客服机器人 v2",
      "updated_at": "2026-07-03T11:00:00Z"
    }
  }
```

#### DELETE /api/bots/:id — 删除 Bot

```
Request:
  DELETE /api/bots/1

Response 200:
  {
    "success": true,
    "data": { "message": "Bot deleted" }
  }
```

#### POST /api/bots/:id/verify — 验证回调联通性

```
Request:
  POST /api/bots/1/verify

Response 200:
  {
    "success": true,
    "data": {
      "status": "active",
      "message": "Callback URL verified successfully"
    }
  }

Response 400:
  {
    "success": false,
    "error": "Callback verification failed: request timeout"
  }
```

### 6.3 消息接口

#### POST /api/bots/:id/send — 发送消息

```
Request:
  POST /api/bots/1/send
  Content-Type: application/json

  {
    "to_user": "zhangsan",
    "msg_type": "text",
    "content": "您好，有什么可以帮助您的？"
  }

Response 200:
  {
    "success": true,
    "data": {
      "message_id": 42,
      "msg_id": "1234567890",
      "status": "sent"
    }
  }
```

支持的消息类型：

| msg_type | content 说明 |
|----------|-------------|
| `text` | 文本内容字符串 |
| `image` | 图片文件的本地路径或 base64 |
| `file` | 文件的本地路径或 base64 |
| `markdown` | Markdown 文本（使用企微 markdown 消息类型） |

#### GET /api/bots/:id/messages — 消息记录

```
Request:
  GET /api/bots/1/messages?contact=zhangsan&page=1&page_size=50

Response 200:
  {
    "success": true,
    "data": {
      "total": 128,
      "page": 1,
      "page_size": 50,
      "items": [
        {
          "id": 42,
          "direction": "outgoing",
          "msg_type": "text",
          "content": "您好，有什么可以帮助您的？",
          "from_user": "system",
          "to_user": "zhangsan",
          "msg_id": "1234567890",
          "created_at": "2026-07-03T10:30:00Z"
        },
        {
          "id": 41,
          "direction": "incoming",
          "msg_type": "text",
          "content": "你好，我想咨询一下订单问题",
          "from_user": "zhangsan",
          "to_user": "system",
          "msg_id": "0987654321",
          "created_at": "2026-07-03T10:29:00Z"
        }
      ]
    }
  }
```

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `contact` | string | 否 | 按联系人筛选（userid） |
| `direction` | string | 否 | incoming / outgoing |
| `start_time` | string | 否 | 起始时间 ISO 8601 |
| `end_time` | string | 否 | 结束时间 ISO 8601 |
| `page` | number | 否 | 页码，默认 1 |
| `page_size` | number | 否 | 每页条数，默认 50，最大 200 |

### 6.4 联系人接口

#### GET /api/bots/:id/contacts — 获取联系人列表

```
Request:
  GET /api/bots/1/contacts?query=张三

Response 200:
  {
    "success": true,
    "data": [
      {
        "userid": "zhangsan",
        "name": "张三",
        "avatar": "https://wework.qpic.cn/...",
        "department": ["产品部"]
      }
    ]
  }
```

#### GET /api/bots/:id/conversations — 最近会话列表

```
Request:
  GET /api/bots/1/conversations

Response 200:
  {
    "success": true,
    "data": [
      {
        "contact_userid": "zhangsan",
        "contact_name": "张三",
        "last_message": "好的收到",
        "last_time": "2026-07-03T10:30:00Z",
        "unread_count": 0
      }
    ]
  }
```

### 6.5 回调接口（无认证）

#### GET /api/callback/:botId — URL 验证

```
Request:
  GET /api/callback/1?msg_signature=xxx&timestamp=123&nonce=456&echostr=encrypted_str

Response 200:
  [明文 echostr]  (纯文本，返回解密后的 echostr)

Response 403:
  [empty body]   (签名验证失败)
```

#### POST /api/callback/:botId — 接收消息回调

```
Request:
  POST /api/callback/1?msg_signature=xxx&timestamp=123&nonce=456
  Content-Type: text/xml

  <xml>
    <Encrypt>encrypted_xml_content</Encrypt>
    <AgentID>1000001</AgentID>
  </xml>

Response 200:
  [空字符串]  (成功)

Response 403:
  [empty body] (签名验证失败)
```

### 6.6 统一响应格式

所有 API 响应遵循以下格式：

```typescript
// 成功
interface ApiSuccess<T> {
  success: true;
  data: T;
}

// 失败
interface ApiError {
  success: false;
  error: string;
  code?: string;       // 错误码，如 "VALIDATION_ERROR"
  details?: unknown;   // 详细错误信息（可选）
}

// 分页
interface PaginatedData<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}
```

HTTP 状态码：

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或 token 过期 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 7. 企业微信回调处理流程

### 7.1 协议概述

企业微信回调机制使用 AES-256-CBC 加密 + PKCS7 填充 + XML 封装，流程如下：

1. 企业微信服务器向配置的 URL 发送 GET 请求验证 URL 有效性
2. 验证通过后，后续消息以 POST 请求推送加密后的 XML 数据
3. 每次请求都附带 `msg_signature`、`timestamp`、`nonce` 三个查询参数

### 7.2 URL 验证流程图

```
企微服务器                          Node.js 服务器
     │                                    │
     │  GET /api/callback/1               │
     │  ?msg_signature=SIG                │
     │  &timestamp=1719900000             │
     │  &nonce=123456                     │
     │  &echostr=ENCRYPTED_STRING         │
     │ ─────────────────────────────────►  │
     │                                    │
     │            ┌───────────────────┐   │
     │            │ 1. 拼接 token +    │   │
     │            │ timestamp + nonce  │   │
     │            │ + echostr          │   │
     │            │ → SHA1 生成签名    │   │
     │            └───────────────────┘   │
     │                    │               │
     │            ┌───────▼───────────┐   │
     │            │ 2. 比对签名是否    │   │
     │            │ 匹配 msg_signature│   │
     │            └───────┬───────────┘   │
     │                    │               │
     │           ┌────────▼────────┐      │
     │           │ 匹配?           │      │
     │           ├─── Yes ──┐  No ─┤      │
     │           ▼          │      ▼      │
     │    ┌─────────────┐   │   返回 403  │
     │    │ 3. AES解密   │   │            │
     │    │ echostr      │   │            │
     │    │ → PKCS7 去填充│   │            │
     │    └──────┬──────┘   │            │
     │           ▼          │            │
     │    ┌─────────────┐   │            │
     │    │ 4. 返回明文   │   │            │
     │    │ echostr      │   │            │
     │    └──────┬──────┘   │            │
     │           │          │            │
     │  200 OK ←─┘          │            │
     │  明文 echostr        │            │
     │◄─────────────────────              │
     │                                    │
```

### 7.3 消息接收流程图

```
企微服务器                          Node.js 服务器                 浏览器
     │                                    │                      │
     │  POST /api/callback/1              │                      │
     │  ?msg_signature=SIG                │                      │
     │  &timestamp=1719900000             │                      │
     │  &nonce=123456                     │                      │
     │  Content-Type: text/xml            │                      │
     │  <xml><Encrypt>...</Encrypt></xml> │                      │
     │ ─────────────────────────────────►  │                      │
     │                                    │                      │
     │            ┌───────────────────┐   │                      │
     │            │ 1. 签名验证        │   │                      │
     │            │ (同 URL 验证)      │   │                      │
     │            └────────┬──────────┘   │                      │
     │                     │              │                      │
     │            ┌────────▼────────┐     │                      │
     │            │ 2. 提取 Encrypt  │     │                      │
     │            │ 节点中的密文     │     │                      │
     │            └────────┬────────┘     │                      │
     │                     │              │                      │
     │            ┌────────▼────────┐     │                      │
     │            │ 3. AES-256-CBC   │     │                      │
     │            │ 解密 (PKCS7)     │     │                      │
     │            └────────┬────────┘     │                      │
     │                     │              │                      │
     │            ┌────────▼────────┐     │                      │
     │            │ 4. 解析 XML      │     │                      │
     │            │ 提取消息内容     │     │                      │
     │            │ FromUserName     │     │                      │
     │            │ Content/MsgType  │     │                      │
     │            │ CreateTime/MsgId │     │                      │
     │            └────────┬────────┘     │                      │
     │                     │              │                      │
     │            ┌────────▼────────┐     │                      │
     │            │ 5. 去重检查      │     │                      │
     │            │ msg_id 是否已存  │     │                      │
     │            └────────┬────────┘     │                      │
     │                     │              │                      │
     │            ┌────────▼────────┐     │                      │
     │            │ 6. 存入 messages │     │                      │
     │            │ 表              │     │                      │
     │            └────────┬────────┘     │                      │
     │                     │              │                      │
     │            ┌────────▼────────┐     │                      │
     │            │ 7. 通过 socket.io│     │                      │
     │            │ 推送到前端      │     │                      │
     │            └────────┬────────┘     │                      │
     │                     │              │                      │
     │  200 OK ←───────────┘              │                      │
     │  (空响应)                           │                      │
     │◄──────────────────────────────────  │                      │
     │                                    │                      │
     │                                    │  socket.io emit      │
     │                                    │  "new_message"      │
     │                                    │ ──────────────────►  │
     │                                    │                      │
     │                                    │                      │ 实时展示消息
     │                                    │                      │ ◄──────────
```

### 7.4 加解密核心逻辑

```javascript
// AES-256-CBC 解密
function decryptMessage(encodingAESKey, encryptText) {
  // 1. Base64 解码 encodingAESKey 得到 AESKey（43 字符 Base64 → 32 字节）
  const aesKey = Buffer.from(encodingAESKey + '=', 'base64');

  // 2. Base64 解码密文
  const cipherBuf = Buffer.from(encryptText, 'base64');

  // 3. AES-256-CBC 解密（IV = AESKey 前 16 字节）
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, aesKey.slice(0, 16));
  decipher.setAutoPadding(false);
  let decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);

  // 4. PKCS7 去填充
  const padLen = decrypted[decrypted.length - 1];
  decrypted = decrypted.slice(0, decrypted.length - padLen);

  // 5. 解析明文结构
  //   [4 字节网络序长度][消息内容][发送者 corpid]
  const content = decrypted.slice(16); // 跳过 16 字节随机串
  const msgLen = content.readUInt32BE(0);
  const msgXml = content.slice(4, 4 + msgLen).toString('utf-8');

  return msgXml;
}
```

### 7.5 签名验证逻辑

```javascript
function verifySignature(token, timestamp, nonce, encryptText, signature) {
  const arr = [token, timestamp, nonce, encryptText].sort();
  const sha1 = crypto.createHash('sha1');
  sha1.update(arr.join(''));
  return sha1.digest('hex') === signature;
}
```

---

## 8. WebSocket 实时通信设计

### 8.1 连接架构

```
┌──────────────────────────────────────────┐
│            socket.io Server               │
│                                           │
│  Namespace: / (default)                   │
│                                           │
│  用户连接: 每个登录用户一个连接            │
│  ┌─────────────────────┐                  │
│  │ Room: user:1        │                  │
│  │  └─ socket_abc      │                  │
│  └─────────────────────┘                  │
│  ┌─────────────────────┐                  │
│  │ Room: user:2        │                  │
│  │  └─ socket_def      │                  │
│  └─────────────────────┘                  │
│                                           │
│  Bot 房间: 按 Bot 隔离                   │
│  ┌─────────────────────┐                  │
│  │ Room: bot:1         │                  │
│  │  └─ room:user:1     │  (用户加入所属   │
│  └─────────────────────┘    Bot 的房间)   │
└──────────────────────────────────────────┘
```

### 8.2 事件定义

#### 客户端 → 服务端

| 事件 | 载荷 | 说明 |
|------|------|------|
| `join_bot` | `{ botId: number }` | 加入 Bot 房间，开始接收该 Bot 的消息 |
| `leave_bot` | `{ botId: number }` | 离开 Bot 房间 |
| `send_message` | `{ botId, toUser, msgType, content }` | 发送消息请求 |
| `mark_read` | `{ botId, contactUserid }` | 标记某联系人的消息为已读 |

#### 服务端 → 客户端

| 事件 | 载荷 | 说明 |
|------|------|------|
| `new_message` | `{ id, botId, direction, msgType, content, fromUser, toUser, createdAt }` | 新消息推送 |
| `message_status` | `{ messageId, status }` | 消息状态更新 |
| `error` | `{ message: string }` | 错误通知 |
| `bot_status` | `{ botId, status }` | Bot 连接状态变化 |

### 8.3 消息推送流程

```
                      ┌──────────────┐
                      │  企微回调    │
                      │  (POST)      │
                      └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ 解析 & 存储  │
                      │ 到 messages  │
                      └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ 查询 message │
                      │ 所属 bot_id  │
                      └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ socket.io    │
                      │ to(`bot:${id}──┐
                      │ ).emit(...)   │
                      └──────────────┘ │
                             │         │
                             ▼         ▼
                      ┌──────────┐  ┌──────────┐
                      │ 用户 A   │  │ 用户 B   │
                      │ 浏览器   │  │ 浏览器   │
                      └──────────┘  └──────────┘
```

### 8.4 认证与连接

```javascript
// 服务端：socket.io 中间件认证
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // 自动加入用户房间
  socket.join(`user:${socket.userId}`);

  socket.on('join_bot', ({ botId }) => {
    // 验证 bot 属于该用户
    socket.join(`bot:${botId}`);
  });
});
```

---

## 9. 前端页面结构

### 9.1 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录页 | 用户名密码登录 |
| `/register` | 注册页 | 新用户注册 |
| `/` | Bot 选择器 | 显示已绑定的 Bot 列表，选择进入聊天 |
| `/chat/:botId` | 主聊天页面 | 聊天界面 + 联系人列表 |
| `/bots/manage` | Bot 管理页面 | 增删改查 Bot 配置 |

### 9.2 组件树

```
App
├── AuthLayout
│   ├── LoginPage
│   └── RegisterPage
│
└── MainLayout (需要认证)
    ├── Sidebar
    │   ├── BotSelector (Bot 列表 + 快速切换)
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
    │       │   │   └── FileMessage
    │       │   └── LoadMore (加载历史消息)
    │       └── MessageInput
    │           ├── TextInput (输入框 + 发送按钮)
    │           ├── ImageUpload (发送图片)
    │           └── FileUpload (发送文件)
    │
    └── BotManagePage
        ├── BotList
        │   └── BotCard (Bot 概览卡片)
        └── BotForm (添加/编辑 Bot 的弹窗表单)
            ├── CorpidInput
            ├── AgentIdInput
            ├── SecretInput
            ├── TokenInput
            ├── EncodingAESKeyInput
            └── VerifyButton (验证联通性)
```

### 9.3 聊天界面布局示意图

```
┌─────────────────────────────────────────────────┐
│  导航栏                                           │
│  ┌──────┐  ┌──────────────────────────────┐      │
│  │  Bot │  │  聊天主区域                     │      │
│  │ 切换  │  │   ┌────────────────────────┐  │      │
│  │      │  │   │  联系人: 张三            │  │      │
│  │  ● 客 │  │   ├────────────────────────┤  │      │
│  │  服Bot│  │   │                        │  │      │
│  │      │  │   │  上午 10:30              │  │      │
│  │      │  │   │  ┌──────────────┐       │  │      │
│  │      │  │   │  │ 你好，我想咨  │← 收到 │  │      │
│  │  ─── │  │   │  │ 询一下       │       │  │      │
│  │      │  │   │  └──────────────┘       │  │      │
│  │  联系 │  │   │       ┌──────────┐     │  │      │
│  │  人   │  │   │       │您好，请  │→ 发送 │  │      │
│  │       │  │   │       │问有什么  │      │  │      │
│  │  ● 张 │  │   │       │可以帮您  │      │  │      │
│  │  三   │  │   │       └──────────┘     │  │      │
│  │  ● 李 │  │   │                        │  │      │
│  │  四   │  │   ├────────────────────────┤  │      │
│  │       │  │   │  [输入消息...]  📎 📷 ➤ │  │      │
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
│   ├── index.js                 # 入口文件，启动 Express + socket.io
│   ├── config.js                # 配置（从环境变量读取）
│   │
│   ├── routes/                  # HTTP 路由
│   │   ├── auth.js              # 认证路由（登录/注册）
│   │   ├── bots.js              # Bot 管理路由
│   │   ├── messages.js          # 消息路由
│   │   ├── contacts.js          # 联系人路由
│   │   └── callback.js          # 企业微信回调路由
│   │
│   ├── services/                # 业务逻辑层
│   │   ├── authService.js       # 认证服务
│   │   ├── botService.js        # Bot 管理服务
│   │   ├── msgService.js        # 消息服务
│   │   ├── wecomApi.js          # 企业微信 API 代理
│   │   └── callbackService.js   # 回调处理服务
│   │
│   ├── middleware/              # Express 中间件
│   │   ├── auth.js              # JWT 认证中间件
│   │   ├── errorHandler.js      # 全局错误处理
│   │   └── validate.js          # 请求验证中间件
│   │
│   ├── socket/                  # WebSocket 相关
│   │   ├── index.js             # socket.io 初始化 + 事件注册
│   │   └── auth.js              # socket.io 认证中间件
│   │
│   ├── db/                      # 数据库相关
│   │   ├── index.js             # 数据库连接初始化
│   │   ├── migrate.js           # 数据库迁移脚本
│   │   └── schema.sql           # 完整建表 SQL
│   │
│   ├── utils/                   # 工具函数
│   │   ├── crypto.js            # AES 加解密工具
│   │   ├── xmlParser.js         # XML 解析/构建
│   │   └── logger.js            # 日志工具
│   │
│   └── scheduler/               # 定时任务
│       └── tokenRefresh.js      # Access Token 定时刷新
│
├── client/                      # 前端代码 (Vite + React)
│   ├── index.html               # HTML 入口
│   ├── vite.config.js           # Vite 配置（含 API 代理）
│   ├── package.json             # 前端依赖
│   │
│   ├── src/
│   │   ├── main.jsx             # React 入口
│   │   ├── App.jsx              # 根组件 + 路由配置
│   │   │
│   │   ├── api/                 # API 请求封装
│   │   │   ├── client.js        # Axios 实例（拦截器）
│   │   │   ├── auth.js          # 认证 API
│   │   │   ├── bots.js          # Bot API
│   │   │   └── messages.js      # 消息 API
│   │   │
│   │   ├── socket/              # WebSocket 客户端
│   │   │   ├── index.js         # socket.io 连接管理
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
│   │   │   ├── BotForm.jsx      # Bot 配置表单
│   │   │   └── ProtectedRoute.jsx # 认证保护路由
│   │   │
│   │   ├── hooks/               # 自定义 Hooks
│   │   │   ├── useSocket.js     # WebSocket 管理
│   │   │   ├── useMessages.js   # 消息状态管理
│   │   │   └── useAuth.js       # 认证状态管理
│   │   │
│   │   ├── context/             # React Context
│   │   │   ├── AuthContext.jsx  # 认证上下文
│   │   │   └── SocketContext.jsx# WebSocket 上下文
│   │   │
│   │   └── styles/              # 样式文件
│   │       ├── global.css       # 全局样式
│   │       └── chat.css         # 聊天界面样式
│   │
│   └── public/                  # 静态资源
│       └── favicon.ico
│
└── scripts/                     # 部署脚本
    ├── deploy.sh                # 部署脚本
    └── seed.sql                 # 初始数据（可选）
```

### 项目依赖 (server/package.json)

```json
{
  "dependencies": {
    "express": "^4.21.x",
    "socket.io": "^4.8.x",
    "better-sqlite3": "^11.x",
    "wechat-enterprise": "^1.x",
    "jsonwebtoken": "^9.x",
    "bcryptjs": "^2.4.x",
    "cors": "^2.8.x",
    "morgan": "^1.10.x",
    "express-validator": "^7.x"
  },
  "devDependencies": {
    "nodemon": "^3.x"
  }
}
```

### 前端依赖 (client/package.json)

```json
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
              │  127.0.0.1:3001  │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   SQLite DB     │
              │  wecom-chat.db  │
              └─────────────────┘
```

### 11.2 Caddy 配置

文件：`/etc/caddy/Caddyfile`

```caddy
chat.zeaho.site {
    # 反向代理到 Node.js 应用
    reverse_proxy 127.0.0.1:3001 {
        # WebSocket 支持
        header_up Upgrade {http.request.header.Upgrade}
        header_up Connection {http.request.header.Connection}
    }

    # 日志
    log {
        output file /var/log/caddy/wecom-chat.log
        format json
    }

    # 安全头
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

> **注意**：如果 Caddy 使用全局配置管理多个站点，只需在已有的 Caddyfile 中添加上述站点块并执行 `caddy reload` 即可。本服务器的 Caddy 版本为 v2.11.3，以上配置语法完全兼容。

### 11.3 systemd 服务单元

文件：`/etc/systemd/system/wecom-bot-webchat.service`

```ini
[Unit]
Description=WeCom Bot WebChat
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/wecom-bot-webchat/server
ExecStart=/usr/bin/node /var/www/wecom-bot-webchat/server/index.js
Restart=always
RestartSec=10

# 环境变量
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=JWT_SECRET=your-jwt-secret-here
Environment=DB_PATH=/var/data/wecom-chat.db

# 日志
StandardOutput=journal
StandardError=journal

# 安全
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

操作命令：

```bash
# 部署二进制/代码后
sudo systemctl daemon-reload
sudo systemctl enable wecom-bot-webchat
sudo systemctl start wecom-bot-webchat

# 查看状态
sudo systemctl status wecom-bot-webchat

# 查看日志
sudo journalctl -u wecom-bot-webchat -f

# 更新后重启
sudo systemctl restart wecom-bot-webchat
```

### 11.4 部署脚本示例

文件：`scripts/deploy.sh`

```bash
#!/bin/bash
set -e

APP_DIR="/var/www/wecom-bot-webchat"
DATA_DIR="/var/data"
REPO_URL="https://github.com/wutao667/wecom-bot-webchat.git"

echo "=== Deploying WeCom Bot WebChat ==="

# 1. 创建目录
sudo mkdir -p $APP_DIR $DATA_DIR

# 2. 拉取代码
if [ -d "$APP_DIR/.git" ]; then
    cd $APP_DIR
    git pull
else
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# 3. 安装服务端依赖
cd $APP_DIR/server
npm install --production

# 4. 构建前端
cd $APP_DIR/client
npm install
npm run build
# 构建产物输出到 server/public/

# 5. 配置环境变量
if [ ! -f "$APP_DIR/server/.env" ]; then
    cp $APP_DIR/server/.env.example $APP_DIR/server/.env
    echo "⚠️  Please configure $APP_DIR/server/.env"
fi

# 6. 重启服务
sudo systemctl daemon-reload
sudo systemctl restart wecom-bot-webchat

echo "=== Deploy complete ==="
```

### 11.5 Nginx 备选配置（如需）

虽然目前使用 Caddy，但作为备选方案也提供 Nginx 配置：

```nginx
server {
    listen 443 ssl;
    server_name chat.zeaho.site;

    ssl_certificate     /etc/ssl/certs/zeaho.site.pem;
    ssl_certificate_key /etc/ssl/private/zeaho.site.key;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 11.6 环境变量配置

文件：`server/.env`

```env
# 服务端口
PORT=3001

# JWT 密钥（生产环境务必修改为随机字符串）
JWT_SECRET=change-this-to-a-random-secret

# 数据库路径
DB_PATH=/var/data/wecom-chat.db

# Node 环境
NODE_ENV=production

# 日志级别
LOG_LEVEL=info
```

---

## 12. 开发计划与里程碑

### 12.1 阶段划分

```
Phase 1 (MVP)    Phase 2 (增强)     Phase 3 (完善)
─────────────────────────────────────────────────►
│                  │                    │
├── 核心功能 ──────┤── 功能增强 ───────┤── 体验优化 ──→
├── Week 1-2      ├── Week 3-4        ├── Week 5-6
```

### 12.2 详细里程碑

#### Phase 1 — MVP 核心功能（第 1-2 周）

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1.1 项目骨架 | 第 1 周 前 3 天 | Express 项目初始化，SQLite 建表，Vite + React 脚手架 |
| M1.2 用户认证 | 第 1 周 中 2 天 | 注册 + 登录 API，前端登录页，JWT 中间件 |
| M1.3 Bot 管理 | 第 1 周 后 2 天 | Bot CRUD API，前端 Bot 管理页 |
| M1.4 回调接收 | 第 2 周 前 3 天 | 回调 URL 验证，消息解密 + 入库 |
| M1.5 消息发送 | 第 2 周 中 2 天 | 通过企微 API 发送消息 + 消息列表 API |
| M1.6 基础 UI | 第 2 周 后 2 天 | 聊天界面（联系人列表、消息列表、输入框）+ WebSocket 实时推送 |

**Phase 1 验收标准：**
- ✅ 用户可注册登录
- ✅ 用户可添加 Bot 配置
- ✅ Bot 回调 URL 验证通过
- ✅ 网页可向企微用户发送文本消息
- ✅ 企微用户发消息 → 网页实时展示
- ✅ 消息记录持久化并可查询

#### Phase 2 — 功能增强（第 3-4 周）

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M2.1 媒体消息 | 第 3 周 前 3 天 | 图片上传 + 发送，文件消息支持 |
| M2.2 联系人同步 | 第 3 周 中 2 天 | 从企微同步通讯录，联系人搜索 |
| M2.3 最近会话 | 第 3 周 后 2 天 | 最近会话列表、未读数标记 |
| M2.4 多 Bot 切换 | 第 4 周 前 2 天 | 侧边栏 Bot 切换，数据隔离 |
| M2.5 Bot 状态监控 | 第 4 周 后 3 天 | 联通性检测，异常告警，自动重连 |

#### Phase 3 — 体验优化（第 5-6 周）

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M3.1 消息搜索 | 第 5 周 前 2 天 | 全局消息搜索 |
| M3.2 消息引用 | 第 5 周 中 2 天 | 消息引用回复 |
| M3.3 暗色模式 | 第 5 周 后 2 天 | 主题切换 |
| M3.4 性能优化 | 第 6 周 前 2 天 | 消息分页加载，虚拟列表 |
| M3.5 数据备份 | 第 6 周 后 3 天 | SQLite 定时备份，恢复脚本 |

---

## 13. 风险与应对措施

### 13.1 风险管理矩阵

| 编号 | 风险 | 概率 | 影响 | 等级 | 应对措施 |
|------|------|------|------|------|----------|
| R-01 | 企微 API 调用频率限制 | 高 | 中 | **高** | 实现 Token 缓存 + 请求队列 + 指数退避重试 |
| R-02 | Access Token 过期导致消息发送失败 | 中 | 中 | **中** | 提前刷新（过期前 10 分钟），请求失败自动重试获取新 Token |
| R-03 | 回调消息重复推送 | 中 | 低 | **中** | 使用 msg_id 去重（数据库 UNIQUE 约束） |
| R-04 | WebSocket 连接断开 | 高 | 中 | **高** | socket.io 自动重连 + 重连后消息同步 |
| R-05 | SQLite 并发写入冲突 | 低 | 中 | **低** | WAL 模式 + 串行化写入 better-sqlite3 |
| R-06 | 企微 API 接口变更 | 低 | 高 | **中** | 封装 API 代理层，变更时只改一处 |
| R-07 | Secret / EncodingAESKey 泄露 | 低 | 高 | **中** | 数据库加密存储敏感字段，配置文件 600 权限 |
| R-08 | 域名/证书过期 | 低 | 高 | **中** | Caddy 自动续期，配置证书到期告警 |
| R-09 | 服务器磁盘空间不足 | 中 | 中 | **中** | 定期清理旧消息，监控磁盘使用率 |
| R-10 | XSS/注入攻击 | 低 | 高 | **中** | 输入清洗，参数化 SQL 查询，CSP 头 |

### 13.2 关键风险应对详述

#### R-01: 企微 API 调用频率

企业微信 API 限制为 600 次/分钟（每应用），超限会返回 `errcode: 45009`。应对方案：

```javascript
class RateLimiter {
  constructor(maxPerMinute = 600) {
    this.queue = [];
    this.windowMs = 60000;
    this.maxPerWindow = maxPerMinute;
  }

  async call(fn) {
    // 使用滑动窗口限流
    const now = Date.now();
    this.queue = this.queue.filter(t => now - t < this.windowMs);
    if (this.queue.length >= this.maxPerWindow) {
      const waitMs = this.queue[0] + this.windowMs - now;
      await sleep(waitMs);
    }
    this.queue.push(Date.now());
    return fn();
  }
}
```

#### R-04: WebSocket 连接管理

```javascript
// 客户端 socket.io 配置
const socket = io('https://chat.zeaho.site', {
  auth: { token: jwtToken },
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  randomizationFactor: 0.5,
});

// 重连后重新加入 Bot 房间
socket.on('connect', () => {
  const cachedBots = getJoinedBots();
  cachedBots.forEach(botId => {
    socket.emit('join_bot', { botId });
  });
});
```

---

## 附录

### A. 数据库迁移脚本

```sql
-- server/db/schema.sql

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
CREATE TABLE IF NOT EXISTS bots (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             TEXT    NOT NULL,
    corpid           TEXT    NOT NULL,
    agentid          INTEGER NOT NULL,
    secret           TEXT    NOT NULL,
    token            TEXT    NOT NULL,
    encoding_aeskey  TEXT    NOT NULL CHECK(length(encoding_aeskey) = 43),
    callback_url     TEXT    DEFAULT NULL,
    status           TEXT    DEFAULT 'inactive' CHECK(status IN ('active','inactive','error')),
    last_error       TEXT    DEFAULT NULL,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bots_user_id ON bots(user_id);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id      INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    direction   TEXT    NOT NULL CHECK(direction IN ('outgoing','incoming')),
    msg_type    TEXT    NOT NULL CHECK(msg_type IN ('text','image','file','voice','video','markdown')),
    content     TEXT    NOT NULL,
    from_user   TEXT    NOT NULL,
    to_user     TEXT    NOT NULL,
    msg_id      TEXT    DEFAULT NULL,
    status      TEXT    DEFAULT 'sent' CHECK(status IN ('sending','sent','delivered','failed')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_messages_bot_id   ON messages(bot_id);
CREATE INDEX idx_messages_created  ON messages(bot_id, created_at DESC);
CREATE UNIQUE INDEX idx_messages_msg_id ON messages(msg_id) WHERE msg_id IS NOT NULL;

-- Access Token 缓存表
CREATE TABLE IF NOT EXISTS access_tokens (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id        INTEGER UNIQUE NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    access_token  TEXT    NOT NULL,
    expires_at    TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 联系人缓存表
CREATE TABLE IF NOT EXISTS contacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id      INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    userid      TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    avatar      TEXT    DEFAULT NULL,
    department  TEXT    DEFAULT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(bot_id, userid)
);
CREATE INDEX idx_contacts_bot_id ON contacts(bot_id);
```

### B. 企微回调数据结构

```xml
<!-- 文本消息回调 XML 示例 -->
<xml>
  <ToUserName><![CDATA[ww123456789]]></ToUserName>
  <FromUserName><![CDATA[zhangsan]]></FromUserName>
  <CreateTime>1719900000</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[你好]]></Content>
  <MsgId>1234567890123456</MsgId>
  <AgentID>1000001</AgentID>
</xml>

<!-- 图片消息回调 XML 示例 -->
<xml>
  <ToUserName><![CDATA[ww123456789]]></ToUserName>
  <FromUserName><![CDATA[zhangsan]]></FromUserName>
  <CreateTime>1719900000</CreateTime>
  <MsgType><![CDATA[image]]></MsgType>
  <PicUrl><![CDATA[http://shp.qpic.cn/...]]></PicUrl>
  <MediaId><![CDATA[media_id_string]]></MediaId>
  <MsgId>1234567890123456</MsgId>
  <AgentID>1000001</AgentID>
</xml>
```

### C. 参考文档

- [企业微信开发文档 — 回调配置](https://developer.work.weixin.qq.com/document/path/90968)
- [企业微信开发文档 — 消息推送](https://developer.work.weixin.qq.com/document/path/90239)
- [企业微信开发文档 — 发送消息](https://developer.work.weixin.qq.com/document/path/90236)
- [企业微信开发文档 — 获取 Access Token](https://developer.work.weixin.qq.com/document/path/91039)
- [socket.io 官方文档](https://socket.io/docs/v4/)
- [better-sqlite3 文档](https://github.com/WiseLibs/better-sqlite3)

---

> 本文档为 WeCom Bot WebChat 项目的完整设计方案。  
> 任何对架构的修改需同步更新本文件。
