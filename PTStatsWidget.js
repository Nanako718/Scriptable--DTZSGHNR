// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: magic;
/**
 * @fileoverview PT站点数据统计小组件
 * @author DTZSGHNR
 * @version 1.1.0
 * @description 用于展示PT站点的上传、下载、魔力值等数据的Scriptable小组件
 * @date 2024-03-22
 * @changelog
 * v1.1.0 - 2025-02-13
 * - 引入DmYY框架重构代码
 * v1.0.0 - 2025-02-10
 * - 首次发布
 */

const { DmYY, Runing } = importModule('./DmYY');

class Widget extends DmYY {
    constructor(arg) {
        super(arg);
        this.name = "PT站点数据统计";
        this.en = "PTStatsWidget";
        
        // 设置默认配置
        this.defaultData = {
            bonus: true,
            seeds: true,
            baseUrl: "", // 用户需要配置自己的服务器地址
            loginPath: "/api/v1/login/access-token",
            statisticPath: "/api/v1/site/userdata/latest",
            sitePath: "/api/v1/site/", // 添加站点信息API路径
            cookie: '',
            username: '', // 存储用户名
            password: ''  // 存储密码
        };
        
        // 站点名称缓存
        this.siteNames = {};
        
        // 根据是否已登录显示不同的菜单
        this.registerAction(
            this.settings.cookie ? '清除账号' : '账号设置',
            async () => {
                if (this.settings.cookie) {
                    await this.clearAccount();
                } else {
                    await this.showLoginForm();
                }
            },
            { name: this.settings.cookie ? 'person.crop.circle.badge.minus' : 'person.crop.circle.badge.plus', 
              color: this.settings.cookie ? '#ff5555' : '#ff79c6' }
        );

        this.registerAction(
            '服务器设置',
            this.setServerConfig.bind(this),
            { name: 'server.rack', color: '#50fa7b' }
        );

        // 添加显示设置菜单
        this.registerAction(
            '显示设置',
            this.setDisplayConfig.bind(this),
            { name: 'eye', color: '#bd93f9' }
        );

        // 只保留大号组件预览
        this.registerAction(
            '预览组件',
            async () => {
                const widget = await this.render();
                await widget.presentLarge();
            },
            { name: 'rectangle.grid.3x2', color: '#bd93f9' }
        );
    }

    // 重写通知方法
    async notify(title, body, opts = {}) {
        console.log(`${title}: ${body}`);
    }

    // 重写保存设置方法
    saveSettings() {
        try {
            let cache = {};
            cache[this.SETTING_KEY] = this.settings;
            Keychain.set(this.SETTING_KEY, JSON.stringify(cache));
            return true;
        } catch (e) {
            console.log(e);
            return false;
        }
    }

    // 重写获取设置方法
    getSettings() {
        try {
            const cache = Keychain.get(this.SETTING_KEY);
            if (cache) {
                const settings = JSON.parse(cache);
                return settings[this.SETTING_KEY];
            }
            return {};
        } catch (e) {
            console.log(e);
            return {};
        }
    }

    async init() {
        try {
            if (!this.settings.baseUrl) {
                console.log("未配置服务器地址");
                return false;
            }
            
            // 获取站点名称映射
            await this.fetchSiteNames();
            
            return true;
        } catch (e) {
            console.log(e);
            return false;
        }
    }

