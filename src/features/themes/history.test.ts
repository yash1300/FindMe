import { describe, expect, it } from "vitest";
import { applyEdit, createHistory, redo, undo } from "./history";

describe("theme history", () => {
  it("undoes and redoes edits in order", () => {
    let history = createHistory("a");
    history = applyEdit(history, "b");
    history = applyEdit(history, "c");
    history = undo(history);
    expect(history.present).toBe("b");
    history = undo(history);
    expect(history.present).toBe("a");
    history = redo(history);
    expect(history.present).toBe("b");
    history = redo(history);
    expect(history.present).toBe("c");
  });

  it("does nothing when there's nothing to undo or redo", () => {
    const history = createHistory("a");
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it("clears redo after a new edit", () => {
    let history = applyEdit(createHistory("a"), "b");
    history = undo(history);
    history = applyEdit(history, "c");
    expect(history.future).toEqual([]);
    expect(redo(history)).toBe(history);
  });

  it("merges edits with the same key into one undo step", () => {
    let history = createHistory("#000");
    for (const value of ["#111", "#222", "#333"]) history = applyEdit(history, value, "text-colour");
    expect(history.past).toEqual(["#000"]);
    expect(undo(history).present).toBe("#000");
  });

  it("starts a new step when the key changes", () => {
    let history = applyEdit(createHistory("a"), "b", "one");
    history = applyEdit(history, "c", "two");
    expect(history.past).toEqual(["a", "b"]);
  });

  it("keeps edits after an undo in a separate step, even with the same key", () => {
    let history = applyEdit(createHistory("a"), "b", "one");
    history = undo(history);
    history = applyEdit(history, "c", "one");
    expect(history.past).toEqual(["a"]);
  });

  it("limits how much history it keeps", () => {
    let history = createHistory(0);
    for (let value = 1; value <= 150; value += 1) history = applyEdit(history, value);
    expect(history.past).toHaveLength(100);
    expect(history.present).toBe(150);
  });
});
