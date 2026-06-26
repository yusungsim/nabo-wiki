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
            tree.push({
                name: cleanName,
                fileName: item,
                type: 'file',
                path: relPath
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
                path: item.path
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

function buildStaticWiki() {
    console.log("Starting static wiki compilation...");

    if (!fs.existsSync(WIKI_DIR)) {
        console.error(`Error: wiki folder not found at ${WIKI_DIR}`);
        return;
    }

    const tree = getWikiTree(WIKI_DIR);
    const searchIndex = getFlatPageList(tree);
    const pageContents = collectPageContents(WIKI_DIR);

    const htmlContent = getTemplateHTML(tree, searchIndex, pageContents);

    fs.writeFileSync(OUTPUT_FILE, htmlContent, 'utf8');
    console.log(`==================================================`);
    console.log(`🎉 Static Wiki Build Complete!`);
    console.log(`📄 Saved to: ${OUTPUT_FILE}`);
    console.log(`💡 Double-click index.html to view directly in your browser without any server!`);
    console.log(`==================================================`);
}

function getTemplateHTML(tree, searchIndex, pageContents) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>개인 지식 아카이브 (Personal Wiki: Music, HiFi & DIY)</title>
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <!-- Marked Markdown Parser -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
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

        .sidebar-header {
            padding: 24px;
            border-bottom: 1px solid var(--border);
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
            background-color: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }

        nav::-webkit-scrollbar-thumb:hover {
            background-color: rgba(255, 255, 255, 0.15);
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
            background-color: rgba(255, 255, 255, 0.03);
        }

        .folder-header.active {
            background-color: rgba(168, 85, 247, 0.1);
            border-left: 2px solid var(--accent-purple);
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
            background-color: rgba(255, 255, 255, 0.05);
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
            background-color: rgba(255, 255, 255, 0.03);
        }

        .menu-item.active {
            color: #fff;
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
            max-width: 840px;
            width: 100%;
            margin: 0 auto;
            padding: 64px 32px;
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
            color: #fff;
        }

        .wiki-content h3 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.15rem;
            font-weight: 600;
            margin-top: 24px;
            margin-bottom: 12px;
            color: #fff;
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
            color: #fff;
        }

        .wiki-content code {
            font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
            background-color: rgba(255, 255, 255, 0.05);
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
            border-bottom: 1px solid rgba(255, 255, 255, 0.02);
            transition: background var(--transition-speed);
        }

        .search-result-item:hover {
            background-color: rgba(255, 255, 255, 0.03);
        }

        .search-result-item .path {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 4px;
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
            color: #fff;
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
    <aside>
        <div class="sidebar-header">
            <a href="#" class="logo" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 8px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1z"/><path d="M22 10v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1z"/><path d="M12 2v20"/><path d="M6 12a6 6 0 0 1 12 0"/></svg>
                Personal Wiki
            </a>
            <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div class="search-box">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <input type="text" id="searchInput" placeholder="개념 검색..." oninput="handleSearch(this.value)">
            </div>
            <div class="search-results" id="searchResults"></div>
        </div>

        <nav class="sidebar-content" id="sidebarContent">
            <!-- Dynamic Navigation Will Be Rendered Here -->
        </nav>
    </aside>

    <!-- Main Content Panel -->
    <main>
        <div class="content-container">
            <article class="wiki-content" id="wikiContent">
                <!-- Welcome/Home Page -->
                <h1>📓 개인 지식 위키 (Personal Wiki)</h1>
                <p>음악 감상, 하이파이 오디오 기기 정보, 다양한 하드웨어 자작(DIY) 및 모딩, 그리고 관련 소프트웨어 및 네트워크 서버 환경을 체계적으로 수집하고 정리한 개인 지식 아카이브입니다.</p>
                
                <hr>
                
                <h2>📂 카테고리 바로가기</h2>
                <div class="welcome-grid">
                    <a href="#1_drivers_technology/INDEX.md" class="welcome-card">
                        <h3>🧬 오디오 기술 & 드라이버</h3>
                        <p>DD, BA, 평판형, 정전형, MEMS 등 하드웨어 드라이버 구조와 핵심 부품 신소재 정보.</p>
                    </a>
                    <a href="#2_earphones_headphones/INDEX.md" class="welcome-card">
                        <h3>🎧 이어폰 & 헤드폰</h3>
                        <p>수월우, 탕주, 심고트 등 단일 드라이버 IEM부터 슈어 KSE1500 정전형 시스템 비교 분석.</p>
                    </a>
                    <a href="#3_dap_dac_interfaces/INDEX.md" class="welcome-card">
                        <h3>🎛️ DAP & DAC / 인터페이스</h3>
                        <p>FiiO M21, iPod 세대별 특징 및 MOTU M2 등 고밀도 DAC 칩셋의 음질 시그니처.</p>
                    </a>
                    <a href="#4_recording_sampling/INDEX.md" class="welcome-card">
                        <h3>🎙️ 레코딩 & 샘플러</h3>
                        <p>Tascam, Zoom 등의 32-bit Float 필드 레코더 및 SP-404, Digitakt II 등 포터블 작곡 머신.</p>
                    </a>
                    <a href="#5_software_apps/INDEX.md" class="welcome-card">
                        <h3>💻 소프트웨어 & 네트워크</h3>
                        <p>UAPP, 뉴트론 등 오디오 플레이어 설정 및 Navidrome + Tailscale 맥북 홈서버 스트리밍 구축법.</p>
                    </a>
                    <a href="#6_formats_protocols/INDEX.md" class="welcome-card">
                        <h3>📡 음원 포맷 & 통신 규격</h3>
                        <p>32-bit Float, DSD 포맷 설명, 비트 퍼펙트 출력 달성법 및 원격 스트리밍 규격 가이드.</p>
                    </a>
                    <a href="#7_accessories_terms/INDEX.md" class="welcome-card">
                        <h3>🏷️ 액세서리 & 음향 용어</h3>
                        <p>이어팁 가이드(디비누스 벨벳 팁 등) 및 지터, 마스킹, 치찰음 등 음향 물리 용어 사전.</p>
                    </a>
                    <a href="#8_music_genres_artists/INDEX.md" class="welcome-card">
                        <h3>🎵 음악 장르 & 아티스트</h3>
                        <p>장르별 음악 분석(IDM, Ambient 등), 앨범 감상평 및 개인 소장 추천 아티스트 정보.</p>
                    </a>
                    <a href="#9_diy_hardware_modding/INDEX.md" class="welcome-card">
                        <h3>🛠️ DIY & 하드웨어 개조</h3>
                        <p>아이팟 SSD 모딩, iMod 납땜 개조, 황동 동록 제거 및 장비 자작 프로젝트 기록.</p>
                    </a>
                </div>
            </article>
        </div>
    </main>

    <script>
        // Injected Static Database
        var wikiTree = ${JSON.stringify(tree)};
        var searchIndex = ${JSON.stringify(searchIndex)};
        var wikiData = ${JSON.stringify(pageContents)};
        
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
                    });
                }, 150);
            }
        }

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
                    var displayFolderName = node.name.replace(/^[0-9]+_/, '').replace(/_/g, ' ');
                    displayFolderName = displayFolderName.charAt(0).toUpperCase() + displayFolderName.slice(1);
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
                return item.name.toLowerCase().indexOf(term) !== -1 || 
                       item.path.toLowerCase().indexOf(term) !== -1;
            });

            if (matches.length > 0) {
                resultsDiv.innerHTML = matches.map(function(match) {
                    var cleanPath = match.path.split('/')[0].replace(/^[0-9]+_/, '').replace(/_/g, ' ');
                    return '<div class="search-result-item" data-path="' + match.path + '">' +
                        '<div style="font-weight: 500; color: #fff;">' + match.name + '</div>' +
                        '<div class="path">' + cleanPath + '</div>' +
                    '</div>';
                }).join('');
                resultsDiv.style.display = 'block';
            } else {
                resultsDiv.innerHTML = '<div class="search-result-item" style="color: var(--text-muted);">검색 결과가 없습니다.</div>';
                resultsDiv.style.display = 'block';
            }
        }

        // Render Markdown Page Content
        function loadPage(pagePath) {
            // Update active menu state (files)
            document.querySelectorAll('.menu-item').forEach(function(item) {
                if (item.dataset.path === pagePath) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });

            // Update active folder state
            document.querySelectorAll('.folder-header').forEach(function(folder) {
                if (folder.dataset.path === pagePath) {
                    folder.classList.add('active');
                } else {
                    folder.classList.remove('active');
                }
            });

            // Close mobile menu if open
            document.getElementById('sidebarContent').classList.remove('active');

            var contentDiv = document.getElementById('wikiContent');
            contentDiv.style.opacity = 0; // Fade out

            function displayMarkdown(markdown) {
                setTimeout(function() {
                    // Render Markdown via marked
                    contentDiv.innerHTML = marked.parse(markdown);
                    contentDiv.style.opacity = 1; // Fade in
                    
                    // Scroll to top
                    document.querySelector('main').scrollTop = 0;

                    // Auto-expand parent folders of active item
                    var activeElement = document.querySelector('.menu-item.active') || document.querySelector('.folder-header.active');
                    if (activeElement) {
                        var parent = activeElement.parentElement;
                        while (parent && parent.id !== 'sidebarContent') {
                            if (parent.classList.contains('folder-content')) {
                                parent.style.display = 'block';
                                // Also rotate the corresponding chevron
                                var headerSibling = parent.previousElementSibling;
                                if (headerSibling && headerSibling.classList.contains('folder-header')) {
                                    var chev = headerSibling.querySelector('.chevron svg');
                                    if (chev) {
                                        chev.style.transform = 'rotate(90deg)';
                                    }
                                }
                            }
                            parent = parent.parentElement;
                        }
                    }

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
                fetch('wiki/' + pagePath)
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
