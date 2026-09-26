# Dockerfile pour NUTRI-DÉPIST Backend API
FROM python:3.13-slim

WORKDIR /app

# Copier et installer les dépendances
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier l'application
COPY . .

# Exposer le port 8000
EXPOSE 8000

# Commande de démarrage avec Uvicorn
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
