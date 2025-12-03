# Deploying Vivi to vivi.jonschubbe.com

## Option 1: Vercel (Recommended - Easiest)

### Steps:

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   Follow the prompts. It will ask:
   - Link to existing project? (No for first time)
   - Project name: `vivi`
   - Directory: `./`
   - Override settings? (No)

4. **Add Custom Domain**:
   - Go to https://vercel.com/dashboard
   - Select your project
   - Go to Settings → Domains
   - Add `vivi.jonschubbe.com`
   - Follow DNS instructions (add CNAME record)

5. **DNS Configuration**:
   In your domain registrar (where jonschubbe.com is managed):
   - Add a CNAME record:
     - Name: `vivi`
     - Value: `cname.vercel-dns.com` (or the value Vercel provides)
   - Wait for DNS propagation (can take up to 48 hours, usually much faster)

### Production Deployment:
```bash
vercel --prod
```

---

## Option 2: Self-Hosted (Your Own Server)

### Prerequisites:
- Node.js 18+ installed on server
- PM2 or similar process manager
- Nginx or Apache for reverse proxy

### Steps:

1. **Build the app**:
   ```bash
   npm run build
   ```

2. **Start production server**:
   ```bash
   npm start
   ```
   Or with PM2:
   ```bash
   pm2 start npm --name "vivi" -- start
   ```

3. **Nginx Configuration** (create `/etc/nginx/sites-available/vivi.jonschubbe.com`):
   ```nginx
   server {
       listen 80;
       server_name vivi.jonschubbe.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Enable site and restart Nginx**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/vivi.jonschubbe.com /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

5. **SSL Certificate (Let's Encrypt)**:
   ```bash
   sudo certbot --nginx -d vivi.jonschubbe.com
   ```

---

## Option 3: Netlify

1. **Install Netlify CLI**:
   ```bash
   npm i -g netlify-cli
   ```

2. **Login and deploy**:
   ```bash
   netlify login
   netlify deploy --prod
   ```

3. **Add custom domain** in Netlify dashboard

---

## Important Notes:

- **IndexedDB**: Since Vivi uses IndexedDB (local-first), all data is stored in the user's browser. No backend database needed!
- **Environment Variables**: Currently none needed, but if you add any, set them in your hosting platform's dashboard
- **Build Command**: `npm run build`
- **Output Directory**: `.next` (handled automatically by Next.js)

## Recommended: Vercel

Vercel is the easiest option because:
- ✅ Zero configuration needed
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Automatic deployments from Git
- ✅ Built specifically for Next.js

