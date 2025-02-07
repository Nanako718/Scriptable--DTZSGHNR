// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: light-brown; icon-glyph: magic;

// 登录配置
const LOGIN_CONFIG = {
    baseUrl: "https://your-domain.com",  // 修改为你的域名
    loginPath: "/api/v1/login/access-token",
    statisticPath: "/api/v1/plugin/page/SiteStatistic"
};

// 配置键名
const CONFIG_KEY = "moviepilot_display_config";

// 默认配置（只保留可配置的选项）
const DEFAULT_CONFIG = {
    bonus: true,     // 魔力值
    seeds: true      // 种数
};

// 保存登录凭证
async function saveCredentials(cookie) {
    try {
        await Keychain.set("moviepilot_cookie", cookie);
        console.log("凭证保存成功");
        return true;
    } catch (error) {
        console.error("保存凭证失败:", error);
        return false;
    }
}

// 获取保存的凭证
async function getCredentials() {
    try {
        const cookie = await Keychain.get("moviepilot_cookie");
        return cookie;
    } catch (error) {
        console.error("获取凭证失败:", error);
        return null;
    }
}

// 登录并获取token
async function login(username, password) {
    try {
        const loginUrl = `${LOGIN_CONFIG.baseUrl}${LOGIN_CONFIG.loginPath}`;
        const request = new Request(loginUrl);
        request.method = "POST";
        request.headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        };
        
        // 构建表单数据
        const body = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        request.body = body;
        
        const response = await request.loadJSON();
        if (response.access_token) {
            const cookie = `MoviePilot=${response.access_token}`;
            // 保存凭证
            await saveCredentials(cookie);
            return cookie;
        } else {
            throw new Error("登录失败：未获取到token");
        }
    } catch (error) {
        console.error("登录失败:", error);
        throw error;
    }
}

// 显示登录表单
async function showLoginForm() {
    const alert = new Alert();
    alert.title = "MoviePilot 登录";
    alert.message = "请输入用户名和密码";
    
    alert.addTextField("用户名");
    alert.addSecureTextField("密码");
    
    alert.addAction("登录");
    alert.addCancelAction("取消");
    
    const result = await alert.present();
    
    if (result === 0) { // 用户点击了登录
        const username = alert.textFieldValue(0);
        const password = alert.textFieldValue(1);
        
        if (!username || !password) {
            const errorAlert = new Alert();
            errorAlert.title = "错误";
            errorAlert.message = "用户名和密码不能为空";
            errorAlert.addAction("确定");
            await errorAlert.present();
            return null;
        }
        
        try {
            return await login(username, password);
        } catch (error) {
            const errorAlert = new Alert();
            errorAlert.title = "登录失败";
            errorAlert.message = error.message;
            errorAlert.addAction("确定");
            await errorAlert.present();
            return null;
        }
    }
    return null;
}

// 获取API数据
async function fetchData() {
    try {
        // 先尝试获取保存的凭证
        let cookie = await getCredentials();
        
        // 如果没有凭证，显示登录表单
        if (!cookie) {
            cookie = await showLoginForm();
            if (!cookie) {
                throw new Error("未能获取登录凭证");
            }
        }
        
        const request = new Request(`${LOGIN_CONFIG.baseUrl}${LOGIN_CONFIG.statisticPath}`);
        request.headers = {
            'cookie': cookie,
            'authorization': `Bearer ${cookie.replace('MoviePilot=', '')}`,
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0'
        };
        request.timeoutInterval = 20;
        
        console.log("开始请求API...");
        const response = await request.loadJSON();
        console.log("API响应:", JSON.stringify(response));
        
        if (!response) {
            throw new Error("API返回空数据");
        }
        
        return response;
    } catch (error) {
        console.error("获取数据失败:", error);
        // 如果是认证失败，清除保存的凭证并重试
        if (error.message.includes("401") || error.message.includes("认证")) {
            await Keychain.remove("moviepilot_cookie");
            return await fetchData(); // 递归调用，重新登录
        }
        return null;
    }
}

