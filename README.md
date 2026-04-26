# NCT API SQL Sub

`nct-api-sql-sub` 是一个独立的 `Cloudflare Workers + D1 + Hono` 服务。
建议将它放在 `nct/nct-api-sql-sub` 目录下，作为与 `nct-api-sql` 同级的单独项目运行与部署。
服务运行时只读取当前项目目录内的 `package.json`、`node_modules`、`wrangler.toml`、`.dev.vars` 和 `migrations`，不会依赖 `nct-api-sql` 目录中的其他文件。

核心能力：

- `nct_form` 与 `nct_databack` 两张 D1 表
- 表字段按传入 JSON 顶层字段自动扩列
- 作为 `No-Torsion` 的后端服务，承接表单、机构修正、翻译与前端运行时保护 token
- 直接输出 `Hono + JSX` 的独立表单、确认页与结果页
- 接收母库 `nct-api-sql` 推送的公开 secure records 并写入 `nct_databack`
- 按母库请求把 `nct_databack` 导出成附件文件并回传给母库
- 服务首次执行时向母库报告一次
- 之后每 30 分钟向母库上报自身状态，每分钟尝试回传待同步表单记录

## 表结构

### `nct_form`

用于接收原始写入数据，保留完整 `payload_json`，并按 payload 顶层字段自动新增动态列。

固定系统列：

- `id`
- `record_key`
- `payload_json`
- `created_at`
- `updated_at`

### `nct_databack`

作为子库对外请求的数据表，保留完整 `payload_json`，并维护版本号。

固定系统列：

- `id`
- `record_key`
- `payload_json`
- `version`
- `fingerprint`
- `created_at`
- `updated_at`

版本规则：

- 新记录写入时，`version = 当前最大版本 + 1`
- 相同 `record_key` 再次写入且 payload 未变化时，版本不变
- 相同 `record_key` 再次写入且 payload 变化时，版本递增

## 动态扩列

当 payload 出现新的顶层字段时，服务会对对应表自动执行 `ALTER TABLE ... ADD COLUMN`。

例如：

```json
{
  "name": "Sub School",
  "province": "河南",
  "age": 18
}
```

可能会生成类似列：

- `name_136nuu`
- `province_71r0hx`
- `age_ca1uak`

说明：

- 列名会做安全规整并带短哈希，避免冲突
- 标量会以字符串形式写入动态列
- 对象和数组会序列化成 JSON 字符串写入动态列
- 原始完整 JSON 仍保留在 `payload_json`

## API

### `GET /`

直接输出独立 Hono JSX 表单页。
适合本地启动后直接打开 Worker 根地址填写问卷。

### `GET /api/health`

健康检查，包含两张表记录数与当前 `nct_databack` 版本号。

`nct-api-sql-sub` 不再公开通用的 `/api/write`、`/api/data/*`、`/api/report-now`。
正常数据流改为：

- `No-Torsion` 前端通过 `/api/no-torsion/*` 走业务接口
- 母库把公开的 secure records 推送到子库 `POST /api/push/secure-records`
- 母库只在灾备时访问 `GET /api/export/nct_databack`

### `GET /api/no-torsion/frontend-runtime`

供 `No-Torsion` 前端获取最新表单保护 token。

### `GET /form`

直接输出独立 Hono JSX 表单页。
适合把前端“填写入口”直接跳到这个页面。

兼容旧路径：

- `GET /no-torsion/form`

### `POST /form`

处理独立表单页提交，返回 Hono JSX 预览页或确认页。

兼容旧路径：

- `POST /no-torsion/form`

### `POST /form/confirm`

处理独立表单页的最终确认提交流程，并返回 Hono JSX 结果页。

兼容旧路径：

- `POST /no-torsion/form/confirm`

### `POST /api/no-torsion/form/prepare`

供 `No-Torsion` 主表单在真正提交前执行：

- 防刷 token 校验
- 表单字段校验与规范化
- 预览模式 / 确认模式分流

### `POST /api/no-torsion/form/confirm`

供 `No-Torsion` 主表单确认页执行最终投递。
根据配置可投递到：

- Google Form
- 本地 D1
- 两者同时

### `POST /api/no-torsion/correction/submit`

供 `No-Torsion` 机构信息补充 / 修正表单提交。

### `POST /api/no-torsion/translate-text`

供 `No-Torsion` 详情页调用明细翻译能力。

### `GET /api/export/nct_databack`

母库使用的导出接口。
会把 `nct_databack` 中 `version > afterVersion` 的记录按 `limit` 导出为 JSON 附件文件返回。