    // 获取站点名称映射
    async fetchSiteNames() {
        try {
            const baseUrl = this.settings.baseUrl || this.defaultData.baseUrl;
            const sitePath = this.settings.sitePath || this.defaultData.sitePath;
            
            // 构建完整的API URL
            const apiUrl = baseUrl + (baseUrl.endsWith('/') ? '' : '/') + 
                          (sitePath.startsWith('/') ? sitePath.substring(1) : sitePath);
            
            console.log("请求站点信息URL:", apiUrl);
            
            const request = new Request(apiUrl);
            request.headers = {
                'cookie': this.settings.cookie,
                'authorization': `Bearer ${this.settings.cookie.replace('MoviePilot=', '')}`,
                'accept': 'application/json',
                'user-agent': 'Mozilla/5.0'
            };
            request.timeoutInterval = 20;
            
            console.log("发送站点信息请求...");
            const response = await request.loadJSON();
            console.log("收到站点信息响应:", JSON.stringify(response));
            
            if (!response) {
                throw new Error("站点信息响应数据为空");
            }
            
            // 更新站点名称映射
            this.siteNames = {};
            response.forEach(site => {
                if (site.domain && site.name) {
                    this.siteNames[site.domain] = site.name;
                }
            });
            
            return true;
        } catch (error) {
            console.error("获取站点信息失败:", error);
            return false;
        }
    }

    // 获取站点名称
    getSiteName(domain) {
        return this.siteNames[domain] || domain;
    }

    async render() {
        const initResult = await this.init();
        const widget = new ListWidget();
        widget.backgroundColor = new Color("#282a36");
        widget.setPadding(5, 16, 5, 16);
        
        if (!initResult) {
            return await this.renderServerConfig(widget);
        }
        
        if (!this.settings.cookie) {
            return await this.renderLogin(widget);
        }
        
        try {
            const data = await this.fetchData();
            if (!data) {
                throw new Error("无法获取数据");
            }
            
            await this.renderHeader(widget);
            await this.renderStats(widget, data);
            await this.renderTable(widget, data);
            
            widget.refreshAfterDate = new Date(Date.now() + 60 * 1000); // 1分钟后刷新
            return widget;
        } catch (error) {
            console.error("创建小组件失败:", error);
            const errorWidget = await this.renderError(widget, error);
            return errorWidget;
        }
    }

    /**
     * 渲染登录界面
     */
    async renderLogin(widget) {
        this.provideText("MoviePilot 小组件", widget, {
            font: "bold",
            size: 16,
            color: new Color("#f8f8f2")
        });
        
        widget.addSpacer(10);
        
        this.provideText("请点击小组件进行登录", widget, {
            size: 14,
            color: new Color("#BBBBBB")
        });
        
        this.provideText("首次使用请先在服务器设置中配置正确的服务器地址", widget, {
            size: 12,
            color: new Color("#BBBBBB")
        });
        
        widget.refreshAfterDate = new Date(Date.now() + 60 * 1000); // 1分钟后刷新
        return widget;
    }

    /**
     * 渲染服务器配置界面
     */
    async renderServerConfig(widget) {
        this.provideText("MoviePilot 小组件", widget, {
            font: "bold",
            size: 16,
            color: new Color("#f8f8f2")
        });
        
        widget.addSpacer(10);
        
        this.provideText("请先配置MoviePilot服务器地址", widget, {
            size: 14,
            color: new Color("#BBBBBB")
        });
        
        widget.refreshAfterDate = new Date(Date.now() + 60 * 1000); // 1分钟后刷新
        return widget;
    }

    /**
     * 渲染头部
     */
    async renderHeader(widget) {
        const titleRow = widget.addStack();
        titleRow.layoutHorizontally();
        titleRow.bottomAlignContent();
        
        this.provideText("PT站点数据统计", titleRow, {
            font: "bold",
            size: 16,
            color: new Color("#f8f8f2")
        });
        
        widget.addSpacer(4);
    }

