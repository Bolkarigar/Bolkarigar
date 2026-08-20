// ecosystem.config.js
// PM2 process manager config — server crash ho jaye to bhi auto-restart
// ho jayega, aur port-already-in-use jaisi dikkatein bhi kam hongi kyunki
// PM2 hamesha ek hi instance chalne deta hai aur cleanly manage karta hai.
//
// Setup (ek baar):
//   npm install -g pm2
//
// Start:
//   pm2 start ecosystem.config.js
//
// Useful commands:
//   pm2 status              -> chal raha hai ki nahi dekho
//   pm2 logs bolkarigar     -> live logs dekho
//   pm2 restart bolkarigar  -> manually restart
//   pm2 stop bolkarigar     -> band karo
//   pm2 delete bolkarigar   -> PM2 ki list se hata do
//   pm2 save                -> current process list save karo
//   pm2 startup             -> system reboot hone par bhi auto-start ho (one-time setup)

module.exports = {
  apps: [
    {
      name: 'bolkarigar',
      script: 'server.js',
      instances: 1,
      autorestart: true,        // crash hone par khud restart
      watch: false,              // production mein file-watch off (dev mein chaho to true karo)
      max_memory_restart: '500M',// memory leak se bachne ke liye safety net
      restart_delay: 2000,       // crash loop se bachne ke liye 2 sec wait restart se pehle
      max_restarts: 10,          // 10 restart ke baad rukk jayega (infinite crash-loop na ho)
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      time: true                 // logs mein timestamp
    }
  ]
};
