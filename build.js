const fs = require('fs');
const path = require('path');

const WIKI_DIR = path.resolve(__dirname, 'wiki');
const OUTPUT_FILE = path.resolve(__dirname, 'index.html');

// Recursive helper to get tree
function getWikiTree(dir, relativeDir = '') {
    const items = fs.readdirSync(dir);
    const tree = [];

    items.forEach(item => {
        if (item.startsWith('.')) return;
        if (item === 'assets') return; // Skip static assets directory from sidebar tree
        if (item === 'CONVENTION.md') return; // Skip convention guidelines from sidebar tree
        
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
            let cleanName = item.replace('.md', '').replace(/_/g, ' ');
            let displayName = cleanName;
            let tags = [];

            try {
                const fileContent = fs.readFileSync(fullPath, 'utf8');
                const frontmatterRegex = /^---\r?\n([\s\S]+?)\r?\n---/;
                const match = fileContent.match(frontmatterRegex);
                if (match) {
                    const yamlContent = match[1];
                    const koMatch = yamlContent.match(/title_ko:\s*(.+)/);
                    const enMatch = yamlContent.match(/title_en:\s*(.+)/);
                    const titleMatch = yamlContent.match(/title:\s*(.+)/);
                    const tagsMatch = yamlContent.match(/tags:\s*\[(.*?)\]/);
                    
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
                    
                    if (tagsMatch && tagsMatch[1]) {
                        tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(t => t);
                    }
                }
            } catch (err) {
                // Fallback to cleanName
            }

            tree.push({
                name: displayName,
                fileName: item,
                type: 'file',
                path: relPath,
                tags: tags
            });
        }
    });

    return tree.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
}

// Flat list for search
function getFlatPageList(tree) {
    let list = [];
    tree.forEach(item => {
        if (item.type === 'directory') {
            list = list.concat(getFlatPageList(item.children));
        } else {
            list.push({
                name: item.name,
                path: item.path,
                tags: item.tags || []
            });
        }
    });
    return list;
}

// Collect all page contents
function collectPageContents(dir, relativeDir = '', contents = {}) {
    const items = fs.readdirSync(dir);

    items.forEach(item => {
        if (item.startsWith('.')) return;
        if (item === 'CONVENTION.md') return; // Skip convention guidelines from search content index
        const fullPath = path.join(dir, item);
        const relPath = path.join(relativeDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            collectPageContents(fullPath, relPath, contents);
        } else if (item.endsWith('.md')) {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            contents[relPath] = fileContent;
        }
    });

    return contents;
}

function buildBacklinks(pageContents) {
    const backlinks = {};
    for (const srcPath of Object.keys(pageContents)) {
        const content = pageContents[srcPath];
        const regex = /\[.*?\]\(([^)]+\.md)(?:#[^)]+)?\)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            let targetPath = match[1];
            
            let currentFolder = srcPath.includes('/') ? srcPath.substring(0, srcPath.lastIndexOf('/')) : '';
            let resolvedTarget = '';
            
            if (targetPath.startsWith('../')) {
                let steps = targetPath.split('/');
                let folderParts = currentFolder ? currentFolder.split('/') : [];
                for(let step of steps) {
                    if (step === '..') folderParts.pop();
                    else folderParts.push(step);
                }
                resolvedTarget = folderParts.join('/');
            } else if (targetPath.startsWith('./')) {
                resolvedTarget = currentFolder ? currentFolder + '/' + targetPath.substring(2) : targetPath.substring(2);
            } else {
                resolvedTarget = currentFolder ? currentFolder + '/' + targetPath : targetPath;
            }

            // Exclude structural (top-down) links from backlinks
            let isStructural = false;
            if (srcPath === 'README.md') {
                isStructural = true;
            } else if (srcPath.endsWith('INDEX.md')) {
                let srcDir = srcPath.includes('/') ? srcPath.substring(0, srcPath.lastIndexOf('/')) : '';
                let targetDir = resolvedTarget.includes('/') ? resolvedTarget.substring(0, resolvedTarget.lastIndexOf('/')) : '';
                if (targetDir === srcDir || targetDir.startsWith(srcDir + '/')) {
                    isStructural = true;
                }
            }

            if (!isStructural) {
                if (!backlinks[resolvedTarget]) backlinks[resolvedTarget] = [];
                if (!backlinks[resolvedTarget].includes(srcPath)) {
                    backlinks[resolvedTarget].push(srcPath);
                }
            }
        }
    }
    return backlinks;
}

function buildStaticWiki() {
    console.log("Starting static wiki compilation...");

    if (!fs.existsSync(WIKI_DIR)) {
        console.error(`Error: wiki folder not found at ${WIKI_DIR}`);
        return;
    }

    const tree = getWikiTree(WIKI_DIR);
    const searchIndex = getFlatPageList(tree);
    const pageContents = collectPageContents(WIKI_DIR);
    const backlinks = buildBacklinks(pageContents);

    let htmlContent = getTemplateHTML();
    htmlContent = htmlContent
        .replace('/* WIKI_TREE_PLACEHOLDER */', JSON.stringify(tree))
        .replace('/* WIKI_SEARCH_PLACEHOLDER */', JSON.stringify(searchIndex))
        .replace('/* WIKI_DATA_PLACEHOLDER */', JSON.stringify(pageContents))
        .replace('/* WIKI_BACKLINKS_PLACEHOLDER */', JSON.stringify(backlinks));

    fs.writeFileSync(OUTPUT_FILE, htmlContent, 'utf8');
    console.log(`==================================================`);
    console.log(`🎉 Static Wiki Build Complete!`);
    console.log(`📄 Saved to: ${OUTPUT_FILE}`);
    console.log(`💡 Double-click index.html to view directly in your browser without any server!`);
    console.log(`==================================================`);
}