说明：

- 如果记录本身已经是母库推送来的 secure payload，会原样回传
- 如果记录是子库本地写入的普通 JSON，会原样回传；母库收到后再按自己的 `ENCRYPTION_KEY` 重新生成 t2
- 这个导出接口要求母库带 `Authorization: Bearer <30秒HMAC>`；双方用子库 `serviceUrl` 派生短期 token，导出包本身明文返回
- 子库会对这个接口做频次限制，默认 `DATABACK_EXPORT_MIN_INTERVAL_MS=60000`

## 母库上报

上报内容格式：

```json
{
  "service": "NCT API SQL Sub",
  "serviceWatermark": "nct-api-sql-sub:v1",
  "serviceUrl": "https://sub.example.com",
  "databackVersion": 12,
  "reportCount": 7,
  "reportedAt": "2026-04-20T13:30:00.000Z"
}
```

其中 `reportCount` 表示该子服务累计执行上报的次数。
这个计数持久化在 `nct_form` 中的一条系统保留记录里，不会额外新增第三张业务表。
系统记录使用保留 `record_key` 前缀 `__system__:`，并且不会出现在正常的数据列表和业务计数中。

环境变量模板：

```bash
cp .env.example .dev.vars
```

[`./.env.example`](./.env.example) 已按修改必要性排序列出当前项目的全部环境变量。
本地 Wrangler 读取 `.dev.vars`；线上部署时，把同名键写入 Cloudflare Variables / Secrets。

#### 必填环境变量

完整 mother/sub 同步与灾备链路至少需要先确认这些值：

- 平台绑定必填但不写进 `.env`：`DB`，在 [`wrangler.toml`](./wrangler.toml) 中绑定 D1
- `SERVICE_PUBLIC_URL`
- `MOTHER_REPORT_URL`

生产部署还需要确认这些前提：

- 子库现在不再要求额外配置母库公钥、旧 token 或本地导出加密密钥
- 子库和母库之间所有请求都用 `SERVICE_PUBLIC_URL` / `serviceUrl` 派生的 30 秒 HMAC Bearer token 验证

如果同时作为 `No-Torsion` 后端并希望真实落库，而不是只停留在预览页，建议明确设置：

- `NO_TORSION_FORM_DRY_RUN=false`

默认行为：

- `NO_TORSION_FORM_DRY_RUN=true`
- `NO_TORSION_FORM_SUBMIT_TARGET=both`
- `NO_TORSION_CORRECTION_SUBMIT_TARGET=both`

按功能必填：

- `GOOGLE_CLOUD_TRANSLATION_API_KEY` 仅在你要启用 `/api/no-torsion/translate-text` 时需要

其他常用但可选变量：

- `APP_NAME`
- `MOTHER_REPORT_TIMEOUT_MS`
- `DATABACK_EXPORT_MIN_INTERVAL_MS`
- `NO_TORSION_GOOGLE_FORM_URL` / `NO_TORSION_FORM_ID`
- `NO_TORSION_CORRECTION_GOOGLE_FORM_URL` / `NO_TORSION_CORRECTION_FORM_ID`
- `NO_TORSION_SITE_URL`
- `NO_TORSION_FORM_PROTECTION_MIN_FILL_MS`
- `NO_TORSION_FORM_PROTECTION_MAX_AGE_MS`

其中：

- `APP_NAME` 不填时默认使用 `NCT API SQL Sub`
- 子库上报时会带上 `serviceWatermark: "nct-api-sql-sub:v1"`；母库用它确认协议类型，但真正认证靠 30 秒 HMAC
- `SERVICE_PUBLIC_URL` 必须稳定；它既是子库登记 URL，也是上报、表单回传、母库推送和灾备回拉的 HMAC seed
- `nct_databack` 传输本身不再加密；请求身份通过 HMAC Bearer token 验证
- 子库本地普通 JSON 回传给母库时不再额外做字段加密，也不再需要 `DEFAULT_ENCRYPT_FIELDS`、`ENCRYPTION_KEY`、`ENCRYPTION_KEY_VERSION`
- `No-Torsion` 现在只支持 `NO_TORSION_*` 变量名；旧 `FORM_*` / `CORRECTION_*` 兼容别名已删除
- `NO_TORSION_GOOGLE_FORM_URL` / `NO_TORSION_CORRECTION_GOOGLE_FORM_URL` 可以填写完整 Google Form 链接，支持 `/forms/d/<id>`、`/forms/d/<id>/viewform`、`/forms/d/<id>/prefill`、`/forms/d/e/<id>/viewform` 和 `/formResponse` 形态；`NO_TORSION_FORM_ID` / `NO_TORSION_CORRECTION_FORM_ID` 可以填写 raw form ID
- 表单保护 secret 不再通过环境变量输入；服务首次发放表单 token 时会自动生成并保存到 D1 的 `__system__:form_protection_secret`

