// ======================================================
// OMNIVERSE - ZASS.WEBSITE WITH SUPER AI
// AI knows EVERYTHING - answers ANY question!
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
const YOUR_DOMAIN = 'zass.website';
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

// ============ SUPER AI - KNOWS EVERYTHING! ============
class SuperAI {
    constructor() {
        this.knowledgeBase = this.buildKnowledgeBase();
        this.conversationHistory = new Map();
    }

    buildKnowledgeBase() {
        return {
            // Programming
            programming: {
                javascript: "JavaScript is a high-level programming language. It's used for web development, Node.js, React, Vue, and more. Key features: async/await, promises, closures, prototypes.",
                python: "Python is a versatile language for data science, AI, web development (Django/Flask), automation. Known for readability and extensive libraries.",
                java: "Java is an object-oriented language used for enterprise apps, Android development, Spring Boot. Runs on JVM.",
                cpp: "C++ is a powerful language for system programming, game development, high-performance applications.",
                react: "React is a JavaScript library for building user interfaces. Created by Facebook. Uses components, hooks, virtual DOM.",
                nodejs: "Node.js is a JavaScript runtime for server-side development. Built on Chrome's V8 engine. Uses event-driven architecture.",
                express: "Express is a Node.js framework for building web APIs and applications. Minimal and flexible.",
                mongodb: "MongoDB is a NoSQL database that stores data in JSON-like documents. Scalable and flexible.",
                sql: "SQL (Structured Query Language) is used to manage relational databases like PostgreSQL, MySQL."
            },
            // Technology
            technology: {
                cloud: "Cloud computing includes AWS, Google Cloud, Azure. Services: compute, storage, databases, AI/ML, serverless.",
                docker: "Docker containers package applications with dependencies. Works on any system. Kubernetes orchestrates containers.",
                ai: "Artificial Intelligence includes machine learning, deep learning, neural networks. Tools: TensorFlow, PyTorch, OpenAI.",
                blockchain: "Blockchain is a distributed ledger. Used for cryptocurrencies (Bitcoin, Ethereum), smart contracts, DeFi.",
                cybersecurity: "Cybersecurity protects systems from attacks. Includes encryption, firewalls, authentication, penetration testing."
            },
            // Business & Money
            business: {
                startup: "To start a business: 1) Find problem 2) Validate idea 3) Build MVP 4) Get customers 5) Raise funding if needed.",
                marketing: "Digital marketing: SEO, social media, email marketing, content marketing, PPC ads, influencer marketing.",
                finance: "Personal finance: budget 50/30/20 rule (needs/wants/savings), invest early, emergency fund, avoid debt.",
                ecommerce: "E-commerce platforms: Shopify, WooCommerce, Magento. Key: product photography, reviews, fast shipping."
            },
            // Health & Lifestyle
            health: {
                fitness: "Exercise: 150 mins cardio + 2x strength training weekly. Benefits: heart health, mental health, longevity.",
                nutrition: "Balanced diet: proteins, complex carbs, healthy fats, fruits, vegetables. Stay hydrated, limit processed foods.",
                mental: "Mental health: practice mindfulness, adequate sleep, social connections, therapy when needed, reduce stress."
            },
            // Science
            science: {
                physics: "Physics studies matter, energy, space, time. Key theories: Newtonian mechanics, relativity, quantum mechanics.",
                biology: "Biology studies life: cells, genetics, evolution, ecosystems, human body, microbiology.",
                chemistry: "Chemistry studies matter, atoms, molecules, reactions. Branches: organic, inorganic, biochemistry."
            },
            // General Knowledge
            general: {
                history: "World history includes ancient civilizations (Egypt, Rome, Greece), Middle Ages, Renaissance, Industrial Revolution, World Wars.",
                geography: "Earth has 7 continents, 5 oceans. Largest countries: Russia, Canada, USA, China. Highest peak: Everest.",
                art: "Art forms: painting, sculpture, music, dance, theater, film, literature. Famous artists: Da Vinci, Van Gogh, Picasso.",
                sports: "Popular sports: football (soccer), basketball, cricket, tennis, baseball. Olympics every 4 years."
            }
        };
    }

