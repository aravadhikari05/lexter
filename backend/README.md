**SETUP**
* cd backend
* python3 -m venv .venv
* source .venv/bin/activate
* python3 -m pip install --upgrade pip
* pip install -r requirements.txt

**RUNNING**
* cd backend
* make sure .venv is activated if not: source .venv/bin/activate
* run uvicorn app.main:app --reload