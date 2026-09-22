import os

from app import create_app
from app.extensions import db
from app.seed import seed_demo_data
from config import DATABASE_DIR

app = create_app()

with app.app_context():
    os.makedirs(DATABASE_DIR, exist_ok=True)
    db.create_all()
    seed_demo_data()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
