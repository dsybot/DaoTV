import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { getRandomUserAgentWithInfo, getSecChUaHeaders } from '@/lib/user-agent';

/**
 * 豆瓣详情调试端点
 * 用于诊断豆瓣详情获取问题
 * 
 * 使用方法：
 * /api/douban/debug?id=1292052&mode=html
 * 
 * 参数：
 * - id: 豆瓣影片ID
 * - mode: 调试模式
 *   - html: 返回原始HTML（用于检查是否是Challenge页面）
 *   - headers: 返回响应头信息
 *   - parse: 返回解析结果（默认）
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const mode = searchParams.get('mode') || 'parse';

  if (!id) {
    return NextResponse.json({
      error: '缺少参数: id',
      usage: '/api/douban/debug?id=1292052&mode=html'
    }, { status: 400 });
  }

  const config = await getConfig();
  const proxyUrl = config.SiteConfig.DoubanDetailProxy || '';
  const originalUrl = `https://movie.douban.com/subject/${id}/`;
  const targetUrl = proxyUrl
    ? `${proxyUrl}${encodeURIComponent(originalUrl)}`
    : originalUrl;

  try {
    // 获取随机浏览器指纹
    const { ua, browser, platform } = getRandomUserAgentWithInfo();
    const secChHeaders = getSecChUaHeaders(browser, platform);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        ...secChHeaders,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': ua,
        'Referer': 'https://www.douban.com/',
      },
    });

    clearTimeout(timeoutId);

    const html = await response.text();

    // 检测是否为 Challenge 页面
    const isChallenge = html.includes('sha512') &&
      html.includes('process(cha)') &&
      html.includes('载入中');

    // 检测是否为错误页面
    const is404 = html.includes('页面不存在') || html.includes('404');
    const is403 = html.includes('403 Forbidden');

    // 提取关键信息用于诊断
    const diagnostics = {
      url: targetUrl,
      proxyUsed: !!proxyUrl,
      statusCode: response.status,
      statusText: response.statusText,
      htmlLength: html.length,
      isChallenge,
      is404,
      is403,
      hasTitle: html.includes('<h1'),
      hasContent: html.includes('id="content"'),
      hasSummary: html.includes('property="v:summary"') || html.includes('class="all hidden"'),
      hasCelebrities: html.includes('id="celebrities"'),
      hasRecommendations: html.includes('id="recommendations"'),
      userAgent: ua,
      browser,
      platform,
    };

    // 根据模式返回不同内容
    switch (mode) {
      case 'html':
        // 返回原始HTML（截取前10000字符，避免太大）
        return new Response(html.substring(0, 10000), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        });

      case 'headers':
        // 返回响应头信息
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return NextResponse.json({
          diagnostics,
          responseHeaders: headers,
        });

      case 'parse':
      default:
        // 尝试解析关键字段
        const titleMatch = html.match(/<h1[^>]*>[\s\S]*?<span[^>]*property="v:itemreviewed"[^>]*>([^<]+)<\/span>/);
        const title = titleMatch ? titleMatch[1].trim() : '';

        const summaryMatch = html.match(/<span[^>]*class="all hidden">([\s\S]*?)<\/span>/) ||
          html.match(/<span[^>]*property="v:summary"[^>]*>([\s\S]*?)<\/span>/);
        const plot_summary = summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        const celebritiesSection = html.match(/<div id="celebrities"[\s\S]*?<ul class="celebrities-list[^"]*">([\s\S]*?)<\/ul>/);
        const celebritiesCount = celebritiesSection
          ? (celebritiesSection[1].match(/<li[\s\S]*?<\/li>/g) || []).length
          : 0;

        return NextResponse.json({
          diagnostics,
          parsedData: {
            title,
            plot_summary: plot_summary.substring(0, 200) + (plot_summary.length > 200 ? '...' : ''),
            celebritiesCount,
          },
          suggestions: getSuggestions(diagnostics),
        });
    }
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

function getSuggestions(diagnostics: any): string[] {
  const suggestions: string[] = [];

  if (diagnostics.isChallenge) {
    suggestions.push('⚠️ 检测到豆瓣 Challenge 页面（反爬虫验证）');
    suggestions.push('建议：1) 配置豆瓣详情代理 2) 等待一段时间后重试 3) 使用 Puppeteer 绕过');
  }

  if (diagnostics.is404) {
    suggestions.push('❌ 影片不存在或已被删除');
  }

  if (diagnostics.is403) {
    suggestions.push('🚫 访问被拒绝（可能被封禁）');
    suggestions.push('建议：配置代理或等待较长时间后重试');
  }

  if (diagnostics.htmlLength < 5000 && !diagnostics.isChallenge) {
    suggestions.push('⚠️ HTML 内容过短，可能是简化版页面或错误页面');
  }

  if (!diagnostics.hasTitle) {
    suggestions.push('❌ 未找到标题元素，页面结构可能已改变');
  }

  if (!diagnostics.hasSummary) {
    suggestions.push('⚠️ 未找到简介元素，可能是新片或页面结构改变');
  }

  if (!diagnostics.hasCelebrities) {
    suggestions.push('⚠️ 未找到演员信息区域');
  }

  if (diagnostics.statusCode !== 200) {
    suggestions.push(`⚠️ HTTP 状态码异常: ${diagnostics.statusCode}`);
  }

  if (!diagnostics.proxyUsed) {
    suggestions.push('💡 提示：未使用代理，建议在管理后台配置豆瓣详情代理');
  }

  if (suggestions.length === 0) {
    suggestions.push('✅ 页面看起来正常，如果仍然获取不到数据，可能是解析逻辑问题');
  }

  return suggestions;
}
