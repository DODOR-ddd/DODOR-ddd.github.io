---
title: DODOR#000a01-WEEK2-WP
date: 2026-02-21 16:52:01
tags:
 - CTF
categories:
  - CTF
---

## Misc:

### **Invest on Matrix**

解锁hint1就知道是一个version2的二维码，剩下的就是不断解锁补全直到可以通过纠错识别出来，这是基础结构，我们优先补全右下角再逐渐保持中心完整，最后脚本如下：

![img](/imgs/hgame/f3d3572c11dfa9ec8a136d41608ce003918fa0ec6b6b)

```python
from PIL import Image
import os

def make_matrix():
    m = [[0]*25 for _ in range(25)]
    def place_finder(r,c):
        for i in range(7):
            for j in range(7):
                v = 1 if (i in (0,6) or j in (0,6) or (2<=i<=4 and 2<=j<=4)) else 0
                m[r+i][c+j] = v
    place_finder(0,0)
    place_finder(0,18)
    place_finder(18,0)
    for j in range(25):
        m[6][j] = 1 if j%2==0 else 0
    for i in range(25):
        m[i][6] = 1 if i%2==0 else 0
    for i in range(5):
        for j in range(5):
            r = 16+i
            c = 16+j
            v = 1 if (i in (0,4) or j in (0,4) or (i==2 and j==2)) else 0
            m[r][c] = v
    return m

def apply_block(m, k, vals):
    r = (k-1)//5
    c = (k-1)%5
    sr = r*5
    sc = c*5
    for idx, v in enumerate(vals):
        dr = idx//5
        dc = idx%5
        m[sr+dr][sc+dc] = v

def save_png(m, path, cell_size=12, border=4):
    n = len(m)
    s = (n + 2*border) * cell_size
    img = Image.new('RGB', (s, s), 'white')
    px = img.load()
    for y in range(n):
        for x in range(n):
            col = (0,0,0) if m[y][x]==1 else (255,255,255)
            for dy in range(cell_size):
                for dx in range(cell_size):
                    px[(x+border)*cell_size+dx, (y+border)*cell_size+dy] = col
    img.save(path)
    print(path)

def main():
    m = make_matrix()
    b2 = [1,1,0,1,1,0,1,0,1,1,0,1,0,1,0,0,1,0,0,0,0,1,0,0,1]
    b6 = [1,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,0,1,0,0]
    b7 = [0,1,0,1,0,1,1,0,1,0,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1]
    b8 = [0,0,1,1,0,1,0,1,0,1,0,1,1,1,1,0,0,1,0,0,0,1,0,0,1]
    b9 = [1,0,0,1,0,0,1,0,1,1,0,0,0,0,0,1,1,1,1,1,1,1,0,1,0]
    b10 = [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,0,1,0,1,1]
    b11 = [1,1,0,1,1,1,1,1,0,1,0,1,1,0,0,1,0,0,0,1,1,0,0,1,1]
    b13 = [1,1,0,1,0,0,0,1,0,1,1,1,1,1,0,1,1,0,1,1,1,0,0,1,0]
    b14 = [1,1,1,0,1,0,0,0,0,1,1,0,1,0,1,1,1,0,1,0,0,0,0,1,0]
    b18 = [1,1,1,0,1,0,0,1,1,1,1,0,0,0,1,1,1,0,0,1,0,1,1,1,1]
    b19 = [0,1,1,1,1,0,1,1,1,1,0,1,0,0,0,1,1,0,1,0,1,1,0,0,0]
    b15 = [1,1,1,1,1,1,0,0,0,1,1,0,0,0,1,0,0,0,1,0,0,1,0,0,1]
    b20 = [0,0,0,1,0,1,1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,0,0,1,1]
    b21 = [1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,0,0,0,1,1,1,1,1]
    b16 = [1,0,1,0,1,1,0,1,0,1,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0]
    b12 = [1,1,0,1,1,0,0,1,1,0,1,1,0,1,0,0,0,0,0,1,1,1,1,1,0]
    b24 = [1,1,1,1,1,0,0,0,1,1,1,0,1,1,1,1,0,1,0,1,0,1,0,0,0]
    b25 = [1,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1,0,0,1,0,0,1,1,1]
    apply_block(m, 2, b2)
    apply_block(m, 6, b6)
    apply_block(m, 7, b7)
    apply_block(m, 8, b8)
    apply_block(m, 9, b9)
    apply_block(m, 10, b10)
    apply_block(m, 11, b11)
    apply_block(m, 13, b13)
    apply_block(m, 14, b14)
    apply_block(m, 12, b12)
    apply_block(m, 18, b18)
    apply_block(m, 19, b19)
    apply_block(m, 15, b15)
    apply_block(m, 20, b20)
    apply_block(m, 21, b21)
    apply_block(m, 16, b16)
    apply_block(m, 24, b24)
    apply_block(m, 25, b25)
    out = os.path.abspath(os.path.join(os.path.dirname(__file__), "qr_recon.png"))
    save_png(m, out)

if __name__ == "__main__":
    main()


```

得到flag。