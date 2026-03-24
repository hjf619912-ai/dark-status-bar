/**
 * Dark 状态栏加载脚本（用于酒馆世界书/预设等）
 * 包装一层并强制限制宽度，避免小屏溢出
 */
$(() => {
  const pageUrl = '/dark/index.html';
  const baseUrl = '/dark';

  $.get(pageUrl, (htmlText) => {
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    const root = doc.querySelector('#root');
    const rootHtml = root ? root.outerHTML : '<div id="root"></div>';

    // 包装层：手机用满宽，避免被压窄
    const wrap = `<div class="dark-embed-wrap" style="width:100%;min-width:100%;max-width:100vw;overflow-x:hidden;box-sizing:border-box;">${rootHtml}</div>`;

    $('body').html(wrap);

    // 同时给 body 加防护，手机用满宽
    $('body').css({ overflowX: 'hidden', width: '100%', maxWidth: '100vw' });
    $('html').css('overflowX', 'hidden');

    $('head').find('link[data-dark-css="1"]').remove();
    $('head').append(`<link rel="stylesheet" data-dark-css="1" href="${baseUrl}/assets/index.css">`);

    const old = document.getElementById('dark-remote-module');
    if (old) old.remove();

    const s = document.createElement('script');
    s.id = 'dark-remote-module';
    s.type = 'module';
    s.src = `${baseUrl}/assets/index.js`;
    document.body.appendChild(s);
  });
});
