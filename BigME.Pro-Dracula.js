// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: magic;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-brown; icon-glyph: magic;
/**
 * Scriptable for BigMe.Pro - Dracula Theme Enhanced UI with Cached Credentials and Logging
 * @Author: fuhao
 * @Date: 2024-11-04 22:34:00
 * @LastEditors: fuhao
 * @LastEditTime: 2024-11-07 23:30:00
 * @Description: BigMe.Pro 小组件 - Dracula 主题、优化进度条，支持账号缓存
 * @Version: 1.8
 * @License: MIT
 */

const subscribe_url = "https://app.bigmess.org/api/v1/user/getSubscribe";
const login_url = "https://app.bigmess.org/api/v1/passport/auth/login";

// 账号缓存键
const EMAIL_KEY = "bigmepro_email";
const PASSWORD_KEY = "bigmepro_password";

// 显示菜单
async function showMenu() {
  const alert = new Alert();
  alert.title = "选择操作";
  alert.addAction("添加/更新账号");
  alert.addAction("清除缓存");
  alert.addCancelAction("取消");

  const response = await alert.presentSheet();

  if (response === 0) {
    await addAccount();
  } else if (response === 1) {
    clearCache();
  } else {
    log("用户取消了操作");
  }
}

// 添加或更新账号并缓存
async function addAccount() {
  log("添加或更新账号...");
  const alert = new Alert();
  alert.title = "登录 BigMe.Pro";
  alert.addTextField("邮箱", Keychain.contains(EMAIL_KEY) ? Keychain.get(EMAIL_KEY) : "");
  alert.addSecureTextField("密码", Keychain.contains(PASSWORD_KEY) ? Keychain.get(PASSWORD_KEY) : "");
  alert.addAction("保存");

  await alert.present();

  const email = alert.textFieldValue(0);
  const password = alert.textFieldValue(1);

  if (email && password) {
    Keychain.set(EMAIL_KEY, email);
    Keychain.set(PASSWORD_KEY, password);
    log("账号已成功缓存");
  } else {
    log("邮箱和密码不能为空，未缓存账号");
  }
}

// 清除账号缓存
function clearCache() {
  Keychain.remove(EMAIL_KEY);
  Keychain.remove(PASSWORD_KEY);
  log("账号缓存已清除");
}

// 获取缓存的账号信息
function getCachedCredentials() {
  const email = Keychain.contains(EMAIL_KEY) ? Keychain.get(EMAIL_KEY) : null;
  const password = Keychain.contains(PASSWORD_KEY) ? Keychain.get(PASSWORD_KEY) : null;
  if (email && password) {
    log("成功获取缓存的账号信息");
  } else {
    log("未找到缓存的账号信息");
  }
  return email && password ? { email, password } : null;
}

// 登录以获取授权数据
async function login() {
  log("尝试登录...");
  let credentials = getCachedCredentials();
  if (!credentials) {
    log("缓存中未找到账号，请求用户输入...");
    await addAccount();
    credentials = getCachedCredentials();
    if (!credentials) {
      log("登录失败：未能获取有效的邮箱或密码");
      return null;
    }
  }

  try {
    const req = new Request(login_url);
    req.method = "POST";

    req.headers = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    req.body = `email=${encodeURIComponent(credentials.email)}&password=${encodeURIComponent(credentials.password)}`;

    const res = await req.loadJSON();

    if (!res) {
      log("登录失败：未收到有效的响应");
      return null;
    }

    if (res.status !== "success") {
      log(`登录失败，状态：${res.status}, 错误信息：${JSON.stringify(res.errors)}`);
      return null;
    }

    if (res.data && res.data.auth_data) {
      log("登录成功，获取授权数据");
      return res.data.auth_data;
    } else {
      log("登录失败：未返回授权数据");
      return null;
    }
  } catch (error) {
    log(`登录失败，错误信息：${error}`);
    return null;
  }
}

// 获取订阅信息
async function getSubscribe() {
  log("尝试获取订阅信息...");
  try {
    const authorization = await login();

    if (!authorization) {
      log("授权数据为空，无法获取订阅信息");
      return null;
    }
    const req = new Request(subscribe_url);
    req.method = "GET";
    req.headers = {
      authorization: authorization,
    };
    const res = await req.loadJSON();
    if (res.status !== "success") {
      log("请求失败，状态：" + res.status);
      return null;
    }
    log("成功获取订阅信息");
    return res;
  } catch (error) {
    log("请求失败：" + error);
    return null;
  }
}

