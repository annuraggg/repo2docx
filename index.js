// index.js - Main entry point of the package
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
  HeadingLevel,
} = require("docx");
const { Octokit } = require("@octokit/rest");
const axios = require("axios");
const AdmZip = require("adm-zip");
const { minimatch } = require("minimatch");

/**
 * Parse a GitHub repository URL or owner/repo format
 * @param {string} repoIdentifier - GitHub URL or owner/repo string
 * @returns {Object} - { owner, repo }
 */
function parseRepoIdentifier(repoIdentifier) {
  // Check if it's a URL
  if (repoIdentifier.includes("github.com")) {
    // Remove protocol and www if present
    const urlPath = repoIdentifier
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\.git$/, "") // Remove .git extension if present
      .split("/");

    if (urlPath.length >= 2) {
      return {
        owner: urlPath[0],
        repo: urlPath[1],
      };
    }
  } else if (repoIdentifier.includes("/")) {
    // It's in the format owner/repo
    const [owner, repo] = repoIdentifier.split("/");
    if (owner && repo) {
      return { owner, repo };
    }
  }

  throw new Error(
    "Invalid repository identifier. Please use a GitHub URL (https://github.com/owner/repo) or owner/repo format."
  );
}

/**
 * Check if content is valid text (not binary)
 * @param {string} content - File content as string
 * @returns {boolean} - True if content is valid text
 */
function isValidTextContent(content) {
  // Check if content contains too many null bytes or other indicators of binary data
  const nullByteRatio = (content.match(/\0/g) || []).length / content.length;
  return nullByteRatio < 0.01; // Threshold for determining binary content
}

/**
 * Add file content as multiple paragraphs
 * @param {string} content - File content
 * @param {Array} children - Array of document children
 */
function addFileContent(content, children) {
  // Split by line breaks and create separate paragraphs
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    children.push(
      new Paragraph({
        text: line || " ", // Empty line as space to maintain formatting
      })
    );
  }
}

/**
 * Check if a file is likely binary
 * @param {string} filename - File name
 * @returns {boolean} - True if file is binary
 */
function isBinaryFile(filename) {
  const binaryExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".ico",
    ".pdf",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".7z",
    ".mp3",
    ".mp4",
    ".avi",
    ".mov",
    ".mpg",
    ".ttf",
    ".woff",
    ".class",
    ".pyc",
    ".pyd",
    ".o",
    ".obj",
  ];

  return binaryExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
}

/**
 * Parse .docxignore file and get patterns
 * @param {string} content - Content of .docxignore file
 * @returns {Array<string>} - Array of ignore patterns
 */
function parseDocxIgnore(content) {
  if (!content) return [];

  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#")) // Remove comments and empty lines
    .map((line) => line.trim());
}

/**
 * Check if path should be ignored based on ignore patterns
 * @param {string} filePath - Path to check
 * @param {Array<string>} ignorePatterns - Array of ignore patterns
 * @returns {boolean} - True if path should be ignored
 */
function shouldIgnorePath(filePath, ignorePatterns) {
  for (const pattern of ignorePatterns) {
    if (minimatch(filePath, pattern, { matchBase: true })) {
      return true;
    }
  }
  return false;
}

/**
 * Generate default ignore patterns for common non-source files
 * @returns {Array<string>} - Array of default ignore patterns
 */
function getDefaultIgnorePatterns() {
  return [
    // Version control
    ".git/**",
    ".gitignore",
    ".gitattributes",
    ".gitmodules",
    ".gitkeep",
    ".github/**",

    // Node.js
    "node_modules/**",
    "package-lock.json",
    "yarn.lock",
    "npm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*",

    // IDE and editor files
    ".vscode/**",
    ".idea/**",
    "*.sublime-*",
    ".editorconfig",

    // Build and configuration files
    "dist/**",
    "build/**",
    "out/**",
    ".babelrc",
    ".eslintrc*",
    ".prettierrc*",
    "tsconfig.json",
    "jsconfig.json",
    "webpack.config.js",
    "rollup.config.js",

    // Logs and temporary files
    "logs/**",
    "*.log",
    "temp/**",
    "tmp/**",

    // Documentation
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "LICENSE.md",
    "AUTHORS",
    "CONTRIBUTORS",

    // OS specific files
    ".DS_Store",
    "Thumbs.db",
  ];
}

/**
 * Convert a GitHub repository to a DOCX file
 * @param {string} repoIdentifier - GitHub URL or owner/repo string
 * @param {string} [outputPath] - Path where to save the DOCX file
 * @param {Object} [options] - Additional options
 * @param {string} [options.token] - GitHub personal access token for private repos
 * @param {string} [options.branch] - Branch to download (default: 'main')
 * @param {Array<string>} [options.ignorePaths] - Additional paths to ignore
 * @returns {Promise<string>} - Path to the created DOCX file
 */