    /**
     * 渲染统计数据
     */
    async renderStats(widget, data) {
        const statsRow = widget.addStack();
        statsRow.layoutHorizontally();
        statsRow.spacing = 8;
        
        // 左侧显示最低分享率站点
        const sitesWithRatio = data.sites
            .map(site => ({
                ...site,
                ratioValue: parseFloat(site.ratio)
            }))
            .filter(site => site.ratioValue > 0) // 只考虑有下载的站点
            .sort((a, b) => a.ratioValue - b.ratioValue); // 按分享率从低到高排序

        if (sitesWithRatio.length > 0) {
            const lowestRatioSite = sitesWithRatio[0];
            const warningStack = statsRow.addStack();
            warningStack.layoutHorizontally();
            warningStack.spacing = 4;
            
            // 警告图标
            this.provideText("⚠️", warningStack, {
                size: 8,
                color: new Color("#ff5555")
            });
            
            // 警告文本
            this.provideText("最低分享率：", warningStack, {
                size: 8,
                color: new Color("#ff5555")
            });
            
            // 显示最低分享率的站点
            this.provideText(`${lowestRatioSite.name}(${lowestRatioSite.ratio})`, warningStack, {
                size: 8,
                color: new Color("#ff5555")
            });
        }
        
        statsRow.addSpacer();
        
        // 右侧显示更新时间
        const now = new Date();
        this.provideText(
            `最后刷新：${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`,
            statsRow,
            {
                size: 8,
                color: new Color("#6272a4")
            }
        );
    }

    /**
     * 计算列宽配置
     * @param {Object} config - 显示配置项
     * @returns {Object} 各列宽度配置
     */
    calculateColumnWidths(config) {
        /** 组件总宽度 */
        const totalWidth = 290;
        /** 列间距 */
        const spacing = 3;
        
        /** 基础列宽配置 */
        const baseWidths = {
            site: 50,      // 站点名称列宽
            upload: 48,    // 上传列宽
            download: 48,  // 下载列宽
            ratio: 38,     // 分享率列宽
            bonus: config.bonus && !config.seeds ? 58 : 38,  // 魔力值列宽（单独显示时加宽）
            seeds: 28,     // 种数列宽
            size: 48       // 体积列宽
        };
        
        // 确定要显示的列
        let visibleColumns = ['site', 'upload', 'download', 'ratio', 'size'];
        if (config.bonus) visibleColumns.push('bonus');
        if (config.seeds) visibleColumns.push('seeds');
        
        // 计算列间距总宽度
        const totalSpacing = (visibleColumns.length - 1) * spacing;
        
        // 计算可用内容宽度
        const availableWidth = totalWidth - totalSpacing;
        
        // 计算基础宽度总和
        const baseTotal = visibleColumns.reduce((sum, key) => sum + baseWidths[key], 0);
        
        // 计算可分配的额外宽度
        const extraWidth = Math.max(0, availableWidth - baseTotal);
        
        // 列宽度优先级配置
        const priorities = {
            site: 2,       // 站点名称优先级最高
            upload: 1.2,   // 数据列标准优先级
            download: 1.2,
            ratio: 1.2,
            size: 1.2,
            bonus: config.bonus && !config.seeds ? 2 : 1.2,  // 魔力值单独显示时提高优先级
            seeds: 1       // 种数优先级最低
        };
        
        // 计算优先级总和
        const totalPriority = visibleColumns.reduce((sum, key) => sum + priorities[key], 0);
        
        // 根据优先级分配额外空间
        const getExtraSpace = (key) => Math.floor((extraWidth * priorities[key]) / totalPriority);
        
        // 返回最终列宽配置
        return {
            site: baseWidths.site + getExtraSpace('site'),
            upload: baseWidths.upload + getExtraSpace('upload'),
            download: baseWidths.download + getExtraSpace('download'),
            ratio: baseWidths.ratio + getExtraSpace('ratio'),
            bonus: config.bonus ? baseWidths.bonus + getExtraSpace('bonus') : 0,
            seeds: config.seeds ? baseWidths.seeds + getExtraSpace('seeds') : 0,
            size: baseWidths.size + getExtraSpace('size')
        };
    }

