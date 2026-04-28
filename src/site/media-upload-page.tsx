import type { FC } from 'hono/jsx';
import { MEDIA_PICKER_CSS, MEDIA_PICKER_SCRIPT } from './media-picker-assets';

const MEDIA_PAGE_SCRIPT = `
const form = document.getElementById('media-upload-form');
const statusBox = document.getElementById('media-status');
const tagList = document.getElementById('media-tag-list');
const submitButton = form ? form.querySelector('button[type="submit"]') : null;
const mediaPicker = window.createSchoolMediaPicker('media');

function setStatus(message, isError) {
  statusBox.textContent = message;
  statusBox.dataset.state = isError ? 'error' : 'ok';
}

function setFileStatus(index, message, isError) {
  mediaPicker.setFileStatus(index, message, isError);
}

async function loadTags() {
  const response = await fetch('/api/media/tags');
  if (!response.ok) return;
  const payload = await response.json();
  tagList.innerHTML = '';
  for (const tag of payload.tags || []) {
    const option = document.createElement('option');
    option.value = tag.label;
    tagList.appendChild(option);
  }
}

async function uploadFile(file, index, metadata) {
  setFileStatus(index, '正在上传到后端', false);
  const body = new FormData();
  body.append('file', file, file.name);
  body.append('city', metadata.city);
  body.append('county', metadata.county);
  body.append('province', metadata.province);
  body.append('schoolAddress', metadata.schoolAddress);
  body.append('schoolName', metadata.schoolName);
  body.append('tags', JSON.stringify(metadata.tags));

  const response = await fetch('/api/media/uploads/direct', {
    method: 'POST',
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || '上传失败。');
  }
  setFileStatus(index, '已提交审核：' + payload.media.status, false);
  return payload.media;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const files = mediaPicker.getFiles();
  if (files.length === 0) {
    setStatus('请选择媒体文件。', true);
    return;
  }
  const formData = new FormData(form);

  const metadata = {
    city: String(formData.get('city') || ''),
    county: String(formData.get('county') || ''),
    province: String(formData.get('province') || ''),
    schoolAddress: String(formData.get('schoolAddress') || ''),
    schoolName: String(formData.get('schoolName') || ''),
    tags: String(formData.get('tags') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  };

  let succeeded = 0;
  let failed = 0;
  if (submitButton) submitButton.disabled = true;
  try {
    for (const [index, file] of files.entries()) {
      try {
        await uploadFile(file, index, metadata);
        succeeded += 1;
      } catch (error) {
        failed += 1;
        setFileStatus(index, error instanceof Error ? error.message : '上传失败', true);
      }
      setStatus('上传进度：' + succeeded + ' 成功，' + failed + ' 失败，合计 ' + files.length + ' 个。', failed > 0);
    }
    if (failed === 0) {
      form.reset();
      mediaPicker.clear();
    }
    setStatus('上传完成：' + succeeded + ' 成功，' + failed + ' 失败。', failed > 0);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

loadTags();
`;