// 处理订阅信息并返回所需数据
async function handleSubscribe() {
  const data = await getSubscribe();

  if (data) {
    const name = data.data.plan.name;
    const u = data.data.u;
    const d = data.data.d;
    const total = data.data.transfer_enable;

    const use = (u + d) / (1024 * 1024);
    const useFormatted =
      use > 1024 ? (use / 1024).toFixed(2) + "GB" : use.toFixed(2) + "MB";
    const reset_day = data.data.reset_day
      ? `距离到期还有 ${data.data.reset_day} 天`
      : "该订阅长期有效";

    const usedPercentage = Math.min(use / (total / (1024 * 1024)), 1);

    log("成功解析订阅数据");
    return {
      planName: name,
      useFormatted,
      totalFormatted: (total / (1024 * 1024 * 1024)).toFixed(2) + "GB",
      reset_day,
      usedPercentage,
    };
  } else {
    log("获取订阅信息失败");
    return null;
  }
}

// 创建和更新小组件，并应用 Dracula 主题样式
async function updateWidget() {
  const subscribeData = await handleSubscribe();

  if (subscribeData) {
    const {
      planName,
      useFormatted,
      totalFormatted,
      reset_day,
      usedPercentage,
    } = subscribeData;

    const dynamicColor = Color.dynamic(
      new Color("#FFFFFF"),
      new Color("#282a36")
    );
    const titleColor = Color.dynamic(
      new Color("#4A4A4A"),
      new Color("#6272a4")
    );
    const packageColor = Color.dynamic(
      new Color("#007aff"),
      new Color("#8be9fd")
    );
    const flowColor = Color.dynamic(new Color("#34c759"), new Color("#50fa7b"));
    const subscribeColor = Color.dynamic(
      new Color("#ff3b30"),
      new Color("#ff79c6")
    );
    const progressBarColor = Color.dynamic(
      new Color("#34c759"),
      new Color("#bd93f9")
    );
    const progressBgColor = Color.dynamic(
      new Color("#C0C0C0"),
      new Color("#44475a")
    );

    let widget = new ListWidget();
    widget.backgroundColor = dynamicColor;
    widget.setPadding(10, 15, 10, 15);

    let title = widget.addText("我的订阅");
    title.font = Font.boldSystemFont(16);
    title.textColor = titleColor;
    widget.addSpacer(10);

    let nameText = widget.addText(planName);
    nameText.font = Font.boldSystemFont(18);
    nameText.textColor = packageColor;
    widget.addSpacer(5);

    let statusText = widget.addText(`${reset_day}`);
    statusText.font = Font.systemFont(12);
    statusText.textColor = subscribeColor;
    widget.addSpacer(5);

    let progressBar = widget.addStack();
    progressBar.layoutHorizontally();
    progressBar.centerAlignContent();
    progressBar.size = new Size(270, 10);
    progressBar.cornerRadius = 3;

    let usedBar = progressBar.addStack();
    usedBar.size = new Size(270 * usedPercentage, 10);
    usedBar.backgroundColor = progressBarColor;

    let unusedBar = progressBar.addStack();
    unusedBar.size = new Size(270 * (1 - usedPercentage), 10);
    unusedBar.backgroundColor = progressBgColor;

    widget.addSpacer(8);

    let usageText = widget.addText(
      `已用 ${useFormatted} / 总计 ${totalFormatted}`
    );
    usageText.font = Font.systemFont(14);
    usageText.textColor = flowColor;

    widget.addSpacer();
    const now = new Date();
    let refreshTimeText = widget.addText(
      `最后刷新：${now.getHours()}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`
    );
    refreshTimeText.font = Font.systemFont(10);
    refreshTimeText.textColor = titleColor;
    refreshTimeText.rightAlignText();

    widget.refreshAfterDate = new Date(Date.now() + 60 * 1000);

    log("小组件创建成功");
    return widget;
  } else {
    log("无法加载订阅数据，未创建小组件");
    return null;
  }
}

// 主程序入口
async function main() {
  if (config.runsInApp) {
    log("在 Scriptable 应用中运行，显示菜单...");
    await showMenu();
    const widget = await updateWidget();
    if (widget) {
      widget.presentMedium(); // 在应用内预览
      log("预览模式下显示小组件");
    }
  } else {
    const widget = await updateWidget();
    if (widget) {
      Script.setWidget(widget);
      log("小组件设置成功");
    }
  }
}

await main();
Script.complete();