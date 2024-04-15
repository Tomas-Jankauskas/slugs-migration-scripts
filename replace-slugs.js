/*
In case you mess up and want to have different slug names for the same translation, you can use this script to replace the slugs (adjust generateSlug function according to your needs) in the codebase.
*/

const { GettextExtractor, JsExtractors, HtmlExtractors } = gettext;

import gettext from "gettext-extractor";
import fs from "fs";
import glob from "glob";
import queue from "queue";
import SAXParser from "parse5-sax-parser";

const FILES_TO_REPLACE = "src/**/*.{ts,js,vue}";

const EXCLUDED_FOLDERS = ["node_modules", "src/types"];

const PATH_TO_REPLACED_JSON = "en_GB_new.json";

const PATH_TO_JSON_TO_REPLACE = "en_GB.json";

let allMessages = [];

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

  const enGB = JSON.parse(fs.readFileSync(PATH_TO_JSON_TO_REPLACE, "utf8"));

  allMessages.forEach((item) => {
    const key = item.text?.replace(/^['"`]|['"`]$/g, "").replace(/\s+/g, " ");

    if (enGB.hasOwnProperty(key)) {
      item.references.forEach((reference) => {
        let filePath = reference.split(":")[0];

        let newSlug = generateSlug({ value: enGB[key], path: filePath });

        if (!key.includes(".")) {
          newSlug = key;
        }

        newTranslations[newSlug] = enGB[key];

        if (EXCLUDED_FOLDERS.some((folder) => filePath.includes(folder))) {
          return; // Skip this file
        }

        let fileContent = fs.readFileSync(filePath, "utf8");

        const textRegex = new RegExp(`(?<!\\.)\\b${key}\\b`, "gs");
        if (key.includes(".")) {
          fileContent = fileContent.replace(textRegex, newSlug);
          fs.writeFileSync(filePath, fileContent);
        }

        fs.writeFileSync(
          PATH_TO_REPLACED_JSON,
          JSON.stringify(newTranslations, null, 2)
        );
      });
    }
  });
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

      templateParser.on("text", (token) => {
        let { text, attrs } = token;
        const location = token.sourceCodeLocation;

        let exprMatch;
        let lineOffset = 0;

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

glob(FILES_TO_REPLACE, (err, files) => {
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
