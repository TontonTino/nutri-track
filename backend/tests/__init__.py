"""
Initialisation de la suite de tests unitaires pour NUTRI-TRACK.
Garantit la résolution propre des modules que le test soit lancé depuis la racine ou depuis backend/.
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
