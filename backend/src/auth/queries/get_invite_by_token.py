from src.auth.repository import (
    AuthReadRepository,
    EmailVerificationTokenRepository,
    ThrottleRepository,
)
from src.auth.schemas import InviteLookupResponse
from src.auth.service import TooManyInviteRequestsError, load_invite
from src.core.config import settings
from src.cqrs.queries import BaseQuery, QueryHandler


class GetInviteByTokenQuery(BaseQuery):
    token: str
    # Throttle key. None (handler-level tests) skips the per-IP limit.
    client_ip: str | None = None


class GetInviteByTokenHandler(QueryHandler[GetInviteByTokenQuery, InviteLookupResponse]):
    """What the accept-invite page shows before the invitee types anything: the
    address the invite is for, or the 400/410 for a dead link. Never consumes.
    Public and token-authenticated, so it shares accept-invite's per-IP throttle."""

    def __init__(
        self,
        read_repo: AuthReadRepository,
        verification_token_repo: EmailVerificationTokenRepository,
        throttle_repo: ThrottleRepository,
    ) -> None:
        self._read_repo = read_repo
        self._verification_token_repo = verification_token_repo
        self._throttle_repo = throttle_repo

    async def handle(self, query: GetInviteByTokenQuery) -> InviteLookupResponse:
        if query.client_ip is not None and await self._throttle_repo.is_over_limit(
            query.client_ip,
            settings.login_rate_limit_window_seconds,
            settings.login_rate_limit_max_attempts,
        ):
            raise TooManyInviteRequestsError()

        _, user_doc = await load_invite(
            query.token, token_repo=self._verification_token_repo, read_repo=self._read_repo
        )
        return InviteLookupResponse(email=user_doc["email"])
