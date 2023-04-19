import * as dotenv from "dotenv";
import * as fs from "fs";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'production'}` });

const client = new S3Client({})

async function uploadFile(filePath, destFileName, fail, success) {
    let data = fs.readFileSync(filePath);

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: destFileName,
        Body: Buffer.from(data)
    });

    try {
        const response = await client.send(command);
        success();
    } catch (err) {
        fail(err);
    }
};

async function purgeOlderFiles(fileName) {
    const command = new ListObjectsV2Command({
        Bucket: process.env.AWS_BUCKET_NAME,
        MaxKeys: 20,
    });
    let fileExists = false;
    try {
        let isTruncated = true;
        // List all files in bucket
        while (isTruncated) {
            const { Contents, IsTruncated, NextContinuationToken } = await client.send(command);
            Contents.forEach(file => {
                if (file.Key.split('_').length > 1) {
                    // Delete files older than 36 hours
                    let fileTime = file.Key.split('_')[0];
                    let expireTime = fileTime * 1 + 60 * 60 * 36 * 1000;
                    let now = new Date() * 1;
                    if (expireTime < now) {
                        deleteFile(file.Key);
                    }
                    // If file exists and it isn't expired we can proceed
                    if (file.Key == fileName && expireTime > now) {
                        fileExists = true;
                    }
                }
            })
            isTruncated = IsTruncated;
            command.input.ContinuationToken = NextContinuationToken;
        }
    } catch (err) {
        fileExists = false;
    }
    return fileExists;
}

async function deleteFile(fileName) {
    const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName
    });

    try {
        await client.send(command);
    } catch (err) {
        console.error(err);
    }
}

async function downloadFile(fileName, fail, success) {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName
    });

    try {
        // Downloads the file if it exists
        if (true === await purgeOlderFiles(fileName)) {
            const response = await client.send(command);
            const str = await response.Body.transformToByteArray();
            fs.writeFileSync('/tmp/' + fileName, Buffer.from(str));
            success('/tmp/' + fileName);
        } else {
            fail('File not found');
        }
    } catch (err) {
        fail(err);
    }
};

export { uploadFile, downloadFile, deleteFile }