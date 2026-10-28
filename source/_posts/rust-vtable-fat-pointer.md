---
title: Rust的虚表与胖指针及其安全应用
date: 2026-08-23 21:50:00
tags:
  - Rust
categories:
  - 技术
---

真是好久没更新了，上次的知识补全计划也咕咕咕了（

还是用一个程序作为例子展开讲罢

```rust
trait Greet {
    fn greet(&self) -> String;
}

struct Cat;
impl Greet for Cat {
    fn greet(&self) -> String { "meow".into() }
}

fn main() {
    let c = Cat;
    let d: &dyn Greet = &c;

    println!("{}", std::mem::size_of::<&Cat>());        // 8
    println!("{}", std::mem::size_of::<&dyn Greet>());  // 16
}
```

## 胖指针

上面的&dyn Greet是16字节

&[u8] 同样是 16 字节：

```rust
println!("{}", std::mem::size_of::<&[u8]>()); // 16
let s: &[u8] = &[1, 2, 3];
// 内存布局: (数据指针, 长度)
```

因为切片要支持 `s.len()`，光有一个起始地址不够，得把长度带上。于是 `&[T]` 变成"数据指针 + usize 长度"两个 word。`&str` 同理，str 的元数据也是长度。

Rust 把这种指针 + 附加信息的结构叫胖指针（fat pointer）。元数据类型由 `Pointee` trait 的关联类型 Metadata 决定，目前只有两种：

- 切片 / str：长度（usize）
- trait object：虚表指针

瘦指针（thin pointer）就是一个裸地址，比如 `&Cat`、`*const u8`。

## dyn

`dyn Greet` 是一个实现了 `Greet`、但类型未知的东西，它叫 trait object（trait 对象）。

什么时候会需要它？编译期你只知道"它实现了 `Greet`"，不知道具体是 Cat 还是 Dog，却想把它们塞进同一个容器、传给同一个函数。泛型做不到这件事——泛型是单态化，`Vec<Box<Cat>>` 和 `Vec<Box<Dog>>` 是两个完全不同的类型，放不进同一个 `Vec`：

```rust
trait Greet { fn greet(&self) -> String; }
struct Cat; impl Greet for Cat { fn greet(&self) -> String { "meow".into() } }
struct Dog; impl Greet for Dog { fn greet(&self) -> String { "woof".into() } }

let mut pets: Vec<Box<dyn Greet>> = Vec::new();
pets.push(Box::new(Cat));
pets.push(Box::new(Dog));
for p in &pets {
    println!("{}", p.greet()); // meow / woof
}
```

`Vec<Box<dyn Greet>>` 里每个元素的真实类型都不同，但对外的接口一致。每次`p.greet()` 调用时要查这个元素到底是谁、它的 greet 在哪，然后跳过去。这种叫做动态分发（dynamic dispatch）；泛型在编译期就确定调谁，叫静态分发（static dispatch）。

`dyn` 本身是未定大小的（`!Sized`），不能拿 `dyn Greet` 直接当值用，必须放在引用、指针或盒子后面，像`&dyn Greet`、`Box<dyn Greet>`、`Rc<dyn Greet>` 都行。

## dyn Trait

`&dyn Greet` 的 16 字节拆开是：

```
data   : *const ()   // 指向具体对象
vtable : *const ()   // 指向类型 Cat 的 Greet 实现表
```

旧版标准库里有个 `std::raw::TraitObject`，就是这个结构，专门用来拆 trait object：

```rust
#[repr(C)]
pub struct TraitObject {
    pub data: *mut (),
    pub vtable: *mut (),
}
```

它后来被移出了标准库，我这个版本的 rustc 里 `std::raw` 已经不存在了。但仍然可以借助transmute：

```rust
#[repr(C)]
struct TraitObject { data: *const (), vtable: *const () }

let to: TraitObject = unsafe { std::mem::transmute(d) };
assert_eq!(to.data as *const Cat, &c as *const Cat);
```

ps：这个 transmute 是合法的：两个类型都是 16 字节，引用转成裸指针对没有别名问题。不过日常写代码用不到它，下面有更干净的观察方式。

## vtable

rustc 生成 vtable 的逻辑在 `compiler/rustc_middle/src/ty/vtable.rs`。布局如下（rustc 把它标为 explicitly unstable，不保证稳定；下文实测基于 rustc 1.97.1）：

| 偏移  | 内容                              |
| --- | ------------------------------- |
| 0   | drop_in_place 函数指针              |
| 1   | 具体类型的大小（size）                   |
| 2   | 具体类型的对齐（align）                  |
| 3.. | 方法指针，按 trait 声明顺序，超 trait 的方法在前 |

前三个条目是 vtable 的"头"。有了它们，运行时不需要知道具体类型就能完成 drop、算 size、算 align —— `size_of_val`、`align_of_val` 就是这么实现的。

上一节的 `to.vtable` 

```rust
let vt = to.vtable as *const usize;
unsafe {
    println!("{:p}", *vt as *const ());        // drop_in_place
    println!("{}", *vt.add(1));                // size
    println!("{}", *vt.add(2));                // align
    println!("{:p}", *vt.add(3) as *const ()); // greet
}
```

`Cat` 是零大小类型（ZST），输出是：

```
0x0   // 不需要 drop，drop_in_place 是空指针
0     // size
1     // align
0x55… // greet 的函数指针
```

