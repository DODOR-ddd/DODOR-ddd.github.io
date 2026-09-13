(() => {
  'use strict';

  const BRAND = [
    ' ____      ___     ____      ___     ____',
    '|  _ \\    / _ \\   |  _ \\    / _ \\   |  _ \\',
    '| | | |  | | | |  | | | |  | | | |  | |_) |',
    '| |_| |  | |_| |  | |_| |  | |_| |  |  _ <',
    '|____/    \\___/   |____/    \\___/   |_| \\_\\'
  ].join('\n');

  const PALETTE = '.,-~:;=!*@$';

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createDonut(node) {
    const width = 52;
    const height = 20;
    const size = width * height;
    const chars = new Array(size);
    const depth = new Float32Array(size);
    let angleA = 0;
    let angleB = 0;
    let running = true;
    let visible = true;
    let lastFrame = 0;

    function render() {
      chars.fill(' ');
      depth.fill(0);

      const sinA = Math.sin(angleA);
      const cosA = Math.cos(angleA);
      const sinB = Math.sin(angleB);
      const cosB = Math.cos(angleB);

      for (let j = 0; j < 6.28; j += 0.09) {
        const sinJ = Math.sin(j);
        const cosJ = Math.cos(j);

        for (let i = 0; i < 6.28; i += 0.035) {
          const sinI = Math.sin(i);
          const cosI = Math.cos(i);
          const ring = cosJ + 2;
          const inverseZ = 1 / (sinI * ring * sinA + sinJ * cosA + 5);
          const rotated = sinI * ring * cosA - sinJ * sinA;
          const x = Math.floor(width / 2 + 19 * inverseZ * (cosI * ring * cosB - rotated * sinB));
          const y = Math.floor(height / 2 + 10 * inverseZ * (cosI * ring * sinB + rotated * cosB));
          const luminance = Math.floor(8 * (
            (sinJ * sinA - sinI * cosJ * cosA) * cosB
            - sinI * cosJ * sinA
            - sinJ * cosA
            - cosI * cosJ * sinB
          ));

          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          const offset = x + width * y;
          if (inverseZ <= depth[offset]) continue;
          depth[offset] = inverseZ;
          chars[offset] = PALETTE[Math.max(0, Math.min(PALETTE.length - 1, luminance))];
        }
      }

      let frame = '';
      for (let row = 0; row < height; row++) {
        frame += chars.slice(row * width, (row + 1) * width).join('').trimEnd();
        if (row !== height - 1) frame += '\n';
      }
      node.textContent = frame;
      angleA += 0.055;
      angleB += 0.025;
    }

    function animate(now) {
      if (running && visible && now - lastFrame > 42) {
        render();
        lastFrame = now;
      }
      window.requestAnimationFrame(animate);
    }

    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(entries => { visible = entries[0].isIntersecting; })
      : null;
    if (observer) observer.observe(node);

    render();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.requestAnimationFrame(animate);
    }

    return {
      toggle() {
        running = !running;
        if (running) render();
        return running;
      }
    };
  }

  function boot() {
    if (document.querySelector('.ascii-shell')) return;

    const legacy = document.getElementById('d3');
    if (legacy) legacy.remove();

    const shell = make('section', 'ascii-shell');
    shell.setAttribute('role', 'dialog');
    shell.setAttribute('aria-modal', 'true');
    shell.setAttribute('aria-hidden', 'true');
    shell.setAttribute('aria-label', 'DODOR interactive ASCII shell');
    shell.inert = true;

    const bar = make('div', 'ascii-shell__bar');
    const lights = make('span', 'ascii-shell__lights');
    lights.setAttribute('aria-hidden', 'true');
    lights.append(make('i'), make('i'), make('i'));
    const close = make('button', 'ascii-shell__live', '~ / ESC');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close ASCII shell');
    bar.append(
      lights,
      make('span', 'ascii-shell__title', 'dodor@blog: ~'),
      close
    );

    const viewport = make('div', 'ascii-shell__viewport');
    const brandWrap = make('div', 'ascii-shell__brand-wrap');
    const brand = make('div', 'ascii-shell__brand');
    brand.setAttribute('role', 'img');
    brand.setAttribute('aria-label', 'DODOR');
    brandWrap.append(brand);

    const sceneWrap = make('div', 'ascii-shell__scene-wrap');
    const scene = make('div', 'ascii-shell__scene');
    scene.setAttribute('role', 'img');
    scene.setAttribute('aria-label', 'Rotating ASCII torus');
    sceneWrap.append(scene);
    viewport.append(brandWrap, sceneWrap);

    const consoleBox = make('div', 'ascii-shell__console');
    const output = make('div', 'ascii-shell__output', '');
    output.setAttribute('aria-live', 'polite');
    const form = make('form', 'ascii-shell__form');
    const prompt = make('label', 'ascii-shell__prompt');
    const input = make('input', 'ascii-shell__input');
    const promptPath = make('span', 'ascii-shell__prompt-path', '~');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Terminal command');
    prompt.append(
      make('span', 'ascii-shell__prompt-user', 'dodor@blog:'),
      promptPath,
      make('span', 'ascii-shell__prompt-mark', '$'),
      input
    );
    form.append(prompt);
    consoleBox.append(output, form);

    shell.append(bar, viewport, consoleBox);
    document.body.appendChild(shell);

    const engine = createDonut(scene);
    const cursor = make('span', 'ascii-shell__cursor');
    cursor.setAttribute('aria-hidden', 'true');
    let position = 0;
    let typingTimer = 0;

    function printBrand() {
      brand.textContent = BRAND.slice(0, position++);
      brand.appendChild(cursor);
      if (position <= BRAND.length) typingTimer = window.setTimeout(printBrand, 9);
    }

    function startBrand() {
      window.clearTimeout(typingTimer);
      position = 0;
      brand.textContent = '';
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        brand.textContent = BRAND;
        brand.appendChild(cursor);
      } else {
        printBrand();
      }
    }

    function openShell() {
      shell.classList.add('is-open');
      shell.setAttribute('aria-hidden', 'false');
      shell.inert = false;
      document.body.classList.add('ascii-shell-open');
      startBrand();
      window.setTimeout(() => input.focus(), 30);
    }

    function closeShell() {
      shell.classList.remove('is-open');
      shell.setAttribute('aria-hidden', 'true');
      shell.inert = true;
      document.body.classList.remove('ascii-shell-open');
      window.clearTimeout(typingTimer);
    }

    function toggleShell() {
      if (shell.classList.contains('is-open')) closeShell();
      else openShell();
    }

    const rootPath = '/home/dodor/blog';
    const commands = ['cat', 'cd', 'clear', 'date', 'donut', 'echo', 'exit', 'help', 'history', 'hostname', 'ls', 'open', 'pwd', 'uname', 'whoami'];
    const terminal = {
      cwd: [],
      history: [],
      historyIndex: 0,
      transcript: [],
      posts: [],
      tags: new Map(),
      categories: new Map(),
      indexPromise: null
    };

    function tokenize(raw) {
      return (raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [])
        .map(token => token.replace(/^(["'])|(["'])$/g, ''));
    }

    function displayPath(parts = terminal.cwd) {
      return parts.length ? `~/${parts.join('/')}` : '~';
    }

    function syncPrompt() {
      promptPath.textContent = displayPath();
    }

    function appendOutput(text) {
      if (text !== undefined && text !== '') terminal.transcript.push(String(text));
      if (terminal.transcript.length > 120) terminal.transcript.splice(0, terminal.transcript.length - 120);
      output.textContent = terminal.transcript.join('\n');
      output.scrollTop = output.scrollHeight;
    }

    function resolvePath(rawPath = '.') {
      let path = rawPath;
      let parts;
      if (path === '~' || path.startsWith('~/')) {
        parts = [];
        path = path.slice(1);
      } else if (path === rootPath || path.startsWith(`${rootPath}/`)) {
        parts = [];
        path = path.slice(rootPath.length);
      } else if (path.startsWith('/')) {
        return null;
      } else {
        parts = terminal.cwd.slice();
      }

      path.split('/').filter(Boolean).forEach(part => {
        if (part === '.') return;
        if (part === '..') parts.pop();
        else parts.push(part);
      });
      return parts;
    }

    function directoryKind(parts) {
      if (!parts || parts.length > 1) return null;
      if (parts.length === 0) return 'root';
      return ['posts', 'tags', 'categories'].includes(parts[0]) ? parts[0] : null;
    }

    function cleanArticleContent(html) {
      const documentNode = new DOMParser().parseFromString(html, 'text/html');
      documentNode.querySelectorAll('script, style, .line-numbers-rows').forEach(node => node.remove());
      return (documentNode.body.innerText || documentNode.body.textContent || '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    async function loadBlogIndex() {
      if (terminal.indexPromise) return terminal.indexPromise;
      terminal.indexPromise = fetch('/search.xml')
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then(xmlText => {
          const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
          terminal.posts = Array.from(xml.querySelectorAll('entry')).map(entry => {
            const title = entry.querySelector('title')?.textContent.trim() || 'untitled';
            const url = entry.querySelector('url')?.textContent.trim() || '/';
            const segment = new URL(url, window.location.origin).pathname.split('/').filter(Boolean).pop();
            const baseName = segment ? decodeURIComponent(segment) : title.replace(/[\\/]/g, '-');
            return {
              title,
              url,
              file: `${baseName}.txt`,
              content: cleanArticleContent(entry.querySelector('content')?.textContent || ''),
              tags: Array.from(entry.querySelectorAll('tag')).map(node => node.textContent.trim()).filter(Boolean),
              categories: Array.from(entry.querySelectorAll('category')).map(node => node.textContent.trim()).filter(Boolean)
            };
          });

          terminal.posts.forEach(post => {
            post.tags.forEach(tag => {
              if (!terminal.tags.has(tag)) terminal.tags.set(tag, []);
              terminal.tags.get(tag).push(post);
            });
            post.categories.forEach(category => {
              if (!terminal.categories.has(category)) terminal.categories.set(category, []);
              terminal.categories.get(category).push(post);
            });
          });
        })
        .catch(() => {
          terminal.posts = Array.from(document.querySelectorAll('.post-title-link')).map(link => ({
            title: link.textContent.trim(),
            url: link.getAttribute('href'),
            file: `${link.textContent.trim().replace(/[\\/]/g, '-')}.txt`,
            content: 'Open this file with: open <filename>',
            tags: [],
            categories: []
          }));
        });
      return terminal.indexPromise;
    }

    function directoryEntries(kind) {
      if (kind === 'root') return ['README', 'about.txt', 'categories/', 'posts/', 'tags/'];
      if (kind === 'posts') return terminal.posts.map(post => post.file);
      const collection = kind === 'tags' ? terminal.tags : terminal.categories;
      return Array.from(collection.keys()).sort((a, b) => a.localeCompare(b, 'zh-CN')).map(name => `${name}.txt`);
    }

    function fileAt(parts) {
      if (!parts || parts.length === 0) return null;
      if (parts.length === 1 && parts[0] === 'README') {
        return { name: 'README', content: "DODOR's BLOG\n\nposts/       blog articles\ntags/        articles grouped by tag\ncategories/  articles grouped by category\nabout.txt    about this site", url: '/' };
      }
      if (parts.length === 1 && parts[0] === 'about.txt') {
        return { name: 'about.txt', content: 'DODOR\nCTF reproductions, Rust notes and experiments.', url: '/about/' };
      }
      if (parts.length !== 2) return null;
      if (parts[0] === 'posts') return terminal.posts.find(post => post.file === parts[1]) || null;
      const collection = parts[0] === 'tags' ? terminal.tags : parts[0] === 'categories' ? terminal.categories : null;
      if (!collection || !parts[1].endsWith('.txt')) return null;
      const name = parts[1].slice(0, -4);
      const posts = collection.get(name);
      if (!posts) return null;
      return {
        name: parts[1],
        content: posts.map(post => `${post.title}\n  ${post.url}`).join('\n\n'),
        url: parts[0] === 'tags' ? `/tags/#${encodeURIComponent(name)}` : `/categories/#${encodeURIComponent(name)}`
      };
    }

    async function listTarget(path, longFormat, showAll) {
      await loadBlogIndex();
      const parts = resolvePath(path);
      if (!parts) return `ls: cannot access '${path}': No such file or directory`;
      const kind = directoryKind(parts);
      if (kind) {
        const entries = directoryEntries(kind);
        if (showAll) entries.unshift('./', '../');
        if (!longFormat) return entries.join('  ');
        const rows = [`total ${entries.length * 4}`];
        entries.forEach(name => {
          const directory = name.endsWith('/');
          const size = directory ? 4096 : Math.max(64, (fileAt([...parts, name])?.content || '').length);
          rows.push(`${directory ? 'd' : '-'}r--r--r--  1 dodor blog ${String(size).padStart(6)} Sep 13 14:41 ${name}`);
        });
        return rows.join('\n');
      }
      const file = fileAt(parts);
      return file ? parts.at(-1) : `ls: cannot access '${path}': No such file or directory`;
    }

    async function run(rawCommand) {
      const raw = rawCommand.trim();
      const args = tokenize(raw);
      const command = (args.shift() || '').toLowerCase();
      if (!command) return;

      terminal.history.push(raw);
      terminal.historyIndex = terminal.history.length;
      if (command === 'clear') {
        terminal.transcript = [];
        output.textContent = '';
        return;
      }

      appendOutput(`dodor@blog:${displayPath()}$ ${raw}`);
      let result = '';

      if (command === 'help') {
        result = 'cat  cd  clear  date  echo  exit  history  hostname  ls  open  pwd  uname  whoami';
      } else if (command === 'pwd') {
        result = `${rootPath}${terminal.cwd.length ? `/${terminal.cwd.join('/')}` : ''}`;
      } else if (command === 'ls') {
        const longFormat = args.some(arg => arg.startsWith('-') && arg.includes('l'));
        const showAll = args.some(arg => arg.startsWith('-') && arg.includes('a'));
        const target = args.find(arg => !arg.startsWith('-')) || '.';
        result = await listTarget(target, longFormat, showAll);
      } else if (command === 'cd') {
        await loadBlogIndex();
        const target = args[0] || '~';
        const parts = resolvePath(target);
        if (directoryKind(parts)) {
          terminal.cwd = parts;
          syncPrompt();
        } else {
          result = `cd: ${target}: No such file or directory`;
        }
      } else if (command === 'cat') {
        await loadBlogIndex();
        if (!args.length) result = 'cat: missing operand';
        else {
          const contents = args.map(path => {
            const parts = resolvePath(path);
            const file = fileAt(parts);
            if (file) return file.content;
            if (directoryKind(parts)) return `cat: ${path}: Is a directory`;
            return `cat: ${path}: No such file or directory`;
          });
          result = contents.join('\n');
        }
      } else if (command === 'open') {
        await loadBlogIndex();
        if (!args[0]) result = 'open: missing operand';
        else {
          const file = fileAt(resolvePath(args[0]));
          if (file?.url) window.location.assign(file.url);
          else result = `open: ${args[0]}: No such file`;
        }
      } else if (command === 'echo') {
        result = args.join(' ');
      } else if (command === 'whoami') {
        result = 'dodor';
      } else if (command === 'hostname') {
        result = 'blog';
      } else if (command === 'date') {
        result = new Date().toString();
      } else if (command === 'uname') {
        result = args.includes('-a') ? 'Linux blog 6.6.0-wasm #1 SMP x86_64 GNU/Linux' : 'Linux';
      } else if (command === 'history') {
        result = terminal.history.map((item, index) => `${String(index + 1).padStart(4)}  ${item}`).join('\n');
      } else if (command === 'donut') {
        result = engine.toggle() ? 'renderer resumed' : 'renderer paused';
      } else if (command === 'exit') {
        closeShell();
      } else {
        result = `${command}: command not found`;
      }
      appendOutput(result);
    }

    async function completeInput() {
      const beforeCursor = input.value.slice(0, input.selectionStart ?? input.value.length);
      const words = beforeCursor.split(/\s+/);
      const partial = words.pop() || '';
      let candidates;
      if (words.length === 0) {
        candidates = commands.filter(command => command.startsWith(partial));
      } else {
        await loadBlogIndex();
        const slash = partial.lastIndexOf('/');
        const parentText = slash >= 0 ? partial.slice(0, slash + 1) : '';
        const leaf = slash >= 0 ? partial.slice(slash + 1) : partial;
        const parent = resolvePath(parentText || '.');
        const kind = directoryKind(parent);
        candidates = kind ? directoryEntries(kind).filter(name => name.startsWith(leaf)).map(name => parentText + name) : [];
      }
      if (candidates.length === 1) {
        const completed = candidates[0];
        words.push(completed);
        input.value = `${words.join(' ')}${completed.endsWith('/') ? '' : ' '}`;
      } else if (candidates.length > 1) {
        appendOutput(candidates.join('  '));
      }
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      await run(input.value);
      input.value = '';
    });

    input.addEventListener('keydown', async event => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const delta = event.key === 'ArrowUp' ? -1 : 1;
        terminal.historyIndex = Math.max(0, Math.min(terminal.history.length, terminal.historyIndex + delta));
        input.value = terminal.history[terminal.historyIndex] || '';
        input.setSelectionRange(input.value.length, input.value.length);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        await completeInput();
      }
    });

    close.addEventListener('click', closeShell);
    document.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.key === '~' || event.key === '～') && !shell.classList.contains('is-open')) {
        event.preventDefault();
        openShell();
      } else if (event.key === 'Escape' && shell.classList.contains('is-open')) {
        event.preventDefault();
        closeShell();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  document.addEventListener('pjax:success', boot);
})();
