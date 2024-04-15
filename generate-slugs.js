/* Scans the whole folder of files and replaces (in .vue, .js and .ts files) the text with the slugs from the translations.js file.
translations.js can be any of our current language .js file that is well translated (language doesn't matter). 

! MAKE SURE your translations.js file and old-translations folder is up to date (using the latest tranlsations files)
*/

/* 
This script has a few issues (didn't have enough time to check them all):

1. In some cases it might replace just a single word in a sentence and leave the rest of it as a string, try running : src/components/Modals/HModal/Hosting/RemoveSshKeyModal.vue
2. In some cases it messes up the routes files and its naming, be careful with that 
3. Make sure to include all the components that are using the translations in the HtmlExtractors, otherwise it won't be able to extract the translations
*/

const { GettextExtractor, JsExtractors, HtmlExtractors } = gettext;

import gettext from "gettext-extractor";
import fs from "fs";
import translations from "./translations.js";
import glob from "glob";
import queue from "queue";
import SAXParser from "parse5-sax-parser";


const PATH_TO_FOLDERS = "src/**/*.{ts,js,vue}";

const MAIN_SLUG_FILE = "en_GB.json"; // file where the [slug]: "english text" will be saved

const EXCLUDED_FOLDERS = ["node_modules", "src/types"]; // exclude these

const EXCLUDED_KEYS = [
  // better to exclude these since it might replace some of the keys that are not supposed to be replaced, like statuses, icon colors, alignment props etc.
  // P.S. there are probably more than just these keys that should be excluded
  "emails",
  "email",
  "domain",
  "domains",
  "active",
  "left",
  "success",
  "danger",
  "error",
  "info",
  "pending",
  "min",
  "max",
  "card",
  "link",
  "php",
  "hosting",
];

let allMessages = [];

function escapeRegExp(string) {
  return string
    .replace(/[.*+?^$()|[\]\\]/g, "\\$&") // escape special characters
    .replace(/\n/g, "\\s*"); // replace newline with any amount of whitespace
}

const extractTextStrings = ({ code, filename }) => {
  let pattern = /'([^']*)'|"([^"]*)"|`([^`]*)`/g;
  if (!code) return;
  let matches = code.match(pattern);
  let extractedItems = matches?.filter((item) => item !== null);
  let extractedValues = [];
  extractedItems?.forEach((item) => {
    extractedValues.push({ text: item, references: [filename] });
  });
  if (!extractedValues.length) return;
  allMessages = [...allMessages, ...extractedValues];
};