如果换成一个带字段的类型就能看到真实值。`struct Dog { name: String }` 的 vtable：

```
drop_in_place = 0x55…   // 真实的 drop glue 代码
size          = 24      // size_of::<Dog>()
align         = 8
greet         = 0x55…
shout         = 0x55…
```

rustc 源码里对应这段逻辑：`ty.needs_drop` 为 false 时 `drop_in_place` 写空指针，否则写 drop glue 的地址。

## 动态分发

`d.greet()` 在编译期不知道 `d` 背后是 Cat 还是别的类型，不能直接 call。于是就

1. 从 vtable 偏移 3 取出函数指针
2. 把 `d` 的两个 word（data, vtable）作为参数传进去

trait 方法 `fn greet(&self)` 在 ABI 层收到的 self 就是这两个 word。

```rust
type GreetFn = unsafe fn(*const (), *const ()) -> String;

let vt = to.vtable as *const usize;
unsafe {
    let greet: GreetFn = std::mem::transmute(*vt.add(3));
    let out = greet(to.data, to.vtable);
    println!("{out}"); // meow
}
```

把函数指针 transmute 成别的签名是 UB 敏感操作，这里只为演示。但调用约定是确定的：dyn 方法第一个参数是数据指针，第二个是 vtable 指针。

对比静态分发：泛型函数 `fn f<T: Greet>(x: &T)` 里调 `x.greet()`，单态化之后是一次直接调用，可以内联。dyn 多了 vtable 的一次内存加载和一次间接跳转。像是异质集合 `Vec<Box<dyn Greet>>` 只能用 dyn。在性能敏感的路径用泛型。

## trait

`trait Animal: Greet` 的情况下，`&dyn Animal` 的 vtable 长这样：

```
[drop_in_place, size, align, greet, shout, name, ...]
```

超 trait 的方法排前面，然后才是自己的。

```rust
let a: &dyn Animal = &c;
let up: &dyn Greet = a;   // upcast

// up 的 vtable 指针和 a 的完全相同
```

Greet 的方法在两个 vtable 里都在偏移 3、4，所以 `dyn Animal` 转 `dyn Greet` 不需要调整 vtable 指针，直接复用。rustc 的 vtable 还有一种 `TraitVPtr` 条目，指向单独的超 trait vtable，算是给 upcasting 用的兜底。

顺带提 dyn 兼容性的两个边界：

- `fn new() -> Self where Self: Sized` 这类非分发方法不占 vtable 槽位，trait 仍可 dyn
- 泛型方法（`fn id<T>(&self, x: T)`）会让整个 trait 失去 dyn 兼容性，编译直接报 E0038

## 虚表劫持

上面一直在"读"虚表。在控制流中`vtable_ptr`是被信任的，虚派发每次都从 `vtable_ptr` 指向的地方按偏移取函数指针再间接调用。rustc 假定它是可信的，因为它指向只读数据段。如果某个越界写能改掉一个 trait object 的 `vtable_ptr`，那就可以挟持控制流。

`unsafe` 的指针算术没有边界检查。常见的一种场景：功能对象被存成 `Box<dyn Trait>` 数组，某个下标的读写只在"上层逻辑/编译器"那里检查过，底层却直接 `ptr.add(idx)` 访问。所以只要越界读胖指针的第二个 word，就能**泄漏 `vtable_ptr`**。vtable 在二进制里有固定偏移（可以用 `readelf -r` 在重定位表里反查出来），泄出它就能算出 PIE 基址。

而越界写同一个 word，就能**把 `vtable_ptr` 改成自己可控的内存**。虚派发只读"方法条目所在的那个偏移"，所以伪造虚表根本不用管 drop/size/align，只要保证方法那一项指向目标函数。

```rust
trait Greet { fn greet(&self) -> String; }
struct Cat;
impl Greet for Cat { fn greet(&self) -> String { "meow".into() } }

fn win(_data: *const (), _vt: *const ()) -> String { "pwned".into() }

#[repr(C)]
struct FakeVt {
    drop: usize,
    size: usize,
    align: usize,
    method: unsafe fn(*const (), *const ()) -> String, // +0x18，方法 0
}

fn main() {
    let c = Cat;
    let mut d: &dyn Greet = &c;
    println!("{}", d.greet()); // meow

    let fake = FakeVt { drop: 0, size: 0, align: 0, method: win };

    let slot = &mut d as *mut &dyn Greet as *mut [*const (); 2];
    unsafe { (*slot)[1] = &fake as *const FakeVt as *const (); }

    println!("{}", d.greet()); // pwned
}
```

输出是：

```
meow
pwned
```

这跟 C++ 里劫持对象的 vptr 思路一致，Rust 把 vtable 指针放在引用/盒子里而不是对象内部，所以攻击目标从对象体里的 vptr转向对象旁边独立的 16 字节胖指针。

## 参考

- Static and Dynamic Dispatch — The Rust Programming Language
  <https://rust.googlesource.com/rust/+/cff0b78ce7a46daf2e6f8de16273ef2e10b6fea6/src/doc/trpl/static-and-dynamic-dispatch.md>
- Rust: Static vs Dynamic Dispatch — SoftwareMill
  <https://softwaremill.com/rust-static-vs-dynamic-dispatch/>