// 解析API返回的数据
function parseData(response) {
    const stats = {
        upload: "0",
        download: "0",
        seedCount: "0",
        seedSize: "0",
        sites: []
    };
    
    try {
        // 解析总计数据
        const cards = response[0].content;
        cards.forEach(col => {
            if (col.content && col.content[0] && col.content[0].content) {
                const cardText = col.content[0].content[0].content;
                const textContent = cardText[1].content;
                if (textContent) {
                    const caption = textContent[0].text;
                    const value = textContent[1].content[0].text;
                    switch (caption) {
                        case "总上传量": stats.upload = value; break;
                        case "总下载量": stats.download = value; break;
                        case "总做种数": stats.seedCount = value; break;
                        case "总做种体积": stats.seedSize = value; break;
                    }
                }
            }
        });
        
        // 解析站点数据
        const tableData = response[0].content.find(col => 
            col.content?.[0]?.component === "VTable"
        );
        
        if (tableData) {
            const tbody = tableData.content[0].content.find(item => 
                item.component === "tbody"
            );
            
            if (tbody && tbody.content) {
                stats.sites = tbody.content.map(row => {
                    const cells = row.content;
                    return {
                        name: cells[0].text || "-",
                        level: cells[2].text || "-",
                        upload: cells[3].text || "0",
                        download: cells[4].text || "0",
                        ratio: cells[5].text?.toString() || "0",
                        bonus: cells[6].text?.toString() || "0",
                        seeds: cells[7].text?.toString() || "0",
                        size: cells[8].text || "0"
                    };
                });
            }
        }
        
        return stats;
    } catch (error) {
        console.error("数据解析错误:", error);
        throw error;
    }
}

// 解析站点详细数据
function parseSiteDetails(response) {
    const sites = [];
    try {
        if (!response || !Array.isArray(response)) {
            console.log("返回数据格式不正确");
            return sites;
        }
        
        // 遍历响应查找表格数据
        response.forEach(section => {
            if (section && section.content) {
                section.content.forEach(item => {
                    if (item.content && item.content[0]?.component === "VTable") {
                        const tableData = item.content[0];
                        const tbody = tableData.content.find(t => t.component === "tbody");
                        
                        if (tbody && tbody.content) {
                            tbody.content.forEach(row => {
                                if (row.content && row.content.length >= 9) {
                                    sites.push({
                                        name: row.content[0].text || "",
                                        username: row.content[1].text || "",
                                        level: row.content[2].text || "",
                                        upload: row.content[3].text || "",
                                        download: row.content[4].text || "",
                                        ratio: row.content[5].text || "",
                                        bonus: row.content[6].text || "",
                                        seedCount: row.content[7].text || "",
                                        seedSize: row.content[8].text || ""
                                    });
                                }
                            });
                        }
                    }
                });
            }
        });
    } catch (error) {
        console.log("站点数据解析错误：" + error);
    }
    
    return sites;
}

// 创建站点详细信息表格
function createSiteDetailsTable(widget, sites) {
    // 创建垂直滚动视图容器
    const scrollView = widget.addStack();
    scrollView.layoutVertically(); // 垂直布局
    scrollView.spacing = 5; // 元素垂直间距5
    
    // 创建表格标题行
    const headerStack = scrollView.addStack();
    headerStack.layoutHorizontally(); // 水平布局
    headerStack.spacing = 10; // 标题列间距10
    
    // 定义表格列标题
    const headers = ["站点", "上传", "下载", "分享率"];
    headers.forEach(header => {
        const headerText = headerStack.addText(header);
        headerText.font = Font.boldSystemFont(10); // 粗体10号字
        headerText.textColor = new Color("#BBBBBB"); // 浅灰色
        // 站点列特殊处理：单行显示，支持字体缩放
        if (header === "站点") {
            headerText.lineLimit = 1; // 限制单行
            headerText.minimumScaleFactor = 0.5; // 允许字体缩小到原大小的50%
        }
    });
    
    // 添加分割线
    const divider = scrollView.addText("─".repeat(46)); // 45个破折号组成的分割线
    divider.textColor = new Color("#666666"); // 深灰色
    divider.font = Font.lightSystemFont(6); // 细体6号字
    
    // 创建站点数据行
    sites.forEach(site => {
        // 创建行容器
        const rowStack = scrollView.addStack();
        rowStack.layoutHorizontally(); // 水平布局
        rowStack.spacing = 10; // 数据列间距10
        
        // 站点名称列
        const nameText = rowStack.addText(site.name);
        nameText.font = Font.mediumSystemFont(10); // 中等粗细10号字
        nameText.textColor = Color.white(); // 白色
        nameText.lineLimit = 1; // 限制单行
        nameText.minimumScaleFactor = 0.5; // 允许字体缩小到原大小的50%
        
        // 上传量列 - 绿色
        const uploadText = rowStack.addText(site.upload);
        uploadText.font = Font.systemFont(10); // 常规10号字
        uploadText.textColor = new Color("#4CAF50"); // 绿色
        
        // 下载量列 - 红色
        const downloadText = rowStack.addText(site.download);
        downloadText.font = Font.systemFont(10); // 常规10号字
        downloadText.textColor = new Color("#F44336"); // 红色
        
        // 分享率列 - 白色
        const ratioText = rowStack.addText(site.ratio);
        ratioText.font = Font.systemFont(10); // 常规10号字
        ratioText.textColor = Color.white(); // 白色
    });
}

