from flask import Blueprint

pool_bp = Blueprint("pool", __name__)

from . import routes  # noqa: E402, F401

