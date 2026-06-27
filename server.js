const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4000;
const WIKI_DIR = path.resolve(__dirname, 'wiki');

// Helper to recursively read directory and build tree structure
function getWikiTree(dir, relativeDir = '') {
    const items = fs.readdirSync(dir);
    const tree = [];

    items.forEach(item => {
        if (item.startsWith('.')) return; // Skip hidden files
        if (item === 'assets') return; // Skip static assets directory from sidebar tree
        
        const fullPath = path.join(dir, item);
        const relPath = path.join(relativeDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            tree.push({
                name: item,
                type: 'directory',
                path: relPath,
                children: getWikiTree(fullPath, relPath)
            });
        } else if (item.endsWith('.md')) {
            // Get clean name for display
            let cleanName = item.replace('.md', '').replace(/_/g, ' ');
            let displayName = cleanName;

            try {
                const fileContent = fs.readFileSync(fullPath, 'utf8');
                const frontmatterRegex = /^---\r?\n([\s\S]+?)\r?\n---/;
                const match = fileContent.match(frontmatterRegex);
                if (match) {
                    const yamlContent = match[1];
                    const koMatch = yamlContent.match(/title_ko:\s*(.+)/);
                    const enMatch = yamlContent.match(/title_en:\s*(.+)/);
                    const titleMatch = yamlContent.match(/title:\s*(.+)/);
                    
                    let titleKo = koMatch ? koMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';
                    let titleEn = enMatch ? enMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';
                    
                    if (!titleKo && titleMatch) {
                        titleKo = titleMatch[1].trim().replace(/^['"]|['"]$/g, '');
                    }

                    if (titleKo && titleEn) {
                        displayName = titleKo + ' (' + titleEn + ')';
                    } else if (titleKo) {
                        displayName = titleKo;
                    } else if (titleEn) {
                        displayName = titleEn;
                    }
                }
            } catch (err) {
                // Fallback to cleanName
            }

            tree.push({
                name: displayName,
                fileName: item,
                type: 'file',
                path: relPath
            });
        }
    });

    // Sort directories first, then files
    return tree.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
}

// Flat list of all pages for search indexing
function getFlatPageList(tree) {
    let list = [];
    tree.forEach(item => {
        if (item.type === 'directory') {
            list = list.concat(getFlatPageList(item.children));
        } else {
            list.push({
                name: item.name,
                path: item.path
            });
        }
    });
    return list;
}

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // API: Get Wiki Tree Structure
    if (pathname === '/api/tree') {
        try {
            const tree = getWikiTree(WIKI_DIR);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(tree));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // API: Get Flat Page List (for search)
    if (pathname === '/api/search') {
        try {
            const tree = getWikiTree(WIKI_DIR);
            const flatList = getFlatPageList(tree);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(flatList));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // API: Get Page Content
    if (pathname === '/api/page') {
        const queryPath = parsedUrl.searchParams.get('path');
        if (!queryPath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Path parameter is required' }));
            return;
        }

        const safePath = path.resolve(path.join(WIKI_DIR, queryPath));
        // Prevent directory traversal
        if (!safePath.startsWith(WIKI_DIR)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Access denied' }));
            return;
        }

        try {
            if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
                const markdown = fs.readFileSync(safePath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(markdown);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Page not found' }));
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Serve Wiki Assets (Images, etc.)
    if (pathname.startsWith('/wiki/assets/')) {
        const relativePath = pathname.substring(13); // remove '/wiki/assets/'
        const safePath = path.resolve(path.join(WIKI_DIR, 'assets', relativePath));
        
        // Prevent directory traversal
        if (safePath.startsWith(path.join(WIKI_DIR, 'assets'))) {
            try {
                if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
                    const ext = path.extname(safePath).toLowerCase();
                    const mimeTypes = {
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.gif': 'image/gif',
                        '.svg': 'image/svg+xml',
                        '.webp': 'image/webp',
                        '.mp3': 'audio/mpeg',
                        '.wav': 'audio/wav',
                        '.mp4': 'video/mp4',
                        '.pdf': 'application/pdf'
                    };
                    const contentType = mimeTypes[ext] || 'application/octet-stream';
                    res.writeHead(200, { 'Content-Type': contentType });
                    fs.createReadStream(safePath).pipe(res);
                    return;
                }
            } catch (err) {
                // Fall through to 404
            }
        }
    }

    // Serve Frontend SPA
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getFrontendHTML());
        return;
    }

    // Catch-all
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

// HTML/CSS/JS Bundle - read from generated index.html
function getFrontendHTML() {
    const indexPath = path.resolve(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        return fs.readFileSync(indexPath, 'utf8');
    }
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>Wiki Error</title>
</head>
<body style="font-family: sans-serif; background: #0b0d11; color: #fff; padding: 40px; text-align: center;">
    <h1>⚠️ index.html 파일을 찾을 수 없습니다</h1>
    <p>서버를 구동하기 전에 먼저 <code>node build.js</code>를 실행하여 정적 파일들을 빌드해 주세요.</p>
</body>
</html>`;
}

server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`📡 HiFi Wiki Server is running!`);
    console.log(`🌐 Open in your browser: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
