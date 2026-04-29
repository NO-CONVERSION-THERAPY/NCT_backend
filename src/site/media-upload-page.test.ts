import { renderToString } from 'hono/jsx/dom/server';
import { describe, expect, it } from 'vitest';
import { MediaUploadPage } from './media-upload-page';

describe('MediaUploadPage', () => {
  it('renders a native-label file picker for mobile browsers', () => {
    const html = renderToString(MediaUploadPage({}));

    expect(html).toContain('media-picker-file-label');
    expect(html).toMatch(/<input(?=[^>]*id="media-file")(?![^>]*hidden)[^>]*>/);
    expect(html).toContain('data-empty-summary="未选择媒体文件。"');
    expect(html).toContain('data-media-tag-limit="20"');
    expect(html).toContain('hidden="" id="media-tag-dropdown"');
    expect(html).toContain('data-media-tag-preset="校门"');
    expect(html).toContain('data-media-tag-preset="精神控制"');
    expect(html).toContain('split(/[,，]/)');
    expect(html).not.toContain('推荐标签');
    expect(html).not.toContain('扩展标签');
    expect(html).not.toContain('fileInput.click()');
  });

  it('moves the picker dialog to the body so fixed positioning stays viewport-relative', () => {
    const html = renderToString(MediaUploadPage({}));

    expect(html).toContain('dialog.parentElement !== document.body');
    expect(html).toContain('document.body.appendChild(dialog)');
  });
});