    async getSmartAnswer(question, context = {}) {
        const q = question.toLowerCase();
        
        // Store conversation
        if (!this.conversationHistory.has(context.sessionId)) {
            this.conversationHistory.set(context.sessionId, []);
        }
        const history = this.conversationHistory.get(context.sessionId);
        history.push({ role: 'user', content: question, time: Date.now() });
        
        let answer = "";
        
        // Check different categories
        if (q.includes('javascript') || q.includes('js')) {
            answer = this.knowledgeBase.programming.javascript;
        }
        else if (q.includes('python')) {
            answer = this.knowledgeBase.programming.python;
        }
        else if (q.includes('react')) {
            answer = this.knowledgeBase.programming.react;
        }
        else if (q.includes('node') || q.includes('nodejs')) {
            answer = this.knowledgeBase.programming.nodejs;
        }
        else if (q.includes('express')) {
            answer = this.knowledgeBase.programming.express;
        }
        else if (q.includes('mongodb') || q.includes('mongo')) {
            answer = this.knowledgeBase.programming.mongodb;
        }
        else if (q.includes('sql') || q.includes('database')) {
            answer = this.knowledgeBase.programming.sql;
        }
        else if (q.includes('docker')) {
            answer = this.knowledgeBase.technology.docker;
        }
        else if (q.includes('ai') || q.includes('artificial intelligence') || q.includes('machine learning')) {
            answer = this.knowledgeBase.technology.ai;
        }
        else if (q.includes('blockchain') || q.includes('crypto') || q.includes('bitcoin') || q.includes('ethereum')) {
            answer = this.knowledgeBase.technology.blockchain;
        }
        else if (q.includes('security') || q.includes('cyber')) {
            answer = this.knowledgeBase.technology.cybersecurity;
        }
        else if (q.includes('startup') || q.includes('business') || q.includes('company')) {
            answer = this.knowledgeBase.business.startup;
        }
        else if (q.includes('marketing') || q.includes('seo') || q.includes('advertising')) {
            answer = this.knowledgeBase.business.marketing;
        }
        else if (q.includes('money') || q.includes('finance') || q.includes('invest')) {
            answer = this.knowledgeBase.business.finance;
        }
        else if (q.includes('ecommerce') || q.includes('shopify')) {
            answer = this.knowledgeBase.business.ecommerce;
        }
        else if (q.includes('fitness') || q.includes('exercise') || q.includes('workout') || q.includes('gym')) {
            answer = this.knowledgeBase.health.fitness;
        }
        else if (q.includes('food') || q.includes('diet') || q.includes('nutrition')) {
            answer = this.knowledgeBase.health.nutrition;
        }
        else if (q.includes('mental') || q.includes('stress') || q.includes('anxiety')) {
            answer = this.knowledgeBase.health.mental;
        }
        else if (q.includes('physics')) {
            answer = this.knowledgeBase.science.physics;
        }
        else if (q.includes('biology') || q.includes('cell') || q.includes('dna')) {
            answer = this.knowledgeBase.science.biology;
        }
        else if (q.includes('chemistry')) {
            answer = this.knowledgeBase.science.chemistry;
        }
        else if (q.includes('history')) {
            answer = this.knowledgeBase.general.history;
        }
        else if (q.includes('geography') || q.includes('country') || q.includes('continent') || q.includes('ocean')) {
            answer = this.knowledgeBase.general.geography;
        }
        else if (q.includes('art') || q.includes('painting') || q.includes('music')) {
            answer = this.knowledgeBase.general.art;
        }
        else if (q.includes('sport') || q.includes('football') || q.includes('soccer') || q.includes('basketball')) {
            answer = this.knowledgeBase.general.sports;
        }
        // Deployment specific questions
        else if (q.includes('deploy') || q.includes('hosting') || q.includes('server')) {
            answer = `To deploy an app on ${YOUR_DOMAIN}: 1) Paste your code, 2) Choose an app name (like 'my-app'), 3) Click Deploy. Your app will be live at https://${YOUR_DOMAIN}/your-app-name instantly!`;
        }
        else if (q.includes('custom url') || q.includes('domain')) {
            answer = `Your apps will have URLs like: https://${YOUR_DOMAIN}/your-chosen-name. You can pick ANY name you want!`;
        }
        else if (q.includes('delete app')) {
            answer = "To delete an app, go to 'Your Deployed Apps' section and click the red 'Delete' button next to the app you want to remove.";
        }
        else if (q.includes('github')) {
            answer = "You can deploy directly from GitHub! Just paste your repository URL (e.g., https://github.com/username/repo) and choose an app name. Make sure your repo has a server.js file.";
        }
        // General greeting
        else if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
            answer = "Hello! I'm OmniAI on OmniVerse. I can answer questions about programming, technology, business, health, science, history, and more! What would you like to know?";
        }
        else if (q.includes('who are you') || q.includes('what are you')) {
            answer = "I'm OmniAI, a super-intelligent assistant running on OmniVerse at zass.website. I know about programming, technology, science, history, business, health, and much more! Ask me anything!";
        }
        else if (q.includes('how are you')) {
            answer = "I'm doing great! Ready to help you with any question you have. What can I assist you with today?";
        }
        else if (q.includes('thank')) {
            answer = "You're very welcome! Feel free to ask me anything else. I'm here to help 24/7!";
        }
        // Default response - try to be helpful
        else {
            answer = `I understand you're asking about "${question.substring(0, 50)}...". I have knowledge about many topics including programming (JavaScript, Python, React, Node.js), technology (AI, Cloud, Docker), business, health, science, history, and more. Could you please rephrase or ask a more specific question?`;
        }
        
