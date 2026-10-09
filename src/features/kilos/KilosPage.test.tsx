import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import type { Proposal } from "../../services/types";
import { deferred, fakeBackend, proposal } from "../../test/fakeBackend";

const irisState = () => screen.getByTestId("iris-companion").getAttribute("data-iris-state");

describe("Kilos approval", () => {
  beforeEach(() => {
    window.location.hash = "#/kilos";
  });

  it("nothing is approved until the user says Yes; success only after the backend confirms", async () => {
    const approveD = deferred<Proposal>();
    const backend = fakeBackend({
      propose: vi.fn(async () => proposal()),
      approve: vi.fn(() => approveD.promise),
    });
    render(<App backend={backend} startup={false} />);
    await userEvent.type(screen.getByLabelText("What should MAT-AH organize?"), "Ipunin enrollment");
    await userEvent.click(screen.getByRole("button", { name: "Make a plan" }));
    expect(await screen.findByText("Waiting for your approval")).toBeInTheDocument();
    expect(irisState()).toBe("waiting-for-approval");

    await userEvent.click(screen.getByRole("button", { name: /Review and approve 2/ }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Are you sure?");
    // Safe default: focus starts on "No".
    expect(screen.getByRole("button", { name: /^No$/ })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(backend.approve).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Review and approve 2/ }));
    await userEvent.click(screen.getByRole("button", { name: /Yes, go ahead/ }));
    expect(backend.approve).toHaveBeenCalledWith(7, [1, 2]);
    expect(screen.queryByText(/Done./)).not.toBeInTheDocument();
    expect(irisState()).not.toBe("success");

    approveD.resolve({ ...proposal("approved"), log: [
      { id: 1, proposal_id: 7, op: "mkdir", src: null, dst: "C:\\Docs\\Enrollment", status: "done", error: null, done_at: "" },
      { id: 2, proposal_id: 7, op: "move", src: "C:\\Docs\\a.pdf", dst: "C:\\Docs\\Enrollment\\a.pdf", status: "done", error: null, done_at: "" },
      { id: 3, proposal_id: 7, op: "move", src: "C:\\Docs\\b.pdf", dst: "C:\\Docs\\Enrollment\\b.pdf", status: "done", error: null, done_at: "" },
    ] });
    expect(await screen.findByText(/Done. 2 items moved/)).toBeInTheDocument();
    await waitFor(() => expect(irisState()).toBe("success"));
  });

  it("unchecking a file excludes it from the approval", async () => {
    const backend = fakeBackend({ propose: vi.fn(async () => proposal()), approve: vi.fn(() => new Promise<Proposal>(() => {})) });
    render(<App backend={backend} startup={false} />);
    await userEvent.type(screen.getByLabelText("What should MAT-AH organize?"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Make a plan" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /b\.pdf/ }));
    await userEvent.click(screen.getByRole("button", { name: /Review and approve 1/ }));
    await userEvent.click(screen.getByRole("button", { name: /Yes, go ahead/ }));
    expect(backend.approve).toHaveBeenCalledWith(7, [1]);
  });

  it("declining tells the backend and clears the approval state", async () => {
    const backend = fakeBackend({ propose: vi.fn(async () => proposal()), decline: vi.fn(async () => proposal("declined")) });
    render(<App backend={backend} startup={false} />);
    await userEvent.type(screen.getByLabelText("What should MAT-AH organize?"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Make a plan" }));
    await userEvent.click(await screen.findByRole("button", { name: /Huwag · Cancel/ }));
    expect(backend.decline).toHaveBeenCalledWith(7);
    expect(await screen.findByText(/Cancelled · nothing changed/)).toBeInTheDocument();
    expect(irisState()).toBe("idle");
  });
});
