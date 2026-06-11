# DataPilot Backend — Oracle Cloud Deploy Guide
# No Docker needed — direct Python deployment

## STEP 1 — Oracle Cloud VM banao

1. oracle.com/cloud/free — account banao
2. Dashboard → Compute → Instances → Create Instance
3. Settings:
   - Name: datapilot-backend
   - Image: Ubuntu 22.04
   - Shape: VM.Standard.A1.Flex (Always Free — 4 OCPU, 24GB RAM)
   - Network: Create new VCN (default settings)
   - SSH Keys: Generate aur download karo (important!)
4. Create Instance click karo
5. 2-3 min wait karo — Status: Running aane tak

---

## STEP 2 — Firewall ports open karo

Oracle Cloud mein 2 jagah firewall hoti hai:

### 2a. Security List (Oracle side):
1. Networking → Virtual Cloud Networks → tumhara VCN
2. Security Lists → Default Security List
3. Add Ingress Rules:
   - Port 8000 (FastAPI):  Source: 0.0.0.0/0, Protocol: TCP, Port: 8000
   - Port 80 (HTTP):       Source: 0.0.0.0/0, Protocol: TCP, Port: 80
   - Port 443 (HTTPS):     Source: 0.0.0.0/0, Protocol: TCP, Port: 443

### 2b. Ubuntu firewall:
```bash
sudo ufw allow 8000
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow ssh
sudo ufw enable
```

---

## STEP 3 — VM mein SSH karo

```bash
# Windows: PuTTY ya Windows Terminal
ssh -i your-key.pem ubuntu@YOUR_ORACLE_IP

# Mac/Linux:
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_ORACLE_IP
```

---

## STEP 4 — System setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python + tools
sudo apt install python3 python3-pip python3-venv git nginx -y

# Check Python version
python3 --version
```

---

## STEP 5 — Code upload karo

### Option A — GitHub se (recommended):
```bash
# VM mein:
git clone https://github.com/your-username/datapilot-backend.git
cd datapilot-backend
```

### Option B — Direct upload:
```bash
# Local machine se (new terminal):
scp -i your-key.pem -r datapilot-backend/ ubuntu@YOUR_ORACLE_IP:/home/ubuntu/
```

---

## STEP 6 — Python environment setup

```bash
cd /home/ubuntu/datapilot-backend

# Virtual environment banao
python3 -m venv venv
source venv/bin/activate

# Dependencies install karo
pip install --upgrade pip
pip install -r requirements.txt

# Test karo
python3 -c "import fastapi, pandas, sklearn; print('All OK!')"
```

---

## STEP 7 — Test run karo

```bash
# Activate venv
source /home/ubuntu/datapilot-backend/venv/bin/activate

# Run karo
cd /home/ubuntu/datapilot-backend
uvicorn main:app --host 0.0.0.0 --port 8000

# Browser mein check karo:
# http://YOUR_ORACLE_IP:8000
# http://YOUR_ORACLE_IP:8000/docs  ← Swagger UI
```

---

## STEP 8 — Systemd service (auto-start)

```bash
# Service file copy karo
sudo cp datapilot.service /etc/systemd/system/datapilot.service

# IMPORTANT: Service file mein edit karo:
sudo nano /etc/systemd/system/datapilot.service
# ExecStart line mein venv ka python use karo:
# ExecStart=/home/ubuntu/datapilot-backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
# ALLOWED_ORIGINS mein apna Vercel URL daalo

# Enable + start
sudo systemctl daemon-reload
sudo systemctl enable datapilot
sudo systemctl start datapilot

# Status check
sudo systemctl status datapilot
```

---

## STEP 9 — Nginx reverse proxy (optional but recommended)

```bash
sudo nano /etc/nginx/sites-available/datapilot
```

Paste karo:
```nginx
server {
    listen 80;
    server_name YOUR_ORACLE_IP;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 100M;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/datapilot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## STEP 10 — Frontend se connect karo

Frontend ke .env.local mein:
```
VITE_API_URL=http://YOUR_ORACLE_IP:8000
```

Ya Nginx ke baad:
```
VITE_API_URL=http://YOUR_ORACLE_IP
```

---

## USEFUL COMMANDS

```bash
# Logs dekhna
sudo journalctl -u datapilot -f

# Restart karna
sudo systemctl restart datapilot

# Stop karna
sudo systemctl stop datapilot

# Code update karna (GitHub se):
cd /home/ubuntu/datapilot-backend
git pull
sudo systemctl restart datapilot
```

---

## API ENDPOINTS

| Method | Endpoint                  | Description              |
|--------|---------------------------|--------------------------|
| POST   | /api/upload/file          | Upload dataset file      |
| POST   | /api/upload/url           | Load from URL            |
| POST   | /api/clean/process        | Clean dataset            |
| POST   | /api/clean/download       | Download cleaned CSV     |
| POST   | /api/query/run            | Run NL query             |
| POST   | /api/ml/train             | Train ML model           |
| POST   | /api/ml/predict           | Make prediction          |
| POST   | /api/ml/suggest-target    | Suggest best target col  |
| POST   | /api/forecast/run         | Time series forecast     |
| POST   | /api/forecast/detect-cols | Detect date columns      |
| POST   | /api/anomaly/detect       | Detect anomalies         |
| POST   | /api/visualize/chart-data | Get chart data           |
| POST   | /api/visualize/summary    | Statistical summary      |
| POST   | /api/dashboard/kpis       | KPI metrics              |
| POST   | /api/dashboard/insights   | Auto insights            |
| POST   | /api/export/download      | Export HTML/PDF/PPT      |
| GET    | /health                   | Health check             |
| GET    | /docs                     | Swagger UI               |
