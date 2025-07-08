// EdgeOne Pages Functions - 简化代理下载（无缓存）
// 文件路径: functions/api/[[route]].js

// 配置常量
const CONFIG = {
    GITHUB_API_URL: 'https://api.github.com/repos/babalae/better-genshin-impact/releases/latest',
    USER_AGENT: 'EdgeOne-GitHub-Release-Downloader',
    MAX_FILE_SIZE: 5 * 1024 * 1024 * 1024, // 5GB最大文件限制
    TIMEOUT: 300000 // 5分钟超时
};

// 主要处理函数
export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace('/api', '');
    
    // 设置CORS头
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 处理OPTIONS请求
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        let response;
        
        // 路由处理
        switch (true) {
            case path === '/release':
                response = await handleRelease(context);
                break;
            case path.startsWith('/download'):
                response = await handleDownload(context);
                break;
            case path === '/health':
                response = await handleHealth(context);
                break;
            default:
                response = new Response(JSON.stringify({
                    error: 'Not Found',
                    available_endpoints: ['/release', '/download', '/health']
                }), { 
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
        }

        // 添加CORS头到响应
        Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString(),
            path: path
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
}

// 处理GitHub发布信息请求
async function handleRelease(context) {
    try {
        const releaseData = await fetchFromGitHub(CONFIG.GITHUB_API_URL);
        
        if (!releaseData) {
            throw new Error('Failed to fetch release data from GitHub API');
        }

        // 验证数据完整性
        if (!releaseData.tag_name || !releaseData.assets || !Array.isArray(releaseData.assets)) {
            throw new Error('Invalid release data structure');
        }

        return new Response(JSON.stringify(releaseData), {
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // 5分钟缓存
            }
        });
    } catch (error) {
        console.error('Release fetch error:', error);
        throw new Error(`GitHub API error: ${error.message}`);
    }
}

// 处理代理下载请求
async function handleDownload(context) {
    const { request } = context;
    const url = new URL(request.url);
    const downloadId = url.searchParams.get('d');
    const version = url.searchParams.get('v');

    // 参数验证
    if (!downloadId || !version) {
        return new Response(JSON.stringify({
            error: 'Missing required parameters',
            required: ['d (download ID)', 'v (version)']
        }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // 获取发布数据
        const releaseData = await fetchFromGitHub(CONFIG.GITHUB_API_URL);
        if (!releaseData || !releaseData.assets) {
            throw new Error('Release data not available');
        }

        // 版本验证
        if (releaseData.tag_name !== version) {
            const normalizedApiVersion = releaseData.tag_name.replace(/^v/, '');
            const normalizedRequestVersion = version.replace(/^v/, '');
            
            if (normalizedApiVersion !== normalizedRequestVersion) {
                return new Response(JSON.stringify({
                    error: 'Version mismatch',
                    expected: releaseData.tag_name,
                    requested: version
                }), { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // 获取资源信息
        const assetIndex = parseInt(downloadId);
        if (isNaN(assetIndex) || assetIndex < 0 || assetIndex >= releaseData.assets.length) {
            return new Response(JSON.stringify({
                error: 'Invalid asset index',
                provided: downloadId,
                available_range: `0-${releaseData.assets.length - 1}`
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const asset = releaseData.assets[assetIndex];
        const filename = asset.name;
        const filesize = asset.size || 0;
        const downloadUrl = asset.browser_download_url;

        // 验证文件信息
        if (!downloadUrl || !filename) {
            throw new Error('Invalid asset data');
        }

        // 检查文件大小限制
        if (filesize > CONFIG.MAX_FILE_SIZE) {
            return new Response(JSON.stringify({
                error: 'File too large for proxy download',
                file_size: filesize,
                max_size: CONFIG.MAX_FILE_SIZE,
                suggestion: 'Please download directly from GitHub'
            }), { 
                status: 413,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 验证下载URL
        if (!downloadUrl.includes('github.com') && !downloadUrl.includes('githubusercontent.com')) {
            throw new Error('Invalid download URL');
        }

        console.log(`Proxying download: ${filename} (${filesize} bytes)`);

        // 代理下载文件
        const fileResponse = await fetch(downloadUrl, {
            headers: {
                'User-Agent': CONFIG.USER_AGENT,
                'Accept': 'application/octet-stream'
            },
            // 设置超时
            signal: AbortSignal.timeout(CONFIG.TIMEOUT)
        });

        if (!fileResponse.ok) {
            throw new Error(`Failed to fetch file from GitHub: ${fileResponse.status} ${fileResponse.statusText}`);
        }

        // 获取文件头信息
        const contentLength = fileResponse.headers.get('content-length');
        const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
        const lastModified = fileResponse.headers.get('last-modified');
        const etag = fileResponse.headers.get('etag');

        // 验证文件大小
        if (contentLength && parseInt(contentLength) !== filesize) {
            console.warn(`Size mismatch: expected ${filesize}, got ${contentLength}`);
        }

        // 构建响应头
        const responseHeaders = {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Cache-Control': 'public, max-age=3600',
            'X-Proxy-Status': 'STREAMING',
            'X-Original-URL': downloadUrl
        };

        // 添加可选头
        if (contentLength) {
            responseHeaders['Content-Length'] = contentLength;
        }
        if (lastModified) {
            responseHeaders['Last-Modified'] = lastModified;
        }
        if (etag) {
            responseHeaders['ETag'] = etag;
        }

        // 流式传输文件
        return new Response(fileResponse.body, {
            status: 200,
            headers: responseHeaders
        });

    } catch (error) {
        console.error('Download proxy error:', error);
        
        // 如果是网络超时或其他错误，返回错误信息
        if (error.name === 'TimeoutError') {
            return new Response(JSON.stringify({
                error: 'Download timeout',
                message: 'The file download timed out. Please try again or download directly from GitHub.',
                timeout: CONFIG.TIMEOUT
            }), { 
                status: 504,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            error: 'Proxy download failed',
            message: error.message,
            suggestion: 'Please try again or download directly from GitHub'
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 处理健康检查
async function handleHealth(context) {
    try {
        // 测试GitHub API连接
        const testResponse = await fetch(CONFIG.GITHUB_API_URL, {
            method: 'HEAD',
            headers: {
                'User-Agent': CONFIG.USER_AGENT
            }
        });

        const githubStatus = testResponse.ok ? 'healthy' : 'unhealthy';
        
        return new Response(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            github_api: {
                status: githubStatus,
                response_code: testResponse.status
            },
            config: {
                max_file_size: CONFIG.MAX_FILE_SIZE,
                timeout: CONFIG.TIMEOUT
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 从GitHub API获取数据
async function fetchFromGitHub(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': CONFIG.USER_AGENT,
                'Accept': 'application/vnd.github.v3+json'
            },
            // 设置较短的超时时间
            signal: AbortSignal.timeout(30000) // 30秒
        });

        if (!response.ok) {
            // 处理GitHub API限制
            if (response.status === 403) {
                const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
                const rateLimitReset = response.headers.get('X-RateLimit-Reset');
                
                if (rateLimitRemaining === '0') {
                    const resetTime = new Date(parseInt(rateLimitReset) * 1000);
                    throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime.toISOString()}`);
                }
            }
            
            throw new Error(`GitHub API responded with status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // 验证返回的数据结构
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid JSON response from GitHub API');
        }

        return data;
    } catch (error) {
        if (error.name === 'TimeoutError') {
            throw new Error('GitHub API request timeout');
        }
        
        console.error('GitHub API fetch error:', error);
        throw error;
    }
}
