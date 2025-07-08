// EdgeOne Pages Functions - API处理
// 文件路径: functions/api/[[route]].js

// 配置常量
const CONFIG = {
    GITHUB_API_URL: 'https://api.github.com/repos/babalae/better-genshin-impact/releases/latest',
    CACHE_EXPIRE: 3600, // 1小时
    SINGLE_FILE_LIMIT: 1024 * 1024 * 1024, // 1GB
    MAX_CACHE_SIZE: 10 * 1024 * 1024 * 1024, // 10GB
    USER_AGENT: 'EdgeOne-GitHub-Release-Downloader'
};

// 主要处理函数
export async function onRequest(context) {
    const { request, env } = context;
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
            case path === '/refresh':
                response = await handleRefresh(context);
                break;
            case path === '/debug/cache':
                response = await handleDebugCache(context);
                break;
            case path === '/test/access':
                response = await handleTestAccess(context);
                break;
            case path === '/test/download':
                response = await handleTestDownload(context);
                break;
            default:
                response = new Response('Not Found', { status: 404 });
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

// 处理GitHub发布信息请求
async function handleRelease(context) {
    const { env } = context;
    const cache = new CacheManager(env);
    
    // 尝试从缓存获取
    const cached = await cache.getApiCache();
    if (cached && cached.data && cached.timestamp + CONFIG.CACHE_EXPIRE > Date.now() / 1000) {
        return new Response(JSON.stringify({
            release: cached.data,
            cache_info: {
                exists: true,
                age: Math.floor(Date.now() / 1000 - cached.timestamp),
                remaining: CONFIG.CACHE_EXPIRE - Math.floor(Date.now() / 1000 - cached.timestamp),
                expired: false
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 从GitHub API获取最新数据
    const releaseData = await fetchFromGitHub(CONFIG.GITHUB_API_URL);
    if (!releaseData) {
        throw new Error('Failed to fetch release data from GitHub');
    }

    // 保存到缓存
    await cache.setApiCache(releaseData);

    // 后台预缓存文件（异步执行，不阻塞响应）
    if (releaseData.assets && Array.isArray(releaseData.assets)) {
        // 使用context.waitUntil在后台执行预缓存（如果EdgeOne支持）
        if (context.waitUntil) {
            context.waitUntil(predownloadAssets(releaseData.assets, releaseData.tag_name, env));
        }
    }

    return new Response(JSON.stringify({
        release: releaseData,
        cache_info: {
            exists: false
        }
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// 处理代理下载请求
async function handleDownload(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const downloadId = url.searchParams.get('d');
    const version = url.searchParams.get('v');

    if (!downloadId || !version) {
        return new Response('Missing parameters', { status: 400 });
    }

    // 获取发布数据
    const cache = new CacheManager(env);
    const apiCache = await cache.getApiCache();
    
    let releaseData;
    if (apiCache && apiCache.data && apiCache.timestamp + CONFIG.CACHE_EXPIRE > Date.now() / 1000) {
        releaseData = apiCache.data;
    } else {
        releaseData = await fetchFromGitHub(CONFIG.GITHUB_API_URL);
        if (releaseData) {
            await cache.setApiCache(releaseData);
        }
    }

    if (!releaseData || !releaseData.assets) {
        return new Response('Release data not found', { status: 404 });
    }

    // 验证版本
    if (releaseData.tag_name !== version) {
        return new Response('Version mismatch', { status: 400 });
    }

    // 获取资源信息
    const assetIndex = parseInt(downloadId);
    if (assetIndex < 0 || assetIndex >= releaseData.assets.length) {
        return new Response('Invalid asset index', { status: 400 });
    }

    const asset = releaseData.assets[assetIndex];
    const filename = asset.name;
    const filesize = asset.size || 0;
    const downloadUrl = asset.browser_download_url;

    // 检查文件缓存
    const fileCache = await cache.getFileCache(filename);
    const isValidCache = fileCache && 
        fileCache.version === version && 
        fileCache.size === filesize &&
        fileCache.timestamp + CONFIG.CACHE_EXPIRE > Date.now() / 1000;

    if (isValidCache) {
        // 从缓存返回文件
        await cache.incrementDownloadCount(filename);
        return new Response(fileCache.data, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': filesize.toString(),
                'Cache-Control': 'public, max-age=86400',
                'X-Cache-Status': 'HIT'
            }
        });
    }

    // 文件未缓存或已过期，需要下载
    if (filesize > CONFIG.SINGLE_FILE_LIMIT) {
        // 文件过大，直接重定向到GitHub
        return Response.redirect(downloadUrl, 302);
    }

    try {
        // 下载并缓存文件
        const fileResponse = await fetch(downloadUrl, {
            headers: {
                'User-Agent': CONFIG.USER_AGENT
            }
        });

        if (!fileResponse.ok) {
            throw new Error(`Failed to download file: ${fileResponse.status}`);
        }

        const fileData = await fileResponse.arrayBuffer();
        
        // 验证文件大小
        if (fileData.byteLength !== filesize) {
            console.warn(`File size mismatch: expected ${filesize}, got ${fileData.byteLength}`);
        }

        // 保存到缓存
        await cache.setFileCache(filename, {
            data: fileData,
            version: version,
            size: fileData.byteLength,
            timestamp: Date.now() / 1000,
            download_count: 1
        });

        return new Response(fileData, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': fileData.byteLength.toString(),
                'Cache-Control': 'public, max-age=86400',
                'X-Cache-Status': 'MISS'
            }
        });

    } catch (error) {
        console.error('Download error:', error);
        // 下载失败，重定向到GitHub原始链接
        return Response.redirect(downloadUrl, 302);
    }
}

// 处理缓存刷新
async function handleRefresh(context) {
    const { env } = context;
    const cache = new CacheManager(env);
    
    // 清除API缓存
    await cache.clearApiCache();
    
    return new Response(JSON.stringify({
        status: 'success',
        message: 'Cache refreshed',
        timestamp: new Date().toISOString()
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// 处理缓存调试
async function handleDebugCache(context) {
    const { env } = context;
    const cache = new CacheManager(env);
    
    const apiCache = await cache.getApiCache();
    const fileList = await cache.listFileCache();
    
    return new Response(JSON.stringify({
        api_cache: apiCache ? {
            exists: true,
            age: Math.floor(Date.now() / 1000 - apiCache.timestamp),
            remaining: CONFIG.CACHE_EXPIRE - Math.floor(Date.now() / 1000 - apiCache.timestamp),
            version: apiCache.data?.tag_name || 'unknown'
        } : { exists: false },
        file_cache: {
            count: fileList.length,
            files: fileList
        },
        config: CONFIG
    }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// 处理访问测试
async function handleTestAccess(context) {
    const { env } = context;
    
    return new Response(JSON.stringify({
        status: 'success',
        message: 'EdgeOne Functions is working',
        timestamp: new Date().toISOString(),
        environment: typeof env !== 'undefined' ? 'edge' : 'unknown'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// 处理下载测试
async function handleTestDownload(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const downloadId = url.searchParams.get('d') || '0';
    const version = url.searchParams.get('v');

    if (!version) {
        return new Response('Version parameter required', { status: 400 });
    }

    // 获取发布数据用于测试
    const releaseData = await fetchFromGitHub(CONFIG.GITHUB_API_URL);
    if (!releaseData || !releaseData.assets) {
        return new Response('No release data available', { status: 404 });
    }

    const assetIndex = parseInt(downloadId);
    if (assetIndex >= releaseData.assets.length) {
        return new Response('Invalid asset index', { status: 400 });
    }

    const asset = releaseData.assets[assetIndex];
    const cache = new CacheManager(env);
    const fileCache = await cache.getFileCache(asset.name);

    return new Response(JSON.stringify({
        asset_info: {
            name: asset.name,
            size: asset.size,
            download_url: asset.browser_download_url
        },
        cache_status: {
            exists: !!fileCache,
            valid: fileCache ? (fileCache.version === version && 
                              fileCache.timestamp + CONFIG.CACHE_EXPIRE > Date.now() / 1000) : false,
            size: fileCache?.size || 0
        },
        test_url: `/api/download?d=${downloadId}&v=${encodeURIComponent(version)}`
    }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// 缓存管理类
class CacheManager {
    constructor(env) {
        this.env = env;
        // EdgeOne Pages的KV存储，根据实际API调整
        this.kv = env.CACHE_KV || env.KV; // 根据EdgeOne的实际KV存储名称调整
    }

    async getApiCache() {
        if (!this.kv) return null;
        try {
            const data = await this.kv.get('github_api_cache', 'json');
            return data;
        } catch (error) {
            console.error('Failed to get API cache:', error);
            return null;
        }
    }

    async setApiCache(data) {
        if (!this.kv) return;
        try {
            await this.kv.put('github_api_cache', JSON.stringify({
                data: data,
                timestamp: Date.now() / 1000
            }));
        } catch (error) {
            console.error('Failed to set API cache:', error);
        }
    }

    async clearApiCache() {
        if (!this.kv) return;
        try {
            await this.kv.delete('github_api_cache');
        } catch (error) {
            console.error('Failed to clear API cache:', error);
        }
    }

    async getFileCache(filename) {
        if (!this.kv) return null;
        try {
            const key = `file_${this.hashFilename(filename)}`;
            const data = await this.kv.get(key, 'json');
            return data;
        } catch (error) {
            console.error('Failed to get file cache:', error);
            return null;
        }
    }

    async setFileCache(filename, data) {
        if (!this.kv) return;
        try {
            const key = `file_${this.hashFilename(filename)}`;
            await this.kv.put(key, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to set file cache:', error);
        }
    }

    async incrementDownloadCount(filename) {
        const fileCache = await this.getFileCache(filename);
        if (fileCache) {
            fileCache.download_count = (fileCache.download_count || 0) + 1;
            await this.setFileCache(filename, fileCache);
        }
    }

    async listFileCache() {
        if (!this.kv) return [];
        try {
            // EdgeOne KV的列表API，根据实际API调整
            const list = await this.kv.list({ prefix: 'file_' });
            return list.keys || [];
        } catch (error) {
            console.error('Failed to list file cache:', error);
            return [];
        }
    }

    hashFilename(filename) {
        // 简单的哈希函数，用于生成KV键名
        let hash = 0;
        for (let i = 0; i < filename.length; i++) {
            const char = filename.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }
}

// 从GitHub API获取数据
async function fetchFromGitHub(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': CONFIG.USER_AGENT,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch from GitHub:', error);
        return null;
    }
}

// 后台预下载资源（异步执行）
async function predownloadAssets(assets, version, env) {
    const cache = new CacheManager(env);
    
    for (const asset of assets) {
        try {
            const filename = asset.name;
            const filesize = asset.size || 0;
            
            // 跳过过大的文件
            if (filesize > CONFIG.SINGLE_FILE_LIMIT) {
                continue;
            }

            // 检查是否已缓存
            const existing = await cache.getFileCache(filename);
            if (existing && existing.version === version && existing.size === filesize) {
                continue; // 已经缓存且版本匹配
            }

            // 下载并缓存
            const response = await fetch(asset.browser_download_url, {
                headers: { 'User-Agent': CONFIG.USER_AGENT }
            });

            if (response.ok) {
                const data = await response.arrayBuffer();
                await cache.setFileCache(filename, {
                    data: data,
                    version: version,
                    size: data.byteLength,
                    timestamp: Date.now() / 1000,
                    download_count: 0
                });
                console.log(`Predownloaded: ${filename}`);
            }
        } catch (error) {
            console.error(`Failed to predownload ${asset.name}:`, error);
        }
    }
}