// 保存配置
async function saveConfig(config) {
    try {
        await Keychain.set(CONFIG_KEY, JSON.stringify(config));
        return true;
    } catch (error) {
        console.error("保存配置失败:", error);
        return false;
    }
}

// 获取配置
async function getConfig() {
    try {
        const config = await Keychain.get(CONFIG_KEY);
        return config ? JSON.parse(config) : DEFAULT_CONFIG;
    } catch (error) {
        console.error("获取配置失败:", error);
        return DEFAULT_CONFIG;
    }
}

// 修改计算列宽的函数
const calculateColumnWidths = (config) => {
    const totalWidth = 300; // 增加总宽度
    const spacing = 3;
    
    // 调整基础宽度分配
    const baseWidths = {
        site: 55,      // 增加站点名称宽度
        upload: 45,    // 增加上传宽度
        download: 45,  // 增加下载宽度
        ratio: 45,     // 增加分享率宽度
        bonus: 45,     // 增加魔力值宽度
        seeds: 35,     // 增加种数宽度
        size: 42       // 增加体积宽度
    };
    
    // 计算显示的列
    let visibleColumns = ['site', 'upload', 'download', 'ratio', 'size'];
    if (config.bonus) visibleColumns.push('bonus');
    if (config.seeds) visibleColumns.push('seeds');
    
    // 计算总间距宽度
    const totalSpacing = (visibleColumns.length - 1) * spacing;
    
    // 计算可用于列的实际宽度
    const availableWidth = totalWidth - totalSpacing;
    
    // 计算基础总宽度
    const baseTotal = visibleColumns.reduce((sum, key) => sum + baseWidths[key], 0);
    
    // 计算每列可以分配的额外宽度
    const extraWidth = Math.max(0, availableWidth - baseTotal);
    
    // 根据列的重要性分配额外空间
    const priorities = {
        site: 2,      // 站点名称优先级
        upload: 1.2,  // 增加数值列优先级
        download: 1.2,
        ratio: 1.2,
        size: 1.2,
        bonus: 1.2,
        seeds: 1
    };
    
    // 计算优先级总和
    const totalPriority = visibleColumns.reduce((sum, key) => sum + priorities[key], 0);
    
    // 根据优先级分配额外空间
    const getExtraSpace = (key) => Math.floor((extraWidth * priorities[key]) / totalPriority);
    
    // 返回调整后的宽度
    return {
        site: baseWidths.site + getExtraSpace('site'),
        upload: baseWidths.upload + getExtraSpace('upload'),
        download: baseWidths.download + getExtraSpace('download'),
        ratio: baseWidths.ratio + getExtraSpace('ratio'),
        bonus: config.bonus ? baseWidths.bonus + getExtraSpace('bonus') : 0,
        seeds: config.seeds ? baseWidths.seeds + getExtraSpace('seeds') : 0,
        size: baseWidths.size + getExtraSpace('size')
    };
};

