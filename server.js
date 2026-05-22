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
const BASE_URL = process.env.BASE_URL || `https://yourdomain.com`; // CHANGE TO YOUR DOMAIN!

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
    return { apps: [], customPaths: {}, nextPort: 3001, totalDeployments: 0, totalVisits: 0 };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let appData = loadData();
let deployedApps = new Map();
let activeProcesses = new Map();

// ============ CUSTOM PATH ROUTING ============
app.use('/', async (req, res, next) => {
    const pathName = req.path.slice(1);
    
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
            
            const proxyUrl = `http://localhost:${appInfo.port}${req.url}`;
            const response = await axios({
                method: req.method,
                url: proxyUrl,
                data: req.body,
                headers: { ...req.headers, host: undefined },
                timeout: 30000
            });
            res.status(response.status).send(response.data);
        } catch (error) {
            res.status(500).send(`
                <!DOCTYPE html>
                <html>
                <head><title>App Error</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>⚠️ App Error</h1>
                    <p>${error.message}</p>
                    <a href="/">Go to Dashboard</a>
                </body>
                </html>
            `);
        }
    } else {
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head><title>404 - App Not Found</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>🔍 App Not Found</h1>
                <p>The app "${pathName}" does not exist.</p>
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
        
        if (!code.includes('error handling') && !code.includes('try') && !code.includes('catch')) {
            fixedCode = `process.on('uncaughtException', console.error);\n${fixedCode}`;
            issues.push('Added error handling');
        }
        
        if (!code.includes('express')) {
            issues.push('Warning: Express not detected');
        }
        
        return { fixedCode, issues };
    }
    
    async generateApp(description) {
        const lowerDesc = description.toLowerCase();
        
        if (lowerDesc.includes('api')) {
            return `const express = require('express');
const app = express();

app.get('/api/data', (req, res) => {
    res.json({ message: 'Hello from your API!', timestamp: new Date() });
});

app.get('/', (req, res) => {
    res.json({ status: 'API is running', endpoints: ['/api/data'] });
});

app.listen(process.env.PORT || 3000);`;
        }
        
        return `const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send(\`
        <!DOCTYPE html>
        <html>
        <head>
            <title>My App</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    color: white;
                    text-align: center;
                }
                .container {
                    background: rgba(255,255,255,0.1);
                    padding: 40px;
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                }
                h1 { font-size: 2rem; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 ${description || 'Your App'} is Live!</h1>
                <p>Deployed successfully on OmniVerse</p>
                <button onclick="alert('Working!')">Click Me</button>
            </div>
        </body>
        </html>
    \`);
});

app.listen(process.env.PORT || 3000);`;
    }
    
    async answerQuestion(question) {
        const q = question.toLowerCase();
        if (q.includes('custom path') || q.includes('url')) {
            return "You can choose any custom path for your app! Like 'myapp' becomes domain.com/myapp";
        }
        if (q.includes('deploy')) {
            return "Paste your code, give it a custom path name (e.g., 'my-cool-app'), and click Deploy. Your app will be live at domain.com/your-custom-name!";
        }
        if (q.includes('delete')) {
            return "You can delete any app by clicking the red Delete button next to it in the 'Your Deployed Apps' section.";
        }
        if (q.includes('github')) {
            return "Enter your GitHub repository URL (e.g., https://github.com/username/repo). Make sure it has a server.js file!";
        }
        return "I'm OmniAI! I can help you deploy apps, fix code, generate apps, and answer questions. Choose a custom URL path for your app - it will be live at domain.com/your-chosen-name!";
    }
}

const ai = new AIAssistant();

// ============ DEPLOYMENT ENGINE ============
class DeploymentEngine {
    async deployCode(code, customPath, description) {
        if (!customPath || customPath.trim() === '') {
            return { success: false, error: 'Custom path name is required!' };
        }
        
        if (appData.customPaths[customPath]) {
            return { success: false, error: `Path '/${customPath}' is already taken! Choose another name.` };
        }
        
        if (!/^[a-z0-9-]+$/i.test(customPath)) {
            return { success: false, error: 'Only letters, numbers, and hyphens allowed in path name!' };
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
        
        if (activeProcesses.has(app.name)) {
            activeProcesses.get(app.name).kill();
            activeProcesses.delete(app.name);
        }
        
        delete appData.customPaths[customPath];
        appData.apps = appData.apps.filter(a => a.name !== app.name);
        deployedApps.delete(app.name);
        saveData(appData);
        
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
    res.json({ apps, total: apps.length, totalDeployments: appData.totalDeployments, totalVisits: appData.totalVisits, baseUrl: BASE_URL });
});

app.get('/api/check-path/:path', (req, res) => {
    const { path } = req.params;
    const exists = !!appData.customPaths[path];
    res.json({ exists, message: exists ? 'Path already taken' : 'Path available' });
});

app.post('/api/ai/chat', express.json(), async (req, res) => {
    const { message, code } = req.body;
    if (code) {
        const analysis = await ai.analyzeAndFix(code);
        res.json({ type: 'analysis', issues: analysis.issues, fixedCode: analysis.fixedCode });
    } else if (message && message.toLowerCase().includes('generate')) {
        const generatedCode = await ai.generateApp(message);
        res.json({ type: 'generated', code: generatedCode });
    } else {
        const answer = await ai.answerQuestion(message || 'help');
        res.json({ type: 'answer', message: answer });
    }
});

// ============ FRONTEND ============
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
                proc.stderr.on('data', (data) => console.error(`[${app.name}] ${data.toString().trim()}`));
                
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
║     📱 Apps at: ${BASE_URL}/[your-custom-name]                   ║
║     ✅ Users can choose ANY custom path name!                   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
        `);
    });
});
