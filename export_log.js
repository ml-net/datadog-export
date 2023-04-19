import { v2 } from "@datadog/datadog-api-client";
import * as fs from "fs";

const configuration = v2.createConfiguration();
const apiInstance = new v2.LogsApi(configuration);

import { storage } from "./storage/storage.js";

const verbose = process.env.verbose ?? false;
const outputFile = process.env.outputFile;
const outputFormat = process.env.outputFormat;
const destFileName = process.env.destFileName;

let initialParams = {};

function yesterday() {
    return new Date(new Date() - 86400000);
}

const startTime = new Date();

const columns = JSON.parse(process.env.columns);

/* 
    Performs a deep walk into an object to see if a specific key (or sub key) exists:
    - if the key was found, it returns the value
    - if the key doesn't exists, it returns null
*/
function deepCheck(rif, key) {
    let k = key.shift();
    if (rif[k] != undefined) {
        if (key.length == 0) {
            return rif[k];
        } else {
            return deepCheck(rif[k], key);
        }
    } else {
        return null;
    }
}

initialParams = {
    filterQuery: process.env.query,
    filterFrom: process.env.from ? new Date(process.env.from) : yesterday(),
    filterTo: process.env.to ? new Date(process.env.to) : new Date(),
    pageLimit: process.env.pageSize ? Math.min(process.env.pageSize, 5000) : 1000,
};

if (verbose) {
    console.log(destFileName + " *** Downloading logs:\n" + JSON.stringify(initialParams, null, 2) + "\noutputFormat: " + outputFormat + "\noutputFile: " + outputFile + "\nVerbose: " + verbose.toString() + "\n");
    console.log(destFileName + ' *** Start at ' + startTime);
}

getLogs(apiInstance, initialParams, (data) => {

    if (storage != null) {
        storage.uploadFile(outputFile, destFileName,
            (e) => {
                if (verbose) {
                    console.log(destFileName + ' *** Error occurred: ' + e);
                }
                storage.uploadFile('./semaphore', destFileName + '.ERR',
                    (e) => { },
                    () => {
                        storage.deleteFile(destFileName + '.sem');
                    }
                );
            },
            () => {
                fs.unlinkSync(outputFile, () => { });
                storage.deleteFile(destFileName + '.sem');
            }
        );
    } else {
        storage.uploadFile('./semaphore', destFileName + '.ERR',
            (e) => { },
            () => {
                storage.deleteFile(destFileName + '.sem');
            }
        );
    }

});



async function getLogs(apiInstance, params, cb) {
    let data = [];
    let contentLen = 0;
    let nextPage = null;
    let n = 0;
    try {
        if (outputFormat == "CSV") {
            let head = 'date';
            columns.forEach(c => { head += ',' + c.label });
            fs.writeFileSync(outputFile, head + "\n");
        }
        do {
            if (verbose) {
                console.log(`${destFileName} *** Requesting page ${++n}`);
            }
            const query = nextPage ? { ...params, pageCursor: nextPage } : params;
            const result = await apiInstance.listLogsGet(query);
            let csvData = "";
            result.data.forEach(tmpRow => {
                if (outputFormat == "CSV") {
                    csvData += '"' + (new Date(tmpRow.attributes.timestamp).toISOString()) + '"';
                }
                if (outputFormat == "JSON") {
                    let tmpData = { date: tmpRow.attributes.timestamp }
                }
                columns.forEach(c => {
                    let attrs = c.path.split('#');
                    let value = deepCheck(tmpRow.attributes, attrs);
                    if (typeof value == 'object') {
                        value = JSON.stringify(value);
                    }
                    if (value == null) {
                        value = c.default ? c.default.toString() : '';
                    }
                    if (outputFormat == "CSV") {
                        csvData += ',"' + value + '"';
                    }
                    if (outputFormat == "JSON") {
                        tmpData[c.label] = value;
                    }
                });
                if (outputFormat == "CSV") {
                    csvData += '\n';
                }
                if (outputFormat == "JSON") {
                    data.push(tmpData);
                }
            });
            if (outputFormat == "CSV") {
                fs.appendFileSync(outputFile, csvData);
            }
            contentLen += result.data.length;
            if (verbose) {
                console.log(`${destFileName} *** Writing ${result.data.length} logs to ${outputFile} (${contentLen} total)`);
            }
            nextPage = result?.meta?.page?.after;
        } while (nextPage);
        if (outputFormat == "JSON") {
            fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
        }
    } catch (e) {
        if (verbose) {
            console.log(destFileName + " *** An error occurred: " + e);
            fs.writeFileSync('./error', e.toString());
            storage.uploadFile('./error', destFileName + '.ERR',
                (e) => {
                    fs.unlinkSync('./error');
                },
                () => {
                    fs.unlinkSync('./error');
                    storage.deleteFile(destFileName + '.sem');
                }
            );
        }
    }
    if (verbose) {
        console.log(destFileName + " *** Process ended.");
    }
    cb(contentLen);
}