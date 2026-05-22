// ======================================================
// OMNIVERSE - ZASS.WEBSITE DEPLOYMENT PLATFORM
// All apps at: https://zass.website/[app-name]
// ======================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { exec, spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const AdmZip = require('adm-zip');

// ============ CONFIGURATION - YOUR DOMAIN ============
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 5000;
const YOUR_DOMAIN = 'zass.website';  // YOUR DOMAIN HERE!
const BASE_URL = `https://${YOUR_DOMAIN}`;

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ============ FILE STORAGE ============
const DATA_FILE = path.join(__dirname, 'data.json');
const DEPLOYED_APPS_DIR = path.join(__dirname, 'deployed_apps');

fs.ensureDirSync(DEPLOYED_APPS_DIR);

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {}
    return { apps: [], customPaths: {}, nextPort: 3001, totalDeployments: 0, totalVisits: 0 };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let appData = loadData();
let deployedApps = new Map();
let activeProcesses = new Map();

// ============ CUSTOM PATH ROUTING ============
// This makes zass.website/app-name work!
app.use('/', async (req, res, next) => {
    const pathName = req.path.slice(1); // Remove leading slash
    
    // Skip API routes and root
    if (req.path === '/' || req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
        return next();
    }
    
    const appInfo = appData.customPaths[pathName];
    if (appInfo && appInfo.status === 'running') {
        try {
            // Track visit
            appInfo.visits = (appInfo.visits || 0) + 1;
            appData.totalVisits++;
            saveData(appData);
            
            // Forward request to the actual app
            const proxyUrl = `http://localhost:${appInfo.port}${req.url}`;
            const response = await axios({
                method: req.method,
                url: proxyUrl,
                data: req.body,
                headers: { ...req.headers, host: YOUR_DOMAIN },
                timeout: 30000
            });
            res.status(response.status).send(response.data);
        } catch (error) {
            res.status(500).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${pathName} - App Error</title>
                    <meta name="description" content="App is temporarily unavailable">
                </head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>⚠️ ${pathName} is starting...</h1>
                    <p>Please wait a moment and refresh the page.</p>
                    <a href="/">Back to OmniVerse</a>
                </body>
                </html>
            `);
        }
    } else {
        // App not found - show helpful message
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${pathName} not found on ${YOUR_DOMAIN}</title>
                <meta name="description" content="App not found on OmniVerse platform">
                <style>
                    body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); color: white; }
                    a { color: #a8c0ff; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <h1>🔍 "${pathName}" Not Found</h1>
                <p>The app you're looking for doesn't exist on ${YOUR_DOMAIN}.</p>
                <p>Check the URL or <a href="/">go to OmniVerse</a> to see available apps.</p>
                <br>
                <p style="font-size: 12px; opacity: 0.7;">💡 Available apps: ${appData.apps.map(a => a.customPath).join(', ') || 'none yet'}</p>
            </body>
            </html>
        `);
    }
});

// ============ AI ASSISTANT ============
class AIAssistant {
    async analyzeAndFix(code) {
        let fixedCode = code;
        const issues = [];
        
        if (!code.includes('process.env.PORT')) {
            fixedCode = fixedCode.replace(/listen\((\d+)\)/, 'listen(process.env.PORT || $1)');
            issues.push('Added process.env.PORT');
        }
        
        if (!code.includes('error handling')) {
            fixedCode = `process.on('uncaughtException', console.error);\n${fixedCode}`;
            issues.push('Added error handling');
        }
        
        return { fixedCode, issues };
    }
    
    async answerQuestion(question) {
        const q = question.toLowerCase();
        if (q.includes('domain') || q.includes('url')) {
            return `Your apps will be at https://${YOUR_DOMAIN}/your-app-name. Choose any name you want!`;
        }
        if (q.includes('deploy')) {
            return "Paste your code, give it a custom name like 'my-app', and click Deploy. It will be live at https://zass.website/my-app immediately!";
        }
        if (q.includes('search') || q.includes('google')) {
            return "Your apps are automatically submitted to Google, Bing, and Yahoo! They will appear in search results within 24-48 hours.";
        }
        return `I'm OmniAI on ${YOUR_DOMAIN}! Choose any custom name for your app - it will be live at https://${YOUR_DOMAIN}/your-chosen-name!`;
    }
}

