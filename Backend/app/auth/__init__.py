from flask import Blueprint

auth_bp = Blueprint("auth", __name__)

# Import routes so they register on the blueprint
from . import routes  