当 `No-Torsion` 接入本服务时：

- `No-Torsion` 侧将 `NCT_BACKEND_SERVICE_URL` 指向这个服务
- `/api/no-torsion/*` 现已作为浏览器侧业务接口公开，若需要更严格控制，建议在前面放同域代理或可信 BFF，而不是把 secret 下发到前端

注意：

- Cloudflare Workers 没有真正的“部署后立即启动钩子”
- 因此这里的“第一次启动报告”实现为“首次实际执行时报告一次”
- 之后通过 Cron `*/30 * * * *` 每 30 分钟向母库报告自身状态，并通过 `* * * * *` 每分钟尝试回传待同步表单记录

本地开发默认在 `.dev.vars` 中把 `MOTHER_REPORT_URL` 设为空，因此手动或定时上报会返回：

```json
{
  "delivered": false,
  "skipped": true,
  "reason": "MOTHER_REPORT_URL is not configured."
}
```

## 开发

```bash
cd nct-api-sql-sub
npm install
cp .env.example .dev.vars
npm run dev
```

如果你当前位于 `nct` 根目录，上面的命令表示进入同级项目 `./nct-api-sql-sub` 后单独启动它，不需要进入 `nct-api-sql` 目录。

本地默认地址：

- Worker: `http://127.0.0.1:8791`
- 健康检查: `http://127.0.0.1:8791/api/health`

## Cloudflare Workers 部署

本文档示例使用 `https://sub.example.com` 作为子库域名，并假设母库已经部署在 `https://api.example.com`。

### 1. 登录并创建 D1

```bash
npx wrangler login
npx wrangler whoami
npm install
npx wrangler d1 create nct-api-sql-sub
```

把命令返回的 `database_id` 写回 [`wrangler.toml`](./wrangler.toml)：

```toml
[[d1_databases]]
binding = "DB"
database_name = "nct-api-sql-sub"
database_id = "替换为线上 D1 database_id"
migrations_dir = "./migrations"
```

### 2. 绑定自定义域名

建议使用 Workers Custom Domains 绑定 `sub.example.com`。用 `wrangler.toml` 管理时加入：

```toml
[[routes]]
pattern = "sub.example.com"
custom_domain = true
```

也可以在 Cloudflare Dashboard 的 Worker 设置页中添加 Custom Domain。正式环境如果不想暴露 `*.workers.dev`，把 `workers_dev = false`。

### 3. 设置生产变量

修改 [`wrangler.toml`](./wrangler.toml) 的 `[vars]`：

```toml
[vars]
APP_NAME = "NCT API SQL Sub"
SERVICE_PUBLIC_URL = "https://sub.example.com"
MOTHER_REPORT_URL = "https://api.example.com/api/sub/report"
MOTHER_REPORT_TIMEOUT_MS = "10000"
NO_TORSION_FORM_DRY_RUN = "false"
NO_TORSION_FORM_SUBMIT_TARGET = "d1"
NO_TORSION_CORRECTION_SUBMIT_TARGET = "d1"
```

提交目标可以按实际需要调整：

- `d1`：只写入子库 D1，再由子库回传母库。
- `google`：只投递 Google Form。
- `both`：同时写 D1 和 Google Form。

如果启用翻译，设置：

```bash
npx wrangler secret put GOOGLE_CLOUD_TRANSLATION_API_KEY
```

如果要覆盖默认 Google Form，也可以把下面这些值放入 `[vars]` 或 Secrets：

```text
NO_TORSION_GOOGLE_FORM_URL="https://docs.google.com/forms/d/e/1FAIpQLScolfqJ9dbvJxhjoKYVlmKGwHmy7RiQThutDXpKj7W7jGytfg/viewform?usp=publish-editor"
NO_TORSION_FORM_ID
NO_TORSION_CORRECTION_GOOGLE_FORM_URL
NO_TORSION_CORRECTION_FORM_ID
```

### 4. 远端迁移并部署

```bash
npm run db:migrate:remote
npm run deploy
```

部署后访问一次：

```text
https://sub.example.com/api/health
https://sub.example.com/form
```

Workers 没有部署后启动钩子，所以首次 report 会在第一次实际请求或后续 Cron 中发生。回到母库 `https://api.example.com/Console`，确认子库上报已经被记录。