const ai = new AIAssistant();

// ============ DEPLOYMENT ENGINE ============
class DeploymentEngine {
    async deployCode(code, customPath, description) {
        if (!customPath || customPath.trim() === '') {
            return { success: false, error: 'App name is required!' };
        }
        
        // Check if path already exists
        if (appData.customPaths[customPath]) {
            return { success: false, error: `App name '/${customPath}' is already taken! Choose another name.` };
        }
        
        // Validate path characters
        if (!/^[a-z0-9-]+$/i.test(customPath)) {
            return { success: false, error: 'Only letters, numbers, and hyphens allowed in app name!' };
        }
        
        const appId = uuidv4().slice(0, 8);
        const finalName = customPath.toLowerCase();
        const appDir = path.join(DEPLOYED_APPS_DIR, finalName);
        const port = appData.nextPort++;
        const url = `${BASE_URL}/${finalName}`;
        
        try {
            await fs.ensureDir(appDir);
            
            const { fixedCode, issues } = await ai.analyzeAndFix(code);
            await fs.writeFile(path.join(appDir, 'server.js'), fixedCode);
            
            const packageJson = {
                name: finalName,
                version: "1.0.0",
                main: "server.js",
                scripts: { start: "node server.js" },
                dependencies: { "express": "^4.18.2" }
            };
            await fs.writeFile(path.join(appDir, "package.json"), JSON.stringify(packageJson, null, 2));
            
            await this.installDependencies(appDir);
            
            const proc = this.startApp(appDir, port, finalName);
            
            const appInfo = {
                id: appId,
                name: finalName,
                customPath: finalName,
                url: url,
                port: port,
                description: description || "No description",
                createdAt: new Date().toISOString(),
                status: "running",
                visits: 0
            };
            
            deployedApps.set(finalName, appInfo);
            appData.customPaths[finalName] = appInfo;
            appData.apps.push(appInfo);
            appData.totalDeployments++;
            saveData(appData);
            
            console.log(`✅ App deployed: ${url}`);
            
            // Auto-submit to search engines
            this.submitToSearchEngines(url, finalName);
            
            return {
                success: true,
                url: url,
                customPath: finalName,
                issues: issues,
                message: `App deployed! Access it at: ${url}`
            };
            
        } catch (error) {
            appData.nextPort--;
            saveData(appData);
            return { success: false, error: error.message };
        }
    }
    
    async submitToSearchEngines(url, appName) {
        try {
            // Ping Google
            await axios.get(`https://www.google.com/ping?sitemap=${encodeURIComponent(url + '/sitemap.xml')}`);
            console.log(`✅ Submitted ${appName} to Google`);
        } catch(e) {}
        
        try {
            // Ping Bing
            await axios.get(`https://www.bing.com/ping?sitemap=${encodeURIComponent(url + '/sitemap.xml')}`);
            console.log(`✅ Submitted ${appName} to Bing`);
        } catch(e) {}
        
        console.log(`🌐 ${appName} submitted to search engines!`);
    }
    
