# NAS Deployment

## Prerequisites

- Synology NAS with Docker (Container Manager)
- SSH access enabled (Control Panel → Terminal & SNMP → Enable SSH)
- DDNS domain configured

## First-time Setup on NAS

1. SSH into your NAS:
   ```bash
   ssh your-user@your-nas-ddns.synology.me
   ```

2. Create deployment directory:
   ```bash
   mkdir -p /volume1/docker/gotion
   ```

3. Copy `docker-compose.nas.yml` to NAS:
   ```bash
   scp deploy/docker-compose.nas.yml your-user@your-nas:/volume1/docker/gotion/docker-compose.yml
   ```

4. Create `.env` file on NAS:
   ```bash
   cat > /volume1/docker/gotion/.env << 'EOF'
   NOTION_TOKEN=your_notion_integration_token
   NOTION_DATABASE_ID=your_database_id
   EOF
   ```

5. Log in to GHCR on NAS:
   ```bash
   echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u iocrazy --password-stdin
   ```
   (Create a PAT at github.com → Settings → Developer settings → Personal access tokens → with `read:packages` scope)

6. Start the service:
   ```bash
   cd /volume1/docker/gotion
   docker compose up -d
   ```

## GitHub Actions Secrets

Set these in your repo (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `NAS_HOST` | Your DDNS domain (e.g., `xxx.synology.me`) |
| `NAS_USER` | SSH username on NAS |
| `NAS_SSH_KEY` | SSH private key (generate with `ssh-keygen`, add public key to NAS) |
| `NAS_SSH_PORT` | SSH port (default 22) |
| `NAS_DEPLOY_PATH` | `/volume1/docker/gotion` |

## Notion Webhook

After deploying, set the Notion Database Automation webhook URL to:
```
https://your-ddns-domain:3001/api/notion/webhook
```

If port 3001 is not directly exposed, set up a reverse proxy in Synology (Control Panel → Login Portal → Advanced → Reverse Proxy).
