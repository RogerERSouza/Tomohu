from datetime import UTC, datetime, timedelta

import jwt

from tests.conftest import PASSWORD


def test_expired_bearer_logout_does_not_revoke_browser_renewal(client):
    payload = {"email": "audit@example.com", "password": PASSWORD}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    trusted = {"Origin": "http://localhost:5173", "X-Tomohu-Request": "1"}
    login = client.post("/api/v1/auth/browser/login", json=payload, headers=trusted)
    assert login.status_code == 200
    claims = jwt.decode(
        login.json()["access_token"], options={"verify_signature": False}
    )
    claims["exp"] = datetime.now(UTC) - timedelta(seconds=1)
    expired = jwt.encode(
        claims, client.app.state.settings.jwt_secret, algorithm="HS256"
    )
    assert (
        client.post(
            "/api/v1/auth/logout", headers={"Authorization": "Bearer " + expired}
        ).status_code
        == 401
    )
    # No successful cookie logout occurred, so the renewable session still works.
    assert (
        client.post("/api/v1/auth/browser/refresh", headers=trusted).status_code == 200
    )
