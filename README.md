# NCT API SQL Sub

`nct-api-sql-sub` 是一个独立的 `Cloudflare Workers + D1 + Hono` 服务。
建议将它放在 `nct/nct-api-sql-sub` 目录下，作为与 `nct-api-sql` 同级的单独项目运行与部署。
服务运行时只读取当前项目目录内的 `package.json`、`node_modules`、`wrangler.toml`、`.dev.vars` 和 `migrations`，不会依赖 `nct-api-sql` 目录中的其他文件。

核心能力：

- `nct_form` 与 `nct_databack` 两张 D1 表
- 表字段按传入 JSON 顶层字段自动扩列
- 数据写入与数据请求 API
- 作为 `No-Torsion` 的后端服务，承接表单、机构修正、翻译与前端运行时 token
- 接收母库 `nct-api-sql` 主动推送的第二张表数据并写入 `nct_databack`
- 按母库请求把 `nct_databack` 导出成附件文件并回传给母库
- 服务首次执行时向母库报告一次
- 之后每 30 分钟向母库报告一次当前部署域名与 `nct_databack` 版本号

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

### `POST /api/write`

写入数据。

请求体：

```json
{
  "table": "nct_form",
  "recordKey": "optional-key",
  "payload": {
    "name": "Sub School",
    "province": "河南",
    "age": 18
  },
  "mirrorToDataback": true
}
```

说明：

- `table` 只能是 `nct_form` 或 `nct_databack`
- 当 `table = nct_form` 时，默认会同步镜像写入 `nct_databack`
- `recordKey` 可不传，服务会自动生成

### `GET /api/data/nct_form`

查询 `nct_form` 数据。

支持参数：

- `limit`
- `recordKey`

### `GET /api/data/nct_databack`

查询 `nct_databack` 数据。

支持参数：

- `limit`
- `recordKey`

### `GET /api/data/nct_databack/version`

返回当前 `nct_databack` 最大版本号。

### `POST /api/report-now`

手动触发一次向母库的上报。

### `GET /api/no-torsion/frontend-runtime`

供 `No-Torsion` 前端获取最新表单保护 token。

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

### `POST /api/push/secure-records`

接收母库 `nct-api-sql` 主动推送的第二张表数据，并按母库的 `recordKey`、`version`、`fingerprint` 幂等写入 `nct_databack`。
该接口同时支持 JSON 请求体和 `multipart/form-data` 的 JSON 附件文件；主库默认走文件上传。

### `GET /api/export/nct_databack`

母库使用的导出接口。
会把 `nct_databack` 中 `version > afterVersion` 的记录按 `limit` 导出为 JSON 附件文件返回。

说明：

- 如果记录本身已经是母库推送来的 secure payload，会原样回传
- 如果记录是子库本地写入的普通 JSON，会在导出时使用子库配置的 `ENCRYPTION_KEY` 和 `DEFAULT_ENCRYPT_FIELDS` 转成 secure payload，再回传给母库

## 母库上报

上报内容格式：

```json
{
  "service": "NCT API SQL Sub",
  "serviceUrl": "https://sub.example.com",
  "databackVersion": 12,
  "reportCount": 7,
  "reportedAt": "2026-04-20T13:30:00.000Z"
}
```

其中 `reportCount` 表示该子服务累计执行上报的次数。
这个计数持久化在 `nct_form` 中的一条系统保留记录里，不会额外新增第三张业务表。
系统记录使用保留 `record_key` 前缀 `__system__:`，并且不会出现在正常的数据列表和业务计数中。

需要的环境变量：

- `ENCRYPTION_KEY`
- `DEFAULT_ENCRYPT_FIELDS`
- `ENCRYPTION_KEY_VERSION`
- `SERVICE_PUBLIC_URL`
- `MOTHER_REPORT_URL`
- `MOTHER_REPORT_TOKEN` 可选
- `MOTHER_PUSH_TOKEN` 可选
- `MOTHER_REPORT_TIMEOUT_MS` 可选

如果同时作为 `No-Torsion` 后端，还建议配置：

- `NO_TORSION_SERVICE_TOKEN`
- `NO_TORSION_FORM_PROTECTION_SECRET` 可选
- `NO_TORSION_FORM_DRY_RUN` 可选
- `NO_TORSION_FORM_SUBMIT_TARGET` 可选
- `NO_TORSION_GOOGLE_FORM_URL` / `NO_TORSION_FORM_ID` 可选
- `NO_TORSION_CORRECTION_SUBMIT_TARGET` 可选
- `NO_TORSION_CORRECTION_GOOGLE_FORM_URL` / `NO_TORSION_CORRECTION_FORM_ID` 可选
- `NO_TORSION_SITE_URL` 可选
- `GOOGLE_CLOUD_TRANSLATION_API_KEY` 可选
- `TRANSLATION_PROVIDER_TIMEOUT_MS` 可选

其中：

- `ENCRYPTION_KEY` 需要与母库保持一致，这样母库才能解密子库回传的 secure payload
- `MOTHER_REPORT_TOKEN` 需要与主库 `SUB_REPORT_TOKEN` 保持一致
- `MOTHER_PUSH_TOKEN` 需要与主库 `SUB_PUSH_TOKEN` 保持一致，并同时用于保护 `GET /api/export/nct_databack`

当 `No-Torsion` 接入本服务时：

- `No-Torsion` 侧将 `NCT_BACKEND_SERVICE_URL` 指向这个服务
- `No-Torsion` 侧的 `NCT_BACKEND_SERVICE_TOKEN` 需要与这里的 `NO_TORSION_SERVICE_TOKEN` 保持一致

注意：

- Cloudflare Workers 没有真正的“部署后立即启动钩子”
- 因此这里的“第一次启动报告”实现为“首次实际执行时报告一次”
- 之后通过 Cron `*/30 * * * *` 每 30 分钟报告一次

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
npm run dev
```

如果你当前位于 `nct` 根目录，上面的命令表示进入同级项目 `./nct-api-sql-sub` 后单独启动它，不需要进入 `nct-api-sql` 目录。

本地默认地址：

- Worker: `http://127.0.0.1:8791`
- 健康检查: `http://127.0.0.1:8791/api/health`

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

- `npm run test`
- `npm run check`
- `npm run predev`
- `POST /api/write`
- `GET /api/data/nct_form`
- `GET /api/data/nct_databack`
- `GET /api/data/nct_databack/version`
- `POST /api/push/secure-records`
- `POST /api/report-now`
- `GET /cdn-cgi/handler/scheduled`
