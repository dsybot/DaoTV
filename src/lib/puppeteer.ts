import puppeteer, { Browser, Page } from 'puppeteer';

import { getRandomUserAgent, getRandomUserAgentWithInfo, getSecChUaHeaders } from './user-agent';

/**
 * 获取 Puppeteer 浏览器实例
 * 自动处理 Docker 和本地环境的配置差异
 */
export async function getBrowser(): Promise<Browser> {
  const isDocker = process.env.DOCKER_BUILD === 'true';

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
    ],
  };

  // Docker 环境：使用系统 Chromium
  if (isDocker && process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return await puppeteer.launch(launchOptions);
}

/**
 * 使用 Puppeteer 获取页面 HTML（绕过 JS 挑战）
 */
export async function fetchPageWithPuppeteer(url: string, options?: {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
}): Promise<{ html: string; cookies: any[] }> {
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();

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
 * 使用 Puppeteer 绕过豆瓣的 Challenge 页面
 */
export async function bypassDoubanChallenge(url: string): Promise<{
  html: string;
  cookies: any[];
}> {
  console.log(`[Puppeteer] 开始绕过豆瓣 Challenge: ${url}`);

  const result = await fetchPageWithPuppeteer(url, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  console.log(`[Puppeteer] ✅ 成功获取页面，HTML 长度: ${result.html.length}`);

  return result;
}
