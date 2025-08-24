import fs from 'fs';
import path from 'path';

function copyJsonFiles(
    inputDir: string = path.join(__dirname, '../artifacts/contracts'),
    outputDir: string = path.join(__dirname, '../../src/contracts')
): void {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    function traverseAndCopy(inputDir: string): void {
        const files = fs.readdirSync(inputDir);

        files.forEach((file: string) => {
            const fullPath = path.join(inputDir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                traverseAndCopy(fullPath);
            } else if (
                stat.isFile() &&
                file.endsWith(".json") &&
                !file.endsWith(".dbg.json")
            ) {
                const destPath = path.join(outputDir, file);
                fs.copyFileSync(fullPath, destPath);
                console.log(`Copied: ${file}`);
            }
        });
    }

    traverseAndCopy(inputDir);
}

// Only run if this script is executed directly
if (require.main === module) {
    copyJsonFiles();
}

export { copyJsonFiles };