export const MediaUploadPage: FC = () => (
  <html lang="zh-CN">
    <head>
      <meta charSet="utf-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <title>学校媒体上传 | NCT API SQL Sub</title>
      <style>{`
        :root {
          color: #172033;
          background: #f6f8fb;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        body {
          margin: 0;
        }
        .shell {
          width: min(880px, calc(100% - 32px));
          margin: 0 auto;
          padding: 36px 0 56px;
        }
        header, form {
          border: 1px solid rgba(32, 48, 76, 0.12);
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 18px 40px rgba(19, 32, 54, 0.08);
        }
        header {
          padding: 26px 30px;
          margin-bottom: 18px;
        }
        h1 {
          margin: 0 0 10px;
          font-size: clamp(1.8rem, 4vw, 2.6rem);
        }
        p {
          margin: 0;
          color: #516070;
          line-height: 1.7;
        }
        form {
          display: grid;
          gap: 18px;
          padding: 26px 30px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        label {
          display: grid;
          gap: 8px;
          font-weight: 700;
        }
        .full {
          grid-column: 1 / -1;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(32, 48, 76, 0.18);
          border-radius: 8px;
          padding: 11px 12px;
          font: inherit;
        }
        .choices {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }
        .choices label {
          display: inline-flex;
          grid-auto-flow: column;
          align-items: center;
          font-weight: 600;
        }
        .choices input {
          width: auto;
        }
        .media-preview-grid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
        .media-preview-grid[hidden] {
          display: none !important;
        }
        .media-preview-card {
          display: grid;
          gap: 10px;
          padding: 12px;
          border: 1px solid rgba(32, 48, 76, 0.12);
          border-radius: 8px;
          background: #f8fafc;
        }
        .media-preview-frame {
          aspect-ratio: 16 / 10;
          overflow: hidden;
          border-radius: 8px;
          background: rgba(23, 32, 51, 0.08);
        }
        .media-preview-frame img,
        .media-preview-frame video {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .media-preview-meta {
          display: grid;
          gap: 4px;
          min-width: 0;
          color: #516070;
          font-size: 0.86rem;
          line-height: 1.45;
        }
        .media-preview-name {
          overflow-wrap: anywhere;
          color: #172033;
          font-weight: 800;
        }
        .media-preview-status[data-state="error"] {
          color: #b42318;
        }
        .media-preview-status[data-state="ok"] {
          color: #047857;
        }
        button {
          justify-self: start;
          border: 0;
          border-radius: 8px;
          background: #1d4ed8;
          color: #fff;
          padding: 12px 18px;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .status {
          min-height: 24px;
          font-weight: 700;
        }
        .status[data-state="error"] {
          color: #b42318;
        }
        .status[data-state="ok"] {
          color: #175cd3;
        }
        ${MEDIA_PICKER_CSS}
        @media (max-width: 720px) {
          .grid {
            grid-template-columns: 1fr;
          }
          header, form {
            padding: 20px;
          }
        }
      `}</style>
    </head>
    <body>
      <main className="shell">
        <header>
          <h1>学校媒体上传</h1>
          <p>媒体按学校归类。上传内容不绑定具体受害者记录，提交后进入后台审核；R18 内容使用 r18 标签标记。</p>
        </header>
        <form id="media-upload-form">
          <div className="grid">
            <label className="full">
              <span>学校名称</span>
              <input maxLength={120} name="schoolName" required />
            </label>
            <label>
              <span>省份</span>
              <input maxLength={80} name="province" />
            </label>
            <label>
              <span>城市</span>
              <input maxLength={80} name="city" />
            </label>
            <label>
              <span>区县</span>
              <input maxLength={80} name="county" />
            </label>
            <label>
              <span>学校地址</span>
              <input maxLength={200} name="schoolAddress" />
            </label>
            <label className="full">
              <span>标签，逗号分隔</span>
              <input list="media-tag-list" maxLength={240} name="tags" placeholder="例如：校门, 宿舍, r18" />
              <datalist id="media-tag-list" />
            </label>
            <div className="full media-picker-field">
              <span>媒体文件</span>
              <button className="media-picker-open-button" id="media-picker-open" type="button">
                选择图片 / 视频
              </button>
              <p className="media-selected-summary" id="media-selected-summary">未选择媒体文件。</p>
            </div>
          </div>
          <button type="submit">上传并提交审核</button>
          <div className="media-preview-grid" hidden id="media-preview-list" />
          <p className="status" id="media-status" />
        </form>
        <div className="media-picker-modal" hidden id="media-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="media-picker-title">
          <div className="media-picker-backdrop" data-media-picker-close="true" />
          <section className="media-picker-panel">
            <div className="media-picker-header">
              <h2 id="media-picker-title">选择学校媒体</h2>
              <button aria-label="关闭" className="media-picker-close" id="media-picker-close" type="button">×</button>
            </div>
            <div className="media-picker-body">
              <div className="media-picker-dropzone" id="media-picker-dropzone">
                <strong>拖拽图片或视频到这里</strong>
                <p>也可以多次点击选择文件，一张一张补齐后再确认。</p>
                <label className="media-picker-secondary media-picker-file-label" id="media-picker-choose">
                  选择文件
                  <input accept="image/gif,image/jpeg,image/png,image/webp,video/mp4,video/webm" className="media-picker-file-input" id="media-file" multiple type="file" />
                </label>
              </div>
              <p className="media-picker-message" id="media-picker-message">拖拽文件到此处，或点击选择文件。</p>
              <div className="media-preview-grid" hidden id="media-picker-draft-list" />
            </div>
            <div className="media-picker-footer">
              <button className="media-picker-secondary" id="media-picker-cancel" type="button">取消</button>
              <button className="media-picker-confirm" id="media-picker-confirm" type="button">确定</button>
            </div>
          </section>
        </div>
      </main>
      <script dangerouslySetInnerHTML={{ __html: MEDIA_PICKER_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: MEDIA_PAGE_SCRIPT }} />
    </body>
  </html>
);
