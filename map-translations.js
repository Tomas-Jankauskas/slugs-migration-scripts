/* Map old translation files to new JSON files */

import fs from "fs";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const PATH_TO_JS_TRANLATIONS = "./old-translations";

const PATH_TO_NEW_JSON_TRANSLATIONS = "./new-translations";

// Read and parse en_GB.json
const enGB = JSON.parse(fs.readFileSync("en_GB.json", "utf8"));
const __dirname = dirname(fileURLToPath(import.meta.url));

// Get a list of all old translation files
const oldTranslationFiles = fs.readdirSync(PATH_TO_JS_TRANLATIONS);

const processFile = async (file) => {
  // Import the old translation file
  const locale = file.split(".")[0];
  const oldTranslation = await import(
    path.join(__dirname, PATH_TO_JS_TRANLATIONS, file)
  );

  // Create a new object where the keys are the slugs from en_GB.json and the values are the corresponding values from the old translation file
  const newTranslation = {};
  for (const [slug, text] of Object.entries(enGB)) {
    newTranslation[slug] = oldTranslation.default[locale][text];
  }

  const dir = PATH_TO_NEW_JSON_TRANSLATIONS;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write this new object to a new JSON file with the same name as the old translation file
  fs.writeFileSync(
    path.join(dir, file.replace(".js", ".json")),
    JSON.stringify(newTranslation, null, 2)
  );
};

// Process all files in parallel
Promise.all(oldTranslationFiles.map((file) => processFile(file)))
  .then(() => console.log("All files processed."))
  .catch((err) => console.error(err));