function getTemplateHTML() {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Prevent caching in local development -->
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>하이파이 오디오, 프로덕션 & 자작 개인 위키 (HiFi Audio, Production & DIY Personal Wiki)</title>
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <!-- Marked Markdown Parser -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script>
        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        document.documentElement.setAttribute('data-theme', savedTheme);
        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        }
    </script>
    <style>
        :root {
            --bg-main: #0b0d11;
            --bg-sidebar: #12151b;
            --bg-card: #181c25;
            --border: #232936;
            --text-main: #e2e8f0;
            --text-muted: #94a3b8;
            --accent-blue: #3b82f6;
            --accent-purple: #a855f7;
            --accent-gradient: linear-gradient(135deg, #3b82f6 0%, #a855f7 100%);
            --sidebar-width: 320px;
            --transition-speed: 0.25s;
            --glass-bg: var(--glass-bg);
            --glass-bg-hover: var(--glass-bg-hover);
            --glass-border: var(--glass-border);
            --glass-border-faint: var(--glass-bg-hover);
        }

        :root[data-theme='light'] {
            --bg-main: #f8fafc;
            --bg-sidebar: #f1f5f9;
            --bg-card: #ffffff;
            --border: #e2e8f0;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --glass-bg: rgba(0, 0, 0, 0.03);
            --glass-bg-hover: rgba(0, 0, 0, 0.06);
            --glass-border: rgba(0, 0, 0, 0.15);
            --glass-border-faint: rgba(0, 0, 0, 0.08);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg-main);
            color: var(--text-main);
            display: flex;
            height: 100vh;
            overflow: hidden;
            -webkit-font-smoothing: antialiased;
        }

        /* Ambient background glow */
        .ambient-glow {
            position: absolute;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, rgba(59, 130, 246, 0.05) 50%, rgba(0,0,0,0) 100%);
            top: -100px;
            right: -100px;
            z-index: 0;
            pointer-events: none;
        }

        /* Sidebar Styling */
        aside {
            width: var(--sidebar-width);
            background-color: var(--bg-sidebar);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            height: 100%;
            z-index: 10;
            position: relative;
        }

        .sidebar-resizer {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            width: 4px;
            cursor: col-resize;
            z-index: 20;
            transition: background-color 0.2s;
        }
        .sidebar-resizer:hover,
        .sidebar-resizer.dragging {
            background-color: var(--accent-purple);
        }

        /* Breadcrumbs styling */
        .breadcrumbs-container {
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
            font-size: 0.9rem;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .breadcrumbs-path {
            color: var(--text-muted);
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
        }
        .breadcrumbs-path a {
            color: var(--text-muted);
            text-decoration: none;
            transition: color 0.2s;
        }
        .breadcrumbs-path a:hover {
            color: var(--accent-purple);
        }
        .breadcrumbs-path .separator {
            color: var(--border);
            user-select: none;
        }
        .breadcrumbs-path .current-crumb {
            color: var(--text-main);
            font-weight: 500;
        }
        .back-to-parent {
            margin-top: 4px;
        }
        .back-to-parent a {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: var(--accent-purple);
            text-decoration: none;
            font-weight: 600;
            transition: opacity 0.2s;
        }
        .back-to-parent a:hover {
            opacity: 0.8;
        }

        .sidebar-header {
            padding: 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-family: 'Outfit', sans-serif;
            font-size: 1.25rem;
            font-weight: 700;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .search-box {
            margin-top: 16px;
            position: relative;
        }

        .search-box input {
            width: 100%;
            padding: 10px 14px 10px 38px;
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-main);
            font-size: 0.9rem;
            transition: all var(--transition-speed);
            outline: none;
        }

        .search-box input:focus {
            border-color: var(--accent-blue);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }

        .search-box svg {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            width: 16px;
            height: 16px;
            color: var(--text-muted);
            pointer-events: none;
        }

        /* Sidebar Navigation Menu */
        nav {
            flex: 1;
            overflow-y: auto;
            padding: 16px 8px;
        }

        nav::-webkit-scrollbar {
            width: 6px;
        }

        nav::-webkit-scrollbar-thumb {
            background-color: var(--glass-bg-hover);
            border-radius: 4px;
        }

        nav::-webkit-scrollbar-thumb:hover {
            background-color: var(--glass-border);
        }

        .menu-section {
            margin-bottom: 14px;
        }

        .section-title {
            font-family: 'Outfit', sans-serif;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            padding: 8px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }

        .section-title:hover {
            color: var(--text-main);
        }

        .section-title svg {
            width: 12px;
            height: 12px;
            transition: transform var(--transition-speed);
        }

        .section-title.collapsed svg {
            transform: rotate(-90deg);
        }

        .section-content {
            transition: max-height var(--transition-speed) ease-out;
            overflow: hidden;
        }

        .menu-folder {
            margin-left: 12px;
            margin-top: 4px;
            border-left: 1px dashed var(--border);
            padding-left: 4px;
        }

        .folder-header {
            display: flex;
            align-items: center;
            border-radius: 4px;
            transition: all var(--transition-speed);
            margin: 2px 0;
        }
        
        .folder-header:hover {
            background-color: var(--glass-bg);
        }

        .folder-header.active {
            background-color: rgba(168, 85, 247, 0.1);
            border-left: 2px solid var(--accent-purple);
        }

        .folder-header.parent-active {
            background-color: rgba(168, 85, 247, 0.04);
            border-left: 2px dashed rgba(168, 85, 247, 0.3);
        }

        .folder-header.parent-active .folder-title {
            color: var(--text-main);
            font-weight: 600;
        }

        .folder-header.parent-active .chevron {
            color: var(--accent-purple);
        }

        .folder-title {
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--text-main);
            padding: 6px 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            border-radius: 4px;
            user-select: none;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .folder-title svg,
        .menu-item svg {
            flex-shrink: 0;
        }

        .chevron {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            color: var(--text-muted);
            cursor: pointer;
            border-radius: 4px;
            transition: all var(--transition-speed);
        }
        
        .chevron:hover {
            color: var(--text-main);
            background-color: var(--glass-bg-hover);
        }

        .chevron svg {
            transition: transform 0.2s;
        }

        .folder-content {
            margin-left: 14px;
            border-left: 1px dashed var(--border);
            padding-left: 6px;
        }

        .menu-item {
            font-size: 0.85rem;
            color: var(--text-muted);
            padding: 6px 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
            cursor: pointer;
            border-radius: 4px;
            transition: all var(--transition-speed);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .menu-item:hover {
            color: var(--text-main);
            background-color: var(--glass-bg);
        }

        .menu-item.active {
            color: var(--text-main);
            background-color: rgba(59, 130, 246, 0.15);
            border-left: 2px solid var(--accent-blue);
            padding-left: 10px;
            font-weight: 500;
        }

        /* Main Content Panel */
        main {
            flex: 1;
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow-y: auto;
            position: relative;
            z-index: 1;
            background-color: var(--bg-main);
        }

        main::-webkit-scrollbar {
            width: 8px;
        }

        main::-webkit-scrollbar-thumb {
            background-color: var(--border);
            border-radius: 4px;
        }

        .content-container {
            max-width: 1000px;
            width: 100%;
            margin: 0 auto;
            padding: 24px 32px 64px 32px;
            animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Markdown Render Styling */
        .wiki-content {
            line-height: 1.7;
            font-size: 1.05rem;
        }

        /* Table Styling */
        .wiki-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
            font-size: 0.95rem;
            border: 1px solid var(--glass-border);
        }

        .wiki-content th, .wiki-content td {
            border: 1px solid var(--glass-border);
            padding: 12px 16px;
            text-align: left;
        }

        .wiki-content th {
            background-color: var(--bg-card);
            font-weight: 600;
            color: var(--text-main);
        }

        .wiki-content tr:nth-child(even) {
            background-color: var(--glass-bg);
        }

        .wiki-content h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 2.25rem;
            font-weight: 700;
            margin-bottom: 24px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 12px;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .wiki-content h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.5rem;
            font-weight: 600;
            margin-top: 36px;
            margin-bottom: 16px;
            color: var(--text-main);
        }

        .wiki-content h3 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.15rem;
            font-weight: 600;
            margin-top: 24px;
            margin-bottom: 12px;
            color: var(--text-main);
        }

        .wiki-content p {
            margin-bottom: 20px;
            color: var(--text-main);
        }

        .wiki-content ul, .wiki-content ol {
            margin-bottom: 20px;
            padding-left: 24px;
        }

        .wiki-content li {
            margin-bottom: 8px;
        }

        .wiki-content li strong {
            color: var(--text-main);
        }

        .wiki-content code {
            font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
            background-color: var(--glass-bg-hover);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.9em;
            color: #f472b6;
        }

        .wiki-content pre {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin-bottom: 24px;
        }

        .wiki-content pre code {
            background-color: transparent;
            padding: 0;
            color: var(--text-main);
            font-size: 0.9rem;
        }

        .wiki-content a {
            color: var(--accent-blue);
            text-decoration: none;
            border-bottom: 1px dashed var(--accent-blue);
            transition: all var(--transition-speed);
        }

        .wiki-content a:hover {
            color: var(--accent-purple);
            border-bottom-color: var(--accent-purple);
        }

        .wiki-content blockquote {
            border-left: 4px solid var(--accent-purple);
            padding-left: 16px;
            margin: 20px 0;
            color: var(--text-muted);
            font-style: italic;
        }

        .wiki-content hr {
            border: none;
            border-top: 1px solid var(--border);
            margin: 40px 0;
        }

        .wiki-content img {
            max-width: 90%;
            max-height: 400px;
            width: auto;
            height: auto;
            display: block;
            margin: 24px auto;
            border-radius: 8px;
            border: 1px solid var(--glass-border);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .wiki-content .image-caption {
            display: block;
            text-align: center;
            font-size: 0.82rem;
            color: var(--text-muted);
            margin-top: -16px;
            margin-bottom: 24px;
            font-style: italic;
        }

        /* Metadata Badges */
        .metadata-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 24px;
            margin-top: -8px;
        }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            letter-spacing: 0.05em;
        }
        .badge-status-default { background-color: var(--glass-border); color: var(--text-muted); }
        .badge-status-draft { background-color: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
        .badge-status-review { background-color: rgba(236, 72, 153, 0.15); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.3); }
        .badge-status-completed { background-color: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-tag { background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }

        /* Backlinks Styling */
        .backlinks-section {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 2px dashed var(--border);
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 24px;
        }
        .backlinks-section details summary {
            font-size: 1.1rem;
            color: var(--accent-purple);
            font-weight: 600;
            cursor: pointer;
            list-style: none;
            display: flex;
            align-items: center;
            gap: 8px;
            user-select: none;
            transition: color 0.2s;
        }
        .backlinks-section details summary::-webkit-details-marker {
            display: none;
        }
        .backlinks-section details summary::before {
            content: "▶";
            font-size: 0.8rem;
            transition: transform 0.2s;
            display: inline-block;
            color: var(--text-muted);
        }
        .backlinks-section details[open] summary::before {
            transform: rotate(90deg);
        }
        .backlinks-section details summary:hover {
            color: var(--text-main);
        }
        .backlinks-list {
            list-style: none !important;
            padding-left: 0 !important;
            margin-top: 16px;
        }
        .backlinks-list li {
            margin-bottom: 8px !important;
        }
        .backlinks-list li::before {
            content: "↳";
            color: var(--text-muted);
            margin-right: 8px;
        }

        /* Search Results Overlay */
        .search-results {
            display: none;
            position: absolute;
            top: 110px;
            left: 24px;
            right: 24px;
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            max-height: 300px;
            overflow-y: auto;
            z-index: 100;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }

        .search-result-item {
            padding: 12px 16px;
            cursor: pointer;
            font-size: 0.9rem;
            border-bottom: 1px solid var(--glass-bg);
            transition: background var(--transition-speed);
        }

        .search-result-item:hover {
            background-color: var(--glass-bg);
        }

        .search-result-item .path {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 4px;
        }

        /* Top Search Wrapper for Main Content */
        .top-search-wrapper {
            position: relative;
            margin-bottom: 40px;
            width: 100%;
        }
        .top-search-wrapper .search-box {
            margin-top: 0;
        }
        .top-search-wrapper .search-box input {
            padding: 14px 16px 14px 44px;
            font-size: 1.05rem;
            border-radius: 12px;
            background-color: var(--glass-bg);
            border: 1px solid var(--glass-border-faint);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .top-search-wrapper .search-box input:focus {
            background-color: var(--bg-card);
            border-color: var(--accent-purple);
            box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.2);
        }
        .top-search-wrapper .search-box svg {
            width: 20px;
            height: 20px;
            left: 14px;
        }
        .top-search-wrapper .search-results {
            top: 56px;
            left: 0;
            right: 0;
            width: 100%;
            max-height: 50vh;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.4);
            border: 1px solid var(--glass-border);
        }

        /* Welcome Screen Styling */
        .welcome-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
            margin-top: 32px;
        }

        .welcome-card {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            cursor: pointer;
            transition: all var(--transition-speed);
            text-decoration: none;
            color: inherit;
            display: block;
        }

        .welcome-card:hover {
            transform: translateY(-2px);
            border-color: var(--accent-blue);
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.1);
        }

        .welcome-card h3 {
            font-family: 'Outfit', sans-serif;
            margin-bottom: 8px;
            color: var(--text-main);
        }

        .welcome-card p {
            font-size: 0.875rem;
            color: var(--text-muted);
            line-height: 1.5;
        }

        /* Back Button on Mobile */
        .mobile-menu-btn {
            display: none;
            background: none;
            border: none;
            color: var(--text-main);
            cursor: pointer;
            padding: 8px;
        }

        @media (max-width: 768px) {
            body {
                flex-direction: column;
            }
            aside {
                width: 100%;
                height: auto;
                max-height: 100vh;
            }
            .sidebar-content {
                display: none;
            }
            .sidebar-content.active {
                display: flex;
                flex-direction: column;
                height: calc(100vh - 80px);
            }
            .mobile-menu-btn {
                display: block;
            }
            .sidebar-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
        }
    </style>