### 5. Cloudflare Dashboard 网页端部署

如果希望主要在 Cloudflare 网页上完成部署，可以使用 Workers Builds 连接 Git 仓库。网页部署仍会读取本目录的 [`wrangler.toml`](./wrangler.toml)，因此先确认 `name = "nct-api-sql-sub"`、`main = "src/index.ts"`、`compatibility_date`、Cron 和 `DB` 绑定都已提交到仓库；不要把示例里的 `database_id = "00000000-0000-0000-0000-000000000000"` 留在线上配置中。

推荐步骤：

1. 在 Cloudflare Dashboard 进入 `Workers & Pages`，创建或选择名为 `nct-api-sql-sub` 的 Worker。
2. 打开该 Worker 的 `Settings` -> `Builds`，选择 `Connect`，连接 GitHub / GitLab 仓库。
3. 构建设置按项目位置填写：
   - Repository root 如果是整个 `nct` 仓库，Root directory 填 `NCT_backend`；如果本项目是独立仓库，留空或填 `/`。
   - Production branch 填实际生产分支，例如 `main`。
   - Build command 填 `npm run check`，用于部署前跑类型检查和测试。
   - Deploy command 填 `npx wrangler deploy`。
4. 在 `D1 SQL database` 页面创建数据库 `nct-api-sql-sub`，复制数据库 ID，写回并提交 [`wrangler.toml`](./wrangler.toml) 的 `[[d1_databases]]`；也可以在 Worker 的 `Settings` -> `Bindings` 手动添加 `D1 database` 绑定，变量名必须是 `DB`。
5. 在 D1 数据库的 `Console` 中按文件名顺序执行 [`migrations`](./migrations) 里的 SQL。更稳妥的方式仍是在本地执行 `npm run db:migrate:remote`，避免漏跑某个 migration。
6. 在 Worker 的 `Settings` -> `Variables and Secrets` 中添加生产配置：
   - Variables：`APP_NAME`、`SERVICE_PUBLIC_URL`、`MOTHER_REPORT_URL`、`MOTHER_REPORT_TIMEOUT_MS`、`DATABACK_EXPORT_MIN_INTERVAL_MS`、`NO_TORSION_FORM_DRY_RUN`、`NO_TORSION_FORM_SUBMIT_TARGET`、`NO_TORSION_CORRECTION_SUBMIT_TARGET`
   - Secrets：`GOOGLE_CLOUD_TRANSLATION_API_KEY` 等不应公开的密钥
7. 在 `Settings` -> `Triggers` 确认 Cron 触发器包含 `*/30 * * * *` 和 `* * * * *`。
8. 在 `Settings` -> `Domains & Routes` -> `Add` -> `Custom Domain` 绑定 `sub.example.com`。
9. 推送一个提交触发 Workers Builds。部署成功后访问 `https://sub.example.com/api/health` 和 `https://sub.example.com/form`，再回到母库 Console 确认子库已上报。

Cloudflare 官方参考：[`Workers Builds`](https://developers.cloudflare.com/workers/ci-cd/builds/)、[`D1 Dashboard`](https://developers.cloudflare.com/d1/get-started/)、[`Variables and Secrets`](https://developers.cloudflare.com/workers/configuration/secrets/)、[`Custom Domains`](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

## 测试

```bash
npm run typecheck
npm run test
```

如果你只想验证独立 Hono JSX 页面：

```bash
npm run test:jsx
```

当前 JSX 验证会直接覆盖：

- `NoTorsionStandaloneFormPage`
- `NoTorsionStandalonePreviewPage`
- `NoTorsionStandaloneResultPage`

这些测试会在 Node 环境里直接调用 `renderToString(...)`，确认 `hono/jsx` 产物可以正常服务端渲染，而不是只测路由字符串拼接。

## D1

首次本地开发前会自动执行 migration：

```bash
npm run predev
```

手动执行：

```bash
npm run db:migrate
```

远端执行：

```bash
npm run db:migrate:remote
```

## 验证

已经本地验证通过：

- `npm run typecheck`
- `npm run test`
- `npm run test:jsx`
- `npm run check`
- `npm run predev`
- `GET /api/no-torsion/frontend-runtime`
- `POST /api/no-torsion/form/prepare`
- `POST /api/no-torsion/form/confirm`
- `POST /api/no-torsion/correction/submit`
- `POST /api/no-torsion/translate-text`
- `GET /api/export/nct_databack`
- `GET /cdn-cgi/handler/scheduled`
