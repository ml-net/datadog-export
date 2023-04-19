import * as dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
import { describe, expect, test } from 'vitest';
import * as Index from '../index';
import * as storage from '../storage/testStorage';
import * as fs from "fs";

describe("Cloud storage interface test", () => {

    test("Successful upload file to storage bucket", () => {
        let result;
        storage.uploadFile('/path/to/file', 'destPathFile', () => { result = false }, () => { result = true });
        expect(result).toBeTruthy();
    })

    test("Failing upload file to storage bucket", () => {
        let result;
        storage.uploadFile('/path/to/failing/file', 'destPathFile', () => { result = false }, () => { result = true });
        expect(result).toBeFalsy();
    })

});

describe("Endpoint test", () => {

    test("Trying getting file with export process still in progress", () => {
        fs.writeFileSync('./test', 'test');
        fs.writeFileSync('./test.sem', 'test');
        Index.getFile('test', (data) => {
            expect(data.status).toEqual(202);
            fs.unlinkSync('./test');
            fs.unlinkSync('./test.sem');
        });
    });

    test("Failing getting file with error file", () => {
        fs.writeFileSync('./test1', 'test');
        fs.writeFileSync('./test1.ERR', 'test');
        Index.getFile('test1', (data) => {
            expect(data.status).toEqual(404);
            fs.unlinkSync('./test1');
            fs.unlinkSync('./test1.ERR');
        });
    });

    test("Getting file", () => {
        fs.writeFileSync('./test2', 'test');
        Index.getFile('test2', (data) => {
            expect(data.status).toEqual(200);
            fs.unlinkSync('./test2');
        });
    });

    test("Failing getting non existent file", () => {
        Index.getFile('test_to_fail', (data) => {
            expect(data.status).toEqual(404);
        });
    });

});