    /**
     * 渲染表格数据
     */
    async renderTable(widget, data) {
        // 使用类的设置
        const config = {
            bonus: this.settings.bonus ?? true,  // 从settings中获取，默认为true
            seeds: this.settings.seeds ?? true   // 从settings中获取，默认为true
        };
        
        // 计算列宽
        const columnWidths = this.calculateColumnWidths(config);
        
        // 添加分割线
        const divider = widget.addStack();
        const dividerLine = divider.addText("─".repeat(50));
        dividerLine.font = Font.systemFont(6);
        dividerLine.textColor = new Color("#6272a4");
        
        widget.addSpacer(4);
        
        // 创建表头
        const headerStack = widget.addStack();
        headerStack.layoutHorizontally();
        headerStack.spacing = 3;
        
        // 定义表头
        const headers = [
            {key: 'site', text: "站点", width: columnWidths.site},
            {key: 'upload', text: "上传", width: columnWidths.upload},
            {key: 'download', text: "下载", width: columnWidths.download},
            {key: 'ratio', text: "分享率", width: columnWidths.ratio},
            {key: 'bonus', text: "魔力", width: columnWidths.bonus},
            {key: 'seeds', text: "种数", width: columnWidths.seeds},
            {key: 'size', text: "体积", width: columnWidths.size}
        ].filter(header => {
            return ['site', 'upload', 'download', 'ratio', 'size'].includes(header.key) || 
                   config[header.key];
        });
        
        // 渲染表头
        headers.forEach(header => {
            const stack = headerStack.addStack();
            stack.size = new Size(header.width, 15);
            stack.layoutHorizontally();
            
            const text = stack.addText(header.text);
            text.font = Font.systemFont(10);
            text.textColor = new Color("#ff79c6");
            text.lineLimit = 1;
            
            stack.addSpacer();
        });
        
        widget.addSpacer(3);
        
        // 显示站点数据
        if (!data.sites || data.sites.length === 0) {
            widget.addSpacer(4);
            const errorText = widget.addText("暂无站点数据");
            errorText.textColor = new Color("#ff5555");
            errorText.font = Font.mediumSystemFont(14);
        } else {
            data.sites.forEach(site => {
                const rowStack = widget.addStack();
                rowStack.layoutHorizontally();
                rowStack.spacing = 3;
                
                const rowData = [
                    {key: 'site', value: site.name, width: columnWidths.site, color: new Color("#f8f8f2")},
                    {key: 'upload', value: site.upload, width: columnWidths.upload, color: new Color("#50fa7b")},
                    {key: 'download', value: site.download, width: columnWidths.download, color: new Color("#ff5555")},
                    {key: 'ratio', value: site.ratio, width: columnWidths.ratio, color: new Color("#ffb86c")},
                    {key: 'bonus', value: site.bonus, width: columnWidths.bonus, color: new Color("#bd93f9")},
                    {key: 'seeds', value: site.seeds, width: columnWidths.seeds, color: new Color("#8be9fd")},
                    {key: 'size', value: site.size, width: columnWidths.size, color: new Color("#f1fa8c")}
                ].filter(item => {
                    return ['site', 'upload', 'download', 'ratio', 'size'].includes(item.key) || 
                           config[item.key];
                });
                
                rowData.forEach(({value, width, color}, index) => {
                    const stack = rowStack.addStack();
                    stack.size = new Size(width, 15);
                    stack.layoutHorizontally();
                    
                    let displayValue = value;
                    if (index === 0) { // 站点名称列
                        if (value.length > 8) {
                            displayValue = value.slice(0, 7) + '…';
                        }
                    }
                    
                    const text = stack.addText(displayValue);
                    text.font = Font.systemFont(9);
                    text.textColor = color;
                    text.lineLimit = 1;
                    
                    stack.addSpacer();
                });
            });
        }
        
        widget.refreshAfterDate = new Date(Date.now() + 60 * 1000); // 1分钟后刷新
        return widget;
    }

