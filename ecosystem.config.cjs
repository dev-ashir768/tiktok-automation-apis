module.exports = {
  apps: [
    {
      name: 'tiktok-automation-apis',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
