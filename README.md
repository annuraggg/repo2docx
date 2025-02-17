# repo2docx

Convert GitHub repositories to DOCX documents with filenames in bold and underlined.

## Features

- Downloads any public GitHub repository and converts it to a single DOCX file
- Each filename appears in bold + underlined at the start of its content
- Accepts GitHub URLs or owner/repo format
- Skips binary files and common directories like node_modules
- Supports private repositories with a GitHub token
- Command-line interface for easy usage

## Installation

```bash
npm install -g repo2docx
```

## Usage

### Command Line

```bash
# Basic usage with owner/repo format
repo2docx microsoft/vscode

# Basic usage with URL format
repo2docx https://github.com/microsoft/vscode

# Specify output file
repo2docx microsoft/vscode -o vscode-docs.docx

# Specify branch
repo2docx microsoft/vscode -b development

# Use GitHub token for private repos
repo2docx yourusername/private-repo -t your-github-token

# Get help
repo2docx --help
```

### API

```javascript
const { repo2docx } = require('repo2docx');

// Basic usage with owner/repo format
repo2docx('microsoft/vscode')
  .then(filePath => console.log(`DOCX created at ${filePath}`))
  .catch(err => console.error(err));

// Basic usage with URL format
repo2docx('https://github.com/microsoft/vscode')
  .then(filePath => console.log(`DOCX created at ${filePath}`))
  .catch(err => console.error(err));

// With options
repo2docx('microsoft/vscode', 'output.docx', {
  branch: 'development',
  token: 'your-github-token',
  ignorePaths: ['node_modules', '.git', 'build']
})
  .then(filePath => console.log(`DOCX created at ${filePath}`))
  .catch(err => console.error(err));
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `repoIdentifier` | GitHub repository URL or owner/repo format | (required) |
| `outputPath` | Path where to save the DOCX file | `${owner}-${repo}.docx` |
| `options.token` | GitHub personal access token for private repos | `process.env.GITHUB_TOKEN` |
| `options.branch` | Branch to download | `'main'` |
| `options.ignorePaths` | Paths to ignore | `['node_modules', '.git']` |

## Requirements

- Node.js >= 14.0.0

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.