const writeAndReplaceTextToSlugs = () => {
  const newTranslations = {};
  let existingSlugs = {};

  let enGB;

  try {
    enGB = JSON.parse(fs.readFileSync(MAIN_SLUG_FILE, "utf8"));
  } catch (err) {
    console.error(`Error reading or parsing file ${MAIN_SLUG_FILE}: ${err}`);
    enGB = {};
  }

  if (
    fs.existsSync(MAIN_SLUG_FILE) &&
    fs.readFileSync(MAIN_SLUG_FILE, "utf8").trim() !== ""
  ) {
    existingSlugs = enGB;
  }

  allMessages.forEach((item) => {
    const key = item.text?.replace(/^['"`]|['"`]$/g, "").replace(/\s+/g, " ");

    if (
      !!key &&
      translations.hasOwnProperty(key) &&
      !EXCLUDED_KEYS.includes(key.toLowerCase())
    ) {
      console.log(`Key already exists: ${key}`);
      item.references.forEach((reference) => {
        let filePath = reference.split(":")[0];

        const slug = generateSlug({ value: key, path: filePath });

        if (!existingSlugs.hasOwnProperty(slug)) {
          newTranslations[slug] = item.text.replace(/^['"`]|['"`]$/g, "");
        }
        item.references.forEach((reference) => {
          let filePath = reference.split(":")[0];

          // Check if the file path includes any of the exclude folders
          if (EXCLUDED_FOLDERS.some((folder) => filePath.includes(folder))) {
            return; // Skip this file
          }

          let fileContent = fs.readFileSync(filePath, "utf8");

          const textRegex = new RegExp(
            `(^|\\W)${escapeRegExp(item.text)}(\\W|$)`,
            "s"
          );

          // Replace the text in fileContent
          const slugToReplace = /['"`]/.test(item.text) ? `'${slug}'` : slug;
          fileContent = fileContent.replace(textRegex, `$1${slugToReplace}$2`);
          fs.writeFileSync(filePath, fileContent);
        });
      });
    }
  });

  // Merge existing slugs with new slugs and write to file
  const mergedSlugs = { ...existingSlugs, ...newTranslations };
  fs.writeFileSync(MAIN_SLUG_FILE, JSON.stringify(mergedSlugs, null, 2));
};

const generateSlug = ({ path, value }) => {
  // Extract the names from the path
  const pathParts = path.split("/");
  const names = pathParts.slice(1, pathParts.length - 1).map((name) => {
    // Split the name into separate words based on camel case
    const words = name.split(/(?=[A-Z])/).map((word) => word.toLowerCase());

    // Remove any empty strings
    const nonEmptyWords = words.filter((word) => word !== "");

    return nonEmptyWords.join(".");
  });

  // Process the value to remove unwanted characters and words
  let modifiedValue = value.trim().toLowerCase();
  modifiedValue = modifiedValue.replace(/<[^>]*>?|{.*?}/g, "");
  modifiedValue = modifiedValue.replace(/[^\w\s]/g, "");
  let words = modifiedValue.split(/\s+/);

  // Limit the number of words to 15
  if (words.length > 15) {
    words = words.slice(0, 15);
  }

  // Add the names to the beginning of the words array
  words = names.concat(words);

  // Join the words with dots, remove leading and trailing dots, and replace consecutive dots with a single dot
  let slug = words.join(".");
  slug = slug.replace(/^\.|\.$/g, "").replace(/\.{2,}/g, ".");

  return slug;
};
const extractAndPushTernaryExpressions = (item) => {
  const regex = /'([^']+)'/g;
  let match;
  while ((match = regex.exec(item.text)) !== null) {
    if (!match[1]) return;
    allMessages.push({ ...item, text: match[1] });
  }
};

const extractor = new GettextExtractor();
const selfClosingTags = [
  "area",
  "base",
  "br",
  "col",
  "command",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];
const parseVueFile = (filename) =>
  new Promise((resolve) => {
    const content = fs.readFileSync(filename, { encoding: "utf8" });

    const parser = new SAXParser({ sourceCodeLocationInfo: true });

    let depth = 0;

    const sectionLocations = {
      template: null,
      script: null,
    };

    // Get the location of the `template` and `script` tags, which should be top-level
    parser.on("startTag", (token) => {
      const name = token.tagName;
      const location = token.sourceCodeLocation;
      const { selfClosing } = token;

      if (depth === 0) {
        if (name === "template" || name === "script") {
          sectionLocations[name] = {
            start: location.endOffset,
            line: location.startLine,
          };
        }
      }

      if (!(selfClosing || selfClosingTags.indexOf(name) > -1)) {
        depth++;
      }
    });

    parser.on("endTag", (token) => {
      const name = token.tagName;
      const location = token.sourceCodeLocation;

      depth--;

      if (depth === 0) {
        if (name === "template" || name === "script") {
          sectionLocations[name].end = location.startOffset;
        }
      }
    });

    parser.on("end", () => {
      // Get the contents of the `template` and `script` sections, if present.
      // We're assuming that the content is inline, not referenced by an `src` attribute.
      // https://vue-loader.vuejs.org/en/start/spec.html
      let template = null;

      const snippets = [];
      const htmlSnippets = [];

      if (sectionLocations.template) {
        template = content.substr(
          sectionLocations.template.start,
          sectionLocations.template.end - sectionLocations.template.start
        );

        htmlSnippets.push({
          filename,
          code: content.substr(
            sectionLocations.template.start,
            sectionLocations.template.end - sectionLocations.template.start
          ),
          line: sectionLocations.template.line,
        });
      }

      extractTextStrings({
        filename,
        code: content,
      });

      // Parse the template looking for JS expressions
      const templateParser = new SAXParser({
        sourceCodeLocationInfo: true,
      });

      // Look for JS expressions in tag attributes
      templateParser.on("startTag", (token) => {
        const { attrs } = token;
        const location = token.sourceCodeLocation;

        for (let i = 0; i < attrs.length; i++) {
          // We're only looking for data bindings, events and directives

          const { name, text } = attrs[i];

          if (name.match(/^(:|@|v-|content)/)) {
            snippets.push({
              filename,
              code: attrs[i].value,
              line: location.attrs[name].startLine,
            });
          }
        }
      });

      // Look for interpolations in text contents.
      // We're assuming {{}} as delimiters for interpolations.
      // These delimiters could change using Vue's `delimiters` option.
      templateParser.on("text", (token) => {
        let { text, attrs } = token;
        const location = token.sourceCodeLocation;

        let exprMatch;
        let lineOffset = 0;

        // eslint-disable-next-line no-cond-assign
        while ((exprMatch = text.match(/{{([\s\S]*?)}}/))) {
          const prevLines = text
            .substr(0, exprMatch.index)
            .split(/\r\n|\r|\n/).length;
          const matchedLines = exprMatch[1].split(/\r\n|\r|\n/).length;

          lineOffset += prevLines - 1;

          snippets.push({
            code: exprMatch[1],
            line: location.startLine + lineOffset,
          });

          text = text.substr(exprMatch.index + exprMatch[0].length);

          lineOffset += matchedLines - 1;
        }
      });

      templateParser.on("end", () => {
        resolve({ htmlSnippets, snippets });
      });

      if (template) templateParser.write(template);
      templateParser.end();
    });

    parser.write(content);
    parser.end();
  });

const htmlParser = extractor.createHtmlParser([
  HtmlExtractors.elementContent("[v-trans], HListItem, HButtonV1, Trans"),
]);

const parser = extractor.createJsParser([
  JsExtractors.callExpression(["$t", "[this].$t", "i18n.t", "t", "[this].t"], {
    arguments: {
      text: 0,
      context: 1,
    },
    comments: {
      otherLineLeading: true,
      sameLineLeading: true,
      sameLineTrailing: true,
      regex: /\s*@i18n\s*(.*)/,
    },
  }),
]);

parser.parseFilesGlob("src/**/*.(ts|tsx|js|jsx)");

const q = queue({
  concurrency: 1,
});

glob(PATH_TO_FOLDERS, (err, files) => {
  if (!err) {
    files.map((filename) => {
      q.push((cb) => {
        parseVueFile(filename).then(({ htmlSnippets, snippets }) => {
          for (let i = 0; i < snippets.length; i++) {
            extractTextStrings(snippets[i].code);

            parser.parseString(snippets[i].code, filename, {
              lineNumberStart: snippets[i].line,
            });
          }

          for (let j = 0; j < htmlSnippets.length; j++) {
            htmlParser.parseString(
              htmlSnippets[j].code
                .replace(/<template/g, "<") // for some reason parser doesn't work if you include multiple nested <template> tags
                .replace(/<\/template/g, "</"),
              filename,
              {
                lineNumberStart: htmlSnippets[j].line,
              }
            );
          }

          cb();
        });
      });
    });

    q.start((err) => {
      if (!err) {
        allMessages = [...allMessages, ...extractor.getMessages()];

        allMessages.forEach((item) => {
          if (item.text.includes("{{")) {
            extractAndPushTernaryExpressions(item);

            return;
          }
        });

        writeAndReplaceTextToSlugs();
      }
    });
  }
});
