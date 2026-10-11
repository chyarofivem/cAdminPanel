import React, { useState } from "react";
import { useTranslate } from "react-polyglot";
import { useNuiEvent } from "../../hooks/useNuiEvent";

/**
 * The player-facing warning. A modal card over a dark backdrop, with the warning
 * as a danger callout. Pulses play a sound and update the countdown; nothing
 * bounces or flashes.
 */
interface WarnInnerProps {
  message: string;
  warnedBy: string;
  isWarningNew: boolean;
  secsRemaining: number;
  resetCounter: number;
}

const WarnInner: React.FC<WarnInnerProps> = ({
  message,
  warnedBy,
  isWarningNew,
  secsRemaining,
  resetCounter,
}) => {
  const t = useTranslate();
  //The instruction grows a little each time the player releases the key early.
  const instructionFontSize = Math.min(18, 14 + resetCounter);

  const [iHead, iTail] = t("nui_warning.instruction", {
    key: "%R%",
    smart_count: secsRemaining,
  }).split("%R%", 2);

  return (
    <>
      <div className="warn-card" role="alertdialog" aria-labelledby="warn-title" aria-describedby="warn-message">
        <div className="callout callout-danger">
          <h1 id="warn-title" className="warn-title">{t("nui_warning.title")}</h1>
          <p id="warn-message" className="warn-message">{message}</p>
          <p className="warn-meta">{t("nui_warning.warned_by")} {warnedBy}</p>
          {!isWarningNew && (
            <p className="warn-meta" style={{ marginTop: 4, color: "var(--warning-text)" }}>
              {t("nui_warning.stale_message")}
            </p>
          )}
        </div>
      </div>
      <p className="warn-instruction tabular" style={{ fontSize: instructionFontSize }} aria-live="polite">
        {iHead} <kbd className="kbd" style={{ fontSize: "0.85em" }}>{t("nui_warning.dismiss_key")}</kbd> {iTail}
      </p>
    </>
  );
};


export interface SetWarnOpenData {
  reason: string;
  warnedBy: string;
  isWarningNew: boolean;
}

const pulseSound = new Audio("sounds/warning_pulse.mp3");
const openSound = new Audio("sounds/warning_open.mp3");

export const WarnPage: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [warnData, setWarnData] = useState<SetWarnOpenData | null>(null);
  const [secsRemaining, setSecsRemaining] = useState(10);
  const [resetCounter, setResetCounter] = useState(0);

  useNuiEvent<SetWarnOpenData>("setWarnOpen", (warnData) => {
    setWarnData(warnData);
    setSecsRemaining(10);
    setResetCounter(0);
    setIsOpen(true);
    openSound.play();
  });

  useNuiEvent<number>("pulseWarning", (secsRemaining) => {
    setSecsRemaining(secsRemaining);
    pulseSound.play();
  });

  useNuiEvent("resetWarning", () => {
    setSecsRemaining(10);
    setResetCounter((prev) => prev + 1);
    pulseSound.pause();
    pulseSound.currentTime = 0;
    openSound.pause();
    openSound.currentTime = 0;
    openSound.play();
  });

  useNuiEvent("closeWarning", () => {
    setIsOpen(false);
    pulseSound.play();
  });

  return (
    <div className={isOpen ? "warn-overlay" : "warn-overlay is-hidden"} aria-hidden={!isOpen}>
      {warnData && (
        <WarnInner
          message={warnData.reason}
          warnedBy={warnData.warnedBy}
          isWarningNew={warnData.isWarningNew}
          secsRemaining={secsRemaining}
          resetCounter={resetCounter}
        />
      )}
    </div>
  );
};
