module.exports = {
  apps: [{
    name: 'claude-api',
    script: './server.js',
    
    // Process management
    instances: 'max',
    exec_mode: 'cluster',
    
    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    
    // Logging
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Restart configuration
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    
    // Memory management
    max_memory_restart: '1G',
    
    // Watch for file changes (disable in production)
    watch: false,
    ignore_watch: ['node_modules', 'logs', '.git'],
    
    // Advanced features
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: false,
    
    // Source maps support
    source_map_support: true,
    
    // Node.js arguments
    node_args: '--max-old-space-size=2048'
  }]
};
