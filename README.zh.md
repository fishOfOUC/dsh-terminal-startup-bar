# dsh-terminal-startup-bar

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的终端启动状态条。

一个 `dsh` profile 会挂载几十个插件行，并且并发加载它们。组合较大时冷启动会让终端沉默十几秒，看不出究竟有没有在动。这个插件把这段沉默变成一行：

```text
⠋ 正在加载 @deepseek-ai/cordis-plugin-timer…  3.2s  36/140
⠹ 正在加载 @deepseek-ai/dsh-session-projection-cache…  7.2s  130/142
⠸ 正在加载 @deepseek-ai/dsh-workspace…  8.3s  136/142
⠸ 正在加载 @daweifu/capability-menu/policy…  8.4s  141/142
✔ 启动完成 (8.7s)
```

这一行显示“等待时间最长的插件”“启动已经跑了多久”“已经起来了多少个插件行”。Loader 结算后它被一行完成提示替换；启动失败或整棵树被销毁时它会被擦掉，绝不留在终端上。

## 安装

### 作为 bundle 层

包内自带 `cordis.patch.yml`，因此可以直接作为一个 bundle 使用。先装进 profile，再把名字加进 `$DSH_HOME/profiles/<名称>/package.json` 的 `dsh.profile.bundles`：

```sh
dsh plugin --profile web add dsh-terminal-startup-bar
```

```json
{
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-terminal-startup-bar"]
    }
  }
}
```

bundle 的先后顺序就是生效顺序，把它放在最后即可——它插入的是一个无依赖的普通行，无论排在列表什么位置都会很早就启动。

### 作为 profile 自己 patch 层里的一行

如果这个包已经是依赖，直接在 `$DSH_HOME/profiles/<名称>/cordis.patch.yml` 里加一行：

```yaml
- insert:
    - id: terminal-startup-bar
      name: dsh-terminal-startup-bar
      config:
        label: 正在加载
```

### 不安装，直接从源码目录挂载

`--patch` overlay 里的相对插件名会相对于该 overlay 文件所在目录解析，因此可以直接挂载一份工作区副本。[`examples/local.patch.yml`](examples/local.patch.yml) 就是这么做的：

```sh
dsh web --patch ./examples/local.patch.yml --port 3081
```

## 配置

所有键都是可选的。出现未知键或类型不对的值时，插件会在加载阶段抛出并点名该键，而不是悄悄忽略。

| 键 | 类型 | 默认值 | 含义 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 保留安装但保持静默。 |
| `stream` | `'stderr' \| 'stdout'` | `'stderr'` | 状态条写在哪个标准流上。 |
| `intervalMs` | 整数 ≥ 16 | `80` | 两次重绘之间的毫秒数。 |
| `frames` | string[] | `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` | 依次循环的旋转帧。 |
| `label` | string | `正在加载` | 插件名前面的文字。 |
| `readyLabel` | string | `正在完成启动` | 所有插件都已 active、但启动器尚未确认就绪时的文字。 |
| `doneLabel` | string | `启动完成` | 收尾那一行的文字。 |
| `showElapsed` | boolean | `true` | 是否显示已用秒数。 |
| `showProgress` | boolean | `true` | 是否显示 `已完成/总数`。 |
| `showCompletion` | boolean | `true` | 启动成功时是否打印收尾行。 |
| `force` | boolean | `false` | 目标流不是终端时也照常绘制。 |

英文配置示例：

```yaml
- id: terminal-startup-bar
  config:
    label: Loading
    readyLabel: Finishing startup
    doneLabel: Ready
```

目标流不是 TTY 且未设置 `force` 时，插件不产生任何输出。这正是它不会把旋转帧混进 CI 日志、被捕获的输出和 supervisor 管道的原因。

## 工作原理

- **数字从哪来。** 插件通过 `ctx.get('loader')` 读取 Cordis Loader 的 entry 树。`total` 统计启用的插件行；group 行、disabled 行以及嵌套树的载体行（根部的 `cordis:include`，它的耗时按定义就等于整个启动过程）都不计入。`done` 统计 fiber 已到达 active 状态的行，被点名的 subject 是按组合顺序第一个尚未 active 的行。
- **为什么 subject 是“等待最久”的那一个。** Loader 用一个 `Promise.allSettled` 挂载同一组里的所有行，因此它们是并发启动的，不存在某一行“正在加载”。在并发下，点名等待最久的那一行是唯一不会说谎的读法，并且它会随着前面的行完成而前进。
- **时间从哪来。** `loader.envData.startTime` 在第一个 profile 行挂载之前就打好了时间戳，因此已用时间覆盖整个启动过程。缺失、非数字或位于未来的时间戳会退回到本行被 apply 的那一刻。
- **什么时候停。** Loader 结算意味着加载阶段结束，这发生在 Web 应用打印 URL 之前；状态条在那里清除，因此 URL 行不会被覆盖。启动器的 `appReady` 信号是第二个停止点，用于 Loader 结算方式不同的组合。重绘定时器由本行的 effect 持有，所以任何销毁路径——启动失败、信号、HMR 重载——都会擦掉这一行。
- **零依赖。** 插件是纯 ESM，没有任何运行时 import，连 `@deepseek-ai/cordis` 都没有：它按结构读取自己需要的两个事实——entry 列表和一个 fiber 状态。一个会拖进自己模块图的加载指示器，测量的是被它自己拖慢的启动过程。

## 已知限制

- **其他写入者可能与这一行冲突。** 状态条在当前终端行上原地重绘。如果启动期间有其他插件往同一个终端写东西，下一次重绘会擦掉那段文字。实践中 `dsh` 启动是安静的，而且状态条在 Loader 结算时就停了——早于 Web 应用打印 URL——但启动期间会打日志的行仍可能被切掉。
- **等待服务的行也算作“加载中”。** fiber 卡在注入服务上的行，和还在 import 模块的行一样被报告为未完成。这一行说的是启动走到哪儿了，而不是某一行为什么在等。
- **fiber 状态是按数值读取的。** `readProgress` 直接和 `FiberState.ACTIVE` 的数值比较，而不是 import 那个 enum——这正是插件零依赖的原因。如果未来某个 Cordis 版本重新编号这个 enum，就需要同步更新这个常量。

## 开发

```sh
npm test      # node --test，无依赖、无需安装
```

测试覆盖了纯格式化函数、Loader 树读取、配置校验、在注入时钟与定时器下状态条的绘制/擦除生命周期，以及插件针对 context 替身的接线。

## 许可证

MIT
