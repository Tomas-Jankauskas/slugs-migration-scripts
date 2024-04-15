# slugs-migration-scripts

This repository contains a set of helper functions for migrating translations from English texts to slugs. Here's a brief explanation of each script:

- `generate-slug.js`: This script generates slugs from English texts and replaces English texts to slugs them throughout the whole folder.

- `map-translations.js`: Used for generating `.json` files in other languages. Make sure write a correct path to `old-translations` folder that includes `.js` files. This script maps translations from English texts to slugs. It takes the generated slugs and maps them to their corresponding translations.

- `replace-slugs.js`: In case if you mess things up or just want to have different slugs, adjust the `generateSlug` function inside this script correspondingly and it should replace existing slugs with new ones.

- `difference.js`: This script calculates the difference between the original English texts and the generated slugs. It can be useful for debugging and verifying the accuracy of the migration process.

To install and use these scripts, follow these steps:

1. Clone the repository to your local machine:
    ```
    git clone https://github.com/your-username/slugs-migration-scripts.git
    ```

2. Navigate to the project directory:
    ```
    cd slugs-migration-scripts
    ```

3. Install the dependencies:
    ```
    npm install
    ```

4. Run the desired script using Node.js:
    ```
    node generate-slug.js
    ```

    Replace `generate-slug.js` with the name of the script you want to run.

Please note that these scripts should be used with caution and thoroughly tested before applying them to a production environment.