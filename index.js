import * as dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'production'}` });

import * as fs from "fs";

import { spawn } from 'child_process';

const allowedOutputTypes = ['JSON', 'CSV', 'SEM', 'ERR'];

import { storage } from "./storage/storage.js";

function getFile(filename, cb) {
    /* Check for older files ready to be deleted */
    fs.readdir('/tmp', (err, files) => {
        if (!err) {
            files.forEach(f => {
                if (allowedOutputTypes.indexOf(f.split('.')[f.split('.').length - 1].toUpperCase()) > -1) {
                    if (f.split('_').length > 1) {
                        let fileTime = f.split('_')[0];
                        let expireTime = fileTime * 1 + 60 * 60 * 36 * 1000;
                        let now = new Date() * 1;
                        if (expireTime < now) {
                            fs.unlink('/tmp/' + f, () => {
                                console.log('Deleting ' + f + ' (expired by ' + (now - expireTime) / 1000 + ' sec.)');
                            });
                        }
                    }
                }
            });
            if (filename.indexOf('/') > -1) {
                cb({ status: 404, message: "" });
            } else {
                if (storage != null) {
                    // First of all, check if semaphore file is yet present
                    // it would mean export in progress
                    storage.downloadFile(filename + '.sem',
                        (e) => {
                            if (e == 'File not found') {
                                // ok, semaphore file is not present, check if there is
                                // the error file too
                                storage.downloadFile(filename + '.ERR',
                                    (e) => {
                                        if (e == 'File not found') {
                                            // ok, we can try to download file
                                            storage.downloadFile(filename,
                                                (e) => {
                                                    cb({ status: 404, message: e });
                                                },
                                                (fn) => {
                                                    cb({ status: 200, filePath: fn });
                                                });
                                        } else {
                                            // other error, return 400
                                            cb({ status: 404, message: e });
                                        }
                                    },
                                    (fn) => {
                                        // There is the error file, returning 400
                                        cb({ status: 404, message: "" });
                                    }
                                );
                            } else {
                                // other error, return 400
                                cb({ status: 404, message: e });
                            }
                        },
                        (fn) => {
                            // The semaphore file is yet present, so export is still in progress
                            // return HTTP 202 Accepted
                            cb({ status: 202, message: 'The export is still in progress, wait and check again later' });
                        }
                    );
                } else {
                    cb({ status: 400, message: 'Wrong Cloud Storage provider' });
                }
            }
        }
    });
}

function exportRequest(reqBody, cb) {
    const outputFormat = (reqBody.outputFormat ?? "json").toUpperCase();
    const outputFile = '/tmp/' + new Date() * 1 + '_' + (reqBody.outputFile ?? "results") + '.' + outputFormat.toLowerCase();
    const destFileName = outputFile.replace('/tmp/', '');
    const downloadURL = reqBody.baseURL + '/' + destFileName;
    const verbose = reqBody.verbose ? true : false;
    const allowedOutputTypes = ["JSON", "CSV"];

    if (!reqBody.columns) {
        cb({ status: 400, message: "Error: No columns supplied, use columns parameter" });
    }

    if (!reqBody.query) {
        cb({ status: 400, message: "Error: No query supplied, use query parameter" });
    }

    if (allowedOutputTypes.indexOf(outputFormat) == -1) {
        cb({ status: 400, message: "Error: Invalid outputFormat value, allowed ones are ['" + allowedOutputTypes.join("', '") + "']" });
    }

    if (storage != null) {
        storage.uploadFile('./semaphore', destFileName + '.sem',
            (e) => {
                cb({ status: 400, message: e.message });
            },
            () => {
                const child = spawn('node', ['./export_log.js'], {
                    stdio: ['ignore', fs.openSync('./out.log', 'a'), fs.openSync('./out.log', 'a')],
                    detached: true,
                    shell: true,
                    env: {
                        query: reqBody.query,
                        from: reqBody.from,
                        to: reqBody.to,
                        pageSize: reqBody.pageSize,
                        outputFile: outputFile,
                        outputFormat: outputFormat,
                        destFileName: destFileName,
                        verbose: verbose,
                        columns: JSON.stringify(reqBody.columns),
                        STORAGE_TYPE: process.env.STORAGE_TYPE,
                        NODE_ENV: process.env.NODE_ENV
                    },
                });
                child.on('error', (err) => { console.log(err) });
                child.unref();
                cb({ status: 202, message: downloadURL });
            }
        );
    } else {
        cb({ status: 400, message: 'Wrong Cloud Storage provider' });
    }

};

export { getFile, exportRequest };