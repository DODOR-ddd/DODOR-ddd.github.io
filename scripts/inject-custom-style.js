// 通过 NEXT 的 theme_inject 注入自定义样式
// 使站点脚本能按名称要求自定义 CSS（不修改 npm 主题源码）
hexo.extend.filter.register('theme_inject', function (injects) {
  injects.style.push('custom/style.styl');
});
