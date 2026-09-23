import { describe, expect, it } from "vitest";
import {
  canChangeRole,
  canLeave,
  canModerate,
  canPost,
  canRemove,
  canView,
  communityCopyError,
  communitySlugError,
  inviteExpiry,
  inviteIsUsable,
  joinOutcome,
  slugifyCommunity,
  type MembershipLike,
} from "./communities";

const active = (role: MembershipLike["role"]): MembershipLike => ({ role, status: "ACTIVE" });
const pending: MembershipLike = { role: "MEMBER", status: "PENDING" };
const removed: MembershipLike = { role: "MEMBER", status: "REMOVED" };

describe("canView", () => {
  it("shows public communities to any signed-in user", () => {
    expect(canView("PUBLIC", null, true)).toBe(true);
    expect(canView("PUBLIC", removed, true)).toBe(true);
  });

  it("hides every community from signed-out visitors", () => {
    expect(canView("PUBLIC", null, false)).toBe(false);
    expect(canView("PRIVATE", active("OWNER"), false)).toBe(false);
  });

  it("shows private communities to active members only", () => {
    expect(canView("PRIVATE", active("MEMBER"), true)).toBe(true);
    expect(canView("PRIVATE", pending, true)).toBe(false);
    expect(canView("PRIVATE", removed, true)).toBe(false);
    expect(canView("PRIVATE", null, true)).toBe(false);
  });
});

describe("canPost / canModerate", () => {
  it("lets any active member post", () => {
    expect(canPost(active("MEMBER"))).toBe(true);
    expect(canPost(active("OWNER"))).toBe(true);
    expect(canPost(pending)).toBe(false);
    expect(canPost(removed)).toBe(false);
    expect(canPost(null)).toBe(false);
  });

  it("lets only active owners and admins moderate", () => {
    expect(canModerate(active("OWNER"))).toBe(true);
    expect(canModerate(active("ADMIN"))).toBe(true);
    expect(canModerate(active("MEMBER"))).toBe(false);
    expect(canModerate({ role: "ADMIN", status: "REMOVED" })).toBe(false);
    expect(canModerate(undefined)).toBe(false);
  });
});

describe("canRemove", () => {
  it("never removes the owner", () => {
    expect(canRemove("OWNER", "OWNER")).toBe(false);
    expect(canRemove("ADMIN", "OWNER")).toBe(false);
  });

  it("lets the owner remove admins and members", () => {
    expect(canRemove("OWNER", "ADMIN")).toBe(true);
    expect(canRemove("OWNER", "MEMBER")).toBe(true);
  });

  it("lets admins remove members but not other admins", () => {
    expect(canRemove("ADMIN", "MEMBER")).toBe(true);
    expect(canRemove("ADMIN", "ADMIN")).toBe(false);
  });

  it("gives members no removal power", () => {
    expect(canRemove("MEMBER", "MEMBER")).toBe(false);
  });
});

describe("canChangeRole", () => {
  it("is owner-only and never touches the owner row", () => {
    expect(canChangeRole("OWNER", "MEMBER")).toBe(true);
    expect(canChangeRole("OWNER", "ADMIN")).toBe(true);
    expect(canChangeRole("OWNER", "OWNER")).toBe(false);
    expect(canChangeRole("ADMIN", "MEMBER")).toBe(false);
    expect(canChangeRole("MEMBER", "MEMBER")).toBe(false);
  });
});

describe("canLeave", () => {
  it("keeps the owner in and lets others leave", () => {
    expect(canLeave(active("OWNER"))).toBe(false);
    expect(canLeave(active("ADMIN"))).toBe(true);
    expect(canLeave(pending)).toBe(true);
    expect(canLeave(removed)).toBe(false);
    expect(canLeave(null)).toBe(false);
  });
});

describe("joinOutcome", () => {
  it("joins open public communities directly", () => {
    expect(joinOutcome("PUBLIC", false, false)).toBe("ACTIVE");
  });

  it("queues a request when approval is required or the room is private", () => {
    expect(joinOutcome("PUBLIC", true, false)).toBe("PENDING");
    expect(joinOutcome("PRIVATE", false, false)).toBe("PENDING");
    expect(joinOutcome("PRIVATE", true, false)).toBe("PENDING");
  });

  it("lets an invite bypass approval", () => {
    expect(joinOutcome("PRIVATE", true, true)).toBe("ACTIVE");
    expect(joinOutcome("PUBLIC", true, true, "PENDING")).toBe("ACTIVE");
  });

  it("keeps removed members out unless invited", () => {
    expect(joinOutcome("PUBLIC", false, false, "REMOVED")).toBe("DENIED");
    expect(joinOutcome("PUBLIC", false, true, "REMOVED")).toBe("ACTIVE");
  });

  it("leaves existing members and pending requests unchanged", () => {
    expect(joinOutcome("PUBLIC", false, false, "ACTIVE")).toBe("UNCHANGED");
    expect(joinOutcome("PUBLIC", false, true, "ACTIVE")).toBe("UNCHANGED");
    expect(joinOutcome("PUBLIC", true, false, "PENDING")).toBe("UNCHANGED");
  });
});

describe("invites", () => {
  it("expire seven days after creation", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const expires = inviteExpiry(now);
    expect(expires.toISOString()).toBe("2026-09-08T00:00:00.000Z");
    expect(inviteIsUsable({ expiresAt: expires }, new Date("2026-09-07T23:59:59Z"))).toBe(true);
    expect(inviteIsUsable({ expiresAt: expires }, new Date("2026-09-08T00:00:00Z"))).toBe(false);
    expect(inviteIsUsable(null, now)).toBe(false);
  });
});

describe("community slugs", () => {
  it("slugifies names", () => {
    expect(slugifyCommunity("  Global Macro Desk! ")).toBe("global-macro-desk");
    expect(slugifyCommunity("Crème --- Brûlée")).toBe("creme-brulee");
  });

  it("validates slugs", () => {
    expect(communitySlugError("gex-research")).toBeNull();
    expect(communitySlugError("ab")).not.toBeNull();
    expect(communitySlugError("join")).not.toBeNull();
    expect(communitySlugError("bad--slug")).not.toBeNull();
    expect(communitySlugError("Upper")).not.toBeNull();
  });
});

describe("communityCopyError", () => {
  it("passes research-room copy", () => {
    expect(communityCopyError(["GEX research", "Methods and post-mortems.", null])).toBeNull();
  });

  it("rejects compliance and signal language", () => {
    expect(communityCopyError(["Sure shot calls", "Guaranteed"])).toContain("sure shot");
    expect(communityCopyError(["VIP group", "", undefined])).toContain("vip group");
  });
});