async function repo2docx(repoIdentifier, outputPath = null, options = {}) {
  // Parse the repository identifier (URL or owner/repo)
  const { owner, repo } = parseRepoIdentifier(repoIdentifier);

  const {
    token = process.env.GITHUB_TOKEN,
    branch = "main",
    ignorePaths = [],
  } = options;

  try {
    // Set default output path if not provided
    if (!outputPath) {
      outputPath = `${owner}-${repo}.docx`;
    }

    // Initialize Octokit with token if available
    const octokit = new Octokit({
      auth: token,
    });

    // Get repository info to confirm it exists
    await octokit.repos.get({
      owner,
      repo,
    });

    // Get repository archive
    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;

    const headers = {};
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    console.log(`Downloading ${owner}/${repo} (${branch} branch)...`);
    const response = await axios.get(zipUrl, {
      responseType: "arraybuffer",
      headers,
    });

    console.log(`Extracting repository archive...`);
    const zip = new AdmZip(Buffer.from(response.data));
    const zipEntries = zip.getEntries();

    // Look for .docxignore file
    let customIgnorePatterns = [];
    const docxIgnoreEntry = zipEntries.find((entry) =>
      entry.entryName.endsWith(`${repo}-${branch}/.docxignore`)
    );

    if (docxIgnoreEntry) {
      const docxIgnoreContent = docxIgnoreEntry.getData().toString("utf8");
      customIgnorePatterns = parseDocxIgnore(docxIgnoreContent);
      console.log(
        `Found .docxignore file with ${customIgnorePatterns.length} patterns`
      );
    }

    // Combine default ignore patterns with custom ones
    const defaultIgnorePatterns = getDefaultIgnorePatterns();
    const allIgnorePatterns = [
      ...defaultIgnorePatterns,
      ...customIgnorePatterns,
      ...ignorePaths,
    ];

    console.log(
      `Using ${allIgnorePatterns.length} ignore patterns (${defaultIgnorePatterns.length} default, ${customIgnorePatterns.length} from .docxignore, ${ignorePaths.length} from options)`
    );

    // Prepare document children
    const children = [];

    // Add title page
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        text: `Repository: ${owner}/${repo}`,
        spacing: {
          after: 400,
        },
      })
    );

    children.push(
      new Paragraph({
        text: `Branch: ${branch}`,
        spacing: {
          after: 200,
        },
      })
    );

    children.push(
      new Paragraph({
        text: `Generated on: ${new Date().toLocaleString()}`,
        spacing: {
          after: 800,
        },
      })
    );

    // Process tracking
    let processedFiles = 0;
    let skippedFilesByIgnore = 0;
    let skippedFilesByBinary = 0;
    let skippedFilesByValidation = 0;
    let skippedFilesByError = 0;

    console.log(`Processing repository files...`);

    // Process all files in the repository
    for (const entry of zipEntries) {
      if (!entry.isDirectory) {
        // Get clean file path (remove the repo-branch prefix)
        const cleanPath = entry.entryName.replace(`${repo}-${branch}/`, "");

        // Check if the path should be ignored based on patterns
        if (shouldIgnorePath(cleanPath, allIgnorePatterns)) {
          skippedFilesByIgnore++;
          if (skippedFilesByIgnore % 50 === 0) {
            console.log(
              `Skipped ${skippedFilesByIgnore} files based on ignore patterns`
            );
          }
          continue;
        }

        // Check if file is binary
        if (isBinaryFile(cleanPath)) {
          skippedFilesByBinary++;
          continue;
        }

        try {
          // Extract the file content
          const content = entry.getData().toString("utf8");

          // Skip if not valid text content
          if (!isValidTextContent(content)) {
            skippedFilesByValidation++;
            continue;
          }

          // Add file name as bold and underlined heading
          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              text: cleanPath,
              spacing: {
                before: 400,
                after: 200,
              },
              bold: true,
              underline: {
                type: UnderlineType.SINGLE,
              },
            })
          );

          // Add file content as multiple paragraphs
          addFileContent(content, children);

          // Add a separator
          children.push(
            new Paragraph({
              text: "----------------------------------------------------------------------",
              spacing: {
                after: 200,
              },
            })
          );

          processedFiles++;
          if (processedFiles % 25 === 0) {
            console.log(`Processed ${processedFiles} files...`);
          }
        } catch (error) {
          // If we can't process this file, just skip it
          console.warn(
            `Could not process file ${entry.entryName}:`,
            error.message
          );
          skippedFilesByError++;
        }
      }
    }

    console.log(`\nFile processing summary:`);
    console.log(`- Processed: ${processedFiles} files`);
    console.log(`- Skipped (ignore patterns): ${skippedFilesByIgnore} files`);
    console.log(`- Skipped (binary): ${skippedFilesByBinary} files`);
    console.log(`- Skipped (validation): ${skippedFilesByValidation} files`);
    console.log(`- Skipped (errors): ${skippedFilesByError} files`);
    console.log(`\nCreating DOCX document...`);

    // Create document with one section containing all children
    const doc = new Document({
      creator: "repo2docx",
      title: `${owner}/${repo} Repository`,
      description: `Generated from GitHub repository ${owner}/${repo}`,
      sections: [
        {
          properties: {},
          children: children,
        },
      ],
    });

    // Generate the DOCX file
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);

    console.log(`Successfully created ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("Error creating DOCX from repository:", error);
    throw error;
  }
}

module.exports = { repo2docx };
