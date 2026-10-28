// 首页摘要：文章没有显式 <!-- more --> 时，自动取正文前约 150 字作为摘要。
// 剔除代码块，只取普通段落文字。hexo 若检测到 <!-- more -->，data.excerpt 已由 hexo 生成，不会覆盖。
hexo.extend.filter.register('after_post_render', function (data) {
  if (!data.excerpt && data.content && data.layout === 'post') {
    const noCode = data.content.replace(/<pre[\s\S]*?<\/pre>/g, ' ');
    const text = noCode.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) data.excerpt = '<div class="excerpt-box">' + text.slice(0, 150) + '…</div>';
  }
  return data;
});
