import * as dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'production'}` });

import express from "express";
import * as Base from "./index.js";

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

const app = express();

app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.get('/:filename', (req, res) => {
  Base.getFile(req.params.filename, (response) => {
    if (response.status == 200) {
      res.sendFile(response.filePath);
    } else {
      res.status(response.status).send(response.message);
    }
  });
});

app.post('/export', (req, res) => {
  req.body.baseURL = req.protocol + '://' + req.get('host');
  Base.exportRequest(req.body, (response) => {
    res.status(response.status).send(response.message);
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Running on http://${HOST}:${PORT}`);
});