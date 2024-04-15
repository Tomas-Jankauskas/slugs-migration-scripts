/* This script will compare two JSON files and log the keys that are in the first file but not in the second file. */

import fs from "fs";

const PATH_TO_JSON_1 = "en_GB.json";
const PATH_TO_JSON_2 = "./new-translations/es_MX.json";
// Read and parse the JSON files

const file1 = JSON.parse(fs.readFileSync(PATH_TO_JSON_1, "utf8"));
const file2 = JSON.parse(fs.readFileSync(PATH_TO_JSON_2, "utf8"));

// Get the keys from each file
const keys1 = Object.keys(file1);
const keys2 = new Set(Object.keys(file2));

// Find and log the keys that are in file1 but not in file2
const difference = keys1.filter((key) => !keys2.has(key));
console.log(difference);
