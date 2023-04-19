import * as fs from 'fs';

function uploadFile(filePath, destFileName, fail, success) {
    if (filePath.indexOf('fail') == -1) {
        success();
    } else {
        fail();
    }
}

function deleteFile(fileName) {
    return;
}

function downloadFile(fileName, fail, success) {
    if (fs.existsSync(fileName)) {
        success(fileName);
    } else {
        fail('File not found');
    }
}

export { uploadFile, downloadFile, deleteFile };