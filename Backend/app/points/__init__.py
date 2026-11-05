from flask import Blueprint

points_bp = Blueprint("points", __name__)

from . import routes  # noqa: E402, F401

