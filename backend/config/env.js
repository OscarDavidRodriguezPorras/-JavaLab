const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

function required(name, fallback = "") {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value;
}

const env = {
  port: Number(required("PORT", "3000")),

  google: {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    redirectUri: required("GOOGLE_REDIRECT_URI", "http://localhost:3000/api/auth/google/callback"),
    refreshToken: required("GOOGLE_REFRESH_TOKEN"),
    rootFolderId: required("GOOGLE_DRIVE_ROOT_FOLDER_ID"),
  },

  ai: {
    apiKey: required("AI_API_KEY"),
    apiUrl: required("AI_API_URL", "https://api.anthropic.com/v1/messages"),
  },

  sessionSecret: required("SESSION_SECRET", "javalab-dev-secret"),

  isGoogleConfigured() {
    return Boolean(env.google.clientId && env.google.clientSecret && env.google.refreshToken);
  },

  isAiConfigured() {
    return Boolean(env.ai.apiKey);
  },
};

module.exports = env;
