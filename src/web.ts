import express from 'express';
import bodyParser from 'body-parser';
import { resolve } from 'path';

export const app = express();

const port = process.env.PORT || 8080;

app.use(express.static(resolve(__dirname, '../static')))
app.use(bodyParser.json());

app.listen(port);