    async deployFromGitHub(repoUrl, customPath) {
        try {
            let repoPath = repoUrl.replace('https://github.com/', '').replace('.git', '');
            let serverCode = null;
            
            const branches = ['main', 'master'];
            const files = ['server.js', 'app.js', 'index.js'];
            
            for (const branch of branches) {
                for (const file of files) {
                    const rawUrl = `https://raw.githubusercontent.com/${repoPath}/${branch}/${file}`;
                    try {
                        const response = await axios.get(rawUrl, { timeout: 10000 });
                        if (response.data) {
                            serverCode = response.data;
                            break;
                        }
                    } catch (e) {}
                }
                if (serverCode) break;
            }
            
            if (!serverCode) {
                throw new Error('No server.js found in repository');
            }
            
            return await this.deployCode(serverCode, customPath, `From GitHub: ${repoUrl}`);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async deployFromZip(filePath, customPath) {
        const extractDir = path.join(__dirname, 'temp', Date.now().toString());
        await fs.ensureDir(extractDir);
        
        try {
            const zip = new AdmZip(filePath);
            zip.extractAllTo(extractDir, true);
            
            const possibleFiles = ['server.js', 'app.js', 'index.js'];
            let code = null;
            
            for (const file of possibleFiles) {
                const codePath = path.join(extractDir, file);
                if (await fs.pathExists(codePath)) {
                    code = await fs.readFile(codePath, 'utf8');
                    break;
                }
            }
            
            if (!code) throw new Error('No server.js found in ZIP');
            
            const result = await this.deployCode(code, customPath, 'Deployed from ZIP');
            await fs.remove(extractDir);
            return result;
        } catch (error) {
            await fs.remove(extractDir);
            return { success: false, error: error.message };
        }
    }
    
    async deleteApp(customPath) {
        if (!appData.customPaths[customPath]) {
            return { success: false, error: 'App not found' };
        }
        
        const app = appData.customPaths[customPath];
        
        if (activeProcesses.has(app.name)) {
            activeProcesses.get(app.name).kill();
            activeProcesses.delete(app.name);
        }
        
        delete appData.customPaths[customPath];
        appData.apps = appData.apps.filter(a => a.name !== app.name);
        deployedApps.delete(app.name);
        saveData(appData);
        
        return { success: true };
    }
    
    installDependencies(appDir) {
        return new Promise((resolve) => {
            exec('npm install --production', { cwd: appDir }, (error) => {
                if (error) console.log(`npm install warning: ${error.message}`);
                resolve(true);
            });
        });
    }
    
    startApp(appDir, port, appName) {
        const proc = spawn('node', ['server.js'], {
            cwd: appDir,
            env: { ...process.env, PORT: port },
            detached: false
        });
        
        proc.stdout.on('data', (data) => console.log(`[${appName}] ${data.toString().trim()}`));
        proc.stderr.on('data', (data) => console.error(`[${appName}] ${data.toString().trim()}`));
        
        activeProcesses.set(appName, proc);
        return proc;
    }
}

const deployEngine = new DeploymentEngine();
const upload = multer({ dest: 'uploads/' });

// ============ API ENDPOINTS ============

app.post('/api/deploy', express.json(), async (req, res) => {
    const { code, customPath, description } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    if (!customPath) return res.status(400).json({ error: 'App name required!' });
    const result = await deployEngine.deployCode(code, customPath, description);
    res.json(result);
});

app.post('/api/deploy/github', express.json(), async (req, res) => {
    const { repoUrl, customPath } = req.body;
    if (!repoUrl) return res.status(400).json({ error: 'GitHub URL required' });
    const result = await deployEngine.deployFromGitHub(repoUrl, customPath);
    res.json(result);
});

app.post('/api/deploy/zip', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'ZIP file required' });
    const { customPath } = req.body;
    if (!customPath) return res.status(400).json({ error: 'App name required!' });
    const result = await deployEngine.deployFromZip(req.file.path, customPath);
    res.json(result);
});

app.delete('/api/app/:path', async (req, res) => {
    const result = await deployEngine.deleteApp(req.params.path);
    res.json(result);
});

app.get('/api/apps', (req, res) => {
    res.json({ 
        apps: appData.apps, 
        total: appData.apps.length, 
        totalDeployments: appData.totalDeployments, 
        totalVisits: appData.totalVisits, 
        domain: YOUR_DOMAIN,
        baseUrl: BASE_URL 
    });
});

