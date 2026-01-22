import puppeteer, { Browser, Page } from 'puppeteer-core';

import { getRandomUserAgent, getRandomUserAgentWithInfo, getSecChUaHeaders } from './user-agent';

// 🎯 重试配置 - 基于2025-2026最佳实践
const PUPPETEER_MAX_RETRIES = 3;
const PUPPETEER_BASE_DELAY = 2000; // 2秒
const PUPPETEER_MAX_DELAY = 30000; // 最大30秒

/**
 * 计算exponential backoff延迟（带jitter）
 * 参考: https://medium.com/@titoadeoye/requests-at-scale-exponential-backoff-with-jitter-with-examples-4d0521891923
 */
function calculateBackoffDelay(retryCount: number): number {
  // Exponential backoff: base_delay * (2 ^ retry_count)
  const exponentialDelay = PUPPETEER_BASE_DELAY * Math.pow(2, retryCount);

  // 限制最大延迟
  const cappedDelay = Math.min(exponentialDelay, PUPPETEER_MAX_DELAY);

  // 添加jitter（随机性）避免thundering herd问题
  // jitter范围：0.5x 到 1.5x
  const jitter = 0.5 + Math.random();

  return Math.floor(cappedDelay * jitter);
}

/**
 * 获取 Puppeteer 浏览器实例
 * 自动处理 Docker、Vercel 和本地环境的配置差异
 */
export async function getBrowser(): Promise<Browser> {
  const isDocker = process.env.DOCKER_BUILD === 'true';
  const isVercel = process.env.VERCEL === '1';

  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      // 🎯 额外的反检测参数 - 基于2025-2026最佳实践
      '--disable-blink-features=AutomationControlled', // 隐藏自动化标识
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080', // 模拟真实窗口大小
    ],
  };

  // Docker 环境：使用系统 Chromium
  if (isDocker && process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  // Vercel 环境：使用 @sparticuz/chromium
  else if (isVercel) {
    const chromium = await import('@sparticuz/chromium');
    launchOptions.executablePath = await chromium.default.executablePath();
  }
  // 本地开发：需要手动指定 Chrome/Chromium 路径
  else {
    // 本地需要安装 Chrome 或 Chromium
    // 可以通过环境变量 CHROME_PATH 指定
    if (process.env.CHROME_PATH) {
      launchOptions.executablePath = process.env.CHROME_PATH;
    } else {
      throw new Error('本地开发环境需要设置 CHROME_PATH 环境变量指向 Chrome/Chromium 可执行文件');
    }
  }

  return await puppeteer.launch(launchOptions);
}

/**
 * 使用 Puppeteer 获取页面 HTML（单次尝试，内部使用）
 * 参考: https://www.zenrows.com/blog/puppeteer-avoid-detection
 */
async function _fetchPageWithPuppeteerOnce(url: string, options?: {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
}): Promise<{ html: string; cookies: any[] }> {
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();

    // 🎯 隐藏webdriver属性 - 反bot检测
    await page.evaluateOnNewDocument(() => {
      // 删除 navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // 模拟真实的Chrome对象
      (window as any).chrome = {
        runtime: {},
      };

      // 模拟权限API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);
    });

    // 使用项目的随机 User-Agent（带浏览器信息）
    const { ua, browser: browserType, platform } = getRandomUserAgentWithInfo();
    const secChHeaders = getSecChUaHeaders(browserType, platform);

    await page.setUserAgent(ua);

    // 设置额外的请求头（与 douban API 保持一致）
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Cache-Control': 'max-age=0',
      'DNT': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      // 随机添加 Referer（50% 概率）
      ...(Math.random() > 0.5 ? { 'Referer': 'https://www.douban.com/' } : {}),
      // 注意：Sec-CH-UA headers 需要通过 CDP 设置，Puppeteer 不直接支持
    });

    // 🎯 监听失败的请求（用于调试）
    page.on('requestfailed', (request) => {
      console.warn(`[Puppeteer] Request failed: ${request.url()}, error: ${request.failure()?.errorText}`);
    });

    // 访问页面
    await page.goto(url, {
      waitUntil: options?.waitUntil || 'networkidle2',
      timeout: options?.timeout || 30000,
    });

    // 等待额外的时间确保 JS 执行完成（SHA-512 计算）
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 获取 HTML
    const html = await page.content();

    // 获取 cookies
    const cookies = await page.cookies();

    return { html, cookies };
  } finally {
    await browser.close();
  }
}

/**
 * 使用 Puppeteer 获取页面 HTML（带重试机制）
 * 参考: https://betterstack.com/community/guides/monitoring/exponential-backoff/
 */
export async function fetchPageWithPuppeteer(url: string, options?: {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
  maxRetries?: number;
}): Promise<{ html: string; cookies: any[] }> {
  const maxRetries = options?.maxRetries ?? PUPPETEER_MAX_RETRIES;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Puppeteer] 尝试 ${attempt + 1}/${maxRetries + 1}: ${url}`);

      const result = await _fetchPageWithPuppeteerOnce(url, options);

      console.log(`[Puppeteer] ✅ 成功获取页面 (尝试 ${attempt + 1}/${maxRetries + 1}), HTML 长度: ${result.html.length}`);

      return result;
    } catch (error) {
      lastError = error as Error;

      console.error(`[Puppeteer] ❌ 尝试 ${attempt + 1}/${maxRetries + 1} 失败:`, error);

      // 如果还有重试机会
      if (attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt);
        console.log(`[Puppeteer] 等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // 所有重试都失败
  throw new Error(`Puppeteer在${maxRetries + 1}次尝试后失败: ${lastError?.message}`);
}

/**
 * 使用 Puppeteer 绕过豆瓣的 Challenge 页面（带重试）
 */
export async function bypassDoubanChallenge(url: string, maxRetries?: number): Promise<{
  html: string;
  cookies: any[];
}> {
  console.log(`[Puppeteer] 开始绕过豆瓣 Challenge: ${url}`);

  const result = await fetchPageWithPuppeteer(url, {
    waitUntil: 'networkidle2',
    timeout: 30000,
    maxRetries,
  });

  console.log(`[Puppeteer] ✅ 成功绕过Challenge，HTML 长度: ${result.html.length}`);

  return result;
}
