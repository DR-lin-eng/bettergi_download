// EdgeOne Pages Functions - 简单代理版本
// 文件路径: functions/api/[[route]].js

// 配置常量
const CONFIG = {
    GITHUB_API_URL: 'https://api.github.com/repos/babalae/better-genshin-impact/releases/latest',
    USER_AGENT: 'EdgeOne-GitHub-Proxy/1.0',
    CACHE_DURATION: 3600 // 1小时缓存
};

// 内存缓存（仅缓存release信息）
let memoryCache = {
    releaseData: null,
    timestamp: 0
};

// 主处理函数
export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env, ctx);
    }
};

export async function onRequest(context) {
    return handleRequest(context.request, context.env, context);
}

// 统一请求处理
async function handleRequest(request, env, ctx) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Range',
        'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    try {
        const url = new URL(request.url);
        const path = url.pathname.replace(/^\/api/, '') || '/';
        
        let response;

        switch (path) {
            case '/release':
            case '/':
                response = await handleRelease();
                break;
            case '/proxy':
                response = await handleProxyChunk(url, request);
                break;
            case '/health':
                response = await handleHealth();
                break;
            default:
                response = new Response(JSON.stringify({
                    error: 'Not Found',
                    available: ['/release', '/proxy', '/health']
                }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
        }

        // 添加CORS头
        Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;

    } catch (error) {
        console.error('Handler error:', error);
        
        return new Response(JSON.stringify({
            error: 'Proxy Error',
            message: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
}

// 处理发布信息
async function handleRelease() {
    try {
        const now = Date.now();
        
        // 检查缓存
        if (memoryCache.releaseData && 
            (now - memoryCache.timestamp) < CONFIG.CACHE_DURATION * 1000) {
            return new Response(JSON.stringify(memoryCache.releaseData), {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Cache': 'HIT',
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        }

        // 获取新数据
        const releaseData = await fetchGitHubAPI(CONFIG.GITHUB_API_URL);
        
        if (!releaseData || !releaseData.tag_name || !Array.isArray(releaseData.assets)) {
            throw new Error('Invalid release data');
        }

        // 更新缓存
        memoryCache.releaseData = releaseData;
        memoryCache.timestamp = now;

        return new Response(JSON.stringify(releaseData), {
            headers: {
                'Content-Type': 'application/json',
                'X-Cache': 'MISS',
                'Cache-Control': 'public, max-age=3600'
            }
        });

    } catch (error) {
        console.error('Release error:', error);
        
        if (memoryCache.releaseData) {
            return new Response(JSON.stringify(memoryCache.releaseData), {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Cache': 'STALE'
                }
            });
        }

        return new Response(JSON.stringify({
            error: 'Failed to fetch release data',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 处理分片代理请求
async function handleProxyChunk(url, request) {
    try {
        const targetUrl = url.searchParams.get('url');
        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');
        
        if (!targetUrl) {
            return new Response('Missing URL parameter', { status: 400 });
        }

        // 验证URL安全性
        if (!targetUrl.includes('github.com') && !targetUrl.includes('githubusercontent.com')) {
            return new Response('Invalid URL - only GitHub URLs allowed', { status: 403 });
        }

        console.log(`Proxying chunk: ${start}-${end} from ${targetUrl}`);

        // 构建代理请求头
        const proxyHeaders = {
            'User-Agent': CONFIG.USER_AGENT,
            'Accept': '*/*'
        };

        // 如果有range参数，添加Range头
        if (start !== null && end !== null) {
            proxyHeaders['Range'] = `bytes=${start}-${end}`;
        }

        // 代理请求到GitHub
        const proxyResponse = await fetch(targetUrl, {
            headers: proxyHeaders
        });

        if (!proxyResponse.ok) {
            throw new Error(`GitHub responded with ${proxyResponse.status}: ${proxyResponse.statusText}`);
        }

        // 构建响应头
        const responseHeaders = {
            'Content-Type': proxyResponse.headers.get('content-type') || 'application/octet-stream',
            'Cache-Control': 'public, max-age=3600',
            'X-Proxy-Status': 'SUCCESS'
        };

        // 复制重要的响应头
        const headersToCopy = ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];
        headersToCopy.forEach(header => {
            const value = proxyResponse.headers.get(header);
            if (value) {
                responseHeaders[header.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('-')] = value;
            }
        });

        // 直接流式传输响应体
        return new Response(proxyResponse.body, {
            status: proxyResponse.status,
            headers: responseHeaders
        });

    } catch (error) {
        console.error('Proxy chunk error:', error);
        
        return new Response(JSON.stringify({
            error: 'Proxy failed',
            message: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 健康检查
async function handleHealth() {
    try {
        const now = Date.now();
        const cacheAge = memoryCache.timestamp ? Math.floor((now - memoryCache.timestamp) / 1000) : 0;
        
        return new Response(JSON.stringify({
            status: 'ok',
            mode: 'frontend_chunk_download',
            timestamp: new Date().toISOString(),
            cache: {
                release_data: !!memoryCache.releaseData,
                age_seconds: cacheAge
            },
            proxy: {
                enabled: true,
                github_proxy: true,
                chunk_support: true
            },
            strategy: 'Backend proxy + Frontend assembly'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            status: 'error',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// GitHub API请求
async function fetchGitHubAPI(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': CONFIG.USER_AGENT,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API: ${response.status} ${response.statusText}`);
        }

        return await response.json();

    } catch (error) {
        console.error('GitHub API error:', error);
        throw error;
    }
}