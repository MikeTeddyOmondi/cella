export const NAME = 'create-cella'
export const TEMPLATE_URL = 'github:cellajs/cella';

// Files/folders to remove from the template
export const TO_REMOVE = [
    'info',
    './cli/create-cella'
];

// Folder contents to remove from the template
export const TO_CLEAN = [
    './backend/drizzle'
];

export const TO_COPY = {
    './backend/.env.example': './backend/.env',
    './tus/.env.example': './tus/.env',
};

export const CELLA_TITLE = `
                         _ _            
    ▒▓█████▓▒     ___ ___| | | __ _
    ▒▓█   █▓▒    / __/ _ \\ | |/ _\` |
    ▒▓█   █▓▒   | (_|  __/ | | (_| |
    ▒▓█████▓▒    \\___\\___|_|_|\\__,_|
`;

// Template for the README.md file
export const README_TEMPLATE = `
# {{projectName}}
---

#### Contents
- [Requirements](#requirements)
- [Quick setup](#quick_setup)
- [Architecture](/info/ARCHITECTURE.md)
- [Roadmap](/info/ROADMAP.md)
- [Deployment](/info/DEPLOYMENT.md)

## Requirements
- Make sure you have node installed with \`node -v\`. Install Node 20.x or 22.x. (ie. [Volta](https://docs.volta.sh/guide/)).
- Ideally you work with [git over ssh](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).

## Quick setup

\`\`\`bash
pnpm quick
\`\`\`

---
Generated by **@cellajs/create-cella**.
`;