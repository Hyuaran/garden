/**
 * leaf-supabase-mock の動作確認テスト。
 * mock が正しく構成され、テスト側から spy / 応答制御できることを検証。
 */
import { describe, it, expect, vi } from "vitest";
import {
  createStorageBucketMock,
  createStorageMock,
  createAuthMock,
  createLeafRpcMock,
  createLeafSupabaseMock,
} from "../leaf-supabase-mock";

describe("createStorageBucketMock", () => {
  it("provides 5 bucket methods that resolve with default null", async () => {
    const bucket = createStorageBucketMock();
    expect(await bucket.upload("path", new Blob())).toEqual({
      data: null,
      error: null,
    });
    expect(await bucket.createSignedUrl("path", 600)).toEqual({
      data: null,
      error: null,
    });
    expect(await bucket.createSignedUrls(["a", "b"], 600)).toEqual({
      data: null,
      error: null,
    });
    expect(await bucket.remove(["a"])).toEqual({ data: null, error: null });
    expect(await bucket.list()).toEqual({ data: null, error: null });
  });

  it("allows overriding upload response", async () => {
    const bucket = createStorageBucketMock();
    bucket.upload.mockResolvedValueOnce({
      data: { path: "case/x.jpg" },
      error: null,
    });
    const result = await bucket.upload("case/x.jpg", new Blob());
    expect(result.data).toEqual({ path: "case/x.jpg" });
  });
});

describe("createStorageMock", () => {
  it("from() returns the same bucket instance for spy continuity", () => {
    const { storage, bucket } = createStorageMock();
    const b1 = storage.from("bucket-a");
    const b2 = storage.from("bucket-b");
    expect(b1).toBe(bucket);
    expect(b2).toBe(bucket);
    expect(storage.from).toHaveBeenCalledTimes(2);
  });
});

describe("createAuthMock", () => {
  it("getUser default is unauthenticated", async () => {
    const auth = createAuthMock();
    const result = await auth.getUser();
    expect(result.data.user).toBeNull();
  });

  it("can be overridden to authenticated", async () => {
    const auth = createAuthMock();
    auth.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const result = await auth.getUser();
    expect(result.data.user).toEqual({ id: "u1" });
  });
});

describe("createLeafRpcMock", () => {
  it("returns default responses for known Leaf RPCs", async () => {
    const { rpc } = createLeafRpcMock();
    expect((await rpc("garden_role_of", { uid: "x" })).data).toBe(
      "super_admin",
    );
    expect((await rpc("leaf_user_in_business", { biz_id: "kanden" })).data).toBe(
      true,
    );
    expect((await rpc("is_user_active")).data).toBe(true);
    expect(
      (await rpc("verify_image_download_password", { input_password: "x" }))
        .data,
    ).toBe(true);
  });

  it("setRoleResponse changes garden_role_of result", async () => {
    const { rpc, setRoleResponse } = createLeafRpcMock();
    setRoleResponse("toss");
    expect((await rpc("garden_role_of", { uid: "x" })).data).toBe("toss");
  });

  it("setBusinessResponse changes leaf_user_in_business result", async () => {
    const { rpc, setBusinessResponse } = createLeafRpcMock();
    setBusinessResponse(false);
    expect((await rpc("leaf_user_in_business", { biz_id: "kanden" })).data).toBe(
      false,
    );
  });

  it("setUserActiveResponse changes is_user_active result", async () => {
    const { rpc, setUserActiveResponse } = createLeafRpcMock();
    setUserActiveResponse(false);
    expect((await rpc("is_user_active")).data).toBe(false);
  });

  it("setVerifyPasswordResponse changes verify_image_download_password", async () => {
    const { rpc, setVerifyPasswordResponse } = createLeafRpcMock();
    setVerifyPasswordResponse(false);
    expect(
      (await rpc("verify_image_download_password", { input_password: "x" }))
        .data,
    ).toBe(false);
  });

  it("returns error for unknown RPC", async () => {
    const { rpc } = createLeafRpcMock();
    const result = await rpc("unknown_function");
    expect(result.error).not.toBeNull();
  });
});

describe("createLeafSupabaseMock (composite)", () => {
  it("exposes client / bucket / auth / rpc / helpers", () => {
    const mock = createLeafSupabaseMock();
    expect(mock.client.storage).toBeDefined();
    expect(mock.client.auth).toBeDefined();
    expect(mock.client.rpc).toBeDefined();
    expect(mock.bucket).toBeDefined();
    expect(mock.auth).toBeDefined();
    expect(mock.helpers.setRoleResponse).toBeInstanceOf(Function);
  });

  it("helpers.setRoleResponse propagates to rpc", async () => {
    const mock = createLeafSupabaseMock();
    mock.helpers.setRoleResponse("manager");
    const result = await mock.client.rpc("garden_role_of", { uid: "x" });
    expect(result.data).toBe("manager");
  });
});
