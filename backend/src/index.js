const path = require('path');
const fs = require('fs');

// Load root .env file before Strapi initializes
function findRootEnv() {
  // Get backend directory (where this file is located)
  const backendDir = __dirname;
  // Go up two levels to get to root (backend/src -> backend -> root)
  const rootPath = path.resolve(backendDir, '../../');
  const rootEnvPath = path.join(rootPath, '.env');
  
  if (fs.existsSync(rootEnvPath)) {
    require('dotenv').config({ path: rootEnvPath });
    return rootEnvPath;
  }
  
  // Fallback to backend/.env if root doesn't exist
  const backendEnvPath = path.join(path.resolve(backendDir, '..'), '.env');
  if (fs.existsSync(backendEnvPath)) {
    require('dotenv').config({ path: backendEnvPath });
    return backendEnvPath;
  }
  
  // Last resort: try current working directory
  const cwdEnvPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(cwdEnvPath)) {
    require('dotenv').config({ path: cwdEnvPath });
    return cwdEnvPath;
  }
  
  return null;
}

// Load environment variables from root .env
findRootEnv();

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap(/*{ strapi }*/) {},
};

