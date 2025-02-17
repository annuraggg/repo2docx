#!/usr/bin/env node

const { repo2docx } = require("./index");
const fs = require("fs");
const path = require("path");

// Helper function to display usage information
function printUsage() {
  console.log(
    `
    Usage: repo2docx <repository> [options]
    
    Arguments:
      repository              GitHub repository URL or owner/repo format
                              Examples: https://github.com/microsoft/vscode
                                        microsoft/vscode
    
    Options:
      -o, --output <path>     Output file path (default: <owner>-<repo>.docx)
      -b, --branch <branch>   Repository branch (default: main)
      -t, --token <token>     GitHub personal access token
      -i, --ignore <path>     Path to local .docxignore file (optional)
      -h, --help              Display this help message
      -v, --version           Display version information
    
    Examples:
      repo2docx microsoft/vscode
      repo2docx https://github.com/microsoft/vscode
      repo2docx microsoft/vscode -o vscode-docs.docx
      repo2docx microsoft/vscode -b development -t <your-token>
      repo2docx microsoft/vscode -i ./.docxignore
    
    Notes:
      - The tool will automatically look for a .docxignore file in the repository
      - You can provide a local .docxignore file with the -i/--ignore option
      - Common non-source files (node_modules, .git, etc.) are ignored by default
    `
  );
}

// Helper function to display version information
function printVersion() {
  const packageInfo = require("./package.json");
  console.log(`repo2docx v${packageInfo.version}`);
}

// Helper function to read a local .docxignore file
function readLocalDocxIgnore(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const patterns = content
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => line.trim());

    console.log(
      `Read ${patterns.length} patterns from local .docxignore file: ${filePath}`
    );
    return patterns;
  } catch (error) {
    console.error(`Failed to read local .docxignore file: ${error.message}`);
    return [];
  }
}

// Process command line arguments
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  if (args.includes("-v") || args.includes("--version")) {
    printVersion();
    process.exit(0);
  }

  // Extract repository identifier
  const repoIdentifier = args[0];

  if (!repoIdentifier) {
    console.error("Error: Repository argument is required");
    printUsage();
    process.exit(1);
  }

  // Process options
  let outputPath = null;
  let branch = "main";
  let token = process.env.GITHUB_TOKEN;
  let localIgnorePath = null;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-o" || arg === "--output") {
      outputPath = args[i + 1];
      i++;
    } else if (arg === "-b" || arg === "--branch") {
      branch = args[i + 1];
      i++;
    } else if (arg === "-t" || arg === "--token") {
      token = args[i + 1];
      i++;
    } else if (arg === "-i" || arg === "--ignore") {
      localIgnorePath = args[i + 1];
      i++;
    }
  }

  try {
    // Process local .docxignore if provided
    let ignorePaths = [];
    if (localIgnorePath) {
      ignorePaths = readLocalDocxIgnore(localIgnorePath);
    }

    console.log(`Converting GitHub repository ${repoIdentifier} to DOCX...`);

    const filePath = await repo2docx(repoIdentifier, outputPath, {
      token,
      branch,
      ignorePaths,
    });

    console.log(`✅ DOCX file created at: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