// 修改显示配置界面
async function showConfigForm() {
    const alert = new Alert();
    alert.title = "显示配置";
    alert.message = "请选择要显示的数据项";
    
    const config = await getConfig();
    
    // 只添加可配置的选项，使用新的勾选符号
    const options = [
        { key: 'bonus', text: '魔力值' },
        { key: 'seeds', text: '种数' }
    ];
    
    options.forEach(option => {
        alert.addAction(config[option.key] ? `✅ ${option.text}` : `❎ ${option.text}`);
    });
    
    // 添加清除账号缓存选项
    alert.addAction("🗑️ 清除账号缓存");
    alert.addCancelAction("完成");
    
    const result = await alert.presentSheet();
    if (result === options.length) {
        // 用户点击了清除账号缓存
        await Keychain.remove("moviepilot_cookie");
        const clearAlert = new Alert();
        clearAlert.title = "清除成功";
        clearAlert.message = "账号缓存已清除";
        clearAlert.addAction("确定");
        await clearAlert.present();
    } else if (result !== -1) {
        // 用户点击了配置选项
        config[options[result].key] = !config[options[result].key];
        await saveConfig(config);
        // 重新显示配置界面
        await showConfigForm();
    }
    
    return config;
}

// 创建小组件
async function createWidget() {
    const widget = new ListWidget();
    widget.backgroundColor = new Color("#1E2329");
    widget.setPadding(5, 16, 5, 16);
    
    // 检查登录状态
    const cookie = await getCredentials();
    if (!cookie) {
        // 未登录状态显示
        const titleText = widget.addText("MoviePilot 小组件");
        titleText.font = Font.boldSystemFont(16);
        titleText.textColor = Color.white();
        
        widget.addSpacer(10);
        
        const loginText = widget.addText("请点击小组件进行登录");
        loginText.font = Font.systemFont(14);
        loginText.textColor = new Color("#BBBBBB");
        
        return widget;
    }
    
    try {
        const response = await fetchData();
        if (!response) {
            throw new Error("无法获取数据");
        }
        
        const data = parseData(response);
        const config = await getConfig();
        
        // 创建标题行容器
        const titleRow = widget.addStack();
        titleRow.layoutHorizontally();
        titleRow.bottomAlignContent(); // 添加底部对齐
        titleRow.spacing = 10;
        
        // 左侧标题文本
        const titleText = titleRow.addText("PT站点数据统计");
        titleText.font = Font.boldSystemFont(16);
        titleText.textColor = Color.white();
        
        titleRow.addSpacer();
        
        // 右侧统计数据容器
        const statsStack = titleRow.addStack();
        statsStack.layoutHorizontally();
        statsStack.spacing = 8;
        
        // 上传统计 - 绿色
        const uploadText = statsStack.addText(`↑${data.upload}`);
        uploadText.font = Font.systemFont(8); // 调整字体大小
        uploadText.textColor = new Color("#4CAF50");
        
        // 下载统计 - 红色
        const downloadText = statsStack.addText(`↓${data.download}`);
        downloadText.font = Font.systemFont(8);
        downloadText.textColor = new Color("#F44336");
        
        // 做种数统计
        const seedText = statsStack.addText(`📦${data.seedCount}`);
        seedText.font = Font.systemFont(8);
        seedText.textColor = Color.white();
        
        // 做种体积统计
        const sizeText = statsStack.addText(`💾${data.seedSize}`);
        sizeText.font = Font.systemFont(8);
        sizeText.textColor = Color.white();
        
        widget.addSpacer(1);
        
        // 分割线
        const divider = widget.addStack();
        const dividerLine = divider.addText("─".repeat(50));
        dividerLine.font = Font.lightSystemFont(6);
        dividerLine.textColor = new Color("#48484A");
        
        widget.addSpacer(4);
        
        const columnWidths = calculateColumnWidths(config);
        
        // 根据配置生成表头（必选项始终显示）
        const headerDefs = [
            {key: 'site', text: "站点", width: columnWidths.site},
            {key: 'upload', text: "上传", width: columnWidths.upload},
            {key: 'download', text: "下载", width: columnWidths.download},
            {key: 'ratio', text: "分享率", width: columnWidths.ratio},
            ...(config.bonus ? [{key: 'bonus', text: "魔力", width: columnWidths.bonus}] : []),
            ...(config.seeds ? [{key: 'seeds', text: "种数", width: columnWidths.seeds}] : []),
            {key: 'size', text: "体积", width: columnWidths.size}
        ];
        
        // 创建表头
        const headerStack = widget.addStack();
        headerStack.layoutHorizontally();
        headerStack.spacing = 3;
        
        headerDefs.forEach(header => {
            const stack = headerStack.addStack();
            stack.size = new Size(header.width, 15); 
            stack.layoutHorizontally();
            stack.centerAlignContent(); // 添加垂直居中对齐
            
            const text = stack.addText(header.text);
            text.font = Font.mediumSystemFont(12);
            text.textColor = new Color("#8E8E93");
            text.lineLimit = 1;
            
            stack.addSpacer();
        });
        
        widget.addSpacer(8); // 增加表头和数据之间的间距从5到8
        
        // 显示站点数据
        if (!data.sites || data.sites.length === 0) {
            widget.addSpacer(4);
            const errorText = widget.addText("暂无站点数据");
            errorText.textColor = new Color("#F44336");
            errorText.font = Font.mediumSystemFont(14);
        } else {
            data.sites.forEach(site => {
                const rowStack = widget.addStack();
                rowStack.layoutHorizontally();
                rowStack.spacing = 3; // 减小间距
                
                const rowData = [
                    {key: 'site', value: site.name, width: columnWidths.site, color: Color.white()},
                    {key: 'upload', value: site.upload, width: columnWidths.upload, color: new Color("#4CAF50")},
                    {key: 'download', value: site.download, width: columnWidths.download, color: new Color("#F44336")},
                    {key: 'ratio', value: site.ratio, width: columnWidths.ratio, color: Color.white()},
                    {key: 'bonus', value: site.bonus, width: columnWidths.bonus, color: new Color("#8E8E93")},
                    {key: 'seeds', value: site.seeds, width: columnWidths.seeds, color: new Color("#8E8E93")},
                    {key: 'size', value: site.size, width: columnWidths.size, color: new Color("#8E8E93")}
                ].filter(item => {
                    return ['site', 'upload', 'download', 'ratio', 'size'].includes(item.key) || 
                           config[item.key];
                });
                
                rowData.forEach(({value, width, color}, index) => {
                    const stack = rowStack.addStack();
                    stack.size = new Size(width, 15);
                    stack.layoutHorizontally();
                    
                    const text = stack.addText(value);
                    text.font = Font.systemFont(10);
                    text.textColor = color;
                    text.lineLimit = 1;
                    
                    if (index === 0 && config.site) {
                        text.minimumScaleFactor = 0.5;
                    }
                    
                    stack.addSpacer();
                });
            });
        }
        
    } catch (error) {
        console.error("创建小组件失败:", error);
        const errorText = widget.addText("数据获取失败");
        errorText.textColor = new Color("#F44336");
        errorText.font = Font.mediumSystemFont(14);
    }
    
    return widget;
}

// 修改主运行逻辑
if (config.runsInWidget) {
    let widget = await createWidget();
    Script.setWidget(widget);
} else {
    // 检查登录状态
    const cookie = await getCredentials();
    
    // 非小组件环境下运行时显示配置界面
    const alert = new Alert();
    alert.title = "PT站点数据统计";
    alert.message = "请选择操作";
    
    // 根据登录状态显示不同的选项
    alert.addAction(cookie ? "预览小组件" : "登录");
    alert.addAction("显示配置");
    alert.addCancelAction("取消");
    
    const result = await alert.presentSheet();
    if (result === 0) {
        if (!cookie) {
            // 未登录状态，显示登录界面
            const newCookie = await showLoginForm();
            if (newCookie) {
                let widget = await createWidget();
                await widget.presentLarge();
            }
        } else {
            // 已登录状态，直接显示小组件
            let widget = await createWidget();
            await widget.presentLarge();
        }
    } else if (result === 1) {
        const configResult = await showConfigForm();
        // 如果配置后清除了缓存，自动显示登录界面
        if (!(await getCredentials())) {
            const newCookie = await showLoginForm();
            if (newCookie) {
                let widget = await createWidget();
                await widget.presentLarge();
            }
        }
    }
}

Script.complete(); 