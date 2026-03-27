import pytest

from src.auth.commands.register_user import RegisterUserCommand, RegisterUserHandler
from src.auth.repository import UserReadRepository, UserWriteRepository
from src.auth.service import EmailAlreadyExistsError


@pytest.mark.asyncio
async def test_register_user_command(mock_db):
    write_repo = UserWriteRepository(mock_db)
    read_repo = UserReadRepository(mock_db)
    handler = RegisterUserHandler(write_repo, read_repo)

    command = RegisterUserCommand(
        email="cmd@example.com",
        password="testpassword123",
        display_name="Command User",
    )
    user_id = await handler.handle(command)
    assert user_id is not None

    doc = await read_repo.find_by_email("cmd@example.com")
    assert doc is not None
    assert doc["display_name"] == "Command User"
    assert doc["credits"] == 0


@pytest.mark.asyncio
async def test_register_user_duplicate_email(mock_db):
    write_repo = UserWriteRepository(mock_db)
    read_repo = UserReadRepository(mock_db)
    handler = RegisterUserHandler(write_repo, read_repo)

    command = RegisterUserCommand(email="dup@example.com", password="testpassword123")
    await handler.handle(command)

    with pytest.raises(EmailAlreadyExistsError):
        await handler.handle(command)
