// ======================================================
// OMNIVERSE ULTIMATE - Custom Path System
// URLs: domain.com/custom-name (user chooses!)
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

// ============ CONFIGURATION ============
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL || `https://yourdomain.com`; // CHANGE THIS!

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ============ FILE STORAGE ============
const DATA_FILE = path.join(__dirname, 'data.json');
const DEPLOYED_APPS_DIR = path.join(__dirname, 'deployed_apps');

fs.ensureDirSync(DEPLOYED_APPS_DIR);

// Load/Save data
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {}
    return { apps: [], customPaths: {}, nextPort: 3001, totalDeployments: 0 };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let appData = loadData();
let deployedApps = new Map();
let activeProcesses = new Map();

// ============ CUSTOM PATH ROUTING ============
// This handles domain.com/custom-name requests
app.use('/', async (req, res, next) => {
    const pathName = req.path.slice(1); // Remove leading slash
    
    // Skip API routes and root
    if (req.path === '/' || req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
        return next();
    }
    
    // Check if this path is registered
    const appInfo = appData.customPaths[pathName];
    if (appInfo && appInfo.status === 'running') {
        try {
            // Forward request to the actual app
            const proxyUrl = `http://localhost:${appInfo.port}${req.url}`;
            const response = await axios({
                method: req.method,
                url: proxyUrl,
                data: req.body,
                headers: { ...req.headers, host: undefined }
            });
            res.status(response.status).send(response.data);
        } catch (error) {
            res.status(500).send(`App error: ${error.message}`);
        }
    } else {
        // Not found - serve custom 404 or redirect to main page
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head><title>404 - App Not Found</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>🔍 App Not Found</h1>
                <p>The app "${pathName}" does not exist or is not running.</p>
                <a href="/">Go to OmniVerse Dashboard</a>
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
        if (q.includes('custom path') || q.includes('url')) {
            return "You can choose any custom path for your app! Like 'myapp' becomes domain.com/myapp";
        }
        if (q.includes('deploy')) {
            return "Paste your code, give it a custom path name (e.g., 'my-cool-app'), and click Deploy. Your app will be live at domain.com/your-custom-name!";
        }
        return "I'm OmniAI! Choose any custom URL path for your app - it will be live at domain.com/your-chosen-name!";
    }
}

const ai = new AIAssistant();

// ============ DEPLOYMENT ENGINE ============
class DeploymentEngine {
    async deployCode(code, customPath, description) {
        // Validate custom path
        if (!customPath || customPath.trim() === '') {
            return { success: false, error: 'Custom path name is required!' };
        }
        
        // Check if path already exists
        if (appData.customPaths[customPath]) {
            return { success: false, error: `Path '/${customPath}' is already taken! Choose another name.` };
        }
        
        // Validate path characters (only letters, numbers, hyphens)
        if (!/^[a-z0-9-]+$/i.test(customPath)) {
            return { success: false, error: 'Only letters, numbers, and hyphens allowed in path name!' };
        }
        
        const appId = uuidv4().slice(0, 8);
        const finalName = customPath.toLowerCase();
        const appDir = path.join(DEPLOYED_APPS_DIR, finalName);
        const port = appData.nextPort++;
        const url = `${BASE_URL}/${finalName}`;
        
        try {
            // Create app directory
            await fs.ensureDir(appDir);
            
            // Analyze and fix code
            const { fixedCode, issues } = await ai.analyzeAndFix(code);
            await fs.writeFile(path.join(appDir, 'server.js'), fixedCode);
            
            // Create package.json
            const packageJson = {
                name: finalName,
                version: "1.0.0",
                main: "server.js",
                scripts: { start: "node server.js" },
                dependencies: { "express": "^4.18.2" }
            };
            await fs.writeFile(path.join(appDir, "package.json"), JSON.stringify(packageJson, null, 2));
            
            // Install dependencies
            await this.installDependencies(appDir);
            
            // Start the app
            const proc = this.startApp(appDir, port, finalName);
            
            // Save app info
            const appInfo = {
                id: appId,
                name: finalName,
                customPath: finalName,
                url: url,
                port: port,
                description: description || "No description",
                createdAt: new Date().toISOString(),
                status: "running"
            };
            
            // Store in both places
            deployedApps.set(finalName, appInfo);
            appData.customPaths[finalName] = appInfo;
            appData.apps.push(appInfo);
            appData.totalDeployments++;
            saveData(appData);
            
            console.log(`✅ App deployed: ${url}`);
            
            return {
                success: true,
                appId: appId,
                name: finalName,
                url: url,
                customPath: finalName,
                issues: issues,
                message: `App deployed! Access it at: ${url}`
            };
            
        } catch (error) {
            // Rollback port if deployment failed
            appData.nextPort--;
            saveData(appData);
            console.error(`Deployment error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    
    async deployFromGitHub(repoUrl, customPath) {
        console.log(`🚀 Deploying from GitHub: ${repoUrl}`);
        
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
                            console.log(`✅ Found ${file}`);
                            break;
                        }
                    } catch (e) {}
                }
                if (serverCode) break;
            }
            
            if (!serverCode) {
                throw new Error('No server.js, app.js, or index.js found');
            }
            
            const finalPath = customPath || repoPath.split('/').pop();
            return await this.deployCode(serverCode, finalPath, `From GitHub: ${repoUrl}`);
            
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
            
            if (!code) {
                throw new Error('No server.js found in ZIP');
            }
            
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
        
        // Stop the process
        if (activeProcesses.has(app.name)) {
            activeProcesses.get(app.name).kill();
            activeProcesses.delete(app.name);
        }
        
        // Remove from data
        delete appData.customPaths[customPath];
        appData.apps = appData.apps.filter(a => a.name !== app.name);
        deployedApps.delete(app.name);
        saveData(appData);
        
        // Optionally delete files (commented for safety)
        // await fs.remove(path.join(DEPLOYED_APPS_DIR, app.name));
        
        console.log(`🗑️ Deleted app: ${customPath}`);
        return { success: true, message: `App '${customPath}' deleted` };
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
    if (!customPath) return res.status(400).json({ error: 'Custom path name required!' });
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
    if (!customPath) return res.status(400).json({ error: 'Custom path name required!' });
    const result = await deployEngine.deployFromZip(req.file.path, customPath);
    res.json(result);
});

app.delete('/api/app/:path', async (req, res) => {
    const { path } = req.params;
    const result = await deployEngine.deleteApp(path);
    res.json(result);
});

app.get('/api/apps', (req, res) => {
    const apps = appData.apps;
    res.json({ apps, total: apps.length, totalDeployments: appData.totalDeployments, baseUrl: BASE_URL });
});

app.get('/api/check-path/:path', (req, res) => {
    const { path } = req.params;
    const exists = !!appData.customPaths[path];
    res.json({ exists, message: exists ? 'Path already taken' : 'Path available' });
});

app.post('/api/ai/chat', express.json(), async (req, res) => {
    const { message } = req.body;
    const answer = await ai.answerQuestion(message);
    res.json({ message: answer });
});

// ============ FRONTEND ============
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OmniVerse - Deploy with Custom URL Paths</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            min-height: 100vh;
            color: white;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 40px 0; }
        .header h1 { font-size: 2.5rem; background: linear-gradient(135deg, #fff, #a8c0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .section {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 25px;
            margin: 20px 0;
        }
        textarea, input {
            width: 100%;
            padding: 12px;
            margin: 10px 0;
            background: rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 10px;
            color: white;
            font-size: 14px;
        }
        button {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 30px;
            cursor: pointer;
            font-size: 16px;
            margin: 5px;
        }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .tab {
            background: rgba(255,255,255,0.1);
            padding: 10px 20px;
            border-radius: 30px;
            cursor: pointer;
        }
        .tab.active { background: linear-gradient(135deg, #667eea, #764ba2); }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .app-card {
            background: rgba(255,255,255,0.05);
            border-radius: 15px;
            padding: 15px;
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
        }
        .app-info { flex: 1; }
        .app-url { color: #a8c0ff; font-family: monospace; }
        .delete-btn {
            background: rgba(255,0,0,0.3);
            border: 1px solid #ff0000;
            padding: 5px 15px;
        }
        .delete-btn:hover { background: rgba(255,0,0,0.6); }
        .success { background: rgba(0,255,0,0.2); border: 1px solid #0f0; padding: 15px; border-radius: 10px; margin: 10px 0; }
        .error { background: rgba(255,0,0,0.2); border: 1px solid #f00; padding: 15px; border-radius: 10px; margin: 10px 0; }
        .loader {
            border: 3px solid rgba(255,255,255,0.3);
            border-top-color: #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .path-preview {
            background: rgba(0,0,0,0.5);
            padding: 10px;
            border-radius: 10px;
            margin: 10px 0;
            font-family: monospace;
            font-size: 14px;
        }
        .available { color: #0f0; }
        .taken { color: #f00; }
        .apps-grid { margin-top: 20px; }
        .badge {
            display: inline-block;
            background: #00ff00;
            color: #000;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 OmniVerse</h1>
            <p>Deploy any app with your own custom URL path!</p>
            <p style="font-size: 14px; opacity: 0.8;">✨ Example: <strong>${BASE_URL}/my-awesome-app</strong> ✨</p>
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
                    <strong>🔗 Your app will be at:</strong><br>
                    ${BASE_URL}/<span id="pathPreviewCode" style="color: #a8c0ff;">your-custom-name</span>
                </div>
                <input type="text" id="customPathCode" placeholder="Custom path name (e.g., my-cool-app)" onkeyup="checkPath('code')">
                <input type="text" id="appDesc" placeholder="Description (optional)">
                <div id="pathStatusCode" style="font-size: 12px; margin: 5px 0;"></div>
                <button onclick="deployCode()">🚀 Deploy Now</button>
                <div id="deployResult"></div>
            </div>

            <div id="tab-github" class="tab-content">
                <input type="text" id="githubUrl" placeholder="https://github.com/username/repository">
                <div class="path-preview">
                    <strong>🔗 Your app will be at:</strong><br>
                    ${BASE_URL}/<span id="pathPreviewGit" style="color: #a8c0ff;">your-custom-name</span>
                </div>
                <input type="text" id="customPathGit" placeholder="Custom path name" onkeyup="checkPath('git')">
                <div id="pathStatusGit" style="font-size: 12px; margin: 5px 0;"></div>
                <button onclick="deployGitHub()">📦 Deploy from GitHub</button>
                <div id="githubResult"></div>
            </div>

            <div id="tab-zip" class="tab-content">
                <input type="file" id="zipFile" accept=".zip">
                <div class="path-preview">
                    <strong>🔗 Your app will be at:</strong><br>
                    ${BASE_URL}/<span id="pathPreviewZip" style="color: #a8c0ff;">your-custom-name</span>
                </div>
                <input type="text" id="customPathZip" placeholder="Custom path name" onkeyup="checkPath('zip')">
                <div id="pathStatusZip" style="font-size: 12px; margin: 5px 0;"></div>
                <button onclick="deployZip()">📁 Upload & Deploy</button>
                <div id="zipResult"></div>
            </div>
        </div>

        <div class="section">
            <h2>📱 Your Deployed Apps</h2>
            <input type="text" id="searchApps" placeholder="Search apps..." onkeyup="searchApps()">
            <div id="appsList" class="apps-grid"></div>
        </div>
    </div>

    <script>
        const BASE_URL = '${BASE_URL}';
        
        async function switchTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById(\`tab-\${tab}\`).classList.add('active');
        }

        async function checkPath(source) {
            const pathInput = document.getElementById(\`customPath\${source === 'code' ? 'Code' : source === 'git' ? 'Git' : 'Zip'}\`);
            const pathStatus = document.getElementById(\`pathStatus\${source === 'code' ? 'Code' : source === 'git' ? 'Git' : 'Zip'}\`);
            const previewSpan = document.getElementById(\`pathPreview\${source === 'code' ? 'Code' : source === 'git' ? 'Git' : 'Zip'}\`);
            const path = pathInput.value;
            
            if (previewSpan) previewSpan.textContent = path || 'your-custom-name';
            
            if (!path) {
                pathStatus.innerHTML = '';
                return;
            }
            
            if (!/^[a-z0-9-]+$/i.test(path)) {
                pathStatus.innerHTML = '<span style="color: #ff6b6b;">❌ Only letters, numbers, and hyphens allowed!</span>';
                return;
            }
            
            const response = await fetch('/api/check-path/' + encodeURIComponent(path));
            const data = await response.json();
            
            if (data.exists) {
                pathStatus.innerHTML = '<span style="color: #ff6b6b;">❌ Path already taken! Choose another name.</span>';
            } else {
                pathStatus.innerHTML = '<span style="color: #00ff00;">✅ Path available!</span>';
            }
        }

        function showAlert(containerId, message, type) {
            const container = document.getElementById(containerId);
            container.innerHTML = \`<div class="\${type}">\${message}</div>\`;
            if (type !== 'loading') {
                setTimeout(() => { if (container.innerHTML.includes(message)) container.innerHTML = ''; }, 10000);
            }
        }

        async function deployCode() {
            const code = document.getElementById('codeInput').value;
            const customPath = document.getElementById('customPathCode').value;
            const description = document.getElementById('appDesc').value;
            
            if (!code) { alert('Please paste your code!'); return; }
            if (!customPath) { alert('Please enter a custom path name!'); return; }
            
            showAlert('deployResult', '<div class="loader"></div><p>Deploying...</p>', 'loading');
            
            const response = await fetch('/api/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, customPath, description })
            });
            const result = await response.json();
            
            if (result.success) {
                showAlert('deployResult', \`
                    ✅ <strong>DEPLOYMENT SUCCESSFUL!</strong><br>
                    🔗 Your app is LIVE at: <a href="\${result.url}" target="_blank" style="color:#a8c0ff;"><strong>\${result.url}</strong></a><br>
                    🌐 Anyone can access it at \${BASE_URL}/\${customPath}<br>
                    ${result.issues ? '<br>⚠️ Fixed issues: ' + result.issues.join(', ') : ''}
                \`, 'success');
                document.getElementById('codeInput').value = '';
                document.getElementById('customPathCode').value = '';
                loadApps();
            } else {
                showAlert('deployResult', \`❌ \${result.error}\`, 'error');
            }
        }

        async function deployGitHub() {
            const repoUrl = document.getElementById('githubUrl').value;
            const customPath = document.getElementById('customPathGit').value;
            
            if (!repoUrl) { alert('Enter GitHub URL!'); return; }
            if (!customPath) { alert('Enter custom path name!'); return; }
            
            showAlert('githubResult', '<div class="loader"></div><p>Fetching from GitHub...</p>', 'loading');
            
            const response = await fetch('/api/deploy/github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoUrl, customPath })
            });
            const result = await response.json();
            
            if (result.success) {
                showAlert('githubResult', \`✅ Deployed! <a href="\${result.url}" target="_blank">\${result.url}</a>\`, 'success');
                document.getElementById('githubUrl').value = '';
                document.getElementById('customPathGit').value = '';
                loadApps();
            } else {
                showAlert('githubResult', \`❌ \${result.error}\`, 'error');
            }
        }

        async function deployZip() {
            const file = document.getElementById('zipFile').files[0];
            const customPath = document.getElementById('customPathZip').value;
            
            if (!file) { alert('Select a ZIP file!'); return; }
            if (!customPath) { alert('Enter custom path name!'); return; }
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('customPath', customPath);
            
            showAlert('zipResult', '<div class="loader"></div><p>Extracting...</p>', 'loading');
            
            const response = await fetch('/api/deploy/zip', { method: 'POST', body: formData });
            const result = await response.json();
            
            if (result.success) {
                showAlert('zipResult', \`✅ Deployed! <a href="\${result.url}" target="_blank">\${result.url}</a>\`, 'success');
                document.getElementById('zipFile').value = '';
                document.getElementById('customPathZip').value = '';
                loadApps();
            } else {
                showAlert('zipResult', \`❌ \${result.error}\`, 'error');
            }
        }

        async function deleteApp(path) {
            if (!confirm(\`Are you sure you want to delete /$\{path\}?\`)) return;
            
            const response = await fetch(\`/api/app/\${path}\`, { method: 'DELETE' });
            const result = await response.json();
            
            if (result.success) {
                loadApps();
            } else {
                alert('Delete failed: ' + result.error);
            }
        }

        async function loadApps() {
            const response = await fetch('/api/apps');
            const data = await response.json();
            const appsList = document.getElementById('appsList');
            
            if (!data.apps || data.apps.length === 0) {
                appsList.innerHTML = '<p>No apps deployed yet. Deploy your first app above!</p>';
            } else {
                appsList.innerHTML = data.apps.map(app => \`
                    <div class="app-card">
                        <div class="app-info">
                            <strong>\${app.name}</strong> <span class="badge">LIVE</span>
                            <div class="app-url">🔗 <a href="\${app.url}" target="_blank">\${app.url}</a></div>
                            <div>\${app.description || 'No description'}</div>
                            <small>📅 \${new Date(app.createdAt).toLocaleString()}</small>
                        </div>
                        <button class="delete-btn" onclick="deleteApp('\${app.customPath}')">🗑️ Delete</button>
                    </div>
                \`).join('');
            }
        }

        async function searchApps() {
            const query = document.getElementById('searchApps').value;
            if (query.length < 2) { loadApps(); return; }
            const response = await fetch('/api/search?q=' + encodeURIComponent(query));
            const data = await response.json();
            const appsList = document.getElementById('appsList');
            appsList.innerHTML = data.apps.map(app => \`
                <div class="app-card">
                    <div class="app-info">
                        <strong>\${app.name}</strong>
                        <div><a href="\${app.url}" target="_blank">\${app.url}</a></div>
                    </div>
                </div>
            \`).join('');
        }

        loadApps();
        setInterval(loadApps, 30000);
    </script>
</body>
</html>
    `);
});

// ============ LOAD EXISTING APPS ON STARTUP ============
async function loadExistingApps() {
    for (const app of appData.apps) {
        if (app.status === 'running') {
            const appDir = path.join(DEPLOYED_APPS_DIR, app.name);
            if (fs.existsSync(appDir)) {
                console.log(`🔄 Restarting app: ${app.name} at /${app.customPath}`);
                const proc = spawn('node', ['server.js'], {
                    cwd: appDir,
                    env: { ...process.env, PORT: app.port },
                    detached: false
                });
                
                proc.stdout.on('data', (data) => console.log(`[${app.name}] ${data.toString().trim()}`));
                proc.stderr.on('data', (data) => console.error(`[${app.name}] ERROR: ${data.toString().trim()}`));
                
                activeProcesses.set(app.name, proc);
                deployedApps.set(app.name, app);
            }
        }
    }
    console.log(`✅ Loaded ${activeProcesses.size} apps from storage`);
}

// ============ START SERVER ============
loadExistingApps().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║     🚀 OMNIVERSE - CUSTOM PATH DEPLOYMENT PLATFORM 🚀          ║
║                                                                  ║
║     🌐 Main Server: http://localhost:${PORT}                     ║
║     📱 Apps are accessible at: ${BASE_URL}/[your-custom-name]    ║
║                                                                  ║
║     ✅ Users can choose ANY custom path name!                   ║
║     ✅ Example: ${BASE_URL}/my-awesome-app                       ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
        `);
    });
});