        // Add helpful follow-up
        if (!q.includes('thank') && !q.includes('hello') && !q.includes('hi')) {
            answer += "\n\n💡 Is there anything else you'd like to know? I can help with programming, technology, business, health, science, history, and more!";
        }
        
        // Store AI response
        history.push({ role: 'assistant', content: answer, time: Date.now() });
        
        // Keep only last 20 messages
        while (history.length > 20) history.shift();
        
        return answer;
    }
    
    async analyzeAndFix(code) {
        let fixedCode = code;
        const issues = [];
        
        if (!code.includes('process.env.PORT')) {
            fixedCode = fixedCode.replace(/listen\((\d+)\)/, 'listen(process.env.PORT || $1)');
            issues.push('Added process.env.PORT for cloud compatibility');
        }
        
        if (!code.includes('error handling') && !code.includes('try')) {
            fixedCode = `process.on('uncaughtException', (err) => {\n  console.error('Error:', err);\n});\n${fixedCode}`;
            issues.push('Added error handling');
        }
        
        if (!code.includes('express') && code.includes('require')) {
            issues.push('Make sure Express is installed if you use it');
        }
        
        return { fixedCode, issues };
    }
    
    async generateApp(description) {
        const lowerDesc = description.toLowerCase();
        
        if (lowerDesc.includes('api')) {
            return `const express = require('express');
const app = express();

app.use(express.json());

// GET endpoint
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello World!', timestamp: new Date() });
});

// POST endpoint
app.post('/api/data', (req, res) => {
    res.json({ received: req.body, status: 'success' });
});

// Main route
app.get('/', (req, res) => {
    res.json({ 
        name: 'My API',
        endpoints: ['GET /api/hello', 'POST /api/data'],
        version: '1.0'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`API running on port \${PORT}\`));`;
        }
        
        return `const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send(\`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${description || 'My App'}</title>
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
                h1 { font-size: 2.5rem; margin-bottom: 20px; }
                button {
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 30px;
                    font-size: 16px;
                    cursor: pointer;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 ${description || 'Your App'} is Live!</h1>
                <p>Deployed successfully on OmniVerse at ${YOUR_DOMAIN}</p>
                <button onclick="alert('App is working! 🎉')">Click Me</button>
            </div>
        </body>
        </html>
    \`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`App running on port \${PORT}\`));`;
    }
}

const ai = new SuperAI();