    /**
     * 渲染错误信息
     */
    async renderError(widget, error) {
        widget.addSpacer(10);
        const errorText = widget.addText("加载数据失败");
        errorText.textColor = new Color("#ff5555"); // Dracula Red
        errorText.font = Font.mediumSystemFont(14);

        widget.addSpacer(5);
        const errorMessage = widget.addText(error.message || "未知错误");
        errorMessage.textColor = new Color("#BBBBBB");
        errorMessage.font = Font.systemFont(10);

        widget.refreshAfterDate = new Date(Date.now() + 60 * 1000); // 1分钟后刷新
        return widget;
    }

    // 数据获取方法
    async fetchData() {
        try {
            await this.init();
            
            if (!this.settings.cookie) return null;
            
            const baseUrl = this.settings.baseUrl || this.defaultData.baseUrl;
            const statPath = this.settings.statisticPath || this.defaultData.statisticPath;
            
            // 构建完整的API URL
            const apiUrl = baseUrl + (baseUrl.endsWith('/') ? '' : '/') + 
                          (statPath.startsWith('/') ? statPath.substring(1) : statPath);
            
            console.log("请求数据URL:", apiUrl); // 打印请求的URL
            
            const request = new Request(apiUrl);
            request.headers = {
                'cookie': this.settings.cookie,
                'authorization': `Bearer ${this.settings.cookie.replace('MoviePilot=', '')}`,
                'accept': 'application/json',
                'user-agent': 'Mozilla/5.0'
            };
            request.timeoutInterval = 20;
            
            console.log("发送数据请求...");
            const response = await request.loadJSON();
            console.log("收到数据响应:", JSON.stringify(response)); // 打印响应数据
            
            if (!response) {
                throw new Error("响应数据为空");
            }
            
            return this.parseData(response);
        } catch (error) {
            console.error("获取数据失败:", error);
            if (error.message.includes("401")) {
                // 检测到cookie过期，尝试使用存储的账号密码自动重新登录
                if (this.settings.username && this.settings.password) {
                    console.log("Cookie已过期，尝试自动重新登录...");
                    try {
                        const newCookie = await this.login(this.settings.username, this.settings.password);
                        if (newCookie) {
                            this.settings.cookie = newCookie;
                            this.saveSettings(false);
                            console.log("自动重新登录成功，重新获取数据");
                            // 递归调用自身，使用新的cookie重新获取数据
                            return await this.fetchData();
                        }
                    } catch (loginError) {
                        console.error("自动重新登录失败:", loginError);
                    }
                }
                // 如果自动重新登录失败或没有存储的账号密码，则清除cookie
                this.settings.cookie = '';
                this.saveSettings();
            }
            throw error;
        }
    }

    async showLoginForm() {
        const alert = new Alert();
        alert.title = "MoviePilot 登录";
        alert.message = "请输入MoviePilot账号密码\n首次使用请先在服务器设置中配置正确的服务器地址";
        
        // 如果已有存储的用户名，则预填充
        if (this.settings.username) {
            alert.addTextField("用户名", this.settings.username);
        } else {
            alert.addTextField("用户名");
        }
        
        alert.addSecureTextField("密码");
        alert.addAction("登录");
        alert.addCancelAction("取消");
        
        const result = await alert.present();
        
        if (result === 0) {
            const username = alert.textFieldValue(0);
            const password = alert.textFieldValue(1);
            
            if (!username || !password) {
                await this.notify("错误", "用户名和密码不能为空");
                return null;
            }
            
            try {
                const cookie = await this.login(username, password);
                if (cookie) {
                    this.settings.cookie = cookie;
                    // 保存账号密码
                    this.settings.username = username;
                    this.settings.password = password;
                    this.saveSettings(false);
                    await this.notify("登录成功", "账号设置已保存");
                    return cookie;
                }
            } catch (error) {
                await this.notify("登录失败", error.message);
                return null;
            }
        }
        return null;
    }

