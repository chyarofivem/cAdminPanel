import React, { type ReactNode } from "react";
import { PlayerModalHasError } from "./PlayerModalHasError";

interface PlayerErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class PlayerModalErrorBoundary extends React.Component<
  { children: ReactNode },
  PlayerErrorBoundaryState
> {
  public state = {
    hasError: false,
    errorMessage: "Unknown Error Occurred",
  };

  public constructor(props: { children: ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): PlayerErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  render() {
    if (this.state.hasError) {
      return <PlayerModalHasError msg={this.state.errorMessage} />;
    }

    return this.props.children;
  }
}
