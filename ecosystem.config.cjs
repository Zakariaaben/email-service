module.exports = {
    apps: [{
        name: 'mail-service',
        cwd: '.',
        script: 'dist/index.js',
        interpreter: 'node',
        env: { NODE_ENV: 'production' },
        env_production: {},
        watch: false,
        time: true,
        max_restarts: 5,
    }],
};
