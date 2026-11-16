"use client";

import dynamic from "next/dynamic";
import {
  Component,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Mode } from "@/lib/games/precise-stop/route";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

type GameText = Dictionary["preciseStop"];

type ExperienceValue = {
  locale: Locale;
  text: GameText;
  nav: Dictionary["nav"];
  start(mode: Mode): void;
};

const ExperienceContext = createContext<ExperienceValue | null>(null);

export function useExperience(): ExperienceValue {
  const value = useContext(ExperienceContext);
  if (!value) throw new Error("useExperience 必須用在 <Experience> 裡面");
  return value;
}

export const BOARD_ID = "departure-board";

/* 遊戲畫面（含 Phaser）按下出發才載入，介紹頁本身保持輕量 */
const GameStage = dynamic(() => import("./game/GameStage"), {
  ssr: false,
  loading: () => <StageMessage />,
});

function StageMessage({ children }: { children?: ReactNode }) {
  return (
    <div
      data-game-stage
      className="on-dark fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-canvas p-6 text-center text-white"
    >
      {children ?? (
        <span className="ps-spinner size-10 rounded-full border-4 border-white/20 border-t-edge" role="status" />
      )}
    </div>
  );
}

/** 遊戲程式下載失敗（例如網路中斷）時顯示重試，不會白畫面 */
class StageBoundary extends Component<
  { text: GameText; onRetry(): void; onBack(): void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { text } = this.props;
    return (
      <StageMessage>
        <div role="alert" data-testid="game-error" className="flex flex-col items-center gap-3">
          <p className="text-xl font-extrabold">{text.stage.errorTitle}</p>
          <p className="text-[#c9cfd8]">{text.stage.errorBody}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                this.setState({ failed: false });
                this.props.onRetry();
              }}
              className="press min-h-12 cursor-pointer rounded-full bg-express px-8 text-lg font-bold"
            >
              {text.stage.retry}
            </button>
            <button
              type="button"
              onClick={this.props.onBack}
              className="min-h-12 cursor-pointer rounded-full px-6 font-bold ring-2 ring-inset ring-white/60"
            >
              {text.stage.back}
            </button>
          </div>
        </div>
      </StageMessage>
    );
  }
}

/**
 * 介紹頁與遊戲畫面的切換。同一個網址：平常顯示介紹頁（children），
 * 按下出發後整頁換成遊戲畫面。
 */
export function Experience({
  locale,
  text,
  nav,
  children,
}: {
  locale: Locale;
  text: GameText;
  nav: Dictionary["nav"];
  children: ReactNode;
}) {
  const [playing, setPlaying] = useState<{ mode: Mode; key: number } | null>(null);

  const start = useCallback((mode: Mode) => {
    setPlaying((current) => current ?? { mode, key: Date.now() });
  }, []);

  const exit = useCallback((scrollToBoard: boolean) => {
    setPlaying(null);
    // 等介紹頁重新顯示後再捲動
    requestAnimationFrame(() => {
      if (scrollToBoard) document.getElementById(BOARD_ID)?.scrollIntoView({ block: "center" });
      else window.scrollTo({ top: 0 });
    });
  }, []);

  const value = useMemo(() => ({ locale, text, nav, start }), [locale, text, nav, start]);

  return (
    <ExperienceContext.Provider value={value}>
      {children}
      {playing && (
        <StageBoundary
          key={playing.key}
          text={text}
          onRetry={() => setPlaying({ mode: playing.mode, key: Date.now() })}
          onBack={() => exit(false)}
        >
          <GameStage mode={playing.mode} locale={locale} text={text} onExit={exit} />
        </StageBoundary>
      )}
    </ExperienceContext.Provider>
  );
}
