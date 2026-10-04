import { afterEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const initialPassword = process.env.SAUL_MOT_DE_PASSE;
const initialOnline = process.env.SAUL_EN_LIGNE;
afterEach(() => {
  if (initialPassword === undefined) delete process.env.SAUL_MOT_DE_PASSE;
  else process.env.SAUL_MOT_DE_PASSE = initialPassword;
  if (initialOnline === undefined) delete process.env.SAUL_EN_LIGNE;
  else process.env.SAUL_EN_LIGNE = initialOnline;
});
const request = (authorization?: string) => new NextRequest("https://saul.example/api/harness/projects", {
  headers: authorization ? { authorization } : {},
});

test("la version en ligne sans mot de passe reste fermée", () => {
  process.env.SAUL_EN_LIGNE = "1";
  delete process.env.SAUL_MOT_DE_PASSE;
  expect(proxy(request()).status).toBe(503);
});
test("le mode local sans mot de passe reste accessible", () => {
  delete process.env.SAUL_EN_LIGNE;
  delete process.env.SAUL_MOT_DE_PASSE;
  expect(proxy(request()).headers.get("x-middleware-next")).toBe("1");
});
test("les identifiants absents, erronés ou mal formés sont refusés", () => {
  process.env.SAUL_MOT_DE_PASSE = "mot:de:passe";
  for (const header of [undefined, "Basic !!!", `Basic ${btoa("saul:incorrect")}`, `Basic ${btoa("mot:de:passe")}`]) {
    const response = proxy(request(header));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
  }
});
test("le mot de passe correct ouvre les API, y compris avec des deux-points", () => {
  process.env.SAUL_MOT_DE_PASSE = "mot:de:passe";
  expect(proxy(request(`Basic ${btoa("saul:mot:de:passe")}`)).headers.get("x-middleware-next")).toBe("1");
});
