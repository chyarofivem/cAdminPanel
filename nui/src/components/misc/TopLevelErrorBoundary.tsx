import { Component, type ReactNode } from "react";
import { fetchNui } from "../../utils/fetchNui";

interface ErrorCompState {
  hasError: boolean;
  error: Error | null;
}

type ErrorBoundaryProps = { children: ReactNode };

/**
 * Last-resort screen. It cannot rely on providers or translations, so it renders
 * plain markup with the menu's modal classes.
 */
export class TopLevelErrorBoundary extends Component<ErrorBoundaryProps, ErrorCompState> {
  state: ErrorCompState = {
    hasError: false,
    error: null,
  };

  componentDidUpdate() {
    if (this.state.hasError) fetchNui("focusInputs", true);
  }

  static getDerivedStateFromError(error: Error): ErrorCompState {
    return { hasError: true, error };
  }

  handleReloadClick = () => {
    fetchNui("focusInputs", false);
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-labelledby="fatal-error-title">
            <div className="modal-header">
              <div>
                <h2 id="fatal-error-title" className="modal-title">The menu stopped working</h2>
                <p className="modal-description">
                  Reload the menu to continue. The error below is for developers.
                </p>
              </div>
            </div>
            <div className="modal-body">
              <div className="row row-copy">
                <code>{this.state.error?.message ?? "Unknown error"}</code>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-primary" onClick={this.handleReloadClick}>
                Reload menu
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
