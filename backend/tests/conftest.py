import os
import tempfile
from pathlib import Path

import pytest

# Les tests travaillent sur une copie neuve de l'ontologie, jamais sur le fichier partagé.
_tmpdir = tempfile.mkdtemp(prefix="nexora-tests-")
os.environ["NEXORA_ONTOLOGY"] = str(Path(_tmpdir) / "nexora-test.owl")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
