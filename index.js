// ==UserScript==
// @name         页面转Markdown (Readability + Turndown)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  使用Readability提取文章内容，并用Turndown转换为Markdown，支持复制和下载
// @author       You
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @require      https://cdnjs.cloudflare.com/ajax/libs/readability/0.6.0/Readability.min.js
// @require      https://unpkg.com/turndown@7.2.2/dist/turndown.js
// ==/UserScript==

(function() {
    'use strict';

    // 在脚本开头添加检查
    if (window.self !== window.top) {
        return; // 如果在iframe中，直接退出
    }

    // ==================== 样式定义 ====================
    GM_addStyle(`
        #md-converter-btn {
            position: fixed;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            z-index: 999999;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1.2;
            text-align: center;
            word-break: break-word;
            padding: 5px;
            font-weight: bold;
        }
        #md-converter-btn:hover {
            background: #45a049;
            transform: translateY(-50%) scale(1.1);
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        }
        #md-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000000;
            display: none;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(3px);
        }
        #md-modal {
            background: white;
            width: 85%;
            max-width: 900px;
            max-height: 85%;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            padding: 24px;
            color: #333;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
            border: 1px solid #ddd;
        }
        #md-modal h3 {
            margin: 0 0 16px 0;
            color: #2c3e50;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 12px;
            font-size: 1.5rem;
            font-weight: 600;
        }
        #md-output {
            width: 100%;
            min-height: 350px;
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 14px;
            line-height: 1.5;
            padding: 16px;
            border: 1px solid #d0d7de;
            border-radius: 8px;
            background: #f6f8fa;
            color: #24292e;
            resize: vertical;
            margin-bottom: 20px;
            box-sizing: border-box;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        #md-output:focus {
            outline: 2px solid #4CAF50;
            outline-offset: 2px;
        }
        .md-button-group {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            flex-wrap: wrap;
        }
        .md-button-group button {
            padding: 10px 24px;
            border: none;
            border-radius: 40px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 500;
            transition: all 0.2s;
            letter-spacing: 0.3px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .md-button-group button:active {
            transform: scale(0.96);
        }
        #md-copy {
            background: #2196F3;
            color: white;
        }
        #md-copy:hover {
            background: #1e87dc;
            box-shadow: 0 4px 10px rgba(33,150,243,0.3);
        }
        #md-download {
            background: #4CAF50;
            color: white;
        }
        #md-download:hover {
            background: #45a049;
            box-shadow: 0 4px 10px rgba(76,175,80,0.3);
        }
        #md-close {
            background: #f44336;
            color: white;
        }
        #md-close:hover {
            background: #da190b;
            box-shadow: 0 4px 10px rgba(244,67,54,0.3);
        }
        #md-converter-btn {
            /* ... 原有保持不变，添加 opacity: 0.7; */
            opacity: 0.2;
        }
        #md-converter-btn:hover {
            opacity: 1;
            /* 其他原有 hover 样式 */
        }
    `);

    // ==================== 转换核心函数 ====================
    function convertToMarkdown() {
        try {
            // 克隆整个文档以避免影响原页面
            const docClone = document.cloneNode(true);

            // 使用Readability解析文章 (传入当前URL以辅助解析相对路径)
            const reader = new Readability(docClone, { url: document.URL });
            const article = reader.parse();

            if (!article || !article.content) {
                throw new Error('未能从当前页面提取出文章内容。可能本页不是文章页或结构特殊。');
            }

            // 初始化Turndown转换器 (默认配置)
            var turndownService = new TurndownService()

            // 将文章HTML转为Markdown
            const markdownBody = turndownService.turndown(article.content);

            // 组合标题与正文 (标题用一级标题)
            const fullMarkdown = `# ${article.title}\n\n${markdownBody}`;

            return fullMarkdown;
        } catch (error) {
            console.error('[MD Converter]', error);
            return `❌ 转换失败: ${error.message}\n\n请检查控制台以获取更多信息。`;
        }
    }

    // ==================== UI初始化 ====================
    function initUI() {
        // 避免重复创建
        if (document.getElementById('md-converter-btn')) return;

        // 创建浮动按钮
        const btn = document.createElement('button');
        btn.id = 'md-converter-btn';
        btn.textContent = 'MD';
        btn.setAttribute('aria-label', '转换为Markdown');

        // 创建遮罩层和模态框
        const overlay = document.createElement('div');
        overlay.id = 'md-overlay';
        overlay.innerHTML = `
            <div id="md-modal">
                <h3>📄 Markdown 输出</h3>
                <textarea id="md-output" readonly placeholder="转换后的Markdown会显示在这里..." spellcheck="false"></textarea>
                <div class="md-button-group">
                    <button id="md-copy">📋 复制</button>
                    <button id="md-download">💾 下载 .md</button>
                    <button id="md-close">✖ 关闭</button>
                </div>
            </div>
        `;

        document.body.appendChild(btn);
        document.body.appendChild(overlay);

        const textarea = document.getElementById('md-output');
        const copyBtn = document.getElementById('md-copy');
        const downloadBtn = document.getElementById('md-download');
        const closeBtn = document.getElementById('md-close');

        // 状态控制
        let isConverting = false;
        let pendingTimeout = null;

        // 关闭浮层 (同时取消待进行的转换)
        const closeOverlay = () => {
            overlay.style.display = 'none';
            if (pendingTimeout) {
                clearTimeout(pendingTimeout);
                pendingTimeout = null;
                isConverting = false;
            }
        };

        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeOverlay();
        });
        closeBtn.addEventListener('click', closeOverlay);

        // 按下ESC键关闭浮层
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.style.display === 'flex') {
                closeOverlay();
            }
        });

        // 主按钮点击：开始转换
        btn.addEventListener('click', () => {
            if (isConverting) {
                alert('已有转换任务进行中，请稍候……');
                return;
            }

            isConverting = true;
            overlay.style.display = 'flex';
            textarea.value = '⏳ 正在提取内容并转换，请稍候……';

            // 使用setTimeout让UI先更新，避免卡死
            if (pendingTimeout) clearTimeout(pendingTimeout);
            pendingTimeout = setTimeout(() => {
                try {
                    const markdown = convertToMarkdown();
                    textarea.value = markdown;
                } catch (e) {
                    textarea.value = `⚠️ 发生意外错误: ${e.message}`;
                } finally {
                    isConverting = false;
                    pendingTimeout = null;
                }
            }, 30);
        });

        // 复制按钮
        copyBtn.addEventListener('click', () => {
            const content = textarea.value;
            if (!content || content.startsWith('⏳') || content.startsWith('⚠️') || content.startsWith('❌')) {
                alert('没有可复制的有效内容，请等待转换完成。');
                return;
            }
            GM_setClipboard(content, 'text');
            // alert('✅ Markdown内容已复制到剪贴板！');
        });

        // 下载按钮
        downloadBtn.addEventListener('click', () => {
            const content = textarea.value;
            if (!content || content.startsWith('⏳') || content.startsWith('⚠️') || content.startsWith('❌')) {
                alert('没有可下载的有效内容，请等待转换完成。');
                return;
            }

            // 生成文件名 (使用页面标题或默认名)
            let filename = document.title.replace(/[\\/:*?"<>|]/g, '_') || 'page';
            if (!filename.endsWith('.md')) filename += '.md';
            else if (!filename.toLowerCase().endsWith('.md')) filename += '.md';

            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // ==================== 启动脚本 ====================
    if (document.body) {
        initUI();
    } else {
        document.addEventListener('DOMContentLoaded', initUI);
    }
})();
