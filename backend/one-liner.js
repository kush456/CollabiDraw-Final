// encode-service-account.js
const fs = require("fs");

const json = require("./serviceAccountKey.json"); // path to your local file
const oneLine = JSON.stringify(json).replace(/\n/g, "\\n");

console.log(oneLine);
