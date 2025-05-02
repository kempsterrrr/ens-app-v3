import { TurboFactory } from '@ardrive/turbo-sdk';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';

async function getContentType(filePath) {
    return mime.lookup(filePath) || 'application/octet-stream';
}

export default async function TurboDeploy(jwk) {
    const turbo = TurboFactory.authenticated({ privateKey: jwk });
    // Next.js static output directory
    const deployFolder = './out';

    let manifest = {
        manifest: 'arweave/paths',
        version: '0.2.0',
        index: { path: 'index.html' },
        paths: {}
    };

    async function processFiles(dir) {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const relativePath = path.relative(deployFolder, filePath)
                .split(path.sep)
                .join('/');

            // Handle empty relative path (root directory)
            const pathKey = relativePath === '' ? '/' : relativePath;

            if (fs.statSync(filePath).isDirectory()) {
                await processFiles(filePath);
                continue;
            }

            console.log(`Uploading: ${relativePath}`);
            const uploadResult = await turbo.uploadFile({
                fileStreamFactory: () => fs.createReadStream(filePath),
                fileSizeFactory: () => fs.statSync(filePath).size,
                dataItemOpts: {
                    tags: [{ 
                        name: 'Content-Type', 
                        value: await getContentType(filePath) 
                    }],
                },
            });

            manifest.paths[pathKey] = { id: uploadResult.id };
        }
    }

    if (!fs.existsSync(deployFolder)) {
        throw new Error('Output folder not found. Run "npm run build" or "yarn build" first.');
    }

    await processFiles(deployFolder);

    // Next.js generates index.html at the root
    if (manifest.paths['index.html']) {
        manifest.index.path = 'index.html';
    }

    // Map 404 page for proper error handling
    if (manifest.paths['404.html']) {
        manifest.paths['404'] = { id: manifest.paths['404.html'].id };
    }

    console.log('Creating manifest...');
    const manifestResult = await turbo.uploadFile({
        fileStreamFactory: () => Buffer.from(JSON.stringify(manifest, null, 2)),
        fileSizeFactory: () => Buffer.from(JSON.stringify(manifest, null, 2)).length,
        dataItemOpts: {
            tags: [{
                name: 'Content-Type',
                value: 'application/x.arweave-manifest+json'
            }],
        },
    });

    return manifestResult.id;
}
