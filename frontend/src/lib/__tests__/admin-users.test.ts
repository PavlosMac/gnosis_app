import { describe, expect, it } from "vitest";
import { mapAdminUserResponse, type AdminUserResponse } from "@/types/auth";

const ROW: AdminUserResponse = {
  _id: "64b7f0c2e4b0a1b2c3d4e5f6",
  email: "guest@example.com",
  display_name: null,
  status: "invited",
  credits: 0,
  is_superadmin: false,
  created_at: "2026-10-24T10:00:00Z",
  updated_at: "2026-10-24T10:00:00Z",
};

describe("mapAdminUserResponse", () => {
  it("reads the id from the backend's _id alias, so row actions have a target", () => {
    const user = mapAdminUserResponse(ROW);
    expect(user.id).toBe("64b7f0c2e4b0a1b2c3d4e5f6");
    expect(user.status).toBe("invited");
    expect(user.displayName).toBeNull();
    expect(user.isSuperadmin).toBe(false);
  });

  it("treats a missing status as active, like every other reader", () => {
    const { status: _omitted, ...withoutStatus } = ROW;
    expect(mapAdminUserResponse(withoutStatus).status).toBe("active");
  });
});