    async login(username, password) {
        try {
            await this.init(); // 确保设置已初始化
            
            const baseUrl = this.settings.baseUrl || this.defaultData.baseUrl;
            const loginPath = this.settings.loginPath || this.defaultData.loginPath;
            
            // 构建完整的登录URL
            const loginUrl = baseUrl + (baseUrl.endsWith('/') ? '' : '/') + 
                            (loginPath.startsWith('/') ? loginPath.substring(1) : loginPath);
            
            console.log("尝试登录URL:", loginUrl);
            
            const request = new Request(loginUrl);
            request.method = "POST";
            request.headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            };
            
            const body = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
            request.body = body;
            
            console.log("发送登录请求...");
            const response = await request.loadJSON();
            console.log("收到响应:", JSON.stringify(response));
            
            if (response.access_token) {
                console.log("登录成功，获取到token");
                return `MoviePilot=${response.access_token}`;
            } else {
                throw new Error("登录失败：未获取到token");
            }
        } catch (error) {
            console.error("登录失败:", error);
            throw new Error(`登录失败: ${error.message}`);
        }
    }

    // 添加服务器配置方法
    async setServerConfig() {
        const alert = new Alert();
        alert.title = "服务器设置";
        
        // 根据是否已配置显示不同的提示信息
        if (this.settings.baseUrl) {
            alert.message = "当前地址：" + this.settings.baseUrl;
        } else {
            alert.message = "首次使用需要配置服务器地址";
        }
        
        // 添加带格式说明的输入框
        alert.addTextField("服务器地址（格式：https://ip:port）");
        if (this.settings.baseUrl) {
            alert.textFieldValue(0, this.settings.baseUrl);
        }
        
        alert.addAction("保存");
        alert.addCancelAction("取消");
        
        const result = await alert.present();
        
        if (result === 0) {
            const url = alert.textFieldValue(0).trim();
            if (url) {
                this.settings.baseUrl = url;
                this.saveSettings(false);
                console.log("服务器地址已更新为:", url); // 打印更新的服务器地址
                await this.notify("设置成功", "服务器地址已更新");
            } else {
                await this.notify("设置失败", "服务器地址不能为空");
            }
        }
    }

    // 添加清除账号方法
    async clearAccount() {
        const alert = new Alert();
        alert.title = "确认清除账号";
        alert.message = "是否确定要清除当前账号？";
        
        alert.addAction("确定");
        alert.addCancelAction("取消");
        
        const result = await alert.present();
        
        if (result === 0) {
            this.settings.cookie = '';
            // 同时清除账号密码
            this.settings.username = '';
            this.settings.password = '';
            this.saveSettings(false);
            await this.notify("清除成功", "账号已清除");
        }
    }

    async parseData(response) {
        const stats = {
            upload: "0",
            download: "0",
            seedCount: "0",
            seedSize: "0",
            userLevel: "-",
            bonus: "0",
            ratio: "0",
            sites: []
        };
        
        try {
            // 计算总计数据
            let totalUpload = 0;
            let totalDownload = 0;
            let totalSeeding = 0;
            let totalSeedingSize = 0;
            let totalBonus = 0;
            let maxLevel = "";
            
            // 解析站点数据
            response.forEach(site => {
                // 累加总计数据
                totalUpload += site.upload;
                totalDownload += site.download;
                totalSeeding += site.seeding;
                totalSeedingSize += site.seeding_size;
                totalBonus += site.bonus;
                
                // 更新最高等级
                if (site.user_level && (!maxLevel || this.getLevelWeight(site.user_level) > this.getLevelWeight(maxLevel))) {
                    maxLevel = site.user_level;
                }
                
                // 转换数据单位
                const upload = this.formatSize(site.upload);
                const download = this.formatSize(site.download);
                const seedingSize = this.formatSize(site.seeding_size);
                
                // 添加到站点列表
                stats.sites.push({
                    name: this.getSiteName(site.domain),
                    level: site.user_level || "-",
                    upload: upload,
                    download: download,
                    ratio: site.ratio.toString(),
                    bonus: site.bonus.toString(),
                    seeds: site.seeding.toString(),
                    size: seedingSize
                });
            });
            
            // 设置总计数据
            stats.upload = this.formatSize(totalUpload);
            stats.download = this.formatSize(totalDownload);
            stats.seedCount = totalSeeding.toString();
            stats.seedSize = this.formatSize(totalSeedingSize);
            stats.userLevel = maxLevel || "-";
            stats.bonus = this.formatNumber(totalBonus);
            stats.ratio = totalDownload > 0 ? (totalUpload / totalDownload).toFixed(3) : "0";
            
            return stats;
        } catch (error) {
            console.error("数据解析错误:", error);
            throw error;
        }
    }

    // 格式化文件大小
    formatSize(bytes) {
        if (bytes === 0) return "0.0B";
        const k = 1024;
        const sizes = ['B', 'K', 'M', 'G', 'T', 'P'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(2) + sizes[i];
    }

    // 添加显示设置方法
    async setDisplayConfig() {
        const alert = new Alert();
        alert.title = "显示设置";
        alert.message = "请选择要显示的数据项";
        
        // 获取当前设置
        const bonus = this.settings.bonus ?? true;
        const seeds = this.settings.seeds ?? true;
        
        alert.addAction(bonus ? "✅ 显示魔力值" : "❎ 显示魔力值");
        alert.addAction(seeds ? "✅ 显示种子数" : "❎ 显示种子数");
        alert.addCancelAction("取消");
        
        const result = await alert.presentSheet();
        
        if (result === 0) {
            // 切换魔力值显示状态
            this.settings.bonus = !bonus;
            this.saveSettings();
        } else if (result === 1) {
            // 切换种子数显示状态
            this.settings.seeds = !seeds;
            this.saveSettings();
        }
    }

    // 格式化数字（添加千位分隔符）
    formatNumber(num) {
        return num.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    // 获取等级权重（用于比较等级高低）
    getLevelWeight(level) {
        const weights = {
            "User": 1,
            "Power User": 2,
            "Elite User": 3,
            "Crazy User": 4,
            "Insane User": 5,
            "Veteran User": 6,
            "Extreme User": 7,
            "Ultimate User": 8,
            "Nexus Master": 9,
            "VIP": 10,
            "(金玉满堂)VIP": 11
        };
        return weights[level] || 0;
    }
}

module.exports = Widget;

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

/**
 * 创建数据展示小组件
 * @returns {ListWidget} 配置完成的小组件实例
 */
async function createWidget() {
    const widget = new ListWidget();
    widget.backgroundColor = new Color("#282a36"); // Dracula Background
    widget.setPadding(5, 16, 5, 16);
    
    // 检查登录状态
    const cookie = await getCredentials();
    if (!cookie) {
        // 未登录状态显示
        const titleText = widget.addText("MoviePilot 小组件");
        titleText.font = Font.boldSystemFont(16);
        titleText.textColor = new Color("#f8f8f2"); // Dracula Foreground
        
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
        titleRow.bottomAlignContent();
        titleRow.spacing = 10;
        
        // 左侧标题文本
        const titleText = titleRow.addText("PT站点数据统计");
        titleText.font = Font.boldSystemFont(16);
        titleText.textColor = new Color("#f8f8f2"); // Dracula Foreground
        
        widget.addSpacer(4);
        
        // 创建统计数据和时间的容器
        const statsRow = widget.addStack();
        statsRow.layoutHorizontally();
        statsRow.spacing = 8;
        
        // 左侧统计数据
        const statsStack = statsRow.addStack();
        statsStack.layoutHorizontally();
        statsStack.spacing = 8;
        
        // 上传统计 - 绿色
        const uploadText = statsStack.addText(`↑${data.upload}`);
        uploadText.font = Font.systemFont(8);
        uploadText.textColor = new Color("#50fa7b"); // Dracula Green
        
        // 下载统计 - 红色
        const downloadText = statsStack.addText(`↓${data.download}`);
        downloadText.font = Font.systemFont(8);
        downloadText.textColor = new Color("#ff5555"); // Dracula Red
        
        // 做种数统计
        const seedText = statsStack.addText(`📦${data.seedCount}`);
        seedText.font = Font.systemFont(8);
        seedText.textColor = new Color("#bd93f9"); // Dracula Purple
        
        // 做种体积统计
        const sizeText = statsStack.addText(`💾${data.seedSize}`);
        sizeText.font = Font.systemFont(8);
        sizeText.textColor = new Color("#8be9fd"); // Dracula Cyan
        
        statsRow.addSpacer(); // 添加弹性空间，将时间推到右边
        
        // 分割线
        const divider = widget.addStack();
        const dividerLine = divider.addText("─".repeat(50));
        dividerLine.font = Font.lightSystemFont(6);
        dividerLine.textColor = new Color("#6272a4"); // Dracula Comment
        
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
            
            const text = stack.addText(header.text);
            text.font = Font.systemFont(10);
            text.textColor = new Color("#ff79c6");
            text.lineLimit = 1;
        });
        
        widget.addSpacer(3);
        
        // 显示站点数据
        if (!data.sites || data.sites.length === 0) {
            widget.addSpacer(4);
            const errorText = widget.addText("暂无站点数据");
            errorText.textColor = new Color("#ff5555");
            errorText.font = Font.mediumSystemFont(14);
        } else {
            data.sites.forEach(site => {
                const rowStack = widget.addStack();
                rowStack.layoutHorizontally();
                rowStack.spacing = 3;
                
                const rowData = [
                    {key: 'site', value: site.name, width: columnWidths.site, color: new Color("#f8f8f2")},
                    {key: 'upload', value: site.upload, width: columnWidths.upload, color: new Color("#50fa7b")},
                    {key: 'download', value: site.download, width: columnWidths.download, color: new Color("#ff5555")},
                    {key: 'ratio', value: site.ratio, width: columnWidths.ratio, color: new Color("#ffb86c")},
                    {key: 'bonus', value: site.bonus, width: columnWidths.bonus, color: new Color("#bd93f9")},
                    {key: 'seeds', value: site.seeds, width: columnWidths.seeds, color: new Color("#8be9fd")},
                    {key: 'size', value: site.size, width: columnWidths.size, color: new Color("#f1fa8c")}
                ].filter(item => {
                    return ['site', 'upload', 'download', 'ratio', 'size'].includes(item.key) || 
                           config[item.key];
                });
                
                rowData.forEach(({value, width, color}, index) => {
                    const stack = rowStack.addStack();
                    stack.size = new Size(width, 15);
                    stack.layoutHorizontally();
                    
                    let displayValue = value;
                    if (index === 0) { // 站点名称列
                        if (value.length > 8) {
                            displayValue = value.slice(0, 7) + '…';
                        }
                    }
                    
                    const text = stack.addText(displayValue);
                    text.font = Font.systemFont(9);
                    text.textColor = color;
                    text.lineLimit = 1;
                    
                    stack.addSpacer();
                });
            });
        }
        
        widget.refreshAfterDate = new Date(Date.now() + 60 * 1000); // 1分钟后刷新
        return widget;
    } catch (error) {
        console.error("创建小组件失败:", error);
        const errorText = widget.addText("数据获取失败");
        errorText.textColor = new Color("#ff5555");
        errorText.font = Font.mediumSystemFont(14);
        
        errorText.refreshAfterDate = new Date(Date.now() + 60 * 1000); // 1分钟后刷新
        return errorText;
    }
}

// 注册组件
await Runing(Widget); 