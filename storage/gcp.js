import * as dotenv from "dotenv";

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'production'}` });

// Imports the Google Cloud client library
import { Storage } from "@google-cloud/storage";

// Creates a client
const storage = new Storage();

const bucketName = process.env.GOOGLE_BUCKET_NAME;

async function uploadFile(filePath, destFileName, fail, success) {
    const options = {
        destination: destFileName,
    };

    await storage.bucket(bucketName).upload(filePath, options);
    success();
}

async function deleteFile(fileName) {
    await storage.bucket(bucketName).file(fileName).delete();
}

async function purgeOlderFiles(fileName) {
    let fileExists = false;
    // List all files in bucket
    const [files] = await storage.bucket(bucketName).getFiles();
    files.forEach(file => {
        if (file.name.split('_').length > 1) {
            // Delete files older than 36 hours
            let fileTime = file.name.split('_')[0];
            let expireTime = fileTime * 1 + 60 * 60 * 36 * 1000;
            let now = new Date() * 1;
            if (expireTime < now) {
                deleteFile(file.name);
            }
            // If file exists and it isn't expired we can proceed
            if (file.name == fileName && expireTime > now) {
                fileExists = true;
            }
        }
    });
    return fileExists;
}

async function downloadFile(fileName, fail, success) {
    const options = {
        destination: '/tmp/' + fileName,
    };

    // Downloads the file if it exists
    if (true === await purgeOlderFiles(fileName)) {
        await storage.bucket(bucketName).file(fileName).download(options);
        success('/tmp/' + fileName);
    } else {
        fail('File not found');
    }
}

export { uploadFile, downloadFile, deleteFile };