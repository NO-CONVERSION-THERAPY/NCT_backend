# NCT API SQL Sub

`nct-api-sql-sub` 是一个独立的 `Cloudflare Workers + D1 + Hono` 服务。
建议将它放在 `nct/nct-api-sql-sub` 目录下，作为与 `nct-api-sql` 同级的单独项目运行与部署。
服务运行时只读取当前项目目录内的 `package.json`、`node_modules`、`wrangler.toml`、`.dev.vars` 和 `migrations`，不会依赖 `nct-api-sql` 目录中的其他文件。

核心能力：

- `nct_form` 与 `nct_databack` 两张 D1 表
- 表字段按传入 JSON 顶层字段自动扩列
- 作为 `No-Torsion` 的后端服务，承接表单、机构修正、翻译与前端运行时保护 token
- 直接输出 `Hono + JSX` 的独立表单、确认页与结果页
- 定时从母库 `nct-api-sql` 拉取公开的 secure records 并写入 `nct_databack`
- 按母库请求把 `nct_databack` 导出成附件文件并回传给母库
- 服务首次执行时向母库报告一次
- 之后每 30 分钟执行一次“拉取母库 + 上报自身状态”

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

返回服务状态、当前 `nct_databack` 版本号和主要路由信息。

### `GET /api/health`

健康检查，包含两张表记录数与当前 `nct_databack` 版本号。

`nct-api-sql-sub` 不再公开通用的 `/api/write`、`/api/data/*`、`/api/report-now`。
正常数据流改为：

- `No-Torsion` 前端通过 `/api/no-torsion/*` 走业务接口
- 子库自己定时从母库拉取 `GET /api/public/secure-records`
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
- 母库灾备回拉这个接口时，必须带可被子库已缓存母库公钥验签通过的 `x-nct-*` ECDSA 请求签名

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
- 子库会在首次成功上报母库后，把母库返回的签名公钥缓存到 `nct_form` 系统记录里

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
- `SERVICE_AUTH_MAX_SKEW_MS`
- `NO_TORSION_GOOGLE_FORM_URL` / `NO_TORSION_FORM_ID`
- `NO_TORSION_CORRECTION_GOOGLE_FORM_URL` / `NO_TORSION_CORRECTION_FORM_ID`
- `NO_TORSION_SITE_URL`
- `NO_TORSION_FORM_PROTECTION_MIN_FILL_MS`
- `NO_TORSION_FORM_PROTECTION_MAX_AGE_MS`

其中：

- `APP_NAME` 不填时默认使用 `NCT API SQL Sub`
- 子库上报时会带上 `serviceWatermark: "nct-api-sql-sub:v1"`；母库识别为子库后，会在上报响应中返回自己的签名公钥，子库会保存到 `__system__:mother_service_public_key`
- 缓存的母库签名公钥只用于两件事：验签母库返回的 `secure-records` payload envelope，以及验签母库灾备回拉 `GET /api/export/nct_databack` 的请求头
- 子库本地普通 JSON 回传给母库时不再额外做字段加密，也不再需要 `DEFAULT_ENCRYPT_FIELDS`、`ENCRYPTION_KEY`、`ENCRYPTION_KEY_VERSION`
- `No-Torsion` 现在只支持 `NO_TORSION_*` 变量名；旧 `FORM_*` / `CORRECTION_*` 兼容别名已删除
- 表单保护 secret 不再通过环境变量输入；服务首次发放表单 token 时会自动生成并保存到 D1 的 `__system__:form_protection_secret`

当 `No-Torsion` 接入本服务时：

- `No-Torsion` 侧将 `NCT_BACKEND_SERVICE_URL` 指向这个服务
- `/api/no-torsion/*` 现已作为浏览器侧业务接口公开，若需要更严格控制，建议在前面放同域代理或可信 BFF，而不是把 secret 下发到前端

注意：

- Cloudflare Workers 没有真正的“部署后立即启动钩子”
- 因此这里的“第一次启动报告”实现为“首次实际执行时报告一次”
- 之后通过 Cron `*/30 * * * *` 每 30 分钟执行一次“从母库拉取公开 secure records + 向母库报告自身状态”

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
