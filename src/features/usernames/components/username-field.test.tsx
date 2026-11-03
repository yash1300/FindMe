import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsernameField } from "./username-field";

const fetchMock = vi.fn();

function respond(body: unknown, ok = true) {
  fetchMock.mockResolvedValue({ ok, json: async () => body });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const setup = () => {
  render(<UsernameField baseUrl="https://app.example.test" />);
  return { user: userEvent.setup(), input: screen.getByLabelText("Username") };
};

describe("UsernameField", () => {
  it("shows the page URL using the configured host, not a hardcoded one", async () => {
    const { user, input } = setup();
    respond({ available: true });
    await user.type(input, "Asha");
    expect(screen.getByText("app.example.test/asha")).toBeInTheDocument();
  });

  it("reports an available name", async () => {
    const { user, input } = setup();
    respond({ available: true });
    await user.type(input, "asha");
    expect(await screen.findByText("Available")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/usernames/check?username=asha", expect.anything());
  });

  it("reports a taken name as an error linked to the input", async () => {
    const { user, input } = setup();
    respond({ available: false, reason: "taken" });
    await user.type(input, "asha");
    expect(await screen.findByText("This username isn't available.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("validates format locally without calling the server", async () => {
    const { user, input } = setup();
    await user.type(input, "no spaces");
    expect(screen.getByText(/Use letters, numbers/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a reserved name locally", async () => {
    const { user, input } = setup();
    await user.type(input, "admin");
    expect(screen.getByText("This username isn't available.")).toBeInTheDocument();
  });

  it("debounces typing into a single request", async () => {
    const { user, input } = setup();
    respond({ available: true });
    await user.type(input, "ashakumar");
    await screen.findByText("Available");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a server error for the submitted value, until the user edits the field", async () => {
    respond({ available: true });
    const message = "You changed your username recently.";
    const { rerender } = render(<UsernameField baseUrl="https://app.example.test" defaultValue="asha" />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Username");
    await user.clear(input);
    await user.type(input, "ashakumar");

    rerender(<UsernameField baseUrl="https://app.example.test" defaultValue="asha" error={message} />);
    expect(screen.getByText(message)).toBeInTheDocument();

    await user.type(input, "x");
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it("does not claim availability when the check fails", async () => {
    const { user, input } = setup();
    respond({}, false);
    await user.type(input, "asha");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Available")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid");
  });
});
