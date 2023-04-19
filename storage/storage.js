import * as dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'production'}` });

let storage = null;
let storageSrc = '';
switch (process.env.STORAGE_TYPE.toUpperCase()) {
    case 'GOOGLE':
        storageSrc = './gcp.js';
        break;
    case 'AWS':
        storageSrc = './aws.js';
        break;
    case 'TEST':
        storageSrc = './testStorage.js';
        break;
    default:
        storageSrc = '';
        break;
}

if (storageSrc != '') {
    storage = await import(storageSrc);
}

export { storage };