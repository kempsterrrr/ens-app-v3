import fs from 'fs';
import { Buffer } from 'node:buffer';
import TurboDeploy from './turbo.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function parseWallet(input) {
    try {
        return JSON.parse(input);
    } catch {
        try {
            return JSON.parse(Buffer.from(input, 'base64').toString('utf-8'));
        } catch {
            throw new Error('Invalid wallet format. Must be JSON or base64 encoded JSON');
        }
    }
}

async function deploy() {
    const walletPath = path.join(projectRoot, 'wallet.json');
    
    if (!fs.existsSync(walletPath)) {
        console.error('wallet.json not found in project root');
        process.exit(1);
    }
    
    // Check if Next.js build has been run
    const outputDir = path.join(projectRoot, 'out');
    if (!fs.existsSync(outputDir)) {
        console.error(`Next.js build output not found in ${outputDir}`);
        console.error('Run "npm run build" or "yarn build" first');
        process.exit(1);
    }

    try {
        console.log('Starting deployment to Arweave...');
        const walletData = fs.readFileSync(walletPath, 'utf8');
        const jwk = parseWallet(walletData);
        
        const manifestId = await TurboDeploy(jwk);
        console.log(`\nDeployment Complete! 🎉`);
        console.log(`View your ENS app at: https://arweave.net/${manifestId}\n`);
        
        // Save the deployment info
        const deployInfo = {
            timestamp: new Date().toISOString(),
            manifestId,
            url: `https://arweave.net/${manifestId}`
        };
        
        fs.writeFileSync(
            path.join(projectRoot, 'last-deployment.json'), 
            JSON.stringify(deployInfo, null, 2)
        );
        
        return manifestId;
    } catch (e) {
        console.error('Deployment failed:', e);
        process.exit(1);
    }
}

// Run the deployment if this script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    deploy();
}

export default deploy;
