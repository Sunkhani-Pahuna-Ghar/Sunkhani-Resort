import { cleanEmail, cleanLine, cleanMultiline } from "./text.util";

describe("cleanLine", () => {
  it("removes control characters and new lines, collapses spaces", () => {
    expect(cleanLine("  Sita\r\nBcc: evil@x.com  Devi\u0000 ")).toBe("Sita Bcc: evil@x.com Devi");
  });
  it("leaves non-strings alone so validation can reject them", () => {
    expect(cleanLine(42)).toBe(42);
    expect(cleanLine({ a: 1 })).toEqual({ a: 1 });
    expect(cleanLine(undefined)).toBeUndefined();
  });
  it("keeps Nepali text", () => {
    expect(cleanLine("  नमस्ते  सुनखानी ")).toBe("नमस्ते सुनखानी");
  });
});

describe("cleanMultiline", () => {
  it("keeps new lines but drops other control characters", () => {
    expect(cleanMultiline("line1\r\nline2\u0007\n\tline3")).toBe("line1\nline2\n\tline3");
  });
});

describe("cleanEmail", () => {
  it("lowercases and trims", () => {
    expect(cleanEmail("  Foo@Example.COM ")).toBe("foo@example.com");
  });
});
