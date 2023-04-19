# Changelog

## Rel. 0.4.0 [2023-04-14]

Making exported file's columns customizable, as a new input arguments

## Rel. 0.3.0 [2023-04-11]

Adding test functionality

## Rel. 0.2.0 [2023-04-04]

Making request and export process separate and asynchronous. Use of sentinel and error files.

## Rel. 0.1.0 [2023-03-31]

First release, the tool works! Listening on defined port and exposes two endpoints:

- `POST /export` for requesting a datadog export, the output is the link that can be used to retrieve the file
- `GET /{filename}` for saving the export generated file