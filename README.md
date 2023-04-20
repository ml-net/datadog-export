# DataDog log export

Download logs from DataDog via the API and save them to your PC.\
This tool originated from an existent GitHub Project: [datadog-downloader](https://github.com/wegift/datadog-downloader) by [WeGift](https://github.com/wegift), a script that allows you to download a large number of logs matching a particular query rather than being bound by the limit of 5000 imposed on the export button in the UI.

From this base, a complete tool has been developed to automate the process, giving the user the largest flexibility in terms of input and output.
Logs are output as a file, and the format is one of the parameters (the choice is between `JSON` and `CSV`).

Fields that will be used to create the result file are fully customizable, they are one of the parameters, mandatory of course, see forward for details.

## Usage

The downloader is a container that exposes two endpoints:

- `POST http://[host]:[port]/export` for sending a download request, parameters will be passed via the `JSON` payload, if nothing goes wrong it returns the URL to call in order to download the file.

The input JSON must follow these rules:

|  Parameter  |  Mandatory  |  Description  | Allowed values  | Default Value  |
|---|---|---|---|---|
| query | YES  | The DataDog filter query. Take care when quoting on the command line, single quote the entire query for best results.  | `datadog filter string` | `none` |
| columns | YES | A list of DataDog logs attributes to include in the export, with label to assign in the export file and a default value | `JSON object` | `none`  |
| from | NO | Start date/time | `string date` | `1 day ago` |
| to | NO | End date/time | `string date` | `current timestamp` |
| pageSize | NO | How many results to download at a time, default 1000 limit of 5000 | `[1..5000]` | `1000` |
| outputFormat | NO | Format of file to write results to | `['JSON','CSV']` | `JSON` |
| outputFile | NO | Path of file to write results to (the extension is related to outputFormat) | `file name (without extension)` | `results` |
| verbose |  NO | Flag for having tool's activities logged on console | `true\|false` | `false` |

Note: Date/times are parsed by JS `Date` constructor, e.g. 2022-01-01.

The result is an `HTTP 202` status code, the body contains a link for downloading the file, this link has a validity of 36 hours, then the file will be deleted.

- `GET http://[host]:[port]/{result_file}` for getting back the exported log file. 

If the export is still in progress, you will get yet a `HTTP 202` status, if an error occurred during the export phase an `HTTP 400` will be returned, otherwise if `result_file` exists and it was created within the previous 36 hours, it will be downloaded, otherwise, you will get an `HTTP 404` error.

## How does it work

The user requests the export, the tool launches a separate process to export and create a file, and responds immediately to the user with the link, the HTTP STATUS sent is `202`. In the bucket is created immediately a `sentinel file` to represent export was started and is in progress, if any error occurred the sentinel file will be deleted and an `error file` will be created.

Both `sentinel` and `error` files have the same name as the `export` one, with the suffixes `.sem` and `.ERR` respectively.

The endpoint `GET /{filename}` will check the presence of these files, in precise order:

1. `{filename}.sem`: if the sentinel is present, the export is still in progress, a `HTTP 202` is returned, wait and retry later.
2. `{filename}.ERR`: an error occurred, a `HTTP 400` is returned.
3. `{filename}`: the sentinel was deleted, the error file is not present, so the export file may be present. If all goes right, a `HTTP 200` will be returned, and the file will be send to the client.

## Storing result files

Once created, a report file will be stored for the next 36 hours in a Cloud Storage Bucket, according to container's environment configuration.

The allowed Cloud storage providers actually are `Google` and `AWS`

## Output file's columns

Which logs data put in the export file?

The list of attributes of a Datadog log is very large and it depends on which logs channel we wants to analyze and **what** we wants to analyze, so the best answer to the question is `it depends!`.\
You have the power, you can choice what you want to have in the file.\
The log's timestamp is the only attribute that is in all results, as first information.

You are free to add whatever you want, using the `columns` attribute of the JSON payload of the command input; it's possible to define the `label` (how the information will be named in the file) and its `path` inside the Datadog logs, and optionally you can set a default value in case the information is not present in a single log entry (an empty string `""` as system default value).

The _root_ of log attributes is `attributes`, so (for example) the timestamp is referred as `attributes.timestamp`

The `columns` input attribute is an array of tuples containing label, attribute's path and optional default value if the attribute isn't found.\
The `path` must be written as a string, with an hashtag (`#`) as separator (come back to timestamp example, it should be added as `attributes#timestamp`)

## Authentication

You will need an API key and an app key to access the DataDog api.
These should be provided in environment variables as seen above.

API keys are global for a DataDog account and can be found in organization settings.
App keys are personal to your profile and can be generated in personal settings.

## Environment variables

| Variable name  | Mandatory  | Description  | Allowed values  | Example value  |
|---|---|---|---|---|
| PORT | YES | TCP Port Server puts itself to listening on | `1 .. 60000` | `8080` |
| DD_SITE | YES | DataDog site from which logs will be downloaded | `URL \| hostname` | `datadoghq.com` |
| DD_API_KEY | YES | DataDog API KEY | `API KEY string` | `aaabbbcccdddeeefff` |
| DD_APP_KEY | YES | DataDog Application KEY | `APP KEY string` | `xxxxyyyyzzzzwwww` |
| STORAGE_TYPE | YES | Cloud Storage Provider to store result files | `['GOOGLE'\,'AWS']` | `AWS`
| GOOGLE_APPLICATION_CREDENTIALS | `if STORAGE_TYPE is GOOGLE` | Path of Google's JSON credentials file | `path to json file` | `/path/to/google_credentials.json` |
| GOOGLE_BUCKET_NAME | `if STORAGE_TYPE is GOOGLE` | Bucket name to store data | `string` | `datadog_storage` |
| AWS_ACCESS_KEY_ID | `if STORAGE_TYPE is AWS` | Access Key for AWS account | `Access Key string ` | `xxxxaaaazzzzbbbbyyy` |
| AWS_SECRET_ACCESS_KEY | `if STORAGE_TYPE is AWS` | Secret for AWS account | `Secret string ` | `xxxx-aaaaz$zzzbbbbyyy` |
| AWS_BUCKET_NAME | `if STORAGE_TYPE is AWS` | Bucket name to store data | `string` | `datadog_storage` |
| AWS_REGION | `if STORAGE_TYPE is AWS` | AWS region where bucket is located | `AWS region` | `eu-north-1` |

## Local Dev

Run `npm install`.

Copy `.env.example` to `.env.production` and add a valid data.

## Run

`node index.js` to start the server (also a `npm start` does the job).

Do you want to asking for all HTTP 500 errors on `/api/*` calls on 27th March between 12 and 13 GMT, saving a CSV file, with `date, context.request.uri, context.request.headers.x-myown-header` as output, with verbose logging to console? Type

```
curl -H "Content-type: application/json" -X POST "http://localhost:8080/export" \
-d'{"query":"@context.request.uri:\/api\/* @http.status_code:500","verbose":true,"from":"2023-03-27T12:00:00.000Z","to":"2023-03-27T13:00:00.000Z","outputFormat":"csv","columns":[{"label":"URI","path":"attributes#context#request#uri"},{"label":"My Header","path":"attributes#context#request#headers#x-myown-header"}]}'
```

You will get `http://localhost:8080/1680087684088_results.csv` as response, or something similar, the prefix is timestamp of request, used for cleaning archives after the limit of 36 hours.

Calling the URL from a browser will force to download the file, otherwise you can use cUrl (according previous request)

`curl http://localhost:8080/1680087684088_results.csv -o "1680087684088_results.csv"`

to have the file stored in your computer.

## Test

The tool uses `vitest` as test suite. Run `vitest` to launch the tests, or `npm run start-dev`.
