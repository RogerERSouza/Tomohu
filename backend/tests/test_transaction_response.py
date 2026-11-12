from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import PASSWORD


def test_login_session_is_committed_before_response_starts(client):
    credentials = {"email": "boundary@example.com", "password": PASSWORD}
    assert client.post("/api/v1/auth/register", json=credentials).status_code == 201
    observed = []

    async def inspect_response(scope, receive, send):
        async def inspect(message):
            if message["type"] == "http.response.start":
                with client.app.state.engine.connect() as connection:
                    observed.append(
                        connection.execute(
                            text("SELECT count(*) FROM auth_sessions")
                        ).scalar_one()
                    )
            await send(message)

        await client.app(scope, receive, inspect)

    response = TestClient(inspect_response).post("/api/v1/auth/login", json=credentials)
    assert response.status_code == 200
    assert observed == [1]