</head>
<body>
    <div class="ambient-glow"></div>

    <!-- Sidebar -->
    <aside id="sidebar">
        <div class="sidebar-header">
            <a href="#" class="logo" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 8px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1z"/><path d="M22 10v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1z"/><path d="M12 2v20"/><path d="M6 12a6 6 0 0 1 12 0"/></svg>
                Personal Wiki
            </a>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button class="theme-toggle-btn" onclick="toggleTheme()" title="Toggle Light/Dark Mode" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: color var(--transition-speed);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                </button>
                <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            </div>
        </div>

        <nav class="sidebar-content" id="sidebarContent">
            <!-- Dynamic Navigation Will Be Rendered Here -->
        </nav>
        
        <!-- Sidebar Resizer Drag Handle -->
        <div class="sidebar-resizer" id="sidebarResizer"></div>
    </aside>

    <!-- Main Content Panel -->
    <main>
        <div class="content-container">
            <div class="top-search-wrapper">
                <div class="search-box">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input type="text" id="searchInput" placeholder="위키 전체 문서 검색..." oninput="handleSearch(this.value)">
                </div>
                <div class="search-results" id="searchResults"></div>
            </div>

            <article class="wiki-content" id="wikiContent">
                <!-- Welcome/Home Page -->
                <h1>🎧 하이파이 오디오, 프로덕션 & 자작 개인 위키 (HiFi Audio, Production & DIY Personal Wiki)</h1>
                <p>음악 감상, 하이파이 오디오 기기 정보, 다양한 하드웨어 자작(DIY) 및 모딩, 그리고 관련 소프트웨어 및 네트워크 서버 환경을 체계적으로 수집하고 정리한 개인 지식 아카이브입니다.</p>
                
                <hr>
                
                <h2>📂 카테고리 바로가기</h2>
                <div class="welcome-grid">
                    <a href="#1_hifi_audio/INDEX.md" class="welcome-card">
                        <h3>🎧 HiFi 오디오</h3>
                        <p>IEM(이어폰), 헤드폰, 재생 기기, 오디오 기술(드라이버/포맷/프로토콜/스트리밍) 및 음향 물리 이론, 청음 평가 등을 다룹니다.</p>
                    </a>
                    <a href="#2_recording_production/INDEX.md" class="welcome-card">
                        <h3>🎙️ 레코딩 및 프로덕션</h3>
                        <p>레코더, 시퀀서, 샘플러 등 녹음·제작 하드웨어와 DAW, 트래커, 모듈러, 샘플러 소프트웨어 및 가상 EQ 라우팅 설정을 다룹니다.</p>
                    </a>
                    <a href="#3_music_appreciation/INDEX.md" class="welcome-card">
                        <h3>🎵 음악 감상</h3>
                        <p>다양한 음악 장르 분석, IDM 및 앰비언트 가이드, 추천 앨범 리뷰와 아티스트의 음악적 발취를 깊이 있게 탐구합니다.</p>
                    </a>
                    <a href="#4_diy/INDEX.md" class="welcome-card">
                        <h3>🛠️ DIY</h3>
                        <p>아이팟 하드웨어 개조 및 관리법을 포함하여 커스텀 키보드 빌드, MYOG(기어 자작) 등 다양한 자작 프로젝트를 기록합니다.</p>
                    </a>
                </div>
            </article>
        </div>
    </main>

    <script>
        // Injected Static Database
        var wikiTree = /* WIKI_TREE_PLACEHOLDER */;
        var searchIndex = /* WIKI_SEARCH_PLACEHOLDER */;
        var wikiData = /* WIKI_DATA_PLACEHOLDER */;
        var wikiBacklinks = /* WIKI_BACKLINKS_PLACEHOLDER */;
        
        var welcomeHTML = '';

        // Toggle mobile sidebar
        function toggleMobileMenu() {
            document.getElementById('sidebarContent').classList.toggle('active');
        }

        // Initialize App
        window.addEventListener('DOMContentLoaded', function() {
            // Save welcome screen HTML to restore when hash is empty
            welcomeHTML = document.getElementById('wikiContent').innerHTML;

            // Render navigation immediately from local memory
            renderNavigation(wikiTree);
            
            // Route initial URL hash
            routeHash();

            // Event delegation for search result clicks
            var resultsDiv = document.getElementById('searchResults');
            resultsDiv.addEventListener('click', function(e) {
                var item = e.target.closest('.search-result-item');
                if (item) {
                    var pagePath = item.getAttribute('data-path');
                    if (pagePath) {
                        window.location.hash = pagePath;
                        resultsDiv.style.display = 'none';
                        document.getElementById('searchInput').value = '';
                    }
                }
            });

            // Listen to browser Back/Forward navigation
            window.addEventListener('hashchange', routeHash);

            // Sidebar Resizer Interaction
            var sidebar = document.getElementById('sidebar');
            var resizer = document.getElementById('sidebarResizer');
            if (resizer) {
                var isDragging = false;

                // Load saved sidebar width from localStorage
                var savedWidth = localStorage.getItem('sidebar-width');
                if (savedWidth) {
                    document.documentElement.style.setProperty('--sidebar-width', savedWidth);
                }

                resizer.addEventListener('mousedown', function(e) {
                    isDragging = true;
                    resizer.classList.add('dragging');
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none'; // prevent text selection while dragging
                    e.preventDefault();
                });

                document.addEventListener('mousemove', function(e) {
                    if (!isDragging) return;
                    var newWidth = e.clientX;
                    // Min/Max boundaries
                    if (newWidth < 200) newWidth = 200;
                    if (newWidth > 600) newWidth = 600;
                    
                    var widthStr = newWidth + 'px';
                    document.documentElement.style.setProperty('--sidebar-width', widthStr);
                    localStorage.setItem('sidebar-width', widthStr);
                });

                document.addEventListener('mouseup', function() {
                    if (isDragging) {
                        isDragging = false;
                        resizer.classList.remove('dragging');
                        document.body.style.cursor = '';
                        document.body.style.userSelect = '';
                    }
                });
            }
        });

        // Router based on URL Hash
        function routeHash() {
            var hashPath = window.location.hash.substring(1);
            if (hashPath && hashPath !== '/') {
                loadPage(hashPath);
            } else {
                // Restore welcome page
                var contentDiv = document.getElementById('wikiContent');
                contentDiv.style.opacity = 0;
                setTimeout(function() {
                    contentDiv.innerHTML = welcomeHTML;
                    contentDiv.style.opacity = 1;
                    
                    // Deactivate active menu items & folders
                    document.querySelectorAll('.menu-item, .folder-header').forEach(function(item) {
                        item.classList.remove('active');
                        item.classList.remove('parent-active');
                    });
                }, 150);
            }
        }

        var koreanNames = {
            '0_inbox': '📥 임시 보관함 (Inbox)',
            '1_hifi_audio': '🎧 하이파이 오디오 (HiFi Audio)',
            '2_recording_production': '🎙️ 레코딩 및 프로덕션 (Recording & Production)',
            '3_music_appreciation': '🎵 음악 감상 (Music Appreciation)',
            '4_diy': '🛠️ 자작 (DIY)',
            '1_1_iem': '인이어 이어폰 (IEM)',
            '1_2_headphones': '헤드폰 (Headphones)',
            '1_3_source_devices': '재생 기기 (Playback Devices)',
            '1_4_audio_technology': '오디오 기술 (Audio Technology)',
            '1_5_acoustics_evaluation': '음향 이론 및 청음 평가 (Acoustics & Evaluation)',
            '2_1_recorders': '레코더 (Recorders)',
            '2_2_sequencers': '시퀀서 (Sequencers)',
            '2_3_samplers': '샘플러 (Samplers)',
            '2_4_daws': 'DAW (DAWs)',
            '2_5_trackers': '트래커 (Trackers)',
            '2_6_modulars': '모듈러 (Modulars)',
            '2_7_samplers_software': '샘플러 (Samplers)',
            '2_8_system_routing_eq': '시스템 라우팅 및 EQ (System Routing & EQ)',
            '3_1_genres_artists': '장르 및 아티스트 분석 (Genres & Artists)',
            '4_1_hardware_modding': '하드웨어 개조 (Hardware Modding)',
            '4_2_maintenance_accessories': '유지 보수 및 액세서리 (Maintenance & Accessories)',
            '1_3_1_dap': '디지털 오디오 플레이어 (DAP)',
            '1_3_2_dac_chips': 'DAC 칩셋 (DAC Chips)',
            '1_3_3_audio_interfaces': '오디오 인터페이스 (Audio Interfaces)',
            '1_4_1_drivers_materials': '드라이버 기술 및 진동판 소재 (Drivers & Materials)',
            '1_4_2_digital_formats': '디지털 음원 포맷 및 데이터 (Digital Formats)',
            '1_4_3_protocols': '전송 프로토콜 및 규격 (Protocols)',
            '1_4_4_server_streaming': '개인 음악 서버 및 스트리밍 (Server & Streaming)',
            '1_4_5_playback_apps': '재생 소프트웨어 및 플레이어 앱 (Playback Apps)',
            '1_5_1_physics_terms': '음향 물리 현상 용어 (Physics Terms)',
            '1_5_2_test_tracks': '청음 평가용 테스트 트랙 (Test Tracks)',
            '3_1_1_reviews': '음악 리뷰 및 인덱스 (Reviews)',
            '4_1_1_ipod_mods': '아이팟 개조 가이드 (iPod Mods)',
            '4_2_1_gear_care': '장비 관리 및 세척 가이드 (Gear Care)',
            '4_2_2_accessories': '음향 피팅 및 액세서리 (Accessories)'
        };

        // Render Sidebar Menu Nodes
        function renderNavigation(tree, container) {
            if (!container) container = document.getElementById('sidebarContent');
            container.innerHTML = '';
            
            tree.forEach(function(node) {
                if (node.type === 'directory') {
                    var section = document.createElement('div');
                    section.className = 'menu-section';
                    
                    // Folder Header (holds chevron + folder title)
                    var header = document.createElement('div');
                    header.className = 'folder-header';
                    header.dataset.path = node.path + '/INDEX.md'; // Folder index route
                    
                    // Chevron button
                    var chevron = document.createElement('span');
                    chevron.className = 'chevron';
                    chevron.innerHTML = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="transform: rotate(0deg);"><polyline points="9 18 15 12 9 6"></polyline></svg>';
                    
                    // Folder Title
                    var title = document.createElement('span');
                    title.className = 'folder-title';
                    var displayFolderName = koreanNames[node.name] || node.name.replace(/^[0-9]+_/, '').replace(/_/g, ' ');
                    if (!koreanNames[node.name]) {
                        displayFolderName = displayFolderName.charAt(0).toUpperCase() + displayFolderName.slice(1);
                    }
                    title.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> <span>' + displayFolderName + '</span>';
                    
                    header.appendChild(chevron);
                    header.appendChild(title);
                    
                    var content = document.createElement('div');
                    content.className = 'folder-content';
                    content.style.display = 'none'; // Collapse folders by default
                    
                    // Recursive render children
                    renderNavigation(node.children, content);
                    
                    // Separate Chevron Click (Toggle collapse)
                    chevron.addEventListener('click', function(e) {
                        e.stopPropagation(); // Prevent folder navigation
                        var isHidden = content.style.display === 'none';
                        content.style.display = isHidden ? 'block' : 'none';
                        chevron.querySelector('svg').style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
                    });
                    
                    // Folder Title Click (Navigate to Category INDEX.md)
                    title.addEventListener('click', function() {
                        window.location.hash = node.path + '/INDEX.md';
                    });
                    
                    section.appendChild(header);
                    section.appendChild(content);
                    container.appendChild(section);
                } else if (node.type === 'file') {
                    // Skip readme and index in sidebar navigation to prevent clutter
                    if (node.fileName === 'README.md' || node.fileName === 'INDEX.md') return;

                    var item = document.createElement('a');
                    item.className = 'menu-item';
                    item.dataset.path = node.path;
                    item.href = '#' + node.path;
                    item.innerHTML = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg> <span>' + node.name + '</span>';
                    container.appendChild(item);
                }
            });
        }

        // Search Autocomplete Handling
        function handleSearch(query) {
            var resultsDiv = document.getElementById('searchResults');
            if (!query.trim()) {
                resultsDiv.style.display = 'none';
                return;
            }

            var term = query.toLowerCase();
            var matches = searchIndex.filter(function(item) {
                var nameMatch = item.name.toLowerCase().indexOf(term) !== -1;
                var pathMatch = item.path.toLowerCase().indexOf(term) !== -1;
                var tagMatch = item.tags && item.tags.some(function(t) { return t.toLowerCase().indexOf(term) !== -1; });
                return nameMatch || pathMatch || tagMatch;
            });

            if (matches.length > 0) {
                resultsDiv.innerHTML = matches.map(function(match) {
                    var cleanPath = match.path.split('/')[0].replace(/^[0-9]+_/, '').replace(/_/g, ' ');
                    
                    var tagsHTML = '';
                    if (match.tags && match.tags.length > 0) {
                        tagsHTML = '<div style="margin-top: 4px;">' + match.tags.map(function(t) {
                            var isMatch = t.toLowerCase().indexOf(term) !== -1;
                            var color = isMatch ? '#60a5fa' : 'var(--text-muted)';
                            var bg = isMatch ? 'rgba(59, 130, 246, 0.15)' : 'var(--glass-bg-hover)';
                            return '<span style="display:inline-block; font-size:0.7rem; padding:2px 6px; border-radius:8px; background:'+bg+'; color:'+color+'; margin-right:4px;">#' + t + '</span>';
                        }).join('') + '</div>';
                    }

                    return '<div class="search-result-item" data-path="' + match.path + '">' +
                        '<div style="font-weight: 500; color: var(--text-main);">' + match.name + '</div>' +
                        '<div class="path">' + cleanPath + '</div>' +
                        tagsHTML +
                    '</div>';
                }).join('');
                resultsDiv.style.display = 'block';
            } else {
                resultsDiv.innerHTML = '<div class="search-result-item" style="color: var(--text-muted);">검색 결과가 없습니다.</div>';
                resultsDiv.style.display = 'block';
            }
        }

        // Update Sidebar highlighting & expand states based on active page
        function updateSidebarState(pagePath) {
            // 1. Reset all active & parent-active states
            document.querySelectorAll('.menu-item').forEach(function(item) {
                item.classList.remove('active');
            });
            document.querySelectorAll('.folder-header').forEach(function(folder) {
                folder.classList.remove('active');
                folder.classList.remove('parent-active');
            });

            // 2. Set current active item
            var activeElement = null;
            document.querySelectorAll('.menu-item').forEach(function(item) {
                if (item.dataset.path === pagePath) {
                    item.classList.add('active');
                    activeElement = item;
                }
            });
            document.querySelectorAll('.folder-header').forEach(function(folder) {
                if (folder.dataset.path === pagePath) {
                    folder.classList.add('active');
                    activeElement = folder;
                }
            });

            // 3. Auto-expand parent folders and mark parent-active
            if (activeElement) {
                var parent = activeElement.parentElement;
                while (parent && parent.id !== 'sidebarContent') {
                    if (parent.classList.contains('folder-content')) {
                        parent.style.display = 'block';
                        
                        // Handle folder header sibling
                        var headerSibling = parent.previousElementSibling;
                        if (headerSibling && headerSibling.classList.contains('folder-header')) {
                            headerSibling.classList.add('parent-active');
                            var chev = headerSibling.querySelector('.chevron svg');
                            if (chev) {
                                chev.style.transform = 'rotate(90deg)';
                            }
                        }
                    }
                    parent = parent.parentElement;
                }

                // 4. Smooth scroll active item into view
                setTimeout(function() {
                    activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
            }
        }

        // Generate Breadcrumbs & Parent Link
        function generateBreadcrumbs(pagePath) {
            var parts = pagePath.split('/');
            if (parts.length <= 1 && (parts[0] === 'README.md' || parts[0] === '')) {
                return null; // No breadcrumbs for home
            }
            
            var container = document.createElement('div');
            container.className = 'breadcrumbs-container';
            
            var breadcrumbs = [];
            // Add Home link
            breadcrumbs.push('<a href="#">홈</a>');
            
            var currentAccPath = '';
            for (var i = 0; i < parts.length - 1; i++) {
                var part = parts[i];
                currentAccPath += (currentAccPath ? '/' : '') + part;
                
                // Folder display name resolution
                var displayName = koreanNames[part] || part.replace(/^[0-9]+_/, '').replace(/_/g, ' ');
                if (!koreanNames[part]) {
                    displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
                }
                
                var folderIndexPath = currentAccPath + '/INDEX.md';
                breadcrumbs.push('<a href="#' + folderIndexPath + '">' + displayName + '</a>');
            }
            
            // Add current page (non-clickable)
            var lastPart = parts[parts.length - 1];
            if (lastPart !== 'INDEX.md' && lastPart !== 'README.md') {
                var pageNode = searchIndex.find(function(item) { return item.path === pagePath; });
                var currentPageName = pageNode ? pageNode.name : lastPart.replace('.md', '').replace(/_/g, ' ');
                breadcrumbs.push('<span class="current-crumb">' + currentPageName + '</span>');
            }
            container.innerHTML = '<div class="breadcrumbs-path">' + breadcrumbs.join(' <span class="separator">/</span> ') + '</div>';
            return container;
        }

        // Render Markdown Page Content
        function loadPage(pagePath) {
            pagePath = decodeURIComponent(pagePath);
            
            // Update sidebar state immediately
            updateSidebarState(pagePath);

            // Close mobile menu if open
            document.getElementById('sidebarContent').classList.remove('active');

            var contentDiv = document.getElementById('wikiContent');
            contentDiv.style.opacity = 0; // Fade out

            function displayMarkdown(markdown) {
                // Parse YAML frontmatter
                var yamlRegex = /^---\\r?\\n([\\s\\S]+?)\\r?\\n---/;
                var match = markdown.match(yamlRegex);
                var metadataHTML = '';
                var cleanMarkdown = markdown;
                
                if (match) {
                    cleanMarkdown = markdown.replace(yamlRegex, '');
                    var yamlText = match[1];
                    
                    var statusMatch = yamlText.match(/status:\\s*['"]?([^'"\\r\\n]+)['"]?/);
                    var tagsMatch = yamlText.match(/tags:\\s*\\[(.*?)\\]/);
                    
                    if (statusMatch || tagsMatch) {
                        metadataHTML += '<div class="metadata-badges">';
                        if (statusMatch) {
                            var status = statusMatch[1].trim();
                            var statusClass = 'badge-status-default';
                            if (status === 'draft') statusClass = 'badge-status-draft';
                            if (status === 'needs_review') statusClass = 'badge-status-review';
                            if (status === 'completed') statusClass = 'badge-status-completed';
                            
                            var displayStatus = status.toUpperCase().replace('_', ' ');
                            metadataHTML += '<span class="badge ' + statusClass + '">' + displayStatus + '</span>';
                        }
                        if (tagsMatch && tagsMatch[1].trim() !== '') {
                            var tags = tagsMatch[1].split(',').map(function(t) { return t.trim().replace(/^['"]|['"]$/g, ''); });
                            tags.forEach(function(tag) {
                                if(tag) metadataHTML += '<span class="badge badge-tag">#' + tag + '</span>';
                            });
                        }
                        metadataHTML += '</div>';
                    }
                }

                setTimeout(function() {
                    // Render Markdown via marked
                    var renderedHTML = marked.parse(cleanMarkdown);
                    
                    // Inject metadata badges right after the first H1
                    if (metadataHTML) {
                        var h1Index = renderedHTML.indexOf('</h1>');
                        if (h1Index !== -1) {
                            renderedHTML = renderedHTML.substring(0, h1Index + 5) + metadataHTML + renderedHTML.substring(h1Index + 5);
                        } else {
                            renderedHTML = metadataHTML + renderedHTML;
                        }
                    }

                    contentDiv.innerHTML = '';

                    // Generate and prepend breadcrumbs
                    var crumbs = generateBreadcrumbs(pagePath);
                    if (crumbs) {
                        contentDiv.appendChild(crumbs);
                    }

                    var bodyWrapper = document.createElement('div');
                    bodyWrapper.innerHTML = renderedHTML;
                    contentDiv.appendChild(bodyWrapper);

                    // Add Backlinks Section
                    if (typeof wikiBacklinks !== 'undefined' && wikiBacklinks[pagePath] && wikiBacklinks[pagePath].length > 0) {
                        var blSection = document.createElement('div');
                        blSection.className = 'backlinks-section';
                        blSection.innerHTML = '<details><summary>🔗 Backlinks <span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">(' + wikiBacklinks[pagePath].length + ')</span></summary><ul class="backlinks-list"></ul></details>';
                        var ul = blSection.querySelector('ul');
                        wikiBacklinks[pagePath].forEach(function(srcPath) {
                            var node = searchIndex.find(function(i) { return i.path === srcPath; });
                            var name = node ? node.name : srcPath.split('/').pop().replace('.md', '');
                            var li = document.createElement('li');
                            li.innerHTML = '<a href="#' + srcPath + '">' + name + '</a>';
                            
                            // Attach click event for internal routing
                            var a = li.querySelector('a');
                            a.addEventListener('click', function(e) {
                                e.preventDefault();
                                window.location.hash = srcPath;
                            });
                            
                            ul.appendChild(li);
                        });
                        contentDiv.appendChild(blSection);
                    }

                    contentDiv.style.opacity = 1; // Fade in
                    
                    // Scroll to top
                    document.querySelector('main').scrollTop = 0;

                    // Resolve relative/absolute image paths for online/offline compatibility
                    contentDiv.querySelectorAll('img').forEach(function(img) {
                        var src = img.getAttribute('src');
                        if (!src) return;

                        var isOffline = window.location.protocol.indexOf('http') === -1;

                        // 1. If it's a fixed path /wiki/assets/... in offline mode, rewrite to relative wiki/assets/...
                        if (isOffline && src.indexOf('/wiki/assets/') === 0) {
                            img.src = src.substring(1); // remove leading '/' -> 'wiki/assets/...'
                        }
                        // 2. If it's a local relative image, resolve relative path according to the current markdown file location
                        else if (src.indexOf('http') === -1 && src.indexOf('://') === -1 && src.indexOf('/') !== 0 && src.indexOf('data:') !== 0) {
                            var currentFolder = pagePath.substring(0, pagePath.lastIndexOf('/'));
                            var targetPath = '';
                            if (src.indexOf('./') === 0) {
                                src = src.substring(2);
                            }
                            
                            if (src.indexOf('../') === 0) {
                                var steps = src.split('/');
                                var folderParts = currentFolder.split('/');
                                steps.forEach(function(step) {
                                    if (step === '..') {
                                        folderParts.pop();
                                    } else {
                                        folderParts.push(step);
                                    }
                                });
                                targetPath = folderParts.join('/');
                            } else {
                                targetPath = currentFolder ? currentFolder + '/' + src : src;
                            }
                            
                            // Prefix with "wiki/" because the assets live inside the wiki/ directory
                            img.src = 'wiki/' + targetPath;
                        }

                        // 3. Add visual caption from Alt attribute if it exists and is not empty
                        var altText = img.getAttribute('alt');
                        if (altText && altText.trim() !== '') {
                            var nextNode = img.nextSibling;
                            if (!nextNode || !nextNode.classList || !nextNode.classList.contains('image-caption')) {
                                var caption = document.createElement('span');
                                caption.className = 'image-caption';
                                caption.innerText = altText;
                                img.parentNode.insertBefore(caption, img.nextSibling);
                            }
                        }
                    });

                    // Intercept links within the rendered markdown to navigate internally
                    contentDiv.querySelectorAll('a').forEach(function(link) {
                        var href = link.getAttribute('href');
                        // Check if link points to another local wiki md file
                        if (href && href.indexOf('http') === -1 && href.indexOf('#') === -1 && href.endsWith('.md')) {
                            link.addEventListener('click', function(e) {
                                e.preventDefault();
                                
                                // Resolve relative path to current page folder
                                var currentFolder = pagePath.substring(0, pagePath.lastIndexOf('/'));
                                var targetPath = '';
                                if (href.indexOf('../') === 0) {
                                    // Handle relative parent step: e.g. ../another_folder/file.md
                                    var steps = href.split('/');
                                    var folderParts = currentFolder.split('/');
                                    steps.forEach(function(step) {
                                        if (step === '..') {
                                            folderParts.pop();
                                        } else {
                                            folderParts.push(step);
                                        }
                                    });
                                    targetPath = folderParts.join('/');
                                } else {
                                    targetPath = currentFolder ? currentFolder + '/' + href : href;
                                }
                                
                                window.location.hash = targetPath;
                            });
                        }
                    });
                }, 150);
            }

            function showError() {
                setTimeout(function() {
                    contentDiv.innerHTML = '<h1>⚠️ 페이지를 찾을 수 없습니다</h1><p>마크다운 데이터를 읽을 수 없습니다.</p>';
                    contentDiv.style.opacity = 1;
                }, 150);
            }

            // Determine loading strategy: Try live fetch if running on http/https
            if (window.location.protocol.indexOf('http') === 0) {
                fetch('wiki/' + pagePath + '?t=' + new Date().getTime(), { cache: 'no-store' })
                    .then(function(response) {
                        if (!response.ok) throw new Error('Fetch failed');
                        return response.text();
                    })
                    .then(function(markdown) {
                        displayMarkdown(markdown);
                    })
                    .catch(function(err) {
                        // Fallback to static injected database
                        var markdown = wikiData[pagePath];
                        if (markdown) {
                            displayMarkdown(markdown);
                        } else {
                            showError();
                        }
                    });
            } else {
                // file:// protocol or other offline mode: use pre-injected database
                var markdown = wikiData[pagePath];
                if (markdown) {
                    displayMarkdown(markdown);
                } else {
                    showError();
                }
            }
        }
    </script>
</body>
</html>`;
}

// Automatically trigger build when script runs
buildStaticWiki();