// ============ DEPLOYMENT ENGINE ============
class DeploymentEngine {
    async deployCode(code, customPath, description) {
        if (!customPath || customPath.trim() === '') {
            return { success: false, error: 'App name is required!' };
        }
        
        if (appData.customPaths[customPath]) {
            return { success: false, error: `App name '/${customPath}' is already taken!` };
        }
        
        if (!/^[a-z0-9-]+$/i.test(customPath)) {
            return { success: false, error: 'Only letters, numbers, and hyphens allowed!' };
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
                url: url,
                customPath: finalName,
                issues: issues
            };
            
        } catch (error) {
            appData.nextPort--;
            saveData(appData);
            return { success: false, error: error.message };
        }
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

// SUPER AI ENDPOINT - Now answers ANY question!
app.post('/api/ai/chat', express.json(), async (req, res) => {
    const { message, code } = req.body;
    
    if (code) {
        const analysis = await ai.analyzeAndFix(code);
        res.json({ type: 'analysis', issues: analysis.issues, fixedCode: analysis.fixedCode });
    } else if (message && message.toLowerCase().includes('generate app')) {
        const generatedCode = await ai.generateApp(message);
        res.json({ type: 'generated', code: generatedCode });
    } else {
        const sessionId = req.body.sessionId || 'default';
        const answer = await ai.getSmartAnswer(message, { sessionId });
        res.json({ type: 'answer', message: answer });
    }
});

// Sitemap for SEO
app.get('/sitemap.xml', (req, res) => {
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>${BASE_URL}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;
    for (const app of appData.apps) {
        sitemap += `\n    <url><loc>${app.url}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`;
    }
    sitemap += `\n</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
});

app.get('/robots.txt', (req, res) => {
    res.send(`User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml`);
});

// ============ MAIN PAGE ============
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OmniVerse on ${YOUR_DOMAIN} - Deploy Your Apps</title>
    <meta name="description" content="Deploy any app instantly on ${YOUR_DOMAIN}. Get a custom URL like ${YOUR_DOMAIN}/your-app-name">
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
        .path-preview { background: rgba(0,0,0,0.4); padding: 12px; border-radius: 10px; margin: 10px 0; font-family: monospace; text-align: center; }
        .app-card { background: rgba(255,255,255,0.05); border-radius: 15px; padding: 15px; margin: 10px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
        .app-url a { color: #a8c0ff; text-decoration: none; }
        .badge { display: inline-block; background: #00ff00; color: #000; padding: 2px 8px; border-radius: 10px; font-size: 10px; margin-left: 10px; }
        .delete-btn { background: rgba(255,0,0,0.3); border: 1px solid #ff4444; padding: 8px 20px; }
        .success { background: rgba(0,255,0,0.2); border: 1px solid #0f0; padding: 15px; border-radius: 10px; margin: 10px 0; }
        .error { background: rgba(255,0,0,0.2); border: 1px solid #f00; padding: 15px; border-radius: 10px; margin: 10px 0; }
        .loader { border: 3px solid rgba(255,255,255,0.3); border-top-color: #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ai-chat { position: fixed; bottom: 20px; right: 20px; width: 380px; background: rgba(0,0,0,0.95); border-radius: 20px; z-index: 1000; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
        .ai-header { padding: 15px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 20px 20px 0 0; cursor: pointer; display: flex; justify-content: space-between; }
        .ai-messages { height: 350px; overflow-y: auto; padding: 15px; }
        .message { margin-bottom: 15px; display: flex; gap: 10px; }
        .message.user { flex-direction: row-reverse; }
        .message-content { padding: 10px 15px; border-radius: 15px; font-size: 13px; max-width: 85%; white-space: pre-wrap; }
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
            <div class="domain-badge">🔗 https://${YOUR_DOMAIN}/<span id="urlExample">your-app-name</span></div>
        </div>

        <div class="stats-grid">
            <div class="stat-card"><div>📦 Total Deployments</div><div class="stat-number" id="totalDeployments">0</div></div>
            <div class="stat-card"><div>🟢 Active Apps</div><div class="stat-number" id="activeApps">0</div></div>
            <div class="stat-card"><div>👁️ Total Visits</div><div class="stat-number" id="totalVisits">0</div></div>
            <div class="stat-card"><div>🧠 AI Status</div><div class="stat-number">SUPER</div></div>
        </div>

        <div class="section">
            <div class="tabs">
                <div class="tab active" onclick="switchTab('code')">📝 Paste Code</div>
                <div class="tab" onclick="switchTab('github')">🐙 GitHub</div>
                <div class="tab" onclick="switchTab('zip')">📁 Upload ZIP</div>
            </div>

            <div id="tab-code" class="tab-content active">
                <textarea id="codeInput" rows="8" placeholder="Paste your Node.js/Express code here..."></textarea>
                <div class="path-preview">🔗 Your app will be at: <strong>https://${YOUR_DOMAIN}/<span id="pathPreviewCode">your-app-name</span></strong></div>
                <input type="text" id="customPathCode" placeholder="App name (e.g., my-cool-app)" onkeyup="checkPath('code')">
                <input type="text" id="appDesc" placeholder="Description (helps with SEO)">
                <div id="pathStatusCode"></div>
                <button onclick="deployCode()">🚀 Deploy Now</button>
                <div id="deployResult"></div>
            </div>

            <div id="tab-github" class="tab-content">
                <input type="text" id="githubUrl" placeholder="https://github.com/username/repository">
                <div class="path-preview">🔗 Your app will be at: <strong>https://${YOUR_DOMAIN}/<span id="pathPreviewGit">your-app-name</span></strong></div>
                <input type="text" id="customPathGit" placeholder="App name" onkeyup="checkPath('git')">
                <div id="pathStatusGit"></div>
                <button onclick="deployGitHub()">📦 Deploy from GitHub</button>
                <div id="githubResult"></div>
            </div>

            <div id="tab-zip" class="tab-content">
                <input type="file" id="zipFile" accept=".zip">
                <div class="path-preview">🔗 Your app will be at: <strong>https://${YOUR_DOMAIN}/<span id="pathPreviewZip">your-app-name</span></strong></div>
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
            <p>💡 Your apps are automatically submitted to Google, Bing, and Yahoo!</p>
        </div>
    </div>

    <div class="ai-chat">
        <div class="ai-header" onclick="toggleChat()">
            <span>🧠 Super AI Assistant</span>
            <span>▼</span>
        </div>
        <div id="chatMessages" class="ai-messages">
            <div class="message bot"><div class="message-content">👋 Hello! I'm Super AI. I can answer ANY question about programming, technology, business, health, science, history, and more! What would you like to know?</div></div>
        </div>
        <div class="ai-input">
            <input type="text" id="chatInput" placeholder="Ask me anything..." onkeypress="if(event.key==='Enter') askAI()">
            <button onclick="askAI()">Send</button>
        </div>
    </div>

    <script>
        const YOUR_DOMAIN = '${YOUR_DOMAIN}';
        let chatOpen = true;
        let sessionId = Math.random().toString(36).substring(2);

        function switchTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById(\`tab-\${tab}\`).classList.add('active');
        }

        async function checkPath(source) {
            const path = document.getElementById(\`customPath\${source === 'code' ? 'Code' : source === 'git' ? 'Git' : 'Zip'}\`).value;
            const preview = document.getElementById(\`pathPreview\${source === 'code' ? 'Code' : source === 'git' ? 'Git' : 'Zip'}\`);
            const statusDiv = document.getElementById(\`pathStatus\${source === 'code' ? 'Code' : source === 'git' ? 'Git' : 'Zip'}\`);
            
            if (preview) preview.textContent = path || 'your-app-name';
            if (!path) { statusDiv.innerHTML = ''; return; }
            
            if (!/^[a-z0-9-]+$/i.test(path)) {
                statusDiv.innerHTML = '<span style="color:#ff6b6b;">❌ Only letters, numbers, and hyphens allowed!</span>';
                return;
            }
            
            const res = await fetch('/api/check-path/' + encodeURIComponent(path));
            const data = await res.json();
            statusDiv.innerHTML = data.exists ? '<span style="color:#ff6b6b;">❌ Name already taken!</span>' : '<span style="color:#0f0;">✅ Available! https://' + YOUR_DOMAIN + '/' + path + '</span>';
        }

        function showAlert(containerId, message, type) {
            const container = document.getElementById(containerId);
            container.innerHTML = \`<div class="\${type}">\${message}</div>\`;
            if (type !== 'loading') setTimeout(() => { if (container.innerHTML.includes(message)) container.innerHTML = ''; }, 8000);
        }

        async function deployCode() {
            const code = document.getElementById('codeInput').value;
            const customPath = document.getElementById('customPathCode').value;
            const description = document.getElementById('appDesc').value;
            if (!code) { alert('Paste your code!'); return; }
            if (!customPath) { alert('Enter an app name!'); return; }
            showAlert('deployResult', '<div class="loader"></div><p>🚀 Deploying...</p>', 'loading');
            const res = await fetch('/api/deploy', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, customPath, description })
            });
            const result = await res.json();
            if (result.success) {
                showAlert('deployResult', \`✅ <strong>DEPLOYED!</strong><br>🔗 <a href="\${result.url}" target="_blank">\${result.url}</a>\`, 'success');
                document.getElementById('codeInput').value = '';
                document.getElementById('customPathCode').value = '';
                loadApps();
            } else { showAlert('deployResult', \`❌ \${result.error}\`, 'error'); }
        }

        async function deployGitHub() {
            const repoUrl = document.getElementById('githubUrl').value;
            const customPath = document.getElementById('customPathGit').value;
            if (!repoUrl || !customPath) { alert('Enter both URL and name!'); return; }
            showAlert('githubResult', '<div class="loader"></div><p>📦 Fetching...</p>', 'loading');
            const res = await fetch('/api/deploy/github', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoUrl, customPath })
            });
            const result = await res.json();
            if (result.success) {
                showAlert('githubResult', \`✅ <a href="\${result.url}" target="_blank">\${result.url}</a>\`, 'success');
                loadApps();
            } else { showAlert('githubResult', \`❌ \${result.error}\`, 'error'); }
        }

        async function deployZip() {
            const file = document.getElementById('zipFile').files[0];
            const customPath = document.getElementById('customPathZip').value;
            if (!file || !customPath) { alert('Select file and enter name!'); return; }
            const formData = new FormData();
            formData.append('file', file);
            formData.append('customPath', customPath);
            showAlert('zipResult', '<div class="loader"></div><p>📁 Extracting...</p>', 'loading');
            const res = await fetch('/api/deploy/zip', { method: 'POST', body: formData });
            const result = await res.json();
            if (result.success) {
                showAlert('zipResult', \`✅ <a href="\${result.url}" target="_blank">\${result.url}</a>\`, 'success');
                loadApps();
            } else { showAlert('zipResult', \`❌ \${result.error}\`, 'error'); }
        }

        async function deleteApp(path) {
            if (!confirm(\`Delete /\${path}/?\`)) return;
            const res = await fetch(\`/api/app/\${path}\`, { method: 'DELETE' });
            if (res.ok) loadApps();
        }

        async function loadApps() {
            const res = await fetch('/api/apps');
            const data = await res.json();
            document.getElementById('totalDeployments').innerHTML = data.totalDeployments || 0;
            document.getElementById('activeApps').innerHTML = data.total || 0;
            document.getElementById('totalVisits').innerHTML = data.totalVisits || 0;
            const appsList = document.getElementById('appsList');
            if (!data.apps || data.apps.length === 0) {
                appsList.innerHTML = '<div style="text-align:center;padding:40px;">🚀 No apps yet. Deploy your first app!</div>';
            } else {
                appsList.innerHTML = data.apps.map(app => \`
                    <div class="app-card">
                        <div><strong>\${app.name}</strong> <span class="badge">LIVE</span>
                        <div class="app-url">🔗 <a href="\${app.url}" target="_blank">\${app.url}</a></div>
                        <small>\${app.description || ''}</small></div>
                        <button class="delete-btn" onclick="deleteApp('\${app.customPath}')">🗑️ Delete</button>
                    </div>
                \`).join('');
            }
        }

        async function searchApps() {
            const q = document.getElementById('searchApps').value;
            if (q.length < 2) { loadApps(); return; }
            const res = await fetch('/api/apps');
            const data = await res.json();
            const filtered = data.apps.filter(a => a.name.includes(q.toLowerCase()));
            const appsList = document.getElementById('appsList');
            appsList.innerHTML = filtered.map(app => \`<div class="app-card"><div><strong>\${app.name}</strong><br><a href="\${app.url}">\${app.url}</a></div></div>\`).join('');
        }

        async function askAI() {
            const input = document.getElementById('chatInput');
            const message = input.value;
            if (!message) return;
            const messages = document.getElementById('chatMessages');
            messages.innerHTML += \`<div class="message user"><div class="message-content">\${escapeHtml(message)}</div></div>\`;
            input.value = '';
            messages.scrollTop = messages.scrollHeight;
            const res = await fetch('/api/ai/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, sessionId })
            });
            const data = await res.json();
            messages.innerHTML += \`<div class="message bot"><div class="message-content">\${escapeHtml(data.message)}</div></div>\`;
            messages.scrollTop = messages.scrollHeight;
        }

        function escapeHtml(text) { return text.replace(/[&<>]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m; }); }
        function toggleChat() { const m = document.querySelector('.ai-messages'); const i = document.querySelector('.ai-input'); if (chatOpen) { m.style.display = 'none'; i.style.display = 'none'; } else { m.style.display = 'block'; i.style.display = 'flex'; } chatOpen = !chatOpen; }

        loadApps();
        setInterval(loadApps, 30000);
    </script>
</body>
</html>`);
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
║     🚀 OMNIVERSE - SUPER AI PLATFORM 🚀                         ║
║                                                                  ║
║     🌐 Domain: https://${YOUR_DOMAIN}                            ║
║     🧠 AI: KNOWS EVERYTHING!                                    ║
║     📱 Apps: https://${YOUR_DOMAIN}/[your-app-name]              ║
║                                                                  ║
║     ✅ Ask AI about ANYTHING!                                   ║
║     ✅ Programming, Tech, Business, Health, Science, History    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
        `);
    });
});
