import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../ErrorBoundary";

// Component that throws on render
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error("Test render error");
  return <div>Normal content</div>;
};

describe("ErrorBoundary", () => {
  // Suppress console.error from React's error boundary logging
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Hello Hub</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Hello Hub")).toBeInTheDocument();
  });

  it("shows fallback UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
    expect(screen.getByText("Test render error")).toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
    expect(screen.getByText("Voltar ao Hub")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error UI")).toBeInTheDocument();
  });

  it("retry button resets error state", async () => {
    let shouldThrow = true;

    const ConditionalThrower = () => {
      if (shouldThrow) throw new Error("Conditional error");
      return <div>Recovered</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();

    // Fix the error condition
    shouldThrow = false;

    // Click retry
    const user = userEvent.setup();
    await user.click(screen.getByText("Tentar novamente"));

    // Re-render to trigger the reset
    rerender(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );
  });
});
