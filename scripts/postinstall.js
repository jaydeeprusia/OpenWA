const fs = require('fs');
const { execSync } = require('child_process');

if (fs.existsSync('dashboard')) {
  execSync('npm run dashboard:install', { stdio: 'inherit' });
}