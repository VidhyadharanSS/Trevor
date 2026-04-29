/**
 * Trevor — Error Boundary
 *
 * Catches React render errors and displays them on screen
 * instead of unmounting to a black screen.
 */

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Trevor] React error:", error);
    console.error("[Trevor] Component stack:", errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            width: "100vw",
            background: "#0f0f0f",
            color: "#e4e4e7",
            padding: "40px 24px",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            overflowY: "auto",
            boxSizing: "border-box",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px",
                background: "rgba(239, 68, 68, 0.12)",
                color: "#fca5a5",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 16,
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              ⚠ Render Error
            </div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                marginBottom: 8,
                color: "#f4f4f5",
              }}
            >
              Trevor crashed while rendering
            </h1>
            <p style={{ color: "#a1a1aa", marginBottom: 20, fontSize: 14 }}>
              The app caught an unexpected error. The details below should help
              diagnose the issue.
            </p>

            <div
              style={{
                background: "#18181b",
                border: "1px solid #2e2e32",
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 13,
                color: "#fca5a5",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {this.state.error?.toString()}
            </div>

            {this.state.error?.stack && (
              <details
                style={{
                  background: "#18181b",
                  border: "1px solid #2e2e32",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    color: "#a1a1aa",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Stack trace
                </summary>
                <pre
                  style={{
                    marginTop: 12,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 12,
                    color: "#d4d4d8",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.5,
                  }}
                >
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            {this.state.errorInfo?.componentStack && (
              <details
                style={{
                  background: "#18181b",
                  border: "1px solid #2e2e32",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    color: "#a1a1aa",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Component stack
                </summary>
                <pre
                  style={{
                    marginTop: 12,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 12,
                    color: "#d4d4d8",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.5,
                  }}
                >
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={this.reset}
                style={{
                  padding: "8px 16px",
                  background: "#6366f1",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("trevor:vaultPath");
                  window.location.reload();
                }}
                style={{
                  padding: "8px 16px",
                  background: "#232326",
                  color: "#e4e4e7",
                  border: "1px solid #2e2e32",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Reset & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