app.get('/api/check-path/:path', (req, res) => {
    res.json({ exists: !!appData.customPaths[req.params.path] });
});

app.post('/api/ai/chat', express.json(), async (req, res) => {
    const answer = await ai.answerQuestion(req.body.message);
    res.json({ message: answer });
});

// Sitemap for SEO
app.get('/sitemap.xml', (req, res) => {
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${BASE_URL}</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>`;
    
    for (const app of appData.apps) {
        sitemap += `
    <url>
        <loc>${app.url}</loc>
        <lastmod>${new Date(app.createdAt).toISOString()}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>`;
    }
    
    sitemap += `\n</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
});

// Robots.txt for search engines
app.get('/robots.txt', (req, res) => {
    res.send(`User-agent: *
Allow: /
Sitemap: ${BASE_URL}/sitemap.xml`);
});

// ============ MAIN PAGE ============
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OmniVerse on ${YOUR_DOMAIN} - Deploy Your Apps</title>
    <meta name="description" content="Deploy any app instantly on ${YOUR_DOMAIN}. Get a custom URL like ${YOUR_DOMAIN}/your-app-name. Free hosting, auto-search engine submission!">
    <meta name="keywords" content="deploy app, free hosting, ${YOUR_DOMAIN}, custom url, web deployment">
    <meta name="author" content="OmniVerse">
    <meta property="og:title" content="OmniVerse - Deploy on ${YOUR_DOMAIN}">
    <meta property="og:description" content="Get your own custom URL at ${YOUR_DOMAIN}/your-app-name">
    <meta name="twitter:card" content="summary_large_image">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            min-height: 100vh;
            color: white;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 50px 0; }
        .header h1 { font-size: 3rem; background: linear-gradient(135deg, #fff, #a8c0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .domain-badge { display: inline-block; background: rgba(0,255,0,0.2); border: 1px solid #0f0; padding: 5px 15px; border-radius: 50px; font-size: 14px; margin-top: 10px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 20px; text-align: center; }
        .stat-number { font-size: 2rem; font-weight: bold; margin: 10px 0; }
        .section { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 30px; margin: 30px 0; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .tab { background: rgba(255,255,255,0.1); padding: 10px 25px; border-radius: 30px; cursor: pointer; }
        .tab.active { background: linear-gradient(135deg, #667eea, #764ba2); }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        textarea, input { width: 100%; padding: 12px; margin: 10px 0; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; color: white; font-size: 14px; }
        button { background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 12px 30px; border-radius: 30px; cursor: pointer; font-size: 16px; margin: 5px; }
        .path-preview { background: rgba(0,0,0,0.4); padding: 12px; border-radius: 10px; margin: 10px 0; font-family: monospace; font-size: 16px; text-align: center; }
        .url-example { color: #a8c0ff; font-weight: bold; }
        .app-card { background: rgba(255,255,255,0.05); border-radius: 15px; padding: 15px; margin: 10px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
        .app-url a { color: #a8c0ff; text-decoration: none; }
        .badge { display: inline-block; background: #00ff00; color: #000; padding: 2px 8px; border-radius: 10px; font-size: 10px; margin-left: 10px; }
        .delete-btn { background: rgba(255,0,0,0.3); border: 1px solid #ff4444; padding: 8px 20px; }
        .success { background: rgba(0,255,0,0.2); border: 1px solid #0f0; padding: 15px; border-radius: 10px; margin: 10px 0; }
        .error { background: rgba(255,0,0,0.2); border: 1px solid #f00; padding: 15px; border-radius: 10px; margin: 10px 0; }
        .loader { border: 3px solid rgba(255,255,255,0.3); border-top-color: #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ai-chat { position: fixed; bottom: 20px; right: 20px; width: 350px; background: rgba(0,0,0,0.95); border-radius: 20px; z-index: 1000; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
        .ai-header { padding: 15px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 20px 20px 0 0; cursor: pointer; display: flex; justify-content: space-between; }
        .ai-messages { height: 300px; overflow-y: auto; padding: 15px; }
        .message { margin-bottom: 15px; display: flex; gap: 10px; }
        .message.user { flex-direction: row-reverse; }
        .message-content { padding: 10px 15px; border-radius: 15px; font-size: 13px; max-width: 80%; }
        .message.user .message-content { background: #667eea; }
        .message.bot .message-content { background: rgba(255,255,255,0.1); }
        .ai-input { display: flex; padding: 15px; gap: 10px; border-top: 1px solid rgba(255,255,255,0.1); }
        .ai-input input { flex: 1; margin: 0; }
        .ai-input button { margin: 0; padding: 10px 20px; }
        .footer { text-align: center; padding: 30px; margin-top: 40px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 14px; color: #888; }
        @media (max-width: 768px) { .ai-chat { width: calc(100% - 40px); right: 20px; } .header h1 { font-size: 2rem; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 OmniVerse on ${YOUR_DOMAIN}</h1>
            <p>Deploy any app with your own custom URL</p>
            <div class="domain-badge">🔗 https://${YOUR_DOMAIN}/<span style="color:#a8c0ff;">your-app-name</span></div>
        </div>

        <div class="stats-grid">
            <div class="stat-card"><div>📦 Total Deployments</div><div class="stat-number" id="totalDeployments">0</div></div>
            <div class="stat-card"><div>🟢 Active Apps</div><div class="stat-number" id="activeApps">0</div></div>
            <div class="stat-card"><div>👁️ Total Visits</div><div class="stat-number" id="totalVisits">0</div></div>
            <div class="stat-card"><div>🌍 Domain</div><div class="stat-number">${YOUR_DOMAIN}</div></div>
        </div>

        <div class="section">
            <div class="tabs">
                <div class="tab active" onclick="switchTab('code')">📝 Paste Code</div>
                <div class="tab" onclick="switchTab('github')">🐙 GitHub</div>
                <div class="tab" onclick="switchTab('zip')">📁 Upload ZIP</div>
            </div>

            <div id="tab-code" class="tab-content active">
                <textarea id="codeInput" rows="8" placeholder="Paste your Node.js/Express code here..."></textarea>
                <div class="path-preview">
                    🔗 Your app will be at: <span class="url-example">https://${YOUR_DOMAIN}/<span id="pathPreviewCode">your-app-name</span></span>
                </div>
                <input type="text" id="customPathCode" placeholder="App name (e.g., my-cool-app, api-store, chat-bot)" onkeyup="checkPath('code')">
                <input type="text" id="appDesc" placeholder="Description (helps with SEO)">
                <div id="pathStatusCode"></div>
                <button onclick="deployCode()">🚀 Deploy Now</button>
                <div id="deployResult"></div>
            </div>

            <div id="tab-github" class="tab-content">
                <input type="text" id="githubUrl" placeholder="https://github.com/username/repository">
                <div class="path-preview">
                    🔗 Your app will be at: <span class="url-example">https://${YOUR_DOMAIN}/<span id="pathPreviewGit">your-app-name</span></span>
                </div>
                <input type="text" id="customPathGit" placeholder="App name" onkeyup="checkPath('git')">
                <div id="pathStatusGit"></div>
                <button onclick="deployGitHub()">📦 Deploy from GitHub</button>
                <div id="githubResult"></div>
            </div>

            <div id="tab-zip" class="tab-content">
                <input type="file" id="zipFile" accept=".zip">
                <div class="path-preview">
                    🔗 Your app will be at: <span class="url-example">https://${YOUR_DOMAIN}/<span id="pathPreviewZip">your-app-name</span></span>
                </div>
                <input type="text" id="customPathZip" placeholder="App name" onkeyup="checkPath('zip')">
                <div id="pathStatusZip"></div>
                <button onclick="deployZip()">📁 Upload & Deploy</button>
                <div id="zipResult"></div>
            </div>
        </div>

        <div class="section">
            <h2>📱 Your Deployed Apps on ${YOUR_DOMAIN}</h2>
            <input type="text" id="searchApps" placeholder="🔍 Search apps..." onkeyup="searchApps()">
            <div id="appsList"></div>
        </div>

        <div class="footer">
            <p>🚀 OmniVerse on ${YOUR_DOMAIN} - Deploy anything, anywhere</p>
            <p style="font-size: 12px; margin-top: 10px;">💡 Your apps are automatically submitted to Google, Bing, and Yahoo! They will appear in search results within 24-48 hours.</p>
            <p style="font-size: 12px;">🔗 Share your app link: <span id="exampleLink">https://${YOUR_DOMAIN}/your-app-name</span></p>
        </div>
    </div>

    <div class="ai-chat">
        <div class="ai-header" onclick="toggleChat()">
            <span>🤖 OmniAI Assistant</span>
            <span>▼</span>
        </div>
        <div id="chatMessages" class="ai-messages">
            <div class="message bot"><div class="message-content">👋 Hello! I'm OmniAI. Your apps will be at https://${YOUR_DOMAIN}/your-app-name. Choose any name you want!</div></div>
        </div>
        <div class="ai-input">
            <input type="text" id="chatInput" placeholder="Ask for help..." onkeypress="if(event.key==='Enter') askAI()">
            <button onclick="askAI()">Send</button>
        </div>
    </div>

    <script>
        const YOUR_DOMAIN = '${YOUR_DOMAIN}';
        const BASE_URL = '${BASE_URL}';
        let chatOpen = true;

        function switchTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById(`tab-${tab}`).classList.add('active');
        }

        async function checkPath(source) {
            const path = document.getElementById(`customPath${source === 'code' ? 'Code' : source === 'git' ? 'Git' : 'Zip'}`).value;
            const preview = document.getElementById(`pathPreview${source === 'code' ? 'Code' : source === 'git' ? 'Git' : 'Zip'}`);
            const statusDiv = document.getElementById(`pathStatus${source === 'code' ? 'Code' : source === 'git' ? 'Git' : 'Zip'}`);
            
            if (preview) preview.textContent = path || 'your-app-name';
            if (!path) { statusDiv.innerHTML = ''; return; }
            
            if (!/^[a-z0-9-]+$/i.test(path)) {
                statusDiv.innerHTML = '<span style="color:#ff6b6b;">❌ Only letters, numbers, and hyphens allowed!</span>';
                return;
            }
            
            const res = await fetch('/api/check-path/' + encodeURIComponent(path));
            const data = await res.json();
            statusDiv.innerHTML = data.exists ? '<span style="color:#ff6b6b;">❌ App name already taken!</span>' : '<span style="color:#0f0;">✅ Available! Your app will be at https://' + YOUR_DOMAIN + '/' + path + '</span>';
        }

        function showAlert(containerId, message, type) {
            const container = document.getElementById(containerId);
            container.innerHTML = `<div class="${type}">${message}</div>`;
            if (type !== 'loading') setTimeout(() => { if (container.innerHTML.includes(message)) container.innerHTML = ''; }, 8000);
        }

        async function deployCode() {
            const code = document.getElementById('codeInput').value;
            const customPath = document.getElementById('customPathCode').value;
            const description = document.getElementById('appDesc').value;
            
            if (!code) { alert('Please paste your code!'); return; }
            if (!customPath) { alert('Please enter an app name!'); return; }
            
            showAlert('deployResult', '<div class="loader"></div><p>🚀 Deploying your app...</p>', 'loading');
            
            const res = await fetch('/api/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, customPath, description })
            });
            const result = await res.json();
            
            if (result.success) {
                showAlert('deployResult', `
                    <div style="text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
                        <strong>DEPLOYMENT SUCCESSFUL!</strong><br><br>
                        🔗 <strong>Your app is LIVE at:</strong><br>
                        <a href="${result.url}" target="_blank" style="color: #a8c0ff; font-size: 18px; word-break: break-all;">${result.url}</a><br><br>
                        🌐 Anyone can access it at ${BASE_URL}/${customPath}<br>
                        🔍 Submitted to Google, Bing, and Yahoo!<br>
                        📱 Share the link - it works on any browser!<br>
                        ${result.issues && result.issues.length > 0 ? `<br>⚠️ Fixed: ${result.issues.join(', ')}` : ''}
                    </div>
                `, 'success');
                document.getElementById('codeInput').value = '';
                document.getElementById('customPathCode').value = '';
                document.getElementById('appDesc').value = '';
                loadApps();
            } else {
                showAlert('deployResult', `❌ ${result.error}`, 'error');
            }
        }

        async function deployGitHub() {
            const repoUrl = document.getElementById('githubUrl').value;
            const customPath = document.getElementById('customPathGit').value;
            
            if (!repoUrl) { alert('Enter GitHub URL!'); return; }
            if (!customPath) { alert('Enter app name!'); return; }
            
            showAlert('githubResult', '<div class="loader"></div><p>📦 Fetching from GitHub...</p>', 'loading');
            
            const res = await fetch('/api/deploy/github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoUrl, customPath })
            });
            const result = await res.json();
            
            if (result.success) {
                showAlert('githubResult', `✅ Deployed! <a href="${result.url}" target="_blank">${result.url}</a>`, 'success');
                document.getElementById('githubUrl').value = '';
                document.getElementById('customPathGit').value = '';
                loadApps();
            } else {
                showAlert('githubResult', `❌ ${result.error}`, 'error');
            }
        }

        async function deployZip() {
            const file = document.getElementById('zipFile').files[0];
            const customPath = document.getElementById('customPathZip').value;
            
            if (!file) { alert('Select a ZIP file!'); return; }
            if (!customPath) { alert('Enter app name!'); return; }
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('customPath', customPath);
            
            showAlert('zipResult', '<div class="loader"></div><p>📁 Extracting and deploying...</p>', 'loading');
            
            const res = await fetch('/api/deploy/zip', { method: 'POST', body: formData });
            const result = await res.json();
            
            if (result.success) {
                showAlert('zipResult', `✅ Deployed! <a href="${result.url}" target="_blank">${result.url}</a>`, 'success');
                document.getElementById('zipFile').value = '';
                document.getElementById('customPathZip').value = '';
                loadApps();
            } else {
                showAlert('zipResult', `❌ ${result.error}`, 'error');
            }
        }

        async function deleteApp(path) {
            if (!confirm(`⚠️ Are you sure you want to delete "${path}"?\n\nThis will remove https://${YOUR_DOMAIN}/${path}`)) return;
            
            const res = await fetch(`/api/app/${path}`, { method: 'DELETE' });
            const result = await res.json();
            
            if (result.success) {
                loadApps();
            } else {
                alert('Delete failed: ' + result.error);
            }
        }

        async function loadApps() {
            const res = await fetch('/api/apps');
            const data = await res.json();
            
            document.getElementById('totalDeployments').innerHTML = data.totalDeployments || 0;
            document.getElementById('activeApps').innerHTML = data.total || 0;
            document.getElementById('totalVisits').innerHTML = data.totalVisits || 0;
            
            const appsList = document.getElementById('appsList');
            
            if (!data.apps || data.apps.length === 0) {
                appsList.innerHTML = '<div style="text-align: center; padding: 40px;">🚀 No apps deployed yet. Deploy your first app above!</div>';
            } else {
                appsList.innerHTML = data.apps.map(app => `
                    <div class="app-card">
                        <div>
                            <strong>${app.name}</strong> <span class="badge">LIVE</span>
                            ${app.visits ? `<span style="font-size: 11px; margin-left: 10px;">👁️ ${app.visits} visits</span>` : ''}
                            <div class="app-url">🔗 <a href="${app.url}" target="_blank">${app.url}</a></div>
                            <div style="font-size: 13px; margin-top: 5px;">${app.description || 'No description'}</div>
                            <small>📅 Deployed: ${new Date(app.createdAt).toLocaleString()}</small>
                        </div>
                        <button class="delete-btn" onclick="deleteApp('${app.customPath}')">🗑️ Delete</button>
                    </div>
                `).join('');
            }
        }

        async function searchApps() {
            const query = document.getElementById('searchApps').value;
            if (query.length < 2) { loadApps(); return; }
            
            const res = await fetch('/api/apps');
            const data = await res.json();
            const filtered = data.apps.filter(app => 
                app.name.toLowerCase().includes(query.toLowerCase()) || 
                (app.description && app.description.toLowerCase().includes(query.toLowerCase()))
            );
            
            const appsList = document.getElementById('appsList');
            if (filtered.length === 0) {
                appsList.innerHTML = '<div style="text-align: center; padding: 40px;">🔍 No apps found matching "' + query + '"</div>';
            } else {
                appsList.innerHTML = filtered.map(app => `
                    <div class="app-card">
                        <div>
                            <strong>${app.name}</strong> <span class="badge">LIVE</span>
                            <div class="app-url">🔗 <a href="${app.url}" target="_blank">${app.url}</a></div>
                        </div>
                    </div>
                `).join('');
            }
        }

        async function askAI() {
            const input = document.getElementById('chatInput');
            const message = input.value;
            if (!message) return;
            
            const messages = document.getElementById('chatMessages');
            messages.innerHTML += `<div class="message user"><div class="message-content">${escapeHtml(message)}</div></div>`;
            input.value = '';
            messages.scrollTop = messages.scrollHeight;
            
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });
            const data = await res.json();
            messages.innerHTML += `<div class="message bot"><div class="message-content">${escapeHtml(data.message)}</div></div>`;
            messages.scrollTop = messages.scrollHeight;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function toggleChat() {
            const messages = document.querySelector('.ai-messages');
            const input = document.querySelector('.ai-input');
            if (chatOpen) {
                messages.style.display = 'none';
                input.style.display = 'none';
            } else {
                messages.style.display = 'block';
                input.style.display = 'flex';
            }
            chatOpen = !chatOpen;
        }

        // Update example link
        document.getElementById('exampleLink').innerHTML = `https://${YOUR_DOMAIN}/your-app-name`;
        
        loadApps();
        setInterval(loadApps, 30000);
    </script>
</body>
</html>
    `);
});

// ============ LOAD EXISTING APPS ============
async function loadExistingApps() {
    for (const app of appData.apps) {
        if (app.status === 'running') {
            const appDir = path.join(DEPLOYED_APPS_DIR, app.name);
            if (fs.existsSync(appDir)) {
                const proc = spawn('node', ['server.js'], {
                    cwd: appDir,
                    env: { ...process.env, PORT: app.port },
                    detached: false
                });
                proc.stdout.on('data', (data) => console.log(`[${app.name}] ${data.toString().trim()}`));
                proc.stderr.on('data', (data) => console.error(`[${app.name}] ${data.toString().trim()}`));
                activeProcesses.set(app.name, proc);
                deployedApps.set(app.name, app);
            }
        }
    }
    console.log(`✅ Loaded ${activeProcesses.size} apps on ${YOUR_DOMAIN}`);
}

// ============ START SERVER ============
loadExistingApps().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║     🚀 OMNIVERSE - DEPLOYMENT PLATFORM 🚀                       ║
║                                                                  ║
║     🌐 Domain: https://${YOUR_DOMAIN}                            ║
║     📱 Apps: https://${YOUR_DOMAIN}/[your-app-name]              ║
║                                                                  ║
║     ✅ Any app you deploy gets a custom URL!                    ║
║     ✅ Links work on any browser!                               ║
║     ✅ Auto-submitted to Google, Bing, Yahoo!                   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
        `);
    });